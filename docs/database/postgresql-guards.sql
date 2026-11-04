-- Focused PostgreSQL guards for the DBML design. Load after the exported schema
-- and postgresql-supplement.sql. No production database is targeted by validation.
-- External authentication/signature verification and gameplay stay in NestJS.
CREATE SCHEMA sahsah_internal;
REVOKE ALL ON SCHEMA sahsah_internal FROM PUBLIC;

CREATE FUNCTION sahsah_internal.invalidate_deletion_checkpoint(p_account uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
  UPDATE account_deletion_requests r
     SET state = 'requested', confirmed_bank = NULL, confirmed_at = NULL,
         funding_cleared_at = NULL, funding_review_audit_event_id = NULL,
         funding_changed_at = clock_timestamp()
    FROM accounts a
   WHERE r.account_id = p_account AND a.id = r.account_id
     AND a.state = 'deletion_pending' AND r.state IN ('requested', 'confirmed');
$$;

-- One write owner for the balance: append a ledger movement, then this constant-
-- cost projection updates the account. Never scan the entire ledger per write.
CREATE FUNCTION sahsah_internal.guard_bank_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.token_balance <> 0 THEN
    RAISE EXCEPTION 'new accounts must start with zero tokens; insert a sourced ledger credit'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND
     ROW(NEW.token_balance, NEW.token_balance_updated_at) IS DISTINCT FROM
     ROW(OLD.token_balance, OLD.token_balance_updated_at) AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'token balance is owned by the ledger projection'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER accounts_bank_write BEFORE INSERT OR UPDATE ON accounts
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_bank_write();

CREATE FUNCTION sahsah_internal.reject_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'token ledger is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER token_ledger_append_only BEFORE UPDATE OR DELETE ON token_ledger_entries
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.reject_ledger_mutation();

CREATE FUNCTION sahsah_internal.project_token_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  UPDATE accounts SET token_balance = token_balance + NEW.amount,
         token_balance_updated_at = clock_timestamp() WHERE id = NEW.account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'token movement account does not exist' USING ERRCODE = '23503';
  END IF;
  IF NEW.amount > 0 THEN
    PERFORM sahsah_internal.invalidate_deletion_checkpoint(NEW.account_id);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER token_ledger_project AFTER INSERT ON token_ledger_entries
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.project_token_movement();

CREATE FUNCTION sahsah_internal.guard_order_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a accounts%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO STRICT a FROM accounts WHERE id = NEW.buyer_account_id FOR NO KEY UPDATE;
    IF a.state <> 'active' THEN
      RAISE EXCEPTION 'new checkout requires an active buyer' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF ROW(NEW.id, NEW.buyer_account_id, NEW.order_kind, NEW.token_quantity,
           NEW.purchase_channel, NEW.store_product_id, NEW.idempotency_key,
           NEW.request_digest, NEW.created_at, NEW.currency, NEW.pricing_version,
           NEW.price_tier_minimum_quantity, NEW.base_unit_price_minor,
           NEW.quantity_discount_bps, NEW.list_subtotal_minor,
           NEW.quantity_discount_minor, NEW.offer_subtotal_minor,
           NEW.additional_discount_kind, NEW.additional_discount_bps,
           NEW.applied_promotion_id, NEW.applied_promotion_trigger,
           NEW.additional_discount_minor, NEW.total_minor) IS DISTINCT FROM
       ROW(OLD.id, OLD.buyer_account_id, OLD.order_kind, OLD.token_quantity,
           OLD.purchase_channel, OLD.store_product_id, OLD.idempotency_key,
           OLD.request_digest, OLD.created_at, OLD.currency, OLD.pricing_version,
           OLD.price_tier_minimum_quantity, OLD.base_unit_price_minor,
           OLD.quantity_discount_bps, OLD.list_subtotal_minor,
           OLD.quantity_discount_minor, OLD.offer_subtotal_minor,
           OLD.additional_discount_kind, OLD.additional_discount_bps,
           OLD.applied_promotion_id, OLD.applied_promotion_trigger,
           OLD.additional_discount_minor, OLD.total_minor) THEN
      RAISE EXCEPTION 'accepted order intent and quote are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.beneficiary_account_id IS NOT NULL AND
       ROW(NEW.beneficiary_account_id, NEW.recipient_bound_at) IS DISTINCT FROM
       ROW(OLD.beneficiary_account_id, OLD.recipient_bound_at) THEN
      RAISE EXCEPTION 'bound order beneficiary cannot change' USING ERRCODE = '23514';
    END IF;
    IF OLD.settlement_kind IS NOT NULL AND
       ROW(NEW.settlement_kind, NEW.settled_at, NEW.payment_state,
           NEW.verified_paid_at, NEW.zero_total_accepted_at, NEW.native_verified_at,
           NEW.settlement_payment_transaction_id, NEW.settlement_payment_kind,
           NEW.settlement_verification_event_id, NEW.settlement_store_purchase_id)
       IS DISTINCT FROM
       ROW(OLD.settlement_kind, OLD.settled_at, OLD.payment_state,
           OLD.verified_paid_at, OLD.zero_total_accepted_at, OLD.native_verified_at,
           OLD.settlement_payment_transaction_id, OLD.settlement_payment_kind,
           OLD.settlement_verification_event_id, OLD.settlement_store_purchase_id) THEN
      RAISE EXCEPTION 'accepted settlement cannot be cleared or reassigned' USING ERRCODE = '23514';
    END IF;
    IF OLD.beneficiary_account_id IS NOT NULL AND
       NEW.recipient_phone_e164 IS DISTINCT FROM OLD.recipient_phone_e164 AND
       NOT (OLD.recipient_phone_redacted_at IS NULL AND NEW.recipient_phone_redacted_at IS NOT NULL
            AND NEW.recipient_phone_e164 IS NULL) THEN
      RAISE EXCEPTION 'bound gift phone permits redaction only' USING ERRCODE = '23514';
    END IF;
    IF OLD.gift_note_redacted_at IS NOT NULL AND
       ROW(NEW.gift_note_redacted_at,NEW.gift_note) IS DISTINCT FROM ROW(OLD.gift_note_redacted_at,OLD.gift_note) THEN
      RAISE EXCEPTION 'redacted gift note cannot be restored' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.beneficiary_account_id IS NOT NULL AND
     (TG_OP = 'INSERT' OR OLD.beneficiary_account_id IS NULL) THEN
    SELECT * INTO STRICT a FROM accounts WHERE id = NEW.beneficiary_account_id FOR NO KEY UPDATE;
    IF a.state <> 'active' THEN
      RAISE EXCEPTION 'new beneficiary binding requires an active account' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER token_orders_transition BEFORE INSERT OR UPDATE ON token_orders
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_order_transition();

-- Constraint triggers inspect final transaction rows, so valid source, bank and
-- completion writes can be committed together in any documented internal order.
CREATE FUNCTION sahsah_internal.check_order_funding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE o token_orders%ROWTYPE; e payment_events%ROWTYPE;
        t payment_transactions%ROWTYPE; p store_purchases%ROWTYPE;
BEGIN
  SELECT * INTO o FROM token_orders WHERE id = NEW.id;
  IF NOT FOUND OR o.settlement_kind IS NULL THEN RETURN NULL; END IF;
  -- A later refund/revocation must not erase the original accepted settlement.
  -- Recheck eligibility only when accepting funding or first binding a gift.
  IF TG_OP='UPDATE' AND OLD.settlement_kind IS NOT NULL
     AND OLD.beneficiary_account_id IS NOT DISTINCT FROM NEW.beneficiary_account_id THEN
    RETURN NULL;
  END IF;
  IF o.settlement_kind = 'payment' THEN
    SELECT * INTO STRICT t FROM payment_transactions
      WHERE id = o.settlement_payment_transaction_id FOR NO KEY UPDATE;
    SELECT * INTO STRICT e FROM payment_events
      WHERE id = o.settlement_verification_event_id;
    IF e.state <> 'processed' OR e.verification_method NOT IN ('hmac_callback','authenticated_inquiry')
       OR e.observed_payment_outcome IS DISTINCT FROM 'succeeded'
       OR t.last_verification_event_id IS DISTINCT FROM e.id
       OR t.last_verified_at IS DISTINCT FROM e.verified_at
       OR e.transaction_id IS DISTINCT FROM t.id OR e.attempt_id IS DISTINCT FROM t.attempt_id
       OR ROW(e.provider,e.environment,e.provider_namespace) IS DISTINCT FROM
          ROW(t.provider,t.environment,t.provider_namespace)
       OR t.order_id <> o.id OR t.transaction_kind NOT IN ('payment','capture')
       OR t.outcome <> 'succeeded' OR t.captured_minor <> t.amount_minor OR t.refunded_minor <> 0
       OR t.amount_minor <> o.total_minor OR t.currency <> o.currency
       OR NOT EXISTS (SELECT 1 FROM payment_attempts a WHERE a.id=t.attempt_id
                      AND t.integration_id=ANY(a.allowed_integration_ids)) THEN
      RAISE EXCEPTION 'order requires matching successful Paymob funding proof' USING ERRCODE = '23514';
    END IF;
  ELSIF o.settlement_kind = 'native_store' THEN
    SELECT * INTO STRICT p FROM store_purchases
      WHERE id = o.settlement_store_purchase_id FOR NO KEY UPDATE;
    SELECT * INTO STRICT e FROM payment_events WHERE id = o.settlement_verification_event_id;
    IF e.state <> 'processed' OR e.verification_method NOT IN ('apple_store_jws','google_play_api')
       OR e.observed_native_state IS DISTINCT FROM 'purchased'
       OR e.native_purchase_id IS DISTINCT FROM p.id OR p.state <> 'purchased'
       OR p.latest_verification_event_id IS DISTINCT FROM e.id
       OR e.observed_native_product_id IS DISTINCT FROM p.provider_product_id
       OR e.observed_native_units IS DISTINCT FROM p.purchased_units
       OR ROW(e.provider,e.environment,e.provider_namespace) IS DISTINCT FROM
          ROW(p.provider,p.environment,p.application_id) THEN
      RAISE EXCEPTION 'order requires a verified PURCHASED native financial proof, not a notification'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  IF o.applied_promotion_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM promo_usages u WHERE u.order_id=o.id
      AND u.promotion_id=o.applied_promotion_id AND u.state='consumed') THEN
    RAISE EXCEPTION 'accepted promotional order must consume its allowance atomically'
      USING ERRCODE='23514';
  END IF;
  IF o.beneficiary_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM token_ledger_entries l WHERE l.source_order_id = o.id
      AND l.account_id = o.beneficiary_account_id AND l.amount = o.token_quantity
      AND l.entry_kind = 'credit') THEN
    RAISE EXCEPTION 'bound accepted funding must credit its bank in the same transaction'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER token_orders_funding AFTER INSERT OR UPDATE ON token_orders
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sahsah_internal.check_order_funding();

CREATE FUNCTION sahsah_internal.guard_checkout_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE o token_orders%ROWTYPE; e payment_events%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO STRICT o FROM token_orders WHERE id = NEW.order_id FOR NO KEY UPDATE;
    IF o.purchase_channel <> 'paymob' OR o.total_minor IS NULL OR o.total_minor <= 0
       OR o.payment_state <> 'pending' OR o.settlement_kind IS NOT NULL THEN
      RAISE EXCEPTION 'Paymob attempt requires a positive pending website order' USING ERRCODE = '23514';
    END IF;
    PERFORM 1 FROM accounts WHERE id=o.buyer_account_id AND state='active' FOR NO KEY UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'new checkout attempt requires an active buyer' USING ERRCODE='23514';
    END IF;
    IF EXISTS (SELECT 1 FROM payment_attempts WHERE order_id = NEW.order_id
               AND state <> 'closed_unpaid') THEN
      RAISE EXCEPTION 'existing checkout must be resolved before another attempt' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF ROW(NEW.id,NEW.order_id,NEW.provider,NEW.environment,NEW.provider_namespace,
           NEW.configuration_key,NEW.request_key,NEW.special_reference,NEW.allowed_integration_ids)
       IS DISTINCT FROM
       ROW(OLD.id,OLD.order_id,OLD.provider,OLD.environment,OLD.provider_namespace,
           OLD.configuration_key,OLD.request_key,OLD.special_reference,OLD.allowed_integration_ids) THEN
      RAISE EXCEPTION 'checkout attempt identity is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.state = 'closed_unpaid' THEN
    SELECT * INTO STRICT e FROM payment_events WHERE id = NEW.closure_verification_event_id;
    IF e.state <> 'processed' OR e.verification_method <> 'authenticated_inquiry'
       OR NOT e.confirms_closed_unpaid OR e.attempt_id IS DISTINCT FROM NEW.id
       OR ROW(e.provider,e.environment,e.provider_namespace) IS DISTINCT FROM
          ROW(NEW.provider,NEW.environment,NEW.provider_namespace) THEN
      RAISE EXCEPTION 'checkout closure requires affirmative same-attempt unpaid proof'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_attempts_guard BEFORE INSERT OR UPDATE ON payment_attempts
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_checkout_attempt();

CREATE FUNCTION sahsah_internal.guard_payment_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE t payment_transactions%ROWTYPE; a payment_attempts%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.provider,NEW.environment,NEW.provider_namespace,NEW.configuration_key,
           NEW.verification_method,NEW.fingerprint,NEW.notification_type,
           NEW.provider_transaction_id,NEW.provider_order_reference,NEW.facts_hash,
           NEW.verified_facts,NEW.confirms_closed_unpaid,NEW.received_at,NEW.verified_at,
           NEW.native_notification_id,NEW.origin_event_id,NEW.observed_payment_outcome,
           NEW.observed_native_state,NEW.observed_native_product_id,NEW.observed_native_units)
       IS DISTINCT FROM
       ROW(OLD.provider,OLD.environment,OLD.provider_namespace,OLD.configuration_key,
           OLD.verification_method,OLD.fingerprint,OLD.notification_type,
           OLD.provider_transaction_id,OLD.provider_order_reference,OLD.facts_hash,
           OLD.verified_facts,OLD.confirms_closed_unpaid,OLD.received_at,OLD.verified_at,
           OLD.native_notification_id,OLD.origin_event_id,OLD.observed_payment_outcome,
           OLD.observed_native_state,OLD.observed_native_product_id,OLD.observed_native_units) THEN
      RAISE EXCEPTION 'verified financial facts are immutable; append another observation'
        USING ERRCODE = '23514';
    END IF;
    IF OLD.state IN ('processed','ignored') AND
       ROW(NEW.state,NEW.attempt_id,NEW.transaction_id,NEW.native_purchase_id,NEW.processed_at)
       IS DISTINCT FROM ROW(OLD.state,OLD.attempt_id,OLD.transaction_id,OLD.native_purchase_id,OLD.processed_at) THEN
      RAISE EXCEPTION 'processed financial evidence cannot be remapped' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.attempt_id IS NOT NULL THEN
    SELECT * INTO STRICT a FROM payment_attempts WHERE id = NEW.attempt_id;
    IF ROW(NEW.provider,NEW.environment,NEW.provider_namespace) IS DISTINCT FROM
       ROW(a.provider,a.environment,a.provider_namespace) THEN
      RAISE EXCEPTION 'payment event attempt namespace mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW.transaction_id IS NOT NULL THEN
    SELECT * INTO STRICT t FROM payment_transactions WHERE id = NEW.transaction_id;
    IF NEW.attempt_id IS DISTINCT FROM t.attempt_id OR
       ROW(NEW.provider,NEW.environment,NEW.provider_namespace) IS DISTINCT FROM
       ROW(t.provider,t.environment,t.provider_namespace) THEN
      RAISE EXCEPTION 'payment event transaction scope mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_events_guard BEFORE INSERT OR UPDATE ON payment_events
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_payment_event();

CREATE FUNCTION sahsah_internal.guard_payment_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF ROW(NEW.id,NEW.provider,NEW.environment,NEW.provider_namespace,NEW.provider_transaction_id,
         NEW.transaction_kind,NEW.parent_transaction_id,NEW.attempt_id,NEW.order_id,
         NEW.integration_id,NEW.amount_minor,NEW.currency,NEW.created_at) IS DISTINCT FROM
     ROW(OLD.id,OLD.provider,OLD.environment,OLD.provider_namespace,OLD.provider_transaction_id,
         OLD.transaction_kind,OLD.parent_transaction_id,OLD.attempt_id,OLD.order_id,
         OLD.integration_id,OLD.amount_minor,OLD.currency,OLD.created_at) THEN
    RAISE EXCEPTION 'payment transaction identity and original amount are immutable'
      USING ERRCODE='23514';
  END IF;
  IF OLD.last_verified_at IS NOT NULL AND
     (NEW.last_verified_at IS NULL OR NEW.last_verified_at<OLD.last_verified_at) THEN
    RAISE EXCEPTION 'payment verification cannot move backward' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_transactions_identity BEFORE UPDATE ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_payment_identity();

CREATE FUNCTION sahsah_internal.check_payment_projection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE t payment_transactions%ROWTYPE; e payment_events%ROWTYPE;
BEGIN
  SELECT * INTO STRICT t FROM payment_transactions WHERE id=NEW.id;
  IF t.last_verification_event_id IS NULL THEN
    IF t.outcome<>'pending' OR t.captured_minor<>0 OR t.refunded_minor<>0 THEN
      RAISE EXCEPTION 'financial payment state requires processed evidence' USING ERRCODE='23514';
    END IF;
  ELSE
    SELECT * INTO STRICT e FROM payment_events WHERE id=t.last_verification_event_id;
    IF e.state<>'processed' OR e.verification_method NOT IN ('hmac_callback','authenticated_inquiry')
       OR e.transaction_id IS DISTINCT FROM t.id OR e.attempt_id IS DISTINCT FROM t.attempt_id
       OR e.verified_at IS DISTINCT FROM t.last_verified_at
       OR e.observed_payment_outcome IS DISTINCT FROM t.outcome THEN
      RAISE EXCEPTION 'payment projection requires matching latest verified evidence' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER payment_transactions_projection AFTER INSERT OR UPDATE ON payment_transactions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sahsah_internal.check_payment_projection();

CREATE FUNCTION sahsah_internal.check_native_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE p store_purchases%ROWTYPE; e payment_events%ROWTYPE;
BEGIN
  SELECT * INTO p FROM store_purchases WHERE id = NEW.id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p.latest_verification_event_id IS NOT NULL THEN
    SELECT * INTO STRICT e FROM payment_events WHERE id = p.latest_verification_event_id;
    IF e.state <> 'processed' OR e.verification_method NOT IN ('apple_store_jws','google_play_api')
       OR e.native_purchase_id IS DISTINCT FROM p.id OR e.observed_native_state IS DISTINCT FROM p.state
       OR p.last_verified_at IS DISTINCT FROM e.verified_at
       OR (e.observed_native_product_id IS NOT NULL AND e.observed_native_product_id IS DISTINCT FROM p.provider_product_id)
       OR (e.observed_native_units IS NOT NULL AND e.observed_native_units IS DISTINCT FROM p.purchased_units) THEN
      RAISE EXCEPTION 'native state requires a matching financial observation' USING ERRCODE = '23514';
    END IF;
  ELSIF p.state <> 'pending' THEN
    RAISE EXCEPTION 'unverified native purchase must remain pending' USING ERRCODE = '23514';
  END IF;
  IF p.completion_state <> 'not_required' AND NOT EXISTS (
    SELECT 1 FROM token_orders o JOIN token_ledger_entries l ON l.source_order_id=o.id
     WHERE o.settlement_store_purchase_id=p.id AND o.settlement_kind='native_store'
       AND l.entry_kind='credit' AND l.account_id=o.beneficiary_account_id
       AND l.amount=o.token_quantity) THEN
    RAISE EXCEPTION 'native completion requires committed bank delivery' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER store_purchases_financial_guard AFTER INSERT OR UPDATE ON store_purchases
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sahsah_internal.check_native_purchase();

CREATE FUNCTION sahsah_internal.guard_native_attribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a accounts%ROWTYPE; prior_intent boolean;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.id,NEW.provider,NEW.environment,NEW.application_id,NEW.store_transaction_id,
           NEW.purchase_token_hash,NEW.created_at) IS DISTINCT FROM
       ROW(OLD.id,OLD.provider,OLD.environment,OLD.application_id,OLD.store_transaction_id,
           OLD.purchase_token_hash,OLD.created_at) THEN
      RAISE EXCEPTION 'native purchase identity is immutable' USING ERRCODE='23514';
    END IF;
    IF OLD.buyer_account_id IS NOT NULL AND NEW.buyer_account_id IS DISTINCT FROM OLD.buyer_account_id THEN
      RAISE EXCEPTION 'native purchase owner cannot change' USING ERRCODE='23514';
    END IF;
    IF OLD.intended_order_id IS NOT NULL AND NEW.intended_order_id IS DISTINCT FROM OLD.intended_order_id THEN
      RAISE EXCEPTION 'native purchase order cannot change' USING ERRCODE='23514';
    END IF;
    IF OLD.last_verified_at IS NOT NULL AND
       (NEW.last_verified_at IS NULL OR NEW.last_verified_at<OLD.last_verified_at) THEN
      RAISE EXCEPTION 'native verification cannot move backward' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.buyer_account_id IS NOT NULL AND
     (TG_OP='INSERT' OR OLD.buyer_account_id IS NULL OR OLD.intended_order_id IS DISTINCT FROM NEW.intended_order_id) THEN
    SELECT * INTO STRICT a FROM accounts WHERE id=NEW.buyer_account_id FOR NO KEY UPDATE;
    SELECT EXISTS (
      SELECT 1 FROM token_orders o JOIN account_deletion_requests r ON r.account_id=o.buyer_account_id
       WHERE o.id=NEW.intended_order_id AND o.buyer_account_id=NEW.buyer_account_id
         AND r.state IN ('requested','confirmed') AND o.created_at<=r.requested_at
    ) INTO prior_intent;
    IF a.state<>'active' AND NOT (a.state='deletion_pending' AND prior_intent) THEN
      RAISE EXCEPTION 'new native claim requires active account or existing authorized intent'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER store_purchases_attribution BEFORE INSERT OR UPDATE ON store_purchases
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_native_attribution();

CREATE FUNCTION sahsah_internal.native_binding_changes_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.buyer_account_id IS NOT NULL AND
     (TG_OP='INSERT' OR OLD.buyer_account_id IS DISTINCT FROM NEW.buyer_account_id
        OR OLD.intended_order_id IS DISTINCT FROM NEW.intended_order_id) THEN
    PERFORM sahsah_internal.invalidate_deletion_checkpoint(NEW.buyer_account_id);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER store_purchases_deletion_checkpoint AFTER INSERT OR UPDATE OF buyer_account_id,intended_order_id ON store_purchases
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.native_binding_changes_deletion();

-- Do not let a transient disconnect mutate the frozen roster or release its claim.
CREATE FUNCTION sahsah_internal.guard_room_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r rooms%ROWTYPE; current_count integer; guest_count integer;
BEGIN
  SELECT * INTO STRICT r FROM rooms WHERE id=NEW.room_id FOR NO KEY UPDATE;
  IF TG_OP='UPDATE' THEN
    IF OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM games WHERE id=r.current_game_id AND status='active') THEN
      RAISE EXCEPTION 'host removal is limited to the lobby' USING ERRCODE='23514';
    END IF;
    IF ROW(NEW.id,NEW.room_id,NEW.joined_at) IS DISTINCT FROM ROW(OLD.id,OLD.room_id,OLD.joined_at)
       OR (OLD.account_id IS NOT NULL AND NEW.account_id IS DISTINCT FROM OLD.account_id)
       OR (OLD.left_at IS NOT NULL AND NEW.left_at IS DISTINCT FROM OLD.left_at)
       OR (OLD.removed_at IS NOT NULL AND NEW.removed_at IS DISTINCT FROM OLD.removed_at)
       OR (OLD.removal_lifted_at IS NOT NULL AND NEW.removal_lifted_at IS DISTINCT FROM OLD.removal_lifted_at) THEN
      RAISE EXCEPTION 'historical membership cannot be reassigned or reactivated' USING ERRCODE='23514';
    END IF;
  END IF;
  IF (NEW.left_at IS NOT NULL OR NEW.removed_at IS NOT NULL)
     AND NEW.reconnect_credential_hash IS NOT NULL AND NEW.reconnect_revoked_at IS NULL THEN
    NEW.reconnect_revoked_at=clock_timestamp();
  END IF;
  IF NEW.account_id IS NOT NULL AND NEW.left_at IS NULL AND NEW.removed_at IS NULL AND
     (TG_OP='INSERT' OR OLD.account_id IS NULL) AND EXISTS (
       SELECT 1 FROM room_memberships m WHERE m.room_id=NEW.room_id
         AND m.account_id=NEW.account_id AND m.removed_at IS NOT NULL AND m.removal_lifted_at IS NULL) THEN
    RAISE EXCEPTION 'account remains removed until the host lifts removal' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' AND NEW.left_at IS NULL AND NEW.removed_at IS NULL THEN
    IF r.closed_at IS NOT NULL OR EXISTS (SELECT 1 FROM games WHERE id=r.current_game_id AND status='active') THEN
      RAISE EXCEPTION 'room does not admit a new member' USING ERRCODE='23514';
    END IF;
    SELECT count(*),count(*) FILTER (WHERE account_id IS DISTINCT FROM r.owner_account_id)
      INTO current_count,guest_count FROM room_memberships
     WHERE room_id=NEW.room_id AND left_at IS NULL AND removed_at IS NULL;
    IF current_count>=6 OR (NEW.account_id IS DISTINCT FROM r.owner_account_id AND guest_count>=5) THEN
      RAISE EXCEPTION 'room capacity includes the reserved host seat' USING ERRCODE='23514';
    END IF;
    IF NEW.account_id IS DISTINCT FROM r.owner_account_id AND NEW.lobby_team_number IS NULL THEN
      RAISE EXCEPTION 'guest must choose a lobby team' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.left_at IS NULL AND NEW.removed_at IS NULL AND
     NEW.account_id IS DISTINCT FROM r.owner_account_id AND NEW.lobby_team_number IS NULL THEN
    RAISE EXCEPTION 'guest must choose a lobby team' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER room_memberships_guard BEFORE INSERT OR UPDATE ON room_memberships
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_room_membership();

CREATE FUNCTION sahsah_internal.guard_game_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF ROW(NEW.id,NEW.room_id,NEW.sequence_number,NEW.host_account_id,NEW.started_at,
         NEW.start_request_id,NEW.start_request_digest,NEW.team_one_name,NEW.team_two_name)
     IS DISTINCT FROM
     ROW(OLD.id,OLD.room_id,OLD.sequence_number,OLD.host_account_id,OLD.started_at,
         OLD.start_request_id,OLD.start_request_digest,OLD.team_one_name,OLD.team_two_name) THEN
    RAISE EXCEPTION 'starting game identity is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.first_question_opened_at IS NOT NULL AND NEW.first_question_opened_at IS DISTINCT FROM OLD.first_question_opened_at THEN
    RAISE EXCEPTION 'first question opening is permanent' USING ERRCODE='23514';
  END IF;
  IF OLD.status<>'active' AND
     ROW(NEW.status,NEW.ended_at,NEW.end_reason,NEW.team_one_score,NEW.team_two_score,
         NEW.state_version,NEW.last_gameplay_at,NEW.idle_expires_at,NEW.first_question_opened_at)
     IS DISTINCT FROM
     ROW(OLD.status,OLD.ended_at,OLD.end_reason,OLD.team_one_score,OLD.team_two_score,
         OLD.state_version,OLD.last_gameplay_at,OLD.idle_expires_at,OLD.first_question_opened_at) THEN
    RAISE EXCEPTION 'terminal game cannot reopen or change its result' USING ERRCODE='23514';
  END IF;
  IF OLD.content_purged_at IS NOT NULL AND NEW.content_purged_at IS DISTINCT FROM OLD.content_purged_at THEN
    RAISE EXCEPTION 'game content purge marker is permanent' USING ERRCODE='23514';
  END IF;
  IF OLD.content_purged_at IS NULL AND NEW.content_purged_at IS NOT NULL AND
     (NEW.content_purge_after IS NULL OR clock_timestamp()<NEW.content_purge_after
      OR NEW.content_purged_at>clock_timestamp()) THEN
    RAISE EXCEPTION 'game content can only purge after its retention deadline' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER games_transition BEFORE UPDATE ON games
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_game_transition();

CREATE FUNCTION sahsah_internal.guard_question_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g games%ROWTYPE;
BEGIN
  IF ROW(NEW.game_id,NEW.board_position,NEW.question_position,NEW.source_question_id,
         NEW.base_points,NEW.format,NEW.snapshot_schema_version) IS DISTINCT FROM
     ROW(OLD.game_id,OLD.board_position,OLD.question_position,OLD.source_question_id,
         OLD.base_points,OLD.format,OLD.snapshot_schema_version) THEN
    RAISE EXCEPTION 'starting question identity is immutable' USING ERRCODE='23514';
  END IF;
  IF (OLD.content_purged_at IS NOT NULL OR NEW.content_purged_at IS NOT NULL) AND
     ROW(NEW.feedback_vote,NEW.feedback_by_account_id,NEW.feedback_created_at,NEW.feedback_updated_at)
     IS DISTINCT FROM
     ROW(OLD.feedback_vote,OLD.feedback_by_account_id,OLD.feedback_created_at,OLD.feedback_updated_at) THEN
    RAISE EXCEPTION 'feedback is closed after exact content purge' USING ERRCODE='23514';
  END IF;
  IF ROW(NEW.content_snapshot,NEW.content_purged_at) IS DISTINCT FROM ROW(OLD.content_snapshot,OLD.content_purged_at) THEN
    SELECT * INTO STRICT g FROM games WHERE id=OLD.game_id;
    IF OLD.content_purged_at IS NOT NULL OR NEW.content_snapshot IS NOT NULL OR NEW.content_purged_at IS NULL
       OR g.ended_at IS NULL OR g.content_purge_after IS NULL
       OR clock_timestamp()<g.content_purge_after OR NEW.content_purged_at<g.content_purge_after THEN
      RAISE EXCEPTION 'question snapshot changes only through due terminal-game purge' USING ERRCODE='23514';
    END IF;
  END IF;
  IF OLD.first_opened_at IS NOT NULL AND NEW.first_opened_at IS DISTINCT FROM OLD.first_opened_at THEN
    RAISE EXCEPTION 'question opening is permanent' USING ERRCODE='23514';
  END IF;
  IF OLD.revealed_at IS NOT NULL AND NEW.revealed_at IS DISTINCT FROM OLD.revealed_at THEN
    RAISE EXCEPTION 'question reveal is permanent' USING ERRCODE='23514';
  END IF;
  IF OLD.resolved_at IS NOT NULL AND
     ROW(NEW.resolved_at,NEW.winning_team_number,NEW.awarded_points,NEW.resolved_by_account_id,NEW.resolution_command_id)
     IS DISTINCT FROM ROW(OLD.resolved_at,OLD.winning_team_number,OLD.awarded_points,OLD.resolved_by_account_id,OLD.resolution_command_id) THEN
    RAISE EXCEPTION 'question resolution is permanent' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER game_questions_history BEFORE UPDATE ON game_questions
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_question_history();

CREATE FUNCTION sahsah_internal.check_game_purge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE game_key uuid; g games%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='games' THEN game_key=NEW.id; ELSE game_key=NEW.game_id; END IF;
  SELECT * INTO STRICT g FROM games WHERE id=game_key;
  IF g.content_purged_at IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM game_questions WHERE game_id=game_key AND content_snapshot IS NOT NULL)
       OR EXISTS (SELECT 1 FROM game_question_media WHERE game_id=game_key) THEN
      RAISE EXCEPTION 'game purge must remove all copied payloads and media pins atomically' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='game_questions' AND NEW.content_purged_at IS NOT NULL THEN
    RAISE EXCEPTION 'question purge requires the completed parent game marker' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER games_purge_complete AFTER UPDATE OF content_purged_at ON games
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sahsah_internal.check_game_purge();
CREATE CONSTRAINT TRIGGER questions_purge_complete AFTER UPDATE OF content_purged_at ON game_questions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sahsah_internal.check_game_purge();

CREATE FUNCTION sahsah_internal.guard_game_media_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g games%ROWTYPE;
BEGIN
  SELECT * INTO STRICT g FROM games WHERE id=NEW.game_id FOR NO KEY UPDATE;
  IF g.content_purged_at IS NOT NULL THEN
    RAISE EXCEPTION 'purged game cannot acquire new media pins' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER game_question_media_retention BEFORE INSERT OR UPDATE ON game_question_media
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_game_media_pin();

CREATE FUNCTION sahsah_internal.guard_phone_redaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.redacted_at IS NOT NULL THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'redacted phone proof cannot be reused or restored' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.redacted_at IS NOT NULL AND NEW.consumed_at IS NULL AND NEW.invalidated_at IS NULL
        AND clock_timestamp()<OLD.expires_at THEN
    RAISE EXCEPTION 'active verification must be invalidated before redaction' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER phone_challenges_redaction BEFORE UPDATE ON phone_verification_challenges
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_phone_redaction();

CREATE FUNCTION sahsah_internal.guard_phone_change_redaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.redacted_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'redacted phone-change history cannot be restored' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_phone_changes_redaction BEFORE UPDATE ON account_phone_changes
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_phone_change_redaction();

CREATE FUNCTION sahsah_internal.guard_promotion_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.phone_fingerprint_key_version<>OLD.phone_fingerprint_key_version THEN
    RAISE EXCEPTION 'campaign fingerprint key version is immutable' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM promo_usages WHERE promotion_id=OLD.id AND phone_fingerprint_cleared_at IS NOT NULL)
     AND (NEW.ends_at>OLD.ends_at OR (NEW.is_active AND NOT OLD.is_active)) THEN
    RAISE EXCEPTION 'campaign cannot reopen after phone markers were purged; use a new campaign'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER promotions_history BEFORE UPDATE ON promotions
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_promotion_history();

CREATE FUNCTION sahsah_internal.guard_promo_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE p promotions%ROWTYPE; o token_orders%ROWTYPE; global_count bigint; buyer_count bigint;
BEGIN
  IF TG_OP='INSERT' THEN
    -- NO KEY UPDATE serializes admission while remaining compatible with FK key
    -- shares already acquired by another checkout; avoid lock-upgrade deadlocks.
    SELECT * INTO STRICT p FROM promotions WHERE id=NEW.promotion_id FOR NO KEY UPDATE;
    SELECT * INTO STRICT o FROM token_orders WHERE id=NEW.order_id;
    IF NOT p.is_active OR clock_timestamp()<p.starts_at OR clock_timestamp()>=p.ends_at
       OR o.token_quantity<>p.eligible_bundle_quantity OR NEW.buyer_phone_fingerprint IS NULL
       OR NEW.state='released' THEN
      RAISE EXCEPTION 'promotion admission is not eligible' USING ERRCODE='23514';
    END IF;
    SELECT count(*), count(*) FILTER (WHERE buyer_account_id=NEW.buyer_account_id
         OR (o.total_minor=0 AND buyer_phone_fingerprint=NEW.buyer_phone_fingerprint))
      INTO global_count,buyer_count FROM promo_usages
     WHERE promotion_id=NEW.promotion_id AND state IN ('held','consumed');
    IF (p.maximum_redemptions IS NOT NULL AND global_count>=p.maximum_redemptions)
       OR (p.per_buyer_limit IS NOT NULL AND buyer_count>=p.per_buyer_limit) THEN
      RAISE EXCEPTION 'promotion allowance exhausted' USING ERRCODE='23514';
    END IF;
  ELSE
    IF ROW(NEW.order_id,NEW.promotion_id,NEW.buyer_account_id,NEW.held_at,NEW.phone_fingerprint_key_version)
       IS DISTINCT FROM ROW(OLD.order_id,OLD.promotion_id,OLD.buyer_account_id,OLD.held_at,OLD.phone_fingerprint_key_version) THEN
      RAISE EXCEPTION 'promotion use identity is immutable' USING ERRCODE='23514';
    END IF;
    IF OLD.state='consumed' AND ROW(NEW.state,NEW.consumed_at) IS DISTINCT FROM ROW(OLD.state,OLD.consumed_at) THEN
      RAISE EXCEPTION 'consumed promotion allowance cannot be released' USING ERRCODE='23514';
    END IF;
    IF OLD.state='released' AND NEW.state='held' THEN
      RAISE EXCEPTION 'released allowance requires new admission, not reactivation' USING ERRCODE='23514';
    END IF;
    IF NEW.state='released' AND OLD.state<>'released' AND EXISTS (
      SELECT 1 FROM payment_attempts WHERE order_id=NEW.order_id AND state<>'closed_unpaid') THEN
      RAISE EXCEPTION 'promotion release requires every payment path confirmed closed unpaid'
        USING ERRCODE='23514';
    END IF;
    IF OLD.state='released' AND NEW.state='consumed' AND NOT EXISTS (
      SELECT 1 FROM payment_reconciliation_cases WHERE order_id=NEW.order_id
       AND case_type='late_promo_settlement' AND details ? 'prior_release') THEN
      RAISE EXCEPTION 'late promotion consumption requires recorded prior-release evidence' USING ERRCODE='23514';
    END IF;
    IF ROW(NEW.buyer_phone_fingerprint,NEW.phone_fingerprint_cleared_at) IS DISTINCT FROM
       ROW(OLD.buyer_phone_fingerprint,OLD.phone_fingerprint_cleared_at) THEN
      SELECT * INTO STRICT p FROM promotions WHERE id=NEW.promotion_id FOR NO KEY UPDATE;
      IF OLD.phone_fingerprint_cleared_at IS NOT NULL OR NEW.buyer_phone_fingerprint IS NOT NULL
         OR NEW.phone_fingerprint_cleared_at IS NULL OR clock_timestamp()<p.ends_at
         OR NEW.phone_fingerprint_cleared_at<p.ends_at THEN
        RAISE EXCEPTION 'phone fingerprint can only be cleared after campaign end' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER promo_usages_guard BEFORE INSERT OR UPDATE ON promo_usages
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_promo_usage();

-- A ledger source must be eligible before its projection changes the bank.
CREATE FUNCTION sahsah_internal.guard_token_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a accounts%ROWTYPE; g games%ROWTYPE; d account_deletion_requests%ROWTYPE;
        audit staff_audit_events%ROWTYPE;
BEGIN
  SELECT * INTO STRICT a FROM accounts WHERE id=NEW.account_id FOR NO KEY UPDATE;
  IF a.state='deleted' THEN
    RAISE EXCEPTION 'deleted account cannot receive a new token movement' USING ERRCODE='23514';
  END IF;
  IF NEW.staff_audit_event_id IS NOT NULL THEN
    SELECT e.* INTO STRICT audit FROM staff_audit_events e JOIN staff_accounts s
      ON s.id=e.staff_account_id WHERE e.id=NEW.staff_audit_event_id AND s.is_active;
    IF audit.reason IS NULL OR length(btrim(audit.reason))=0 OR
       NOT ((NEW.entry_kind='credit' AND audit.action_code='token_grant'
              AND audit.target_kind='account' AND audit.target_key=NEW.account_id::text)
         OR (NEW.entry_kind='game_restoration' AND audit.action_code='game_token_restoration'
              AND audit.target_kind='game' AND audit.target_key=NEW.game_id::text)) THEN
      RAISE EXCEPTION 'token action requires matching authorized staff audit and reason'
        USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.entry_kind='credit' AND NEW.staff_audit_event_id IS NOT NULL AND a.state<>'active' THEN
    RAISE EXCEPTION 'new complimentary credit requires an active account' USING ERRCODE='23514';
  ELSIF NEW.entry_kind='game_debit' THEN
    SELECT * INTO STRICT g FROM games WHERE id=NEW.game_id;
    IF g.status<>'active' OR a.active_game_id IS DISTINCT FROM g.id OR a.state<>'active' THEN
      RAISE EXCEPTION 'game debit requires the accepted active-game claim' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.entry_kind='game_restoration' THEN
    SELECT * INTO STRICT g FROM games WHERE id=NEW.game_id;
    IF g.status='active' OR (NEW.restoration_reason='unopened_game' AND g.first_question_opened_at IS NOT NULL)
       OR (NEW.restoration_reason='platform_failure' AND g.end_reason IS DISTINCT FROM 'platform_failure') THEN
      RAISE EXCEPTION 'game token restoration is not eligible' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.entry_kind='deletion_forfeiture' THEN
    SELECT * INTO STRICT d FROM account_deletion_requests WHERE id=NEW.deletion_request_id;
    IF a.state<>'deletion_pending' OR d.state<>'confirmed' OR d.confirmed_bank<>a.token_balance
       OR NEW.amount<>-a.token_balance OR d.funding_cleared_at IS NULL THEN
      RAISE EXCEPTION 'deletion must forfeit the exact confirmed bank after funding clearance'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER token_ledger_source BEFORE INSERT ON token_ledger_entries
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_token_source();

CREATE FUNCTION sahsah_internal.guard_deletion_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a accounts%ROWTYPE; unresolved boolean;
BEGIN
  SELECT * INTO STRICT a FROM accounts WHERE id=NEW.account_id FOR NO KEY UPDATE;
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'requested' OR a.state='deleted' OR a.active_game_id IS NOT NULL THEN
      RAISE EXCEPTION 'deletion begins with a request after leaving active play' USING ERRCODE='23514';
    END IF;
  ELSE
    IF ROW(NEW.id,NEW.account_id,NEW.request_key,NEW.requested_at) IS DISTINCT FROM
       ROW(OLD.id,OLD.account_id,OLD.request_key,OLD.requested_at)
       OR (OLD.state IN ('completed','cancelled') AND NEW IS DISTINCT FROM OLD) THEN
      RAISE EXCEPTION 'deletion request history cannot be reassigned or reopened' USING ERRCODE='23514';
    END IF;
    IF OLD.funding_changed_at IS NOT NULL AND
       (NEW.funding_changed_at IS NULL OR NEW.funding_changed_at<OLD.funding_changed_at) THEN
      RAISE EXCEPTION 'funding review invalidation cannot move backward' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.state IN ('confirmed','completed') OR NEW.funding_cleared_at IS NOT NULL THEN
    IF a.state NOT IN ('deletion_pending','deleted') OR a.active_game_id IS NOT NULL THEN
      RAISE EXCEPTION 'funding review requires a blocked deletion-pending account' USING ERRCODE='23514';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM token_orders o WHERE (o.buyer_account_id=a.id OR o.beneficiary_account_id=a.id)
        AND o.settlement_kind IS NULL AND
        (o.payment_state='pending' OR EXISTS (SELECT 1 FROM payment_attempts p
           WHERE p.order_id=o.id AND p.state<>'closed_unpaid'))
      UNION ALL
      SELECT 1 FROM store_purchases p WHERE p.buyer_account_id=a.id
        AND (p.state='pending' OR (p.state='purchased' AND NOT EXISTS (
          SELECT 1 FROM token_orders o JOIN token_ledger_entries l ON l.source_order_id=o.id
           WHERE o.settlement_store_purchase_id=p.id)))
      UNION ALL
      SELECT 1 FROM payment_events e LEFT JOIN payment_attempts p ON p.id=e.attempt_id
        LEFT JOIN token_orders o ON o.id=p.order_id LEFT JOIN store_purchases n ON n.id=e.native_purchase_id
        WHERE e.state IN ('queued','needs_review')
          AND (o.buyer_account_id=a.id OR o.beneficiary_account_id=a.id OR n.buyer_account_id=a.id)
      UNION ALL
      SELECT 1 FROM payment_reconciliation_cases c LEFT JOIN token_orders o ON o.id=c.order_id
        LEFT JOIN store_purchases n ON n.id=c.native_purchase_id
        WHERE c.state='open' AND (o.buyer_account_id=a.id OR o.beneficiary_account_id=a.id OR n.buyer_account_id=a.id)
    ) INTO unresolved;
    IF unresolved AND NOT EXISTS (
      SELECT 1 FROM staff_audit_events e JOIN staff_accounts s ON s.id=e.staff_account_id
       WHERE e.id=NEW.funding_review_audit_event_id AND s.is_active
         AND e.action_code='deletion_funding_review' AND e.target_kind='account'
         AND e.target_key=a.id::text AND e.reason IS NOT NULL AND length(btrim(e.reason))>0
         AND e.created_at>=coalesce(NEW.funding_changed_at,NEW.requested_at)) THEN
      RAISE EXCEPTION 'resolve pending funding or record a specific authorized deletion review'
        USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.state='confirmed' AND NEW.confirmed_bank IS DISTINCT FROM a.token_balance THEN
    RAISE EXCEPTION 'deletion confirmation must match the current locked bank' USING ERRCODE='23514';
  END IF;
  IF NEW.state='completed' AND (a.state<>'deleted' OR a.token_balance<>0 OR
      (NEW.confirmed_bank>0 AND NOT EXISTS (SELECT 1 FROM token_ledger_entries l
       WHERE l.deletion_request_id=NEW.id AND l.amount=-NEW.confirmed_bank))) THEN
    RAISE EXCEPTION 'deletion completion requires anonymization and exact forfeiture'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER account_deletion_request_guard BEFORE INSERT OR UPDATE ON account_deletion_requests
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_deletion_request();

CREATE FUNCTION sahsah_internal.check_account_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a accounts%ROWTYPE;
BEGIN
  SELECT * INTO STRICT a FROM accounts WHERE id=NEW.id;
  IF a.state='deleted' AND NOT EXISTS (
    SELECT 1 FROM account_deletion_requests r WHERE r.account_id=a.id AND r.state='completed') THEN
    RAISE EXCEPTION 'account deletion requires its completed consent workflow' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER accounts_deletion_complete AFTER UPDATE OF state ON accounts
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sahsah_internal.check_account_deletion();

CREATE FUNCTION sahsah_internal.guard_deleted_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.state='deleted' AND NEW.state<>'deleted' THEN
    RAISE EXCEPTION 'deleted account identity cannot be revived' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER accounts_deleted_identity BEFORE UPDATE OF state ON accounts
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_deleted_identity();

CREATE FUNCTION sahsah_internal.check_deletion_forfeiture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.entry_kind='deletion_forfeiture' AND NOT EXISTS (
    SELECT 1 FROM account_deletion_requests r JOIN accounts a ON a.id=r.account_id
     WHERE r.id=NEW.deletion_request_id AND r.state='completed' AND a.state='deleted') THEN
    RAISE EXCEPTION 'forfeiture must commit together with completed account deletion'
      USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER token_ledger_completed_deletion AFTER INSERT ON token_ledger_entries
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION sahsah_internal.check_deletion_forfeiture();

-- A newly verified/mapped receipt makes an earlier deletion clearance stale even
-- before it grants tokens. Invalidate under the same account lock used by deletion.
CREATE FUNCTION sahsah_internal.funding_changes_deletion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE account_key uuid;
BEGIN
  FOR account_key IN
    SELECT DISTINCT target_id FROM (
      SELECT o.buyer_account_id AS target_id FROM token_orders o JOIN payment_attempts p ON p.order_id=o.id
        WHERE p.id=NEW.attempt_id
      UNION ALL
      SELECT o.beneficiary_account_id FROM token_orders o JOIN payment_attempts p ON p.order_id=o.id
        WHERE p.id=NEW.attempt_id
      UNION ALL SELECT buyer_account_id FROM store_purchases WHERE id=NEW.native_purchase_id
    ) candidates WHERE target_id IS NOT NULL ORDER BY target_id
  LOOP
    PERFORM 1 FROM accounts WHERE id=account_key FOR NO KEY UPDATE;
    PERFORM sahsah_internal.invalidate_deletion_checkpoint(account_key);
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE TRIGGER payment_events_deletion_checkpoint AFTER INSERT OR UPDATE OF attempt_id,native_purchase_id ON payment_events
FOR EACH ROW EXECUTE FUNCTION sahsah_internal.funding_changes_deletion();

-- Do not leave security-definer helpers directly callable by application users.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sahsah_internal FROM PUBLIC;

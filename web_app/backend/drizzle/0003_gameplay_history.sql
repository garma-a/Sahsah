ALTER TABLE "game_questions" ADD CONSTRAINT "game_questions_nonnegative_feedback_version" CHECK (feedback_version >= 0);--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_nonnegative_projection" CHECK (projection_version >= 0);--> statement-breakpoint

ALTER TABLE room_pack_selections ALTER CONSTRAINT room_selection_room DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE room_pack_selections ALTER CONSTRAINT room_selection_category DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE room_pack_selections ALTER CONSTRAINT room_selection_pack DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE room_actions ALTER CONSTRAINT room_action_room DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE room_actions ALTER CONSTRAINT room_action_account DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE room_actions ALTER CONSTRAINT room_action_membership DEFERRABLE INITIALLY IMMEDIATE;

-- These guards supplement, rather than replace, 0001's financial/PII guards.
CREATE FUNCTION sahsah_internal.guard_room_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF ROW(NEW.id,NEW.owner_account_id,NEW.created_at,NEW.create_request_id,NEW.create_request_digest)
     IS DISTINCT FROM ROW(OLD.id,OLD.owner_account_id,OLD.created_at,OLD.create_request_id,OLD.create_request_digest)
     OR (OLD.closed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD AND (
       (to_jsonb(NEW)-ARRAY['state_version','invitation_code','invitation_issued_at','invitation_expires_at','invitation_revoked_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state_version','invitation_code','invitation_issued_at','invitation_expires_at','invitation_revoked_at'])
       OR NEW.invitation_code IS NOT NULL OR OLD.invitation_expires_at IS NULL OR OLD.invitation_expires_at>clock_timestamp())) THEN
    RAISE EXCEPTION 'room source and closure are permanent' USING ERRCODE='23514';
  END IF;
  IF NEW.lobby_generation NOT BETWEEN OLD.lobby_generation AND OLD.lobby_generation+1
     OR NEW.state_version NOT BETWEEN OLD.state_version AND OLD.state_version+1
     OR NEW.last_lobby_activity_at<OLD.last_lobby_activity_at
     OR NEW.controller_generation NOT BETWEEN OLD.controller_generation AND OLD.controller_generation+1 THEN
    RAISE EXCEPTION 'room revisions and activity are monotonic' USING ERRCODE='23514';
  END IF;
  IF (NEW.controller_generation=OLD.controller_generation) <>
       (ROW(NEW.controller_credential_hash,NEW.controller_acquired_at) IS NOT DISTINCT FROM ROW(OLD.controller_credential_hash,OLD.controller_acquired_at))
     OR (NEW.controller_generation>OLD.controller_generation AND NEW.controller_credential_hash=OLD.controller_credential_hash) THEN
    RAISE EXCEPTION 'controller rotation requires a new proof and generation' USING ERRCODE='23514';
  END IF;
  IF NEW IS DISTINCT FROM OLD AND NEW.state_version=OLD.state_version THEN NEW.state_version=OLD.state_version+1; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER rooms_history BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_room_history();

CREATE FUNCTION sahsah_internal.guard_membership_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF ROW(NEW.join_request_id,NEW.join_request_digest,NEW.reconnect_credential_hash,NEW.reconnect_issued_at)
     IS DISTINCT FROM ROW(OLD.join_request_id,OLD.join_request_digest,OLD.reconnect_credential_hash,OLD.reconnect_issued_at)
     OR (OLD.reconnect_revoked_at IS NOT NULL AND NEW.reconnect_revoked_at IS DISTINCT FROM OLD.reconnect_revoked_at)
     OR NEW.state_version NOT BETWEEN OLD.state_version AND OLD.state_version+1 THEN
    RAISE EXCEPTION 'membership source, proof and revocation are permanent' USING ERRCODE='23514';
  END IF;
  IF NEW IS DISTINCT FROM OLD AND NEW.state_version=OLD.state_version THEN NEW.state_version=OLD.state_version+1; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER room_memberships_source BEFORE UPDATE ON room_memberships FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_membership_source();

CREATE FUNCTION sahsah_internal.guard_game_versions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.state_version NOT BETWEEN OLD.state_version AND OLD.state_version+1
     OR NEW.projection_version NOT BETWEEN OLD.projection_version AND OLD.projection_version+1
     OR (OLD.status<>'active' AND ROW(NEW.controller_generation,NEW.controller_credential_hash,NEW.controller_acquired_at)
       IS DISTINCT FROM ROW(OLD.controller_generation,OLD.controller_credential_hash,OLD.controller_acquired_at)) THEN
    RAISE EXCEPTION 'game revisions and terminal controller are frozen' USING ERRCODE='23514';
  END IF;
  IF NEW.status='active' AND ((NEW.controller_generation=OLD.controller_generation) <>
       (ROW(NEW.controller_credential_hash,NEW.controller_acquired_at) IS NOT DISTINCT FROM ROW(OLD.controller_credential_hash,OLD.controller_acquired_at))
       OR NEW.controller_generation NOT BETWEEN OLD.controller_generation AND OLD.controller_generation+1
       OR (NEW.controller_generation>OLD.controller_generation AND NEW.controller_credential_hash=OLD.controller_credential_hash)) THEN
    RAISE EXCEPTION 'game controller rotation requires a new proof' USING ERRCODE='23514';
  END IF;
  IF OLD.status='active' AND ROW(NEW.status,NEW.first_question_opened_at,NEW.team_one_score,NEW.team_two_score,NEW.active_board_position,NEW.active_question_position,NEW.last_gameplay_at,NEW.controller_generation)
      IS DISTINCT FROM ROW(OLD.status,OLD.first_question_opened_at,OLD.team_one_score,OLD.team_two_score,OLD.active_board_position,OLD.active_question_position,OLD.last_gameplay_at,OLD.controller_generation)
      AND NEW.state_version=OLD.state_version THEN NEW.state_version=OLD.state_version+1; END IF;
  IF NEW IS DISTINCT FROM OLD AND NEW.projection_version=OLD.projection_version THEN NEW.projection_version=OLD.projection_version+1; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER games_versions BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_game_versions();

CREATE FUNCTION sahsah_internal.guard_frozen_game_rows()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g games%ROWTYPE; game_key uuid;
BEGIN
  game_key=CASE WHEN TG_OP='DELETE' THEN OLD.game_id ELSE NEW.game_id END;
  SELECT * INTO STRICT g FROM games WHERE id=game_key FOR NO KEY UPDATE;
  IF TG_OP='INSERT' THEN
    IF g.status<>'active' OR EXISTS(SELECT 1 FROM rooms WHERE current_game_id=g.id) THEN
      RAISE EXCEPTION 'cannot acquire new media pins or change a sealed starting roster' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='game_players' AND TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['left_at','display_name']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['left_at','display_name'])
       OR (OLD.left_at IS NOT NULL AND NEW.left_at IS DISTINCT FROM OLD.left_at)
       OR (NEW.display_name IS DISTINCT FROM OLD.display_name AND NOT (NEW.display_name='Deleted player' AND EXISTS(SELECT 1 FROM accounts WHERE id=OLD.account_id AND state='deleted'))) THEN
      RAISE EXCEPTION 'frozen player identity is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='game_question_media' AND TG_OP='DELETE' AND g.status<>'active'
     AND g.content_purge_after<=clock_timestamp() AND g.content_purged_at IS NOT NULL THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'copied packs and retained media pins are immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER game_players_frozen BEFORE INSERT OR UPDATE OR DELETE ON game_players FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_frozen_game_rows();
CREATE TRIGGER game_packs_frozen BEFORE INSERT OR UPDATE OR DELETE ON game_packs FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_frozen_game_rows();
CREATE TRIGGER game_question_media_frozen BEFORE INSERT OR UPDATE OR DELETE ON game_question_media FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_frozen_game_rows();

CREATE FUNCTION sahsah_internal.guard_game_receipts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' OR OLD.score_entry_kind IS NOT NULL OR OLD.accepted_at>clock_timestamp()-interval '7 days' THEN
    RAISE EXCEPTION 'accepted game actions are immutable; score history is retained' USING ERRCODE='23514';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER game_actions_frozen BEFORE UPDATE OR DELETE ON game_actions FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_game_receipts();

CREATE FUNCTION sahsah_internal.guard_room_receipts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP='UPDATE' OR OLD.expires_at>clock_timestamp() THEN RAISE EXCEPTION 'accepted room receipts are immutable until expiry' USING ERRCODE='23514'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER room_actions_frozen BEFORE UPDATE OR DELETE ON room_actions FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_room_receipts();

CREATE FUNCTION sahsah_internal.guard_question_milestones()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE g games%ROWTYPE;
BEGIN
  SELECT * INTO STRICT g FROM games WHERE id=OLD.game_id FOR NO KEY UPDATE;
  IF (OLD.memory_first_shown_at IS NOT NULL AND NEW.memory_first_shown_at IS DISTINCT FROM OLD.memory_first_shown_at)
     OR (OLD.memory_first_hidden_at IS NOT NULL AND NEW.memory_first_hidden_at IS DISTINCT FROM OLD.memory_first_hidden_at)
     OR NEW.feedback_version NOT BETWEEN OLD.feedback_version AND OLD.feedback_version+1
     OR (g.status<>'active' AND (to_jsonb(NEW)-ARRAY['feedback_vote','feedback_version','feedback_by_account_id','feedback_created_at','feedback_updated_at','content_snapshot','content_purged_at'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['feedback_vote','feedback_version','feedback_by_account_id','feedback_created_at','feedback_updated_at','content_snapshot','content_purged_at'])) THEN
    RAISE EXCEPTION 'question milestones and terminal gameplay are frozen' USING ERRCODE='23514';
  END IF;
  IF NEW.feedback_vote IS DISTINCT FROM OLD.feedback_vote AND NEW.feedback_version=OLD.feedback_version THEN NEW.feedback_version=OLD.feedback_version+1; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER game_questions_milestones BEFORE UPDATE ON game_questions FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_question_milestones();

-- Idle streams learn deactivation without periodically querying every account.
CREATE FUNCTION sahsah_internal.notify_gameplay_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    INSERT INTO outbox_events(id,deduplication_key,topic,resource_kind,resource_id,payload,available_at,created_at)
      SELECT gen_random_uuid(),gen_random_uuid()::text,'account.gameplay.changed','room',r.id,jsonb_build_object('roomId',r.id),clock_timestamp(),clock_timestamp()
      FROM rooms r WHERE r.closed_at IS NULL AND EXISTS(SELECT 1 FROM room_memberships m WHERE m.room_id=r.id AND m.account_id=NEW.id AND m.left_at IS NULL AND m.removed_at IS NULL);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accounts_gameplay_notification AFTER UPDATE OF state ON accounts FOR EACH ROW EXECUTE FUNCTION sahsah_internal.notify_gameplay_account();

CREATE FUNCTION sahsah_internal.guard_ready_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.state='ready' AND (to_jsonb(NEW)-'archived_at') IS DISTINCT FROM (to_jsonb(OLD)-'archived_at') THEN
    RAISE EXCEPTION 'ready media objects and metadata are immutable; create a new asset' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER media_assets_ready_immutable BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION sahsah_internal.guard_ready_media();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sahsah_internal FROM PUBLIC;

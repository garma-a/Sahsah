#!/usr/bin/env python3
"""Exercise the design in a fresh local PostgreSQL cluster, never a supplied DSN.

Requires PostgreSQL 18 binaries, Python 3, Node 24 and npm. No application install.
Run from any directory. The pinned DBML CLI is downloaded into npm's cache.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import uuid

from measure_access_paths import measure

DESIGN = Path(__file__).resolve().parents[1]


def uid():
    return str(uuid.uuid4())


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def digest(value):
    return "decode(" + quote(hashlib.sha256(str(value).encode()).hexdigest()) + ",'hex')"


def assertion(condition, message):
    return f"DO $$ BEGIN IF NOT ({condition}) THEN RAISE EXCEPTION {quote(message)}; END IF; END $$;"


class Audit:
    def __init__(self, connection, database="sahsah_validation"):
        self.connection = connection
        self.database = database
        self.results = []
        self.phone_counter = 0
        self.staff = uid()
        self.catalog = []

    def sql(self, text, check=True):
        if not text.lstrip().upper().startswith("BEGIN;"):
            text="BEGIN;\n"+text+"\n;\nCOMMIT;"
        result = subprocess.run(
            ["psql", *self.connection, "-d", self.database, "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
            input="SET lock_timeout='5s'; SET statement_timeout='30s';\n" + text,
            text=True, capture_output=True,
        )
        if check and result.returncode:
            raise RuntimeError(result.stderr + "\n" + text[-2000:])
        return result

    def case(self, name, sql, reject=None):
        result = self.sql("BEGIN;\n" + sql + "\nSET CONSTRAINTS ALL IMMEDIATE; ROLLBACK;", check=False)
        passed = (result.returncode == 0) if reject is None else (
            result.returncode != 0 and reject in result.stderr
        )
        self.results.append({"name": name, "passed": passed, "expected": reject or "accepted"})
        print(("PASS " if passed else "FAIL ") + name, flush=True)
        if not passed:
            raise RuntimeError(result.stderr + "\nExpected: " + str(reject) + "\n" + sql[-2000:])

    def account(self, tokens=0, phone=None):
        account = uid()
        self.phone_counter += 1
        phone = phone or f"+2010{self.phone_counter:08d}"
        sql = f"INSERT INTO accounts(id,display_name,phone_e164,phone_verified_at) VALUES ('{account}','Test player','{phone}',now());"
        if tokens:
            sql += self.grant(account, tokens)
        return account, sql

    def grant(self, account, tokens):
        audit = uid()
        return f"""
        INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key,reason)
          VALUES ('{audit}','{self.staff}','token_grant','account','{account}','{uid()}','Synthetic fixture grant');
        INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,staff_audit_event_id,reason_text)
          VALUES ('{uid()}','{account}','credit',{tokens},'{uid()}','{audit}','Synthetic fixture grant');
        """

    def web_order(self, buyer, quantity=1, promotion=None, free=False, beneficiary=None, gift_phone=None):
        order = uid()
        kind = "gift" if gift_phone else "personal"
        beneficiary = beneficiary or (None if gift_phone else buyer)
        subtotal = quantity * 10000
        return order, f"""
        INSERT INTO token_orders(id,buyer_account_id,order_kind,beneficiary_account_id,token_quantity,
          currency,pricing_version,base_unit_price_minor,quantity_discount_bps,list_subtotal_minor,
          quantity_discount_minor,offer_subtotal_minor,additional_discount_kind,additional_discount_bps,
          additional_discount_minor,total_minor,idempotency_key,request_digest,applied_promotion_id,
          applied_promotion_trigger,payment_state,settlement_kind,zero_total_accepted_at,settled_at,
          recipient_phone_e164,recipient_bound_at)
        VALUES ('{order}','{buyer}','{kind}',{quote(beneficiary) if beneficiary else 'NULL'},{quantity},
          'EGP',1,10000,0,{subtotal},0,{subtotal},'{('promo_code' if promotion else 'none')}',
          {10000 if free else 0},{subtotal if free else 0},{0 if free else subtotal},'{uid()}',{digest(order)},
          {quote(promotion) if promotion else 'NULL'},{quote('code') if promotion else 'NULL'},
          '{'not_required' if free else 'pending'}',{quote('zero_cost') if free else 'NULL'},
          {'now()' if free else 'NULL'},{'now()' if free else 'NULL'},
          {quote(gift_phone) if gift_phone else 'NULL'},{'now()' if gift_phone and beneficiary else 'NULL'});
        """

    def order_credit(self, order, account, quantity=1, kind="payment"):
        return f"""INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,
          source_order_id,source_order_settlement_kind) VALUES
          ('{uid()}','{account}','credit',{quantity},'{uid()}','{order}','{kind}');"""

    def attempt(self, order, merchant="merchant_test"):
        attempt = uid()
        return attempt, f"""INSERT INTO payment_attempts(id,order_id,environment,provider_namespace,
          configuration_key,request_key,special_reference,allowed_integration_ids,created_at)
          VALUES ('{attempt}','{order}','test','{merchant}','fixture','{uid()}','{uid()}',ARRAY['101'],now());"""

    def paymob(self, order, attempt, amount=10000, integration="101", merchant="merchant_test"):
        transaction, event = uid(), uid()
        sql = f"""
        INSERT INTO payment_transactions(id,environment,provider_namespace,provider_transaction_id,
          attempt_id,order_id,integration_id,amount_minor,currency,outcome,captured_minor,created_at)
          VALUES ('{transaction}','test','{merchant}','{uid()}','{attempt}','{order}',
          '{integration}',{amount},'EGP','succeeded',{amount},now());
        INSERT INTO payment_events(id,environment,provider_namespace,configuration_key,verification_method,
          fingerprint,notification_type,attempt_id,transaction_id,facts_hash,verified_facts,
          observed_payment_outcome,received_at,verified_at,state,processed_at)
          VALUES ('{event}','test','{merchant}','fixture','hmac_callback',{digest(event)},'TRANSACTION',
          '{attempt}','{transaction}',{digest(transaction)},'{{}}','succeeded',now(),now(),'processed',now());
        UPDATE payment_transactions SET last_verification_event_id='{event}',last_verified_at=now()
          WHERE id='{transaction}';
        """
        return transaction, event, sql

    def settle_web(self, order, transaction, event):
        return f"""UPDATE token_orders SET payment_state='paid',settlement_kind='payment',verified_paid_at=now(),
          settled_at=now(),settlement_payment_transaction_id='{transaction}',settlement_payment_kind='payment',
          settlement_verification_event_id='{event}' WHERE id='{order}';"""

    def native(self, buyer, provider="google_play", proof="google_play_api", state="purchased"):
        product, order, purchase, event = uid(), uid(), uid(), uid()
        product_name = "sahsah_token_1_" + product
        is_apple = provider == "apple_app_store"
        native_identity = (f"'{uid()}',NULL,NULL,NULL" if is_apple else f"NULL,{digest(purchase)},decode('abcd','hex'),1")
        is_notice = proof in ("google_play_rtdn", "apple_store_notification")
        sql = f"""
        INSERT INTO store_products(id,provider,application_id,provider_product_id,token_quantity,
          updated_by_staff_id,created_at,updated_at)
          VALUES ('{product}','{provider}','com.sahsah.fixture','{product_name}',1,'{self.staff}',now(),now());
        INSERT INTO token_orders(id,buyer_account_id,order_kind,beneficiary_account_id,token_quantity,
          purchase_channel,store_product_id,idempotency_key,request_digest)
          VALUES ('{order}','{buyer}','personal','{buyer}',1,'{provider}','{product}','{uid()}',{digest(order)});
        INSERT INTO store_purchases(id,provider,environment,application_id,provider_product_id,store_product_id,
          product_token_quantity,purchased_units,verified_token_quantity,store_transaction_id,purchase_token_hash,
          purchase_token_ciphertext,encryption_key_version,intended_order_id,buyer_account_id,attributed_at,created_at)
          VALUES ('{purchase}','{provider}','test','com.sahsah.fixture','{product_name}','{product}',1,1,1,
          {native_identity},'{order}','{buyer}',now(),now());
        INSERT INTO payment_events(id,provider,environment,provider_namespace,configuration_key,verification_method,
          native_purchase_id,native_notification_id,fingerprint,notification_type,facts_hash,verified_facts,
          observed_native_state,observed_native_product_id,observed_native_units,
          received_at,verified_at,state,processed_at)
          VALUES ('{event}','{provider}','test','com.sahsah.fixture','fixture','{proof}','{purchase}',
          {quote(uid()) if is_notice else 'NULL'},{digest(event) if is_notice else 'NULL'},
          {quote('STORE_NOTICE') if is_notice else 'NULL'},{digest(purchase)},'{{}}',
          {quote(state) if not is_notice else 'NULL'},{quote(product_name) if not is_notice else 'NULL'},
          {1 if not is_notice else 'NULL'},now(),now(),'processed',now());
        """
        if not is_notice:
            sql += f"UPDATE store_purchases SET state='{state}',latest_verification_event_id='{event}',last_verified_at=now() WHERE id='{purchase}';"
        return order, purchase, event, sql

    def settle_native(self, order, purchase, event):
        return f"""UPDATE token_orders SET payment_state='store_verified',settlement_kind='native_store',
          native_verified_at=now(),settled_at=now(),settlement_store_purchase_id='{purchase}',
          settlement_verification_event_id='{event}' WHERE id='{order}';"""

    def room(self, owner):
        room, member = uid(), uid()
        return room, member, f"""
          INSERT INTO rooms(id,owner_account_id,team_one_name,team_two_name)
            VALUES ('{room}','{owner}','Team A','Team B');
          INSERT INTO room_memberships(id,room_id,account_id,display_name,joined_at)
            VALUES ('{member}','{room}','{owner}','Host',now());
        """

    def member(self, room, account=None):
        member = uid()
        return member, f"""INSERT INTO room_memberships(id,room_id,account_id,display_name,lobby_team_number,
          joined_at,reconnect_credential_hash,reconnect_issued_at) VALUES
          ('{member}','{room}',{quote(account) if account else 'NULL'},'Guest',1,now(),{digest(member)},now());"""

    def game(self, account, room, member, old=False):
        game = uid()
        at = "now()-interval '14 months'" if old else "now()"
        sql = f"""
        INSERT INTO games(id,room_id,sequence_number,start_request_id,start_request_digest,started_at,
          last_gameplay_at,idle_expires_at,host_account_id,team_one_name,team_two_name,
          controller_credential_hash,controller_acquired_at)
          VALUES ('{game}','{room}',1,'{uid()}',{digest(game)},{at},{at},({at})+interval '24 hours',
          '{account}','Team A','Team B',{digest('controller'+game)},{at});
        INSERT INTO game_players(game_id,room_id,room_member_id,seat_number,account_id,display_name,joined_at)
          VALUES ('{game}','{room}','{member}',1,'{account}','Host',{at});
        UPDATE rooms SET current_game_id='{game}' WHERE id='{room}';
        UPDATE accounts SET active_game_id='{game}',active_game_claimed_at=now() WHERE id='{account}';
        INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,game_id)
          VALUES ('{uid()}','{account}','game_debit',-1,'{uid()}','{game}');
        """
        for board, (category, pack, questions) in enumerate(self.catalog, 1):
            sql += f"""INSERT INTO game_packs(game_id,category_id,pack_id,board_position,pack_number,
              source_content_revision,category_name_ar) VALUES ('{game}','{category}','{pack}',{board},1,1,'فئة');"""
            for position, question in enumerate(questions, 1):
                sql += f"""INSERT INTO game_questions(game_id,board_position,question_position,source_question_id,
                  base_points,format,content_snapshot) VALUES ('{game}',{board},{position},'{question}',
                  {200*((position+1)//2)},'STANDARD','{{"prompt_ar":"سؤال","answer_ar":"إجابة"}}');"""
        return game, sql

    def end_game(self, game, account, old=False):
        at = "now()-interval '14 months'+interval '1 hour'" if old else "now()"
        return f"""UPDATE games SET status='finished',ended_at={at},end_reason='host_ended',
          content_purge_after=({at})+interval '12 months' WHERE id='{game}';
          UPDATE accounts SET active_game_id=NULL,active_game_claimed_at=NULL WHERE id='{account}';"""

    def initialize(self):
        sql = f"INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES ('{self.staff}','admin','audit@example.invalid','fixture-only-hash');"
        for _ in range(6):
            category, pack = uid(), uid()
            questions = [uid() for _ in range(6)]
            self.catalog.append((category, pack, questions))
            sql += f"INSERT INTO categories(id,name_ar) VALUES ('{category}','فئة');"
            sql += f"INSERT INTO question_packs(id,category_id,pack_number,publication_state) VALUES ('{pack}','{category}',1,'published');"
            for i, question in enumerate(questions, 1):
                sql += f"INSERT INTO questions(id,pack_id,slot_number,prompt_ar,answer_ar,format) VALUES ('{question}','{pack}',{i},'سؤال','إجابة','STANDARD');"
        self.sql(sql)

    def functional_cases(self):
        a, sa = self.account()
        self.case("staff credit projects the bank once", sa + self.grant(a, 3) + assertion(
            f"(SELECT token_balance FROM accounts WHERE id='{a}')=3", "bank projection mismatch"))
        self.case("direct balance edits are rejected", sa + f"UPDATE accounts SET token_balance=5 WHERE id='{a}';", "owned by the ledger")
        self.case("ledger history is append-only", sa+self.grant(a,1)+f"DELETE FROM token_ledger_entries WHERE account_id='{a}';", "append-only")
        o, so = self.web_order(a)
        self.case("order retries cannot change the original digest", sa+so+f"UPDATE token_orders SET request_digest={digest('changed')} WHERE id='{o}';", "intent and quote are immutable")
        p, sp = self.attempt(o)
        t, e, se = self.paymob(o,p)
        settlement = self.settle_web(o,t,e)
        self.case("verified Paymob settlement and bank delivery commit together", sa+so+sp+se+settlement+
                  self.order_credit(o,a)+assertion(f"(SELECT token_balance FROM accounts WHERE id='{a}')=1", "Paymob bank mismatch"))
        self.case("settlement without bank delivery is rejected", sa+so+sp+se+settlement, "must credit its bank")
        self.case("settled evidence cannot be cleared", sa+so+sp+se+settlement+self.order_credit(o,a)+
                  f"UPDATE token_orders SET settlement_kind=NULL,settled_at=NULL,payment_state='pending',verified_paid_at=NULL,settlement_payment_transaction_id=NULL,settlement_payment_kind=NULL,settlement_verification_event_id=NULL WHERE id='{o}';", "cannot be cleared")
        self.case("verified payment amount cannot be rewritten",sa+so+sp+se+
                  f"UPDATE payment_transactions SET amount_minor=20000 WHERE id='{t}';","identity and original amount are immutable")
        self.case("payment projection cannot fabricate a later proof time",sa+so+sp+se+
                  f"UPDATE payment_transactions SET last_verified_at=now()+interval '1 second' WHERE id='{t}';",
                  "matching latest verified evidence")
        # Use the IDs belonging to this independent evidence rather than the valid pair.
        wt, we, ws = self.paymob(o,p,integration="999")
        self.case("unconfigured payment integration cannot fund", sa+so+sp+ws+self.settle_web(o,wt,we)+self.order_credit(o,a), "successful Paymob funding proof")
        self.case("duplicate credit is rejected even with another request key", sa+so+sp+se+settlement+
                  self.order_credit(o,a)+self.order_credit(o,a), "duplicate key")
        closure = uid()
        closure_sql = f"""INSERT INTO payment_events(id,environment,provider_namespace,configuration_key,
          verification_method,attempt_id,facts_hash,verified_facts,confirms_closed_unpaid,received_at,verified_at,
          state,processed_at) VALUES ('{closure}','test','merchant_test','fixture','authenticated_inquiry',
          '{p}',{digest(closure)},'{{}}',false,now(),now(),'processed',now());
          UPDATE payment_attempts SET state='closed_unpaid',confirmed_unpaid_at=now(),closure_verification_event_id='{closure}' WHERE id='{p}';"""
        self.case("inquiry that did not confirm closure cannot close checkout", sa+so+sp+closure_sql, "affirmative same-attempt")
        self.case("affirmative same-attempt closure is accepted", sa+so+sp+closure_sql.replace("'{}',false,", "'{}',true,"))
        self.case("event transaction and merchant namespaces must agree", sa+so+sp+se.replace("'merchant_test','fixture','hmac_callback'", "'wrong_merchant','fixture','hmac_callback'"), "namespace mismatch")
        b, sb = self.account()
        other_order, other_so = self.web_order(b)
        self.case("payment source cannot be reused by a different order", sa+sb+so+other_so+sp+se+
                  self.settle_web(other_order,t,e)+self.order_credit(other_order,b), 'token_orders_settlement_payment')
        self.case("later reversal preserves the original bank and accepted proof", sa+so+sp+se+settlement+
                  self.order_credit(o,a)+"SET CONSTRAINTS ALL IMMEDIATE;"+
                  f"UPDATE payment_transactions SET refunded_minor=amount_minor WHERE id='{t}';"+
                  assertion(f"(SELECT token_balance FROM accounts WHERE id='{a}')=1", "reversal changed bank"))

        for provider, method in [("google_play","google_play_api"),("apple_app_store","apple_store_jws")]:
            no, np, ne, ns = self.native(a,provider,method)
            self.case(provider+" verified delivery and completion intent", sa+ns+self.settle_native(no,np,ne)+
                      self.order_credit(no,a,kind="native_store")+f"UPDATE store_purchases SET completion_state='pending',completion_requested_at=now() WHERE id='{np}';")
            self.case(provider+" completion before delivery is rejected", sa+ns+
                      f"UPDATE store_purchases SET completion_state='pending',completion_requested_at=now() WHERE id='{np}';", "completion requires committed bank delivery")
            self.case(provider+" cannot use Paymob checkout", sa+ns+self.attempt(no)[1], "positive pending website order")
            self.case(provider+" cannot roll verification time backward",sa+ns+
                      f"UPDATE store_purchases SET last_verified_at=now()-interval '1 second' WHERE id='{np}';","verification cannot move backward")
        no, np, ne, ns = self.native(a,proof="google_play_rtdn")
        self.case("mapped RTDN alone cannot fund tokens", sa+ns+self.settle_native(no,np,ne)+self.order_credit(no,a,kind="native_store"), "PURCHASED native financial proof")
        no, np, ne, ns = self.native(a,state="pending")
        self.case("verified pending store purchase cannot fund tokens", sa+ns+self.settle_native(no,np,ne)+self.order_credit(no,a,kind="native_store"), "PURCHASED native financial proof")
        no,np,ne,ns=self.native(a)
        revoked,revoked_sql=self.native_observation(ne,np,"revoked",digest("revoked"))
        again,again_sql=self.native_observation(ne,np,"purchased",None)
        self.case("native reinstatement may repeat earlier facts without duplicating delivery",sa+ns+
                  revoked_sql+again_sql+self.settle_native(no,np,again)+self.order_credit(no,a,kind="native_store"))
        self.case("older purchased proof cannot overwrite a later revocation",sa+ns+revoked_sql+
                  f"UPDATE store_purchases SET state='purchased',latest_verification_event_id='{ne}',last_verified_at=(SELECT verified_at FROM payment_events WHERE id='{ne}') WHERE id='{np}';",
                  "verification cannot move backward")

        room, host_member, sr = self.room(a)
        guest, sg = self.account()
        member, sm = self.member(room,guest)
        remove = f"UPDATE room_memberships SET removed_at=now() WHERE id='{member}';"
        rejoin = self.member(room,guest)[1]
        self.case("removed account cannot rejoin until host unblock", sa+sg+sr+sm+remove+rejoin, "remains removed")
        self.case("unblock creates a new membership and leaves old credential revoked", sa+sg+sr+sm+remove+
                  f"UPDATE room_memberships SET removal_lifted_at=now(),removal_lifted_by_account_id='{a}' WHERE id='{member}';"+
                  rejoin+assertion(f"(SELECT reconnect_revoked_at IS NOT NULL FROM room_memberships WHERE id='{member}')", "old credential revived"))
        self.case("capacity is six including host", sa+sr+"".join(self.member(room)[1] for _ in range(6)), "capacity includes")
        self.case("empty room reserves one seat for its host", sa+
                  f"INSERT INTO rooms(id,owner_account_id,team_one_name,team_two_name) VALUES ('{room}','{a}','A','B');"+
                  "".join(self.member(room)[1] for _ in range(6)), "capacity includes")

        self.deletion_cases()
        self.promotion_cases()
        self.history_cases()

    def native_observation(self,source,purchase,state,facts):
        event=uid()
        return event,f"""
        WITH tick AS MATERIALIZED (SELECT clock_timestamp() AS at)
        INSERT INTO payment_events(id,provider,environment,provider_namespace,configuration_key,verification_method,
          native_purchase_id,facts_hash,verified_facts,observed_native_state,observed_native_product_id,
          observed_native_units,received_at,verified_at,state,processed_at)
        SELECT '{event}',provider,environment,provider_namespace,configuration_key,verification_method,
          native_purchase_id,{facts or 'facts_hash'},verified_facts,'{state}',observed_native_product_id,
          observed_native_units,tick.at,tick.at,'processed',tick.at
        FROM payment_events CROSS JOIN tick WHERE id='{source}';
        UPDATE store_purchases SET state='{state}',latest_verification_event_id='{event}',
          last_verified_at=(SELECT verified_at FROM payment_events WHERE id='{event}') WHERE id='{purchase}';
        """

    def deletion_cases(self):
        a, sa = self.account(tokens=2)
        request = uid()
        start = sa+f"INSERT INTO account_deletion_requests(id,account_id,request_key,requested_at) VALUES ('{request}','{a}','{uid()}',now()); UPDATE accounts SET state='deletion_pending' WHERE id='{a}';"
        confirm = f"UPDATE account_deletion_requests SET funding_cleared_at=clock_timestamp() WHERE id='{request}'; UPDATE account_deletion_requests SET state='confirmed',confirmed_bank=2,confirmed_at=clock_timestamp() WHERE id='{request}';"
        self.case("deletion confirmation requires funding clearance", start+
                  f"UPDATE account_deletion_requests SET state='confirmed',confirmed_bank=2,confirmed_at=clock_timestamp() WHERE id='{request}';", "cleared_confirmation")
        o, so = self.web_order(a)
        self.case("unresolved checkout blocks deletion clearance", sa+so+start[len(sa):]+confirm, "resolve pending funding")
        self.case("deletion-pending account cannot create new checkout", start+so, "active buyer")
        self.case("deletion confirmation must match exact current bank", start+confirm.replace("confirmed_bank=2", "confirmed_bank=1"), "current locked bank")
        forfeiture = f"INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,deletion_request_id,reason_text) VALUES ('{uid()}','{a}','deletion_forfeiture',-2,'{uid()}','{request}','Explicit consent');"
        finish = f"UPDATE accounts SET state='deleted',deleted_at=clock_timestamp(),display_name=NULL,phone_e164=NULL,phone_verified_at=NULL,firebase_uid=NULL,firebase_project_id=NULL WHERE id='{a}'; UPDATE account_deletion_requests SET state='completed',completed_at=clock_timestamp() WHERE id='{request}';"
        self.case("exact confirmed forfeiture and anonymization complete atomically", start+confirm+forfeiture+finish)
        self.case("deletion cannot silently forfeit a different balance", start+confirm+forfeiture.replace("-2,", "-1,"), "exact confirmed bank")
        self.case("forfeiture cannot commit without completing deletion",start+confirm+forfeiture,
                  "forfeiture must commit together")
        self.case("deleted account identity cannot be reactivated",start+confirm+forfeiture+finish+
                  f"UPDATE accounts SET state='active',deleted_at=NULL,display_name='Recreated',phone_e164='+201099999999',phone_verified_at=now() WHERE id='{a}';","cannot be revived")
        no,np,ne,ns=self.native(a)
        self.case("verified undelivered native funding blocks deletion clearance",sa+ns+start[len(sa):]+confirm,
                  "resolve pending funding")
        # An earlier authorized order may finish during deletion; the accepted credit
        # invalidates the old clearance/confirmation rather than being confiscated.
        p, sp = self.attempt(o)
        t,e,se = self.paymob(o,p)
        self.case("incoming verified funding invalidates deletion confirmation", sa+so+sp+
          start[len(sa):]+f"UPDATE token_orders SET payment_state='cancelled' WHERE id='{o}';"+
          # Close existing external path using authoritative proof before clearance.
          self.closed_attempt(p)+confirm+se+self.settle_web(o,t,e)+self.order_credit(o,a)+
          assertion(f"(SELECT state='requested' AND confirmed_bank IS NULL AND funding_cleared_at IS NULL FROM account_deletion_requests WHERE id='{request}')", "stale deletion consent survived funding"))
        review=uid()
        reviewed=f"""INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,
          request_key,reason,created_at) VALUES ('{review}','{self.staff}','deletion_funding_review','account',
          '{a}','{uid()}','Reviewed known checkout',clock_timestamp());
          UPDATE account_deletion_requests SET funding_review_audit_event_id='{review}',funding_cleared_at=clock_timestamp() WHERE id='{request}';
          UPDATE account_deletion_requests SET state='confirmed',confirmed_bank=2,confirmed_at=clock_timestamp() WHERE id='{request}';"""
        self.case("new funding evidence requires a new staff review",sa+so+sp+start[len(sa):]+reviewed+se+
                  f"UPDATE account_deletion_requests SET funding_review_audit_event_id='{review}',funding_cleared_at=clock_timestamp() WHERE id='{request}';",
                  "resolve pending funding")
        no,np,ne,ns=self.native(a)
        unowned=ns.replace(f"'{no}','{a}',now(),now()", "NULL,NULL,NULL,now()")
        self.case("new native attribution invalidates old deletion consent",sa+unowned+
                  f"UPDATE token_orders SET payment_state='cancelled' WHERE id='{no}';"+start[len(sa):]+confirm+
                  f"UPDATE store_purchases SET intended_order_id='{no}',buyer_account_id='{a}',attributed_at=clock_timestamp() WHERE id='{np}';"+
                  assertion(f"(SELECT state='requested' AND confirmed_bank IS NULL AND funding_cleared_at IS NULL FROM account_deletion_requests WHERE id='{request}')","native binding preserved stale consent"))

    def closed_attempt(self, attempt):
        event=uid()
        return f"""INSERT INTO payment_events(id,environment,provider_namespace,configuration_key,verification_method,
          attempt_id,facts_hash,verified_facts,confirms_closed_unpaid,received_at,verified_at,state,processed_at)
          VALUES ('{event}','test','merchant_test','fixture','authenticated_inquiry','{attempt}',{digest(event)},
          '{{}}',true,now(),now(),'processed',now());
          UPDATE payment_attempts SET state='closed_unpaid',confirmed_unpaid_at=now(),closure_verification_event_id='{event}' WHERE id='{attempt}';"""

    def campaign(self, cap=None):
        promo=uid()
        return promo,f"""INSERT INTO promotions(id,code,discount_bps,eligible_bundle_quantity,starts_at,ends_at,maximum_redemptions)
          VALUES ('{promo}','CODE_{promo}',10000,1,now()-interval '1 day',now()+interval '1 day',{cap if cap else 'NULL'});"""

    def promo_usage(self, order, promo, buyer, fingerprint):
        return f"""INSERT INTO promo_usages(order_id,promotion_id,buyer_account_id,state,consumed_at,
          buyer_phone_fingerprint,phone_fingerprint_key_version) VALUES ('{order}','{promo}','{buyer}',
          'consumed',now(),{digest(fingerprint)},1);"""

    def promotion_cases(self):
        a,sa=self.account(); b,sb=self.account()
        promo,ps=self.campaign()
        o,so=self.web_order(a,promotion=promo,free=True)
        credit=self.order_credit(o,a,kind="zero_cost")
        use=self.promo_usage(o,promo,a,"same-phone-in-campaign")
        self.case("100% promotion delivers without Paymob",sa+ps+so+use+credit)
        self.case("zero-cost order cannot create Paymob attempt",sa+ps+so+use+credit+self.attempt(o)[1],"positive pending website order")
        self.case("consumed campaign allowance cannot be released",sa+ps+so+use+credit+
          f"UPDATE promo_usages SET state='released',consumed_at=NULL,released_at=now(),release_reason='browser timeout' WHERE order_id='{o}';","cannot be released")
        bo,bso=self.web_order(b,promotion=promo,free=True)
        self.case("same campaign phone cannot reset free allowance with another account",sa+sb+ps+so+use+credit+bso+
          self.promo_usage(bo,promo,b,"same-phone-in-campaign")+self.order_credit(bo,b,kind="zero_cost"),"allowance exhausted")
        self.case("campaign phone marker cannot be cleared before end",sa+ps+so+use+credit+
          f"UPDATE promo_usages SET buyer_phone_fingerprint=NULL,phone_fingerprint_cleared_at=now() WHERE order_id='{o}';","only be cleared after campaign end")
        self.case("expired campaign permits marker cleanup without deleting financial evidence",sa+ps+so+use+credit+
          f"UPDATE promotions SET ends_at=now()-interval '1 second' WHERE id='{promo}'; UPDATE promo_usages SET buyer_phone_fingerprint=NULL,phone_fingerprint_cleared_at=clock_timestamp() WHERE order_id='{o}';")

    def history_cases(self):
        a,sa=self.account(tokens=1); room,member,sr=self.room(a)
        game,sg=self.game(a,room,member,old=True)
        open_question=f"""UPDATE games SET first_question_opened_at=started_at WHERE id='{game}';
          UPDATE game_questions SET first_opened_at=now()-interval '14 months',revealed_at=now()-interval '14 months',
          feedback_vote='like',feedback_by_account_id='{a}',feedback_created_at=now()-interval '14 months',
          feedback_updated_at=now()-interval '14 months' WHERE game_id='{game}' AND board_position=1 AND question_position=1;"""
        end=self.end_game(game,a,old=True)
        purge=f"UPDATE game_questions SET content_snapshot=NULL,content_purged_at=clock_timestamp() WHERE game_id='{game}'; UPDATE games SET content_purged_at=clock_timestamp() WHERE id='{game}';"
        self.case("accepted game has exactly 36 copied questions",sa+sr+sg+assertion(f"(SELECT count(*) FROM game_questions WHERE game_id='{game}')=36","board shape"))
        self.case("first opening cannot be cleared to obtain an unopened refund",sa+sr+sg+open_question+f"UPDATE games SET first_question_opened_at=NULL WHERE id='{game}';","opening is permanent")
        self.case("ended game cannot be revived",sa+sr+sg+end+f"UPDATE games SET status='active',ended_at=NULL,end_reason=NULL,content_purge_after=NULL WHERE id='{game}';","terminal game cannot reopen")
        guest,gsql=self.member(room)
        self.case("host cannot remove a player after game start",sa+sr+gsql+sg+
                  f"UPDATE room_memberships SET removed_at=now() WHERE id='{guest}';","limited to the lobby")
        self.case("due content purge preserves the original host vote",sa+sr+sg+open_question+end+purge+
          assertion(f"(SELECT feedback_vote='like' FROM game_questions WHERE game_id='{game}' AND board_position=1 AND question_position=1)","purge erased vote"))
        self.case("vote edits close after actual content purge",sa+sr+sg+open_question+end+purge+
          f"UPDATE game_questions SET feedback_vote='dislike',feedback_updated_at=now() WHERE game_id='{game}' AND board_position=1 AND question_position=1;","feedback is closed")
        self.case("purge cannot leave some copied questions behind",sa+sr+sg+end+
          f"UPDATE games SET content_purged_at=clock_timestamp() WHERE id='{game}';","remove all copied payloads")
        asset=uid()
        pin=f"""INSERT INTO media_assets(id,media_kind,storage_provider,storage_namespace,storage_key,uploaded_by_staff_id)
          VALUES ('{asset}','image','cloudflare','validation','{asset}','{self.staff}');
          INSERT INTO game_question_media(game_id,board_position,question_position,media_role,media_asset_id)
          VALUES ('{game}',1,1,'prompt_image','{asset}');"""
        self.case("purged game cannot acquire a new media reference",sa+sr+sg+end+purge+pin,"cannot acquire new media pins")
        challenge=uid()
        proof=f"INSERT INTO phone_verification_challenges(id,account_id,phone_e164,purpose,otp_mac,mac_key_version,created_at,expires_at) VALUES ('{challenge}','{a}','+201012345678','sign_in',{digest(challenge)},1,now()-interval '1 day',now()-interval '23 hours');"
        self.case("expired OTP payload can redact while proof identity remains",sa+proof+
          f"UPDATE phone_verification_challenges SET redacted_at=now(),phone_e164=NULL,otp_mac=NULL,provider_message_id=NULL WHERE id='{challenge}';")
        self.case("redacted OTP proof cannot be restored or reused",sa+proof+
          f"UPDATE phone_verification_challenges SET redacted_at=now(),phone_e164=NULL,otp_mac=NULL WHERE id='{challenge}'; UPDATE phone_verification_challenges SET redacted_at=NULL,phone_e164='+201012345678',otp_mac={digest(challenge)} WHERE id='{challenge}';","cannot be reused or restored")
        old,new,change=uid(),uid(),uid()
        linked=""
        for challenge_id,purpose,phone in [(old,'phone_change_old','+201012345678'),(new,'phone_change_new','+201012345679')]:
            linked+=f"""INSERT INTO phone_verification_challenges(id,account_id,phone_e164,purpose,otp_mac,mac_key_version,
              created_at,expires_at,verified_at,consumed_at) VALUES ('{challenge_id}','{a}','{phone}','{purpose}',
              {digest(challenge_id)},1,now()-interval '1 day',now()-interval '23 hours',now()-interval '23 hours 1 minute',now()-interval '23 hours 1 minute');"""
        linked+=f"INSERT INTO account_phone_changes(id,account_id,old_phone_e164,new_phone_e164,old_phone_challenge_id,new_phone_challenge_id,changed_at) VALUES ('{change}','{a}','+201012345678','+201012345679','{old}','{new}',now()-interval '23 hours');"
        redact=f"UPDATE phone_verification_challenges SET redacted_at=now(),phone_e164=NULL,otp_mac=NULL,provider_message_id=NULL WHERE id IN ('{old}','{new}'); UPDATE account_phone_changes SET redacted_at=now(),old_phone_e164=NULL,new_phone_e164=NULL WHERE id='{change}';"
        self.case("linked phone proofs can redact without breaking their history FKs",sa+linked+redact)
        self.case("redacted phone-change payload cannot be restored",sa+linked+redact+
                  f"UPDATE account_phone_changes SET redacted_at=NULL,old_phone_e164='+201012345678',new_phone_e164='+201012345679' WHERE id='{change}';","history cannot be restored")

    def race(self,name,statements,verify):
        # Each participant uses its own psql connection and transaction. A short
        # in-transaction delay makes overlap likely; locks determine the winner.
        with ThreadPoolExecutor(max_workers=len(statements)) as pool:
            results=list(pool.map(lambda s:self.sql("BEGIN;"+s+"COMMIT;",check=False),statements))
        successes=sum(r.returncode==0 for r in results)
        if successes!=1:
            raise RuntimeError(name+f": expected one commit, got {successes}: "+str([r.stderr for r in results]))
        self.sql(verify)
        self.results.append({"name":name,"passed":True,"expected":"exactly one concurrent commit"})
        print("PASS "+name,flush=True)

    def concurrency_cases(self):
        a,sa=self.account(tokens=1)
        r1,m1,s1=self.room(a);r2,m2,s2=self.room(a)
        self.sql(sa+s1+s2)
        commands=[]
        for room,member in [(r1,m1),(r2,m2)]:
            game,sg=self.game(a,room,member)
            commands.append(f"SELECT id FROM accounts WHERE id='{a}' FOR NO KEY UPDATE; SELECT pg_sleep(0.15);"+
              assertion(f"(SELECT active_game_id IS NULL AND token_balance>=1 FROM accounts WHERE id='{a}')","account already playing or empty")+sg)
        self.race("two starts cannot spend the last token twice",commands,
          assertion(f"(SELECT token_balance FROM accounts WHERE id='{a}')=0","last-token race bank")+
          assertion(f"(SELECT count(*) FROM token_ledger_entries WHERE account_id='{a}' AND entry_kind='game_debit')=1","double start"))

        a,sa=self.account();o,so=self.web_order(a);p,sp=self.attempt(o);t,e,se=self.paymob(o,p)
        self.sql(sa+so+sp+se)
        commands=[f"SELECT id FROM token_orders WHERE id='{o}' FOR NO KEY UPDATE; SELECT pg_sleep(0.15);"+
          self.settle_web(o,t,e)+self.order_credit(o,a) for _ in range(2)]
        self.race("simultaneous payment handlers cannot double-credit",commands,
          assertion(f"(SELECT token_balance FROM accounts WHERE id='{a}')=1","duplicate callback race bank"))

        promo,ps=self.campaign(cap=1);a,sa=self.account();b,sb=self.account();self.sql(sa+sb+ps)
        commands=[]
        for buyer in [a,b]:
            o,so=self.web_order(buyer,promotion=promo,free=True)
            commands.append(so+"SELECT pg_sleep(0.15);"+self.promo_usage(o,promo,buyer,buyer)+self.order_credit(o,buyer,kind="zero_cost"))
        self.race("concurrent free orders obey the final global campaign slot",commands,
          assertion(f"(SELECT count(*) FROM promo_usages WHERE promotion_id='{promo}')=1","campaign race"))

        a,sa=self.account();room,member,sr=self.room(a)
        self.sql(sa+sr+"".join(self.member(room)[1] for _ in range(4)))
        self.race("simultaneous guests cannot exceed six including host",
          [self.member(room)[1] for _ in range(2)],
          assertion(f"(SELECT count(*) FROM room_memberships WHERE room_id='{room}' AND left_at IS NULL AND removed_at IS NULL)=6","room race"))

        a,sa=self.account();self.sql(sa)
        request=uid();o,so=self.web_order(a)
        pending=f"""SELECT id FROM accounts WHERE id='{a}' FOR NO KEY UPDATE;
          UPDATE accounts SET state='deletion_pending' WHERE id='{a}';
          INSERT INTO account_deletion_requests(id,account_id,request_key,requested_at)
            VALUES ('{request}','{a}','{uid()}',now());
          UPDATE account_deletion_requests SET funding_cleared_at=clock_timestamp() WHERE id='{request}';
          UPDATE account_deletion_requests SET state='confirmed',confirmed_bank=0,confirmed_at=clock_timestamp() WHERE id='{request}';"""
        self.locked_race("deletion serializes against new checkout admission",pending,so,"active buyer",
          assertion(f"NOT EXISTS (SELECT 1 FROM token_orders WHERE id='{o}')","checkout crossed deletion gate"))

        a,sa=self.account(tokens=1);room,member,sr=self.room(a);game,sg=self.game(a,room,member,old=True)
        self.sql(sa+sr+sg+self.end_game(game,a,old=True))
        asset=uid();self.sql(f"INSERT INTO media_assets(id,media_kind,storage_provider,storage_namespace,storage_key,uploaded_by_staff_id) VALUES ('{asset}','image','cloudflare','validation','{asset}','{self.staff}');")
        purge=f"""SELECT id FROM games WHERE id='{game}' FOR NO KEY UPDATE;
          UPDATE game_questions SET content_snapshot=NULL,content_purged_at=clock_timestamp() WHERE game_id='{game}';
          UPDATE games SET content_purged_at=clock_timestamp() WHERE id='{game}';"""
        pin=f"INSERT INTO game_question_media(game_id,board_position,question_position,media_role,media_asset_id) VALUES ('{game}',1,1,'prompt_image','{asset}');"
        self.locked_race("content purge serializes against media reference insertion",purge,pin,"cannot acquire new media pins",
          assertion(f"NOT EXISTS (SELECT 1 FROM game_question_media WHERE game_id='{game}')","purge acquired new pin"))

    def locked_race(self,name,first,second,reject,verify):
        tag="sahsah_validation_"+uid()
        with ThreadPoolExecutor(max_workers=1) as pool:
            future=pool.submit(self.sql,f"BEGIN; SET LOCAL application_name='{tag}';"+first+"SELECT pg_sleep(0.5); COMMIT;")
            deadline=time.monotonic()+4
            while self.sql(f"SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='{tag}' AND wait_event='PgSleep');").stdout.strip()!='t':
                if time.monotonic()>deadline:
                    raise RuntimeError(name+": first transaction did not reach its locked checkpoint")
                time.sleep(0.01)
            result=self.sql(second,check=False)
            future.result(timeout=5)
        if result.returncode==0 or reject not in result.stderr:
            raise RuntimeError(name+": contender was not rejected after lock: "+result.stderr)
        self.sql(verify)
        self.results.append({"name":name,"passed":True,"expected":"locked contender rejected after committed state change"})
        print("PASS "+name,flush=True)


def start_cluster(root, pg_bin):
    data,socket=root/"data",root/"socket"
    socket.mkdir(mode=0o700)
    subprocess.run([str(pg_bin/"initdb"),"-D",str(data),"--auth=trust","--no-locale","--encoding=UTF8","-U","sahsah_audit"],check=True,capture_output=True,text=True)
    subprocess.run([str(pg_bin/"pg_ctl"),"-D",str(data),"-l",str(root/"postgres.log"),"-o",
      f"-h '' -k {socket} -c shared_buffers=64MB -c max_connections=24","-w","start"],check=True,capture_output=True,text=True)
    return ["-h",str(socket),"-U","sahsah_audit"]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin",type=Path,default=Path("/usr/lib/postgresql/18/bin"))
    parser.add_argument("--report",type=Path,default=DESIGN/"validation"/"latest-results.json")
    args=parser.parse_args()
    if os.getuid()==0:
        raise SystemExit("Run as a normal user: PostgreSQL initdb rejects root.")
    if not shutil.which("psql") or not shutil.which("npm"):
        raise SystemExit("psql and npm must be on PATH; use Node 24.")
    if not subprocess.check_output(["node","--version"],text=True).startswith("v24."):
        raise SystemExit("Use Node 24 for the pinned DBML CLI.")
    started=time.monotonic()
    with tempfile.TemporaryDirectory(prefix="sahsah-db-validation-") as name:
        root=Path(name)
        connection=None
        try:
            connection=start_cluster(root,args.pg_bin)
            subprocess.run([str(args.pg_bin/"createdb"),*connection,"sahsah_validation"],check=True)
            export=root/"schema.sql"
            subprocess.run(["npm","exec","--yes","--package=@dbml/cli@10.3.1","--","dbml2sql",
              str(DESIGN/"sahsah.dbml"),"--postgres","--out-file",str(export)],check=True,cwd=root)
            audit=Audit(connection)
            for file in [export,DESIGN/"postgresql-supplement.sql",DESIGN/"postgresql-guards.sql"]:
                audit.sql(file.read_text())
            audit.initialize()
            audit.functional_cases()
            audit.concurrency_cases()
            measurements=measure(audit)
            counts=json.loads(audit.sql("""SELECT json_build_object(
              'tables',(SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'),
              'enums',(SELECT count(*) FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e'),
              'foreign_keys',(SELECT count(*) FROM pg_constraint WHERE contype='f' AND connamespace='public'::regnamespace),
              'checks',(SELECT count(*) FROM pg_constraint WHERE contype='c' AND connamespace='public'::regnamespace),
              'indexes',(SELECT count(*) FROM pg_indexes WHERE schemaname='public'),
              'partial_indexes',(SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace AND indpred IS NOT NULL));""").stdout)
            result={"schema_sha256":hashlib.sha256((DESIGN/"sahsah.dbml").read_bytes()).hexdigest(),
              "artifacts_sha256":{name:hashlib.sha256((DESIGN/name).read_bytes()).hexdigest() for name in
                ['sahsah.dbml','postgresql-supplement.sql','postgresql-guards.sql']},
              "postgresql":audit.sql("SELECT version();").stdout.strip(),"counts":counts,
              "cases":audit.results,"measurements":measurements,"elapsed_seconds":round(time.monotonic()-started,2),
              "limits":"Disposable local SQL/reference transactions only; no NestJS, Paymob, Apple/Google SDK or Railway load validation."}
            args.report.parent.mkdir(parents=True,exist_ok=True)
            args.report.write_text(json.dumps(result,indent=2)+"\n")
            print(json.dumps({"passed":len(audit.results),"counts":counts,"report":str(args.report)}),flush=True)
        finally:
            if connection:
                subprocess.run([str(args.pg_bin/"pg_ctl"),"-D",str(root/"data"),"-m","fast","-w","stop"],capture_output=True,text=True,check=True)


if __name__=="__main__":
    main()

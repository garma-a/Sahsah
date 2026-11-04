"""Synthetic local access-path measurements, called by validate_design.py.

This is an index comparison, not a game-server capacity benchmark. All competing
indexes and generated data exist only in the private validation cluster.
"""
import json


def measure(audit):
    # Ten thousand retained jobs per 20 pending/running jobs. No provider calls.
    audit.sql("""
    INSERT INTO outbox_events(id,deduplication_key,topic,resource_kind,resource_id,state,
      attempt_count,available_at,lease_token,lease_until,created_at,finished_at)
    SELECT md5('job'||i)::uuid,'synthetic-job-'||i,'validation.job','validation',md5('target'||i)::uuid,
      CASE WHEN i<=20 THEN 'pending'::work_state WHEN i<=40 THEN 'running'::work_state
           ELSE 'succeeded'::work_state END,
      CASE WHEN i<=20 THEN 0 ELSE 1 END,now()-interval '1 hour'+i*interval '1 second',
      CASE WHEN i BETWEEN 21 AND 40 THEN md5('lease'||i)::uuid END,
      CASE WHEN i BETWEEN 21 AND 40 THEN now()-interval '1 minute' END,
      now()-interval '1 day',CASE WHEN i>40 THEN now()-interval '1 hour' END
    FROM generate_series(1,100000) i;
    CREATE INDEX audit_full_outbox_pending ON outbox_events(state,available_at,id);
    CREATE INDEX audit_full_outbox_leases ON outbox_events(state,lease_until,id);
    ANALYZE outbox_events;
    """)
    owner, account_sql = audit.account()
    room, _, room_sql = audit.room(owner)
    audit.sql(account_sql + room_sql + f"""
    INSERT INTO games(id,room_id,sequence_number,status,start_request_id,start_request_digest,
      started_at,last_gameplay_at,idle_expires_at,host_account_id,team_one_name,team_two_name,
      controller_credential_hash,controller_acquired_at,ended_at,end_reason,content_purge_after,content_purged_at)
    SELECT md5('history-game'||i)::uuid,'{room}',i,'finished',md5('history-request'||i)::uuid,
      decode(repeat(md5('history-game'||i),2),'hex'),
      '2024-01-01'::timestamptz,'2024-01-01'::timestamptz,'2024-01-02'::timestamptz,
      '{owner}','A','B',decode(repeat(md5('controller'||i),2),'hex'),'2024-01-01'::timestamptz,
      '2024-01-01 01:00'::timestamptz,'host_ended','2025-01-01 01:00'::timestamptz,
      CASE WHEN i<=9950 THEN '2025-01-02'::timestamptz END
    FROM generate_series(1,10000) i;
    INSERT INTO rooms(id,owner_account_id,team_one_name,team_two_name)
      SELECT md5('active-room'||i)::uuid,'{owner}','A','B' FROM generate_series(1,50) i;
    INSERT INTO games(id,room_id,sequence_number,start_request_id,start_request_digest,
      started_at,last_gameplay_at,idle_expires_at,host_account_id,team_one_name,team_two_name,
      controller_credential_hash,controller_acquired_at)
    SELECT md5('active-game'||i)::uuid,md5('active-room'||i)::uuid,1,md5('active-request'||i)::uuid,
      decode(repeat(md5('active-game'||i),2),'hex'),now()-interval '25 hours',now()-interval '25 hours',
      now()-interval '1 hour','{owner}','A','B',decode(repeat(md5('active-controller'||i),2),'hex'),
      now()-interval '25 hours' FROM generate_series(1,50) i;
    CREATE INDEX audit_full_games_expiry ON games(status,idle_expires_at,id);
    CREATE INDEX audit_full_games_purge ON games(content_purge_after,id);
    ANALYZE games;
    """)
    # Approximately the planned catalog size: 20 * 34 * 6 = 4,080 questions.
    audit.sql("""
    INSERT INTO categories(id,name_ar)
      SELECT md5('catalog-category'||c)::uuid,'فئة '||c FROM generate_series(1,20) c;
    INSERT INTO question_packs(id,category_id,pack_number,publication_state)
      SELECT md5('catalog-pack-'||c||'-'||p)::uuid,md5('catalog-category'||c)::uuid,p,'published'
      FROM generate_series(1,20) c CROSS JOIN generate_series(1,34) p;
    INSERT INTO questions(id,pack_id,slot_number,prompt_ar,answer_ar,format)
      SELECT md5('catalog-question-'||c||'-'||p||'-'||s)::uuid,md5('catalog-pack-'||c||'-'||p)::uuid,
      s,repeat('سؤال ',60),'إجابة','STANDARD'
      FROM generate_series(1,20) c CROSS JOIN generate_series(1,34) p CROSS JOIN generate_series(1,6) s;
    ANALYZE questions;
    ANALYZE question_packs;
    """)

    queries = [
        ("pending_jobs", "outbox_events_pending_work", "audit_full_outbox_pending",
         "SELECT id FROM outbox_events WHERE state='pending' AND available_at<=now() ORDER BY available_at,id LIMIT 20"),
        ("stale_job_leases", "outbox_events_stale_leases", "audit_full_outbox_leases",
         "SELECT id FROM outbox_events WHERE state='running' AND lease_until<=now() ORDER BY lease_until,id LIMIT 20"),
        ("expired_active_games", "games_due_expiry", "audit_full_games_expiry",
         "SELECT id FROM games WHERE status='active' AND idle_expires_at<=now() ORDER BY idle_expires_at,id LIMIT 20"),
        ("content_due_for_purge", "games_due_content_purge", "audit_full_games_purge",
         "SELECT id FROM games WHERE content_purged_at IS NULL AND content_purge_after IS NOT NULL AND content_purge_after<=now() ORDER BY content_purge_after,id LIMIT 20"),
    ]
    results=[]
    for name, partial, full, query in queries:
        sizes=json.loads(audit.sql(f"SELECT json_build_object('partial_bytes',pg_relation_size('{partial}'),'full_bytes',pg_relation_size('{full}'));" ).stdout)
        current=json.loads(audit.sql("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+query).stdout)[0]
        # A transaction-local DROP removes only the partial candidate for the
        # comparison. ROLLBACK restores it before the next measured operation.
        before=json.loads(audit.sql(f"BEGIN; DROP INDEX {partial}; EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) {query}; ROLLBACK;").stdout)[0]
        if sizes['partial_bytes']>=sizes['full_bytes']:
            raise RuntimeError(name+": sparse index did not reduce its footprint")
        def indexes(node):
            return ([node['Index Name']] if 'Index Name' in node else [])+sum([indexes(n) for n in node.get('Plans',[])],[])
        chosen=indexes(current['Plan'])
        if not chosen:
            raise RuntimeError(name+": expected an indexed bounded lookup: "+str(current))
        results.append({"name":name,"sql":query,**sizes,"selected_indexes":chosen,
                        "current":current,"full_candidate_without_this_partial":before})

    # The unique current-slot path also serves the only six-row playable-pack
    # query; prove it still works without the extra full current/retired index.
    pack_sql="SELECT id FROM questions WHERE pack_id=md5('catalog-pack-1-1')::uuid AND retired_at IS NULL ORDER BY slot_number"
    without_full=json.loads(audit.sql("BEGIN; DROP INDEX IF EXISTS questions_pack_current_list; EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) "+pack_sql+"; ROLLBACK;").stdout)[0]
    if 'questions_one_current_per_pack_slot' not in indexes(without_full['Plan']):
        raise RuntimeError("six current slots lost their unique-index access path")
    audit.sql("DROP INDEX audit_full_outbox_pending; DROP INDEX audit_full_outbox_leases; DROP INDEX audit_full_games_expiry; DROP INDEX audit_full_games_purge;")
    return {"fixture":{"jobs":100000,"pending_jobs":20,"running_jobs":20,"terminal_games":10000,
             "active_games":50,"unpurged_terminal_games":50,"additional_questions":4080,
             "note":"Minimal valid measurement rows; no media transfer, network, complete historical gameplay or production traffic simulation."},
            "maintenance_queries":results,"six_current_slots_without_extra_full_index":without_full,
            "interpretation":"Index footprints and planner access paths only. Local timings are not Railway capacity or an application latency guarantee."}

-- RLA Nexo: salary occurrences live inside financial_state.snapshot JSONB.
-- Safe to run once on existing Supabase projects. It preserves historic data.
begin;
update public.nexo_state
set snapshot=jsonb_set(
  jsonb_set(snapshot,'{salary,active}',coalesce(snapshot #> '{salary,active}',snapshot #> '{salary,confirmed}','true'::jsonb),true),
  '{salary,occurrences}',coalesce(snapshot #> '{salary,occurrences}','[]'::jsonb),true
),updated_at=now()
where snapshot ? 'salary' and snapshot->'salary' <> 'null'::jsonb;
commit;

begin;

create table if not exists public.user_preferences(
 id bigint generated always as identity unique,
 user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 nexo_personality text not null default 'friendly' check(nexo_personality in ('friendly','direct','calm','analytical','adaptive')),
 response_length text not null default 'standard' check(response_length in ('short','standard','detailed')),
 use_emojis boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
drop policy if exists preferences_owner on public.user_preferences;
create policy preferences_owner on public.user_preferences for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

revoke all on public.user_preferences from anon,authenticated;
grant select,insert,update on public.user_preferences to authenticated;
grant usage,select on sequence public.user_preferences_id_seq to authenticated;

create or replace function public.nexo_preferences_read() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select jsonb_build_object('nexo_personality',p.nexo_personality,'response_length',p.response_length,'use_emojis',p.use_emojis)
 into result from public.user_preferences p where p.user_id=auth.uid();
 return coalesce(result,jsonb_build_object('nexo_personality','friendly','response_length','standard','use_emojis',false));
end;$$;

create or replace function public.nexo_preferences_save(personality text,response_length text,use_emojis boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if personality not in ('friendly','direct','calm','analytical','adaptive') then raise exception 'Invalid personality' using errcode='22023'; end if;
 if response_length not in ('short','standard','detailed') then raise exception 'Invalid response length' using errcode='22023'; end if;
 insert into public.user_preferences(user_id,nexo_personality,response_length,use_emojis)
 values(auth.uid(),personality,response_length,use_emojis)
 on conflict(user_id) do update set nexo_personality=excluded.nexo_personality,response_length=excluded.response_length,use_emojis=excluded.use_emojis,updated_at=now();
end;$$;

revoke all on function public.nexo_preferences_read(),public.nexo_preferences_save(text,text,boolean) from public,anon;
grant execute on function public.nexo_preferences_read(),public.nexo_preferences_save(text,text,boolean) to authenticated;

commit;

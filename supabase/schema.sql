-- Execute once in a NEW Supabase project's SQL Editor.
begin;
create table if not exists public.nexo_state(
 user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 snapshot jsonb not null check(octet_length(snapshot::text)<=2000000),
 revision integer not null default 0, updated_at timestamptz not null default now()
);
create table if not exists public.nexo_messages(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 role text not null check(role in ('user','assistant')),text text not null check(length(text)<=12000),created_at timestamptz not null default now()
);
create table if not exists public.nexo_chat_usage(
 user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 day date not null default current_date,count integer not null default 0,last_at timestamptz
);
create table if not exists public.user_preferences(
 id bigint generated always as identity unique,
 user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 nexo_personality text not null default 'friendly' check(nexo_personality in ('friendly','direct','calm','analytical','adaptive')),
 response_length text not null default 'standard' check(response_length in ('short','standard','detailed')),
 use_emojis boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.nexo_state enable row level security;
alter table public.nexo_messages enable row level security;
alter table public.nexo_chat_usage enable row level security;
alter table public.user_preferences enable row level security;
create policy state_owner on public.nexo_state for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy messages_owner on public.nexo_messages for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy preferences_owner on public.user_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.nexo_state,public.nexo_messages,public.nexo_chat_usage,public.user_preferences from anon,authenticated;
grant select,insert,update on public.nexo_state to authenticated;
grant select,insert,delete on public.nexo_messages to authenticated;
grant usage,select on sequence public.nexo_messages_id_seq to authenticated;
grant select,insert,update on public.user_preferences to authenticated;
grant usage,select on sequence public.user_preferences_id_seq to authenticated;
create or replace function public.nexo_read(initial_snapshot jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 insert into public.nexo_state(snapshot) values(initial_snapshot) on conflict(user_id) do nothing;
 select jsonb_build_object('snapshot',snapshot,'revision',revision) into result from public.nexo_state where user_id=auth.uid();return result;
end;$$;
create or replace function public.nexo_preferences_read() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select jsonb_build_object('exists',true,'nexo_personality',p.nexo_personality,'response_length',p.response_length,'use_emojis',p.use_emojis) into result from public.user_preferences p where p.user_id=auth.uid();
 return coalesce(result,jsonb_build_object('exists',false,'nexo_personality','friendly','response_length','standard','use_emojis',false));
end;$$;
create or replace function public.nexo_preferences_save(personality text,response_length text,use_emojis boolean) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if personality not in ('friendly','direct','calm','analytical','adaptive') or response_length not in ('short','standard','detailed') then raise exception 'Invalid preferences' using errcode='22023'; end if;
 insert into public.user_preferences(user_id,nexo_personality,response_length,use_emojis) values(auth.uid(),personality,response_length,use_emojis)
 on conflict(user_id) do update set nexo_personality=excluded.nexo_personality,response_length=excluded.response_length,use_emojis=excluded.use_emojis,updated_at=now();
end;$$;
create or replace function public.nexo_save(expected_revision integer,new_snapshot jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 update public.nexo_state set snapshot=new_snapshot,revision=revision+1,updated_at=now() where user_id=auth.uid() and revision=expected_revision;
 if not found then raise exception 'Revision conflict' using errcode='40001';end if;
end;$$;
create or replace function public.nexo_remember(user_text text,assistant_text text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 insert into public.nexo_messages(role,text) values('user',user_text),('assistant',assistant_text);
 delete from public.nexo_messages where user_id=auth.uid() and id not in(select id from public.nexo_messages where user_id=auth.uid() order by id desc limit 100);
end;$$;
-- The quota is server-owned: authenticated clients cannot reset their counter.
create or replace function public.nexo_chat_allow() returns boolean language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if auth.uid() is null then return false;end if;
 insert into public.nexo_chat_usage(user_id,day,count,last_at) values(auth.uid(),current_date,1,now())
 on conflict(user_id) do update set day=current_date,count=case when nexo_chat_usage.day=current_date then nexo_chat_usage.count+1 else 1 end,last_at=now()
 where (nexo_chat_usage.day<>current_date or nexo_chat_usage.count<30) and (nexo_chat_usage.last_at is null or nexo_chat_usage.last_at<now()-interval '5 seconds');
 get diagnostics affected=row_count;return affected=1;
end;$$;
revoke all on function public.nexo_read(jsonb),public.nexo_save(integer,jsonb),public.nexo_remember(text,text),public.nexo_chat_allow(),public.nexo_preferences_read(),public.nexo_preferences_save(text,text,boolean) from public,anon;
grant execute on function public.nexo_read(jsonb),public.nexo_save(integer,jsonb),public.nexo_remember(text,text),public.nexo_chat_allow(),public.nexo_preferences_read(),public.nexo_preferences_save(text,text,boolean) to authenticated;
commit;

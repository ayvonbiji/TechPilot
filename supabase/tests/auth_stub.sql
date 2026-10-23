-- Minimal stand-in for Supabase's auth schema so the migration can be tested
-- on plain PostgreSQL. NOT for use on a real Supabase project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz default now()
);
-- Same definition Supabase uses: works with PostgREST's request.jwt.claims JSON
-- and with the older per-claim setting used by the SQL tests.
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase grants broad default privileges on public tables; mimic that so the
-- migration's revokes are actually exercised.
alter default privileges in schema public grant all on tables to anon, authenticated;

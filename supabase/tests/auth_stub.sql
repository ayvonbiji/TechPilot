-- Minimal stand-in for Supabase's auth schema so the migration can be tested
-- on plain PostgreSQL. NOT for use on a real Supabase project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;
-- Supabase grants broad default privileges on public tables; mimic that so the
-- migration's revokes are actually exercised.
alter default privileges in schema public grant all on tables to anon, authenticated;

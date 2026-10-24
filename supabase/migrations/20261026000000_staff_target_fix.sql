-- Fix: the staff-target check on automation rules and client-technician
-- assignments ran on every update, including the "created_by = null" update
-- Postgres makes when the rule's author deletes their account. If the rule's
-- target had since left the workspace, the author could not delete their
-- account. Only validate when the target or workspace actually changes.
-- Safe to re-run; changes one function and no data.

create or replace function public.require_staff_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  col text := case when tg_table_name = 'client_technicians' then 'user_id' else 'target_user_id' end;
  target uuid := (to_jsonb(new) ->> col)::uuid;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(old) ->> col) is not distinct from (to_jsonb(new) ->> col)
     and old.workspace_id = new.workspace_id then
    return new;
  end if;
  if not public.is_staff_user(new.workspace_id, target) then
    raise exception 'Choose a technician, administrator or owner of this workspace' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.require_staff_target() from public, anon, authenticated;

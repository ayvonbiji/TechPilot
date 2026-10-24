-- Restores the previous require_staff_target() (validates on every update).
create or replace function public.require_staff_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if tg_table_name = 'client_technicians' then
    target := (to_jsonb(new) ->> 'user_id')::uuid;
  else
    target := (to_jsonb(new) ->> 'target_user_id')::uuid;
  end if;
  if not public.is_staff_user(new.workspace_id, target) then
    raise exception 'Choose a technician, administrator or owner of this workspace' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.require_staff_target() from public, anon, authenticated;

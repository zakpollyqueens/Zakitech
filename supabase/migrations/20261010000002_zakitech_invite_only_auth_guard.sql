-- Prevent public self-registration. Auth users must be created through an invitation.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create or replace function private.enforce_zakitech_invite_only()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.invited_at is null then
    raise exception 'ZakiTech accounts are invitation-only. Contact an authorized administrator.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_zakitech_invite_only() from public, anon, authenticated;
drop trigger if exists zt_invite_only_auth_users on auth.users;
create trigger zt_invite_only_auth_users
before insert on auth.users
for each row execute function private.enforce_zakitech_invite_only();

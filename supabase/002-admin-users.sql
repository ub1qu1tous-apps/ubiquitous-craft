-- Ubiquitous Craft: admin user management (patch 002).
-- Run this ONCE in Supabase: SQL Editor -> New query -> paste all -> Run.
-- Safe to run again. The same code is also at the bottom of schema.sql.
-- Needed because emails live in the protected auth.users table, which the browser can't read
-- directly: these functions check is_admin() first, then read/delete on the admin's behalf.

create or replace function public.admin_list_users()
returns table (user_id uuid, display_name text, email text, role text, created_at timestamptz)
language plpgsql security definer stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  return query
    select p.id, p.display_name, u.email::text, p.role, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at, p.display_name;
end;
$$;

-- Deletes a customer's login. Their profile and saved cart go with it (on delete cascade).
create or replace function public.admin_delete_user(target uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.';
  end if;
  if target = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;
  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'User not found.';
  end if;
  if exists (select 1 from public.profiles where id = target and role = 'admin') then
    raise exception 'Admin accounts cannot be deleted here.';
  end if;
  delete from auth.users where id = target;
end;
$$;

revoke all on function public.admin_list_users(), public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_list_users(), public.admin_delete_user(uuid) to authenticated;

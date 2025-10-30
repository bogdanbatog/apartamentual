-- Update helper to avoid recursive RLS evaluation
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
set row_security = off
as $$
  select coalesce(
    (select is_super_admin from public.profiles where user_id = auth.uid()),
    false
  );
$$;

-- Remove recursive self-referencing profiles policy
drop policy if exists "Super admins can update any profile" on public.profiles;

-- Replace user self-update policy to avoid subselect into profiles
drop policy if exists "Users can update their own profile except admin status" on public.profiles;
create policy "Users can update their own profile except admin status"
on public.profiles
for update
 to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (public.is_super_admin() or is_super_admin = false)
);

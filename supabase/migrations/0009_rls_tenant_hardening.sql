-- AgendaFlow 0009: tenant RLS hardening and relational integrity.
-- Apply after 0008_trial_access_security.sql. This migration intentionally
-- removes EVERY existing policy on the six tenant tables and recreates a
-- reviewed, explicit policy set. This prevents stale permissive policies
-- from being OR-combined with the hardened policies.

begin;

-- Prevent API roles from creating objects in public that could shadow objects
-- referenced by SECURITY DEFINER routines.
revoke create on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Remove all policies on the tenant-owned tables, regardless of legacy name.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'businesses', 'services', 'working_hours',
        'customers', 'appointments', 'blocked_times'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      p.policyname, p.schemaname, p.tablename
    );
  end loop;
end;
$$;

-- Revoke broad table privileges; grant only what the app requires.
revoke all on table public.businesses, public.services, public.working_hours,
  public.customers, public.appointments, public.blocked_times
from anon, authenticated;

grant select, insert on table public.businesses to authenticated;
grant update (name, slug, phone, timezone, sector)
  on table public.businesses to authenticated;

grant select, insert, update, delete on table public.services,
  public.working_hours, public.customers, public.appointments, public.blocked_times
to authenticated;

-- Businesses: the owner can see subscription status, but cannot self-delete
-- or alter subscription/trial/payment columns through the Data API.
create policy "af_business_owner_select"
on public.businesses for select to authenticated
using (owner_id = (select auth.uid()));

create policy "af_business_owner_insert_trial"
on public.businesses for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and subscription_status = 'trial'
  and trial_started_at >= now() - interval '10 minutes'
  and trial_started_at <= now()
  and trial_ends_at > now()
  and trial_ends_at <= trial_started_at + interval '7 days'
  and trial_ends_at <= now() + interval '7 days'
  and subscription_period_end is null
  and mp_preapproval_id is null
);

create policy "af_business_owner_update_active"
on public.businesses for update to authenticated
using (
  owner_id = (select auth.uid())
  and public.agendaflow_business_access(id)
)
with check (
  owner_id = (select auth.uid())
  and public.agendaflow_business_access(id)
);

-- Each operational row is scoped to an owned business whose subscription
-- currently grants access. Both USING and WITH CHECK are required.
create policy "af_services_tenant_access"
on public.services for all to authenticated
using (public.agendaflow_business_access(business_id))
with check (public.agendaflow_business_access(business_id));

create policy "af_hours_tenant_access"
on public.working_hours for all to authenticated
using (public.agendaflow_business_access(business_id))
with check (public.agendaflow_business_access(business_id));

create policy "af_customers_tenant_access"
on public.customers for all to authenticated
using (public.agendaflow_business_access(business_id))
with check (public.agendaflow_business_access(business_id));

create policy "af_appointments_tenant_access"
on public.appointments for all to authenticated
using (public.agendaflow_business_access(business_id))
with check (public.agendaflow_business_access(business_id));

create policy "af_blocked_times_tenant_access"
on public.blocked_times for all to authenticated
using (public.agendaflow_business_access(business_id))
with check (public.agendaflow_business_access(business_id));

-- Defense in depth: a reservation cannot reference a customer belonging to
-- another business, even if a client tampers with customer_id.
create or replace function public.agendaflow_validate_appointment_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = new.customer_id
      and c.business_id = new.business_id
  ) then
    raise exception 'El cliente no pertenece a este negocio'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke all on function public.agendaflow_validate_appointment_customer()
from public, anon, authenticated;

drop trigger if exists agendaflow_validate_appointment_customer
on public.appointments;

create trigger agendaflow_validate_appointment_customer
before insert or update of business_id, customer_id
on public.appointments
for each row
execute function public.agendaflow_validate_appointment_customer();

-- Keep public access limited to the intended booking endpoints only.
revoke all on function public.get_public_booking_data(text)
from public;
grant execute on function public.get_public_booking_data(text)
to anon, authenticated;

revoke all on function public.create_public_appointment(
  text, uuid, timestamptz, text, text, text
) from public;
grant execute on function public.create_public_appointment(
  text, uuid, timestamptz, text, text, text
) to anon, authenticated;

commit;

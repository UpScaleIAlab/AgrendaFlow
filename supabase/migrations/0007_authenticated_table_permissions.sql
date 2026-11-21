-- AgendaFlow: explicitly grant authenticated users table privileges.
-- RLS remains the tenant boundary; anon receives data only through SECURITY DEFINER RPCs.
grant usage on schema public to anon, authenticated;

revoke all on table public.businesses, public.services, public.working_hours,
  public.customers, public.appointments, public.blocked_times from anon;

grant select, insert, update, delete on table public.businesses, public.services,
  public.working_hours, public.customers, public.appointments, public.blocked_times
to authenticated;

alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.blocked_times enable row level security;

-- Recreate the expected owner policies so this migration also repairs
-- projects where the original policy setup was incomplete.
drop policy if exists "owner manages business" on public.businesses;
create policy "owner manages business" on public.businesses
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "owner manages services" on public.services;
create policy "owner manages services" on public.services
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = services.business_id and b.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = services.business_id and b.owner_id = (select auth.uid())
  ));

drop policy if exists "owner manages hours" on public.working_hours;
create policy "owner manages hours" on public.working_hours
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = working_hours.business_id and b.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = working_hours.business_id and b.owner_id = (select auth.uid())
  ));

drop policy if exists "owner manages customers" on public.customers;
create policy "owner manages customers" on public.customers
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = customers.business_id and b.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = customers.business_id and b.owner_id = (select auth.uid())
  ));

drop policy if exists "owner manages appointments" on public.appointments;
create policy "owner manages appointments" on public.appointments
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = appointments.business_id and b.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = appointments.business_id and b.owner_id = (select auth.uid())
  ));

drop policy if exists "owner manages blocked times" on public.blocked_times;
create policy "owner manages blocked times" on public.blocked_times
  for all to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = blocked_times.business_id and b.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = blocked_times.business_id and b.owner_id = (select auth.uid())
  ));

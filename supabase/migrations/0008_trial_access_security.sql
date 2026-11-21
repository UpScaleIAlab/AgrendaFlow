-- AgendaFlow 0008: enforcement de demo y permisos de acceso.
-- El estado de suscripción solo lo puede cambiar un proceso confiable (webhook/backend service role).
alter table public.businesses
  add column if not exists subscription_status text not null default 'trial'
    check (subscription_status in ('trial','active','past_due','cancelled','expired')),
  add column if not exists subscription_period_end timestamptz,
  add column if not exists mp_preapproval_id text;

-- Compatibilidad: negocios existentes sin fecha reciben un último periodo de transición de 7 días.
update public.businesses
set trial_started_at=coalesce(trial_started_at,now()),
    trial_ends_at=coalesce(trial_ends_at,now()+interval '7 days'),
    subscription_status=coalesce(subscription_status,'trial')
where trial_ends_at is null;

-- El dueño puede consultar su estado para mostrar la pantalla de renovación.
-- El acceso a datos operativos se valida siempre en PostgreSQL, no solo en la UI.
create or replace function public.agendaflow_business_access(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = p_business_id
      and b.owner_id = (select auth.uid())
      and (
        (b.subscription_status = 'trial' and b.trial_ends_at > now())
        or
        (b.subscription_status = 'active' and b.subscription_period_end > now())
      )
  );
$$;

revoke all on function public.agendaflow_business_access(uuid) from public, anon;
grant execute on function public.agendaflow_business_access(uuid) to authenticated;

-- Businesses: el propietario siempre puede consultar el estado de su cuenta,
-- pero no puede modificar ni extender su prueba desde el cliente.
drop policy if exists "owner manages business" on public.businesses;
create policy "owner reads business" on public.businesses
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner creates business" on public.businesses
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and subscription_status = 'trial'
    and trial_started_at between now()-interval '10 minutes' and now()
    and trial_ends_at > now()
    and trial_ends_at <= trial_started_at+interval '7 days'
    and trial_ends_at <= now()+interval '7 days'
    and subscription_period_end is null
    and mp_preapproval_id is null
  );
create policy "owner updates business while active" on public.businesses
  for update to authenticated
  using (owner_id = (select auth.uid()) and public.agendaflow_business_access(id))
  with check (owner_id = (select auth.uid()) and public.agendaflow_business_access(id));
create policy "owner deletes business while active" on public.businesses
  for delete to authenticated
  using (owner_id = (select auth.uid()) and public.agendaflow_business_access(id));

-- Datos del negocio: al vencer el periodo, RLS bloquea lectura y escritura.
drop policy if exists "owner manages services" on public.services;
create policy "business access services" on public.services for all to authenticated
  using (public.agendaflow_business_access(business_id))
  with check (public.agendaflow_business_access(business_id));
drop policy if exists "owner manages hours" on public.working_hours;
create policy "business access hours" on public.working_hours for all to authenticated
  using (public.agendaflow_business_access(business_id))
  with check (public.agendaflow_business_access(business_id));
drop policy if exists "owner manages customers" on public.customers;
create policy "business access customers" on public.customers for all to authenticated
  using (public.agendaflow_business_access(business_id))
  with check (public.agendaflow_business_access(business_id));
drop policy if exists "owner manages appointments" on public.appointments;
create policy "business access appointments" on public.appointments for all to authenticated
  using (public.agendaflow_business_access(business_id))
  with check (public.agendaflow_business_access(business_id));
drop policy if exists "owner manages blocked times" on public.blocked_times;
create policy "business access blocked times" on public.blocked_times for all to authenticated
  using (public.agendaflow_business_access(business_id))
  with check (public.agendaflow_business_access(business_id));

-- Impide que el navegador cambie trial_ends_at o active/status/IDs de pago.
create or replace function public.agendaflow_protect_subscription_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres','supabase_admin') then
    if new.trial_started_at is distinct from old.trial_started_at
       or new.trial_ends_at is distinct from old.trial_ends_at
       or new.subscription_status is distinct from old.subscription_status
       or new.subscription_period_end is distinct from old.subscription_period_end
       or new.mp_preapproval_id is distinct from old.mp_preapproval_id then
      raise exception 'Los datos de suscripción solo pueden modificarse desde el servidor autorizado'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agendaflow_protect_subscription_fields on public.businesses;
create trigger agendaflow_protect_subscription_fields
before update on public.businesses
for each row execute function public.agendaflow_protect_subscription_fields();
revoke all on function public.agendaflow_protect_subscription_fields() from public, anon, authenticated;

-- Defense in depth: bloquea operaciones de escritura, incluidas las RPC públicas,
-- si la prueba venció. El rol service_role se reserva para backend/webhooks.
create or replace function public.agendaflow_require_active_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_business_id uuid;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  v_business_id := coalesce(new.business_id, old.business_id);
  if not exists (
    select 1 from public.businesses b
    where b.id = v_business_id
      and ((b.subscription_status='trial' and b.trial_ends_at>now())
        or (b.subscription_status='active' and b.subscription_period_end>now()))
  ) then
    raise exception 'La prueba de AgendaFlow terminó. Activa tu suscripción para continuar.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$;

drop trigger if exists agendaflow_gate_services on public.services;
create trigger agendaflow_gate_services before insert or update or delete on public.services
for each row execute function public.agendaflow_require_active_business();
drop trigger if exists agendaflow_gate_hours on public.working_hours;
create trigger agendaflow_gate_hours before insert or update or delete on public.working_hours
for each row execute function public.agendaflow_require_active_business();
drop trigger if exists agendaflow_gate_customers on public.customers;
create trigger agendaflow_gate_customers before insert or update or delete on public.customers
for each row execute function public.agendaflow_require_active_business();
drop trigger if exists agendaflow_gate_appointments on public.appointments;
create trigger agendaflow_gate_appointments before insert or update or delete on public.appointments
for each row execute function public.agendaflow_require_active_business();
drop trigger if exists agendaflow_gate_blocked_times on public.blocked_times;
create trigger agendaflow_gate_blocked_times before insert or update or delete on public.blocked_times
for each row execute function public.agendaflow_require_active_business();
revoke all on function public.agendaflow_require_active_business() from public, anon, authenticated;

-- La agenda pública también se suspende al terminar el periodo gratuito.
create or replace function public.get_public_booking_data(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_result jsonb;
begin
  select * into v_business from public.businesses where slug=p_slug;
  if not found then return null; end if;
  if not (
    (v_business.subscription_status='trial' and v_business.trial_ends_at>now())
    or (v_business.subscription_status='active' and v_business.subscription_period_end>now())
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'business',jsonb_build_object('name',v_business.name,'phone',v_business.phone,'slug',v_business.slug,'timezone',v_business.timezone),
    'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'duration',s.duration_minutes,'price',s.price_clp) order by s.name) from public.services s where s.business_id=v_business.id and s.active=true),'[]'::jsonb),
    'hours',coalesce((select jsonb_agg(jsonb_build_object('weekday',h.weekday,'enabled',h.enabled,'opens_at',h.opens_at,'closes_at',h.closes_at) order by h.weekday) from public.working_hours h where h.business_id=v_business.id),'[]'::jsonb),
    'busy',coalesce((select jsonb_agg(jsonb_build_object('starts_at',x.starts_at,'ends_at',x.ends_at)) from (
      select a.starts_at,a.ends_at from public.appointments a where a.business_id=v_business.id and a.status<>'cancelled' and a.ends_at>now()
      union all select bt.starts_at,bt.ends_at from public.blocked_times bt where bt.business_id=v_business.id and bt.ends_at>now()
    ) x),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_public_booking_data(text) from public;
grant execute on function public.get_public_booking_data(text) to anon, authenticated;

-- RPC pública: el trigger de appointments valida el periodo y revierte toda la
-- transacción si está vencido (incluida la inserción/actualización de cliente).

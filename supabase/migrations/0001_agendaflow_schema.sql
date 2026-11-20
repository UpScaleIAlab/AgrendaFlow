-- AgendaFlow: base de datos mínima para agenda, servicios, clientes y bloqueos.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
do $$ begin
  create type public.appointment_status as enum ('pending','confirmed','cancelled','completed');
exception when duplicate_object then null; end $$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, slug text not null unique, phone text not null default '', timezone text not null default 'America/Santiago', created_at timestamptz not null default now()
);
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, duration_minutes integer not null default 30 check(duration_minutes between 5 and 600),
  price_clp integer not null default 0 check(price_clp>=0), active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6), opens_at time not null, closes_at time not null,
  enabled boolean not null default true, check(closes_at>opens_at), unique(business_id,weekday)
);
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  full_name text not null, phone text not null, created_at timestamptz not null default now(), unique(business_id,phone)
);
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict, service_id uuid references public.services(id) on delete set null,
  starts_at timestamptz not null, ends_at timestamptz not null, status public.appointment_status not null default 'pending',
  notes text, created_at timestamptz not null default now(), check(ends_at>starts_at)
);
create table if not exists public.blocked_times (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, reason text not null default 'No disponible',
  created_at timestamptz not null default now(), check(ends_at>starts_at)
);
create index if not exists appointments_business_starts_idx on public.appointments(business_id,starts_at);
create index if not exists customers_business_name_idx on public.customers(business_id,full_name);

alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.blocked_times enable row level security;
do $$ begin
 create policy "owner manages business" on public.businesses for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "owner manages services" on public.services for all using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())) with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "owner manages hours" on public.working_hours for all using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())) with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "owner manages customers" on public.customers for all using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())) with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "owner manages appointments" on public.appointments for all using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())) with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "owner manages blocked times" on public.blocked_times for all using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid())) with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));
exception when duplicate_object then null; end $$;

-- El formulario público usa esta función para crear una reserva de forma atómica.
-- La función valida negocio, servicio, jornada, bloqueos y cruces de horario.
create or replace function public.create_public_appointment(
  p_slug text, p_service_id uuid, p_starts_at timestamptz, p_full_name text, p_phone text, p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_business businesses%rowtype; v_service services%rowtype; v_customer_id uuid; v_appointment_id uuid; v_end timestamptz; v_weekday smallint; v_hours working_hours%rowtype;
begin
 select * into v_business from businesses where slug=p_slug;
 if not found then raise exception 'Negocio no encontrado'; end if;
 if trim(coalesce(p_full_name,''))='' or trim(coalesce(p_phone,''))='' then raise exception 'Nombre y teléfono son obligatorios'; end if;
 if p_starts_at<=now() then raise exception 'La hora debe ser futura'; end if;
 select * into v_service from services where id=p_service_id and business_id=v_business.id and active=true;
 if not found then raise exception 'Servicio no disponible'; end if;
 v_end:=p_starts_at + make_interval(mins=>v_service.duration_minutes);
 v_weekday:=extract(dow from p_starts_at at time zone v_business.timezone)::smallint;
 select * into v_hours from working_hours where business_id=v_business.id and weekday=v_weekday and enabled=true;
 if not found or (p_starts_at at time zone v_business.timezone)::time < v_hours.opens_at or (v_end at time zone v_business.timezone)::time > v_hours.closes_at then raise exception 'Fuera del horario de atención'; end if;
 perform pg_advisory_xact_lock(hashtext(v_business.id::text));
 if exists(select 1 from blocked_times b where b.business_id=v_business.id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_starts_at,v_end,'[)')) then raise exception 'Horario bloqueado'; end if;
 if exists(select 1 from appointments a where a.business_id=v_business.id and a.status<>'cancelled' and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_starts_at,v_end,'[)')) then raise exception 'Horario ocupado'; end if;
 insert into customers(business_id,full_name,phone) values(v_business.id,trim(p_full_name),trim(p_phone)) on conflict(business_id,phone) do update set full_name=excluded.full_name returning id into v_customer_id;
 insert into appointments(business_id,customer_id,service_id,starts_at,ends_at,status,notes) values(v_business.id,v_customer_id,v_service.id,p_starts_at,v_end,'pending',nullif(trim(coalesce(p_notes,'')),'')) returning id into v_appointment_id;
 return v_appointment_id;
end; $$;
revoke all on function public.create_public_appointment(text,uuid,timestamptz,text,text,text) from public;
grant execute on function public.create_public_appointment(text,uuid,timestamptz,text,text,text) to anon, authenticated;

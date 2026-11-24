-- URLs públicas legibles para reservas, manteniendo vigentes los enlaces antiguos.
-- Los IDs internos y las reservas no se modifican.
create table if not exists public.business_slug_aliases (
  old_slug text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.business_slug_aliases enable row level security;
revoke all on public.business_slug_aliases from anon, authenticated;

-- Guardamos los slugs actuales para que los enlaces compartidos sigan funcionando.
insert into public.business_slug_aliases(old_slug,business_id)
select slug,id from public.businesses
on conflict(old_slug) do nothing;

-- Liberamos el índice único antes de asignar los nuevos slugs.
update public.businesses
set slug='legacy-'||replace(id::text,'-','')
where slug is distinct from 'legacy-'||replace(id::text,'-','');

with normalized as (
  select id,
    coalesce(nullif(trim(both '-' from regexp_replace(
      lower(unaccent(name)), '[^a-z0-9]+', '-', 'g'
    )),''),'negocio') as base
  from public.businesses
), ranked as (
  select id,base,row_number() over(partition by base order by created_at,id) as ordinal
  from normalized n join public.businesses b using(id)
)
update public.businesses b
set slug=case when r.ordinal=1 then r.base else r.base||'-'||r.ordinal end
from ranked r where b.id=r.id;

-- Los RPC públicos aceptan tanto el slug nuevo como el enlace antiguo.
create or replace function public.get_public_booking_data(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_business public.businesses%rowtype;
  v_result jsonb;
begin
  select b.* into v_business
  from public.businesses b
  where b.slug=p_slug
     or exists(select 1 from public.business_slug_aliases a
               where a.old_slug=p_slug and a.business_id=b.id)
  order by (b.slug=p_slug) desc
  limit 1;

  if not found then return null; end if;

  select jsonb_build_object(
    'business', jsonb_build_object(
      'name', v_business.name,
      'phone', v_business.phone,
      'slug', v_business.slug,
      'timezone', v_business.timezone
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'duration',s.duration_minutes,'price',s.price_clp) order by s.name)
      from public.services s where s.business_id=v_business.id and s.active=true
    ), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object('weekday',h.weekday,'enabled',h.enabled,'opens_at',h.opens_at,'closes_at',h.closes_at) order by h.weekday)
      from public.working_hours h where h.business_id=v_business.id
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('starts_at',x.starts_at,'ends_at',x.ends_at))
      from (
        select a.starts_at,a.ends_at from public.appointments a
        where a.business_id=v_business.id and a.status<>'cancelled' and a.ends_at>now()
        union all
        select bt.starts_at,bt.ends_at from public.blocked_times bt
        where bt.business_id=v_business.id and bt.ends_at>now()
      ) x
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_public_booking_data(text) from public;
grant execute on function public.get_public_booking_data(text) to anon, authenticated;

create or replace function public.create_public_appointment(
  p_slug text,p_service_id uuid,p_starts_at timestamptz,p_full_name text,p_phone text,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_business public.businesses%rowtype;
  v_service public.services%rowtype;
  v_customer_id uuid;
  v_appointment_id uuid;
  v_end timestamptz;
  v_weekday smallint;
  v_hours public.working_hours%rowtype;
begin
  select b.* into v_business
  from public.businesses b
  where b.slug=p_slug
     or exists(select 1 from public.business_slug_aliases a where a.old_slug=p_slug and a.business_id=b.id)
  order by (b.slug=p_slug) desc
  limit 1;
  if not found then raise exception 'Negocio no encontrado'; end if;
  if trim(coalesce(p_full_name,''))='' or trim(coalesce(p_phone,''))='' then raise exception 'Nombre y teléfono son obligatorios'; end if;
  if p_starts_at<=now() then raise exception 'La hora debe ser futura'; end if;
  select * into v_service from public.services where id=p_service_id and business_id=v_business.id and active=true;
  if not found then raise exception 'Servicio no disponible'; end if;
  v_end:=p_starts_at+make_interval(mins=>v_service.duration_minutes);
  v_weekday:=extract(dow from p_starts_at at time zone v_business.timezone)::smallint;
  select * into v_hours from public.working_hours where business_id=v_business.id and weekday=v_weekday and enabled=true;
  if not found or (p_starts_at at time zone v_business.timezone)::time<v_hours.opens_at
    or (v_end at time zone v_business.timezone)::time>v_hours.closes_at then raise exception 'Fuera del horario de atención'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_business.id::text,0));
  if exists(select 1 from public.blocked_times b where b.business_id=v_business.id and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_starts_at,v_end,'[)')) then raise exception 'Horario bloqueado'; end if;
  if exists(select 1 from public.appointments a where a.business_id=v_business.id and a.status<>'cancelled' and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_starts_at,v_end,'[)')) then raise exception 'Horario ocupado'; end if;
  insert into public.customers(business_id,full_name,phone) values(v_business.id,trim(p_full_name),trim(p_phone))
  on conflict(business_id,phone) do update set full_name=excluded.full_name returning id into v_customer_id;
  insert into public.appointments(business_id,customer_id,service_id,starts_at,ends_at,status,notes)
  values(v_business.id,v_customer_id,v_service.id,p_starts_at,v_end,'pending',nullif(trim(coalesce(p_notes,'')),'')) returning id into v_appointment_id;
  return v_appointment_id;
end;
$$;
revoke all on function public.create_public_appointment(text,uuid,timestamptz,text,text,text) from public;
grant execute on function public.create_public_appointment(text,uuid,timestamptz,text,text,text) to anon, authenticated;

-- Bloqueos que se repiten semanalmente en los días elegidos.
create table if not exists public.weekly_blocked_times (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 weekdays smallint[] not null check(cardinality(weekdays)>0 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
 starts_at time not null,
 ends_at time not null,
 reason text not null default 'No disponible',
 created_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
create index if not exists weekly_blocked_business_idx on public.weekly_blocked_times(business_id);
alter table public.weekly_blocked_times enable row level security;
drop policy if exists "owner manages weekly blocked times" on public.weekly_blocked_times;
create policy "owner manages weekly blocked times" on public.weekly_blocked_times
 for all using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()))
 with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=auth.uid()));

-- La agenda pública recibe reglas recurrentes y las aplica al día que el cliente consulta.
create or replace function public.get_public_booking_data(p_slug text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_business businesses%rowtype; v_result jsonb;
begin
 select * into v_business from public.businesses where slug=p_slug;
 if not found then return null; end if;
 select jsonb_build_object(
  'business',jsonb_build_object('name',v_business.name,'phone',v_business.phone,'slug',v_business.slug,'timezone',v_business.timezone,'sector',v_business.sector),
  'services',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'duration',s.duration_minutes,'price',s.price_clp) order by s.name) from public.services s where s.business_id=v_business.id and s.active=true),'[]'::jsonb),
  'hours',coalesce((select jsonb_agg(jsonb_build_object('weekday',h.weekday,'enabled',h.enabled,'opens_at',h.opens_at,'closes_at',h.closes_at) order by h.weekday) from public.working_hours h where h.business_id=v_business.id),'[]'::jsonb),
  'busy',coalesce((select jsonb_agg(jsonb_build_object('starts_at',x.starts_at,'ends_at',x.ends_at)) from (
    select a.starts_at,a.ends_at from public.appointments a where a.business_id=v_business.id and a.status<>'cancelled' and a.ends_at>now()
    union all select b.starts_at,b.ends_at from public.blocked_times b where b.business_id=v_business.id and b.ends_at>now()
  ) x),'[]'::jsonb),
  'weekly_busy',coalesce((select jsonb_agg(jsonb_build_object('weekdays',w.weekdays,'starts_at',w.starts_at,'ends_at',w.ends_at,'reason',w.reason)) from public.weekly_blocked_times w where w.business_id=v_business.id),'[]'::jsonb)
 ) into v_result;
 return v_result;
end; $$;
revoke all on function public.get_public_booking_data(text) from public;
grant execute on function public.get_public_booking_data(text) to anon,authenticated;

-- Evita que el formulario público permita reservar sobre un bloqueo recurrente.
create or replace function public.create_public_appointment(
 p_slug text,p_service_id uuid,p_starts_at timestamptz,p_full_name text,p_phone text,p_rut text default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_business businesses%rowtype; v_service services%rowtype; v_customer_id uuid; v_appointment_id uuid; v_end timestamptz; v_weekday smallint; v_hours working_hours%rowtype; v_rut text; v_local_start time; v_local_end time;
begin
 select * into v_business from businesses where slug=p_slug;
 if not found then raise exception 'Negocio no encontrado'; end if;
 if trim(coalesce(p_full_name,''))='' or trim(coalesce(p_phone,''))='' then raise exception 'Nombre y teléfono son obligatorios'; end if;
 v_rut:=nullif(trim(coalesce(p_rut,'')),'');
 if v_business.sector='health' and v_rut is null then raise exception 'El RUT es obligatorio para reservar en salud o atención clínica'; end if;
 if p_starts_at<=now() then raise exception 'La hora debe ser futura'; end if;
 select * into v_service from services where id=p_service_id and business_id=v_business.id and active=true;
 if not found then raise exception 'Servicio no disponible'; end if;
 v_end:=p_starts_at+make_interval(mins=>v_service.duration_minutes);
 v_weekday:=extract(dow from p_starts_at at time zone v_business.timezone)::smallint;
 v_local_start:=(p_starts_at at time zone v_business.timezone)::time;
 v_local_end:=(v_end at time zone v_business.timezone)::time;
 select * into v_hours from working_hours where business_id=v_business.id and weekday=v_weekday and enabled=true;
 if not found or v_local_start<v_hours.opens_at or v_local_end>v_hours.closes_at then raise exception 'Fuera del horario de atención'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_business.id::text,0));
 if exists(select 1 from blocked_times b where b.business_id=v_business.id and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,v_end,'[)')) then raise exception 'Horario bloqueado'; end if;
 if exists(select 1 from weekly_blocked_times w where w.business_id=v_business.id and v_weekday=any(w.weekdays) and v_local_start<w.ends_at and v_local_end>w.starts_at) then raise exception 'Horario bloqueado semanalmente'; end if;
 if exists(select 1 from appointments a where a.business_id=v_business.id and a.status<>'cancelled' and tstzrange(a.starts_at,a.ends_at,'[)')&&tstzrange(p_starts_at,v_end,'[)')) then raise exception 'Horario ocupado'; end if;
 insert into customers(business_id,full_name,phone,rut) values(v_business.id,trim(p_full_name),trim(p_phone),case when v_business.sector='health' then v_rut else null end)
 on conflict(business_id,phone) do update set full_name=excluded.full_name,rut=coalesce(excluded.rut,customers.rut)
 returning id into v_customer_id;
 insert into appointments(business_id,customer_id,service_id,starts_at,ends_at,status,notes) values(v_business.id,v_customer_id,v_service.id,p_starts_at,v_end,'pending',nullif(trim(coalesce(p_notes,'')),'')) returning id into v_appointment_id;
 return v_appointment_id;
end; $$;
revoke all on function public.create_public_appointment(text,uuid,timestamptz,text,text,text,text) from public;
grant execute on function public.create_public_appointment(text,uuid,timestamptz,text,text,text,text) to anon,authenticated;

-- AgendaFlow: use the same advisory-lock key in public and dashboard booking writes.
-- Migration 0005 uses hashtextextended in the appointment trigger.
-- Recreate the public RPC with that exact key so both paths serialize together.
create or replace function public.create_public_appointment(
  p_slug text, p_service_id uuid, p_starts_at timestamptz, p_full_name text, p_phone text, p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_business businesses%rowtype;
  v_service services%rowtype;
  v_customer_id uuid;
  v_appointment_id uuid;
  v_end timestamptz;
  v_weekday smallint;
  v_hours working_hours%rowtype;
begin
  select * into v_business from businesses where slug=p_slug;
  if not found then raise exception 'Negocio no encontrado'; end if;
  if trim(coalesce(p_full_name,''))='' or trim(coalesce(p_phone,''))='' then
    raise exception 'Nombre y teléfono son obligatorios';
  end if;
  if p_starts_at<=now() then raise exception 'La hora debe ser futura'; end if;
  select * into v_service from services
  where id=p_service_id and business_id=v_business.id and active=true;
  if not found then raise exception 'Servicio no disponible'; end if;
  v_end:=p_starts_at+make_interval(mins=>v_service.duration_minutes);
  v_weekday:=extract(dow from p_starts_at at time zone v_business.timezone)::smallint;
  select * into v_hours from working_hours
  where business_id=v_business.id and weekday=v_weekday and enabled=true;
  if not found
    or (p_starts_at at time zone v_business.timezone)::time<v_hours.opens_at
    or (v_end at time zone v_business.timezone)::time>v_hours.closes_at then
    raise exception 'Fuera del horario de atención';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_business.id::text,0));

  if exists(select 1 from blocked_times b where b.business_id=v_business.id
    and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_starts_at,v_end,'[)')) then
    raise exception 'Horario bloqueado';
  end if;
  if exists(select 1 from appointments a where a.business_id=v_business.id
    and a.status<>'cancelled'
    and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(p_starts_at,v_end,'[)')) then
    raise exception 'Horario ocupado';
  end if;

  insert into customers(business_id,full_name,phone)
  values(v_business.id,trim(p_full_name),trim(p_phone))
  on conflict(business_id,phone) do update set full_name=excluded.full_name
  returning id into v_customer_id;

  insert into appointments(business_id,customer_id,service_id,starts_at,ends_at,status,notes)
  values(v_business.id,v_customer_id,v_service.id,p_starts_at,v_end,'pending',nullif(trim(coalesce(p_notes,'')),'' ))
  returning id into v_appointment_id;
  return v_appointment_id;
end;
$$;
revoke all on function public.create_public_appointment(text,uuid,timestamptz,text,text,text) from public;
grant execute on function public.create_public_appointment(text,uuid,timestamptz,text,text,text) to anon, authenticated;

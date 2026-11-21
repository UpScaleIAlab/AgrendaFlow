-- AgendaFlow: integrity checks for all appointment channels (dashboard and public booking).
-- Existing overlapping active reservations are soft-cancelled, preserving their records.
update public.appointments newer
set status='cancelled'
where newer.status<>'cancelled'
and exists (
  select 1 from public.appointments older
  where older.business_id=newer.business_id
    and older.id<>newer.id
    and older.status<>'cancelled'
    and tstzrange(older.starts_at,older.ends_at,'[)') && tstzrange(newer.starts_at,newer.ends_at,'[)')
    and (older.created_at,older.id)<(newer.created_at,newer.id)
);

create or replace function public.agendaflow_validate_appointment()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_timezone text;
  v_weekday smallint;
  v_open time;
  v_close time;
  v_duration integer;
begin
  if new.status='cancelled' then
    return new;
  end if;
  if new.ends_at<=new.starts_at then
    raise exception 'La hora de término debe ser posterior al inicio';
  end if;

  -- Serialize all appointment writers for this business to prevent race conditions.
  perform pg_advisory_xact_lock(hashtextextended(new.business_id::text,0));

  select timezone into v_timezone from public.businesses where id=new.business_id;
  if not found then raise exception 'Negocio no encontrado'; end if;

  if new.service_id is not null then
    select duration_minutes into v_duration
    from public.services
    where id=new.service_id and business_id=new.business_id and active=true;
    if not found then raise exception 'Servicio no disponible'; end if;
    if new.ends_at<>new.starts_at+make_interval(mins=>v_duration) then
      raise exception 'La duración de la reserva no coincide con el servicio';
    end if;
  end if;

  v_weekday:=extract(dow from new.starts_at at time zone v_timezone)::smallint;
  select opens_at,closes_at into v_open,v_close
  from public.working_hours
  where business_id=new.business_id and weekday=v_weekday and enabled=true;
  if not found
    or (new.starts_at at time zone v_timezone)::time<v_open
    or (new.ends_at at time zone v_timezone)::time>v_close then
    raise exception 'Fuera del horario de atención';
  end if;

  if exists(
    select 1 from public.blocked_times b
    where b.business_id=new.business_id
      and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then raise exception 'Horario bloqueado'; end if;

  if exists(
    select 1 from public.appointments a
    where a.business_id=new.business_id
      and a.id is distinct from new.id
      and a.status<>'cancelled'
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then raise exception 'Horario ocupado'; end if;

  return new;
end;
$$;

drop trigger if exists agendaflow_validate_appointment on public.appointments;
create trigger agendaflow_validate_appointment
before insert or update of business_id,starts_at,ends_at,status,service_id
on public.appointments
for each row execute function public.agendaflow_validate_appointment();

create or replace function public.agendaflow_validate_blocked_time()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.ends_at<=new.starts_at then
    raise exception 'El bloqueo debe terminar después de comenzar';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.business_id::text,0));
  if exists(
    select 1 from public.appointments a
    where a.business_id=new.business_id
      and a.status<>'cancelled'
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
  ) then raise exception 'El bloqueo coincide con una reserva existente'; end if;
  return new;
end;
$$;

drop trigger if exists agendaflow_validate_blocked_time on public.blocked_times;
create trigger agendaflow_validate_blocked_time
before insert or update of business_id,starts_at,ends_at
on public.blocked_times
for each row execute function public.agendaflow_validate_blocked_time();

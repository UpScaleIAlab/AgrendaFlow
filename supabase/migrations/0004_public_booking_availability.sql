-- AgendaFlow: lectura publica segura para mostrar solo servicios y disponibilidad.
-- No expone datos personales de clientes.
create or replace function public.get_public_booking_data(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business businesses%rowtype;
  v_result jsonb;
begin
  select * into v_business
  from public.businesses
  where slug = p_slug;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'business', jsonb_build_object(
      'name', v_business.name,
      'phone', v_business.phone,
      'slug', v_business.slug,
      'timezone', v_business.timezone
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'duration', s.duration_minutes,
        'price', s.price_clp
      ) order by s.name)
      from public.services s
      where s.business_id = v_business.id and s.active = true
    ), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', h.weekday,
        'enabled', h.enabled,
        'opens_at', h.opens_at,
        'closes_at', h.closes_at
      ) order by h.weekday)
      from public.working_hours h
      where h.business_id = v_business.id
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object(
        'starts_at', x.starts_at,
        'ends_at', x.ends_at
      ))
      from (
        select a.starts_at, a.ends_at
        from public.appointments a
        where a.business_id = v_business.id
          and a.status <> 'cancelled'
          and a.ends_at > now()
        union all
        select b.starts_at, b.ends_at
        from public.blocked_times b
        where b.business_id = v_business.id
          and b.ends_at > now()
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_public_booking_data(text) from public;
grant execute on function public.get_public_booking_data(text) to anon, authenticated;

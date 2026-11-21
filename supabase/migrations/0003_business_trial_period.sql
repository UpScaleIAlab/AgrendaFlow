-- AgendaFlow: registra el periodo de prueba gratuito de cada nuevo negocio.
alter table public.businesses
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

create or replace function public.handle_new_agendaflow_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_sector text;
  v_slug text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'business_name'), ''), 'Mi negocio');
  v_sector := coalesce(nullif(trim(new.raw_user_meta_data->>'sector'), ''), 'other');
  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'))
    || '-' || substr(replace(new.id::text, '-', ''), 1, 6);

  insert into public.businesses (
    owner_id, name, slug, sector, trial_started_at, trial_ends_at
  )
  values (
    new.id, v_name, v_slug, v_sector, now(), now() + interval '7 days'
  )
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

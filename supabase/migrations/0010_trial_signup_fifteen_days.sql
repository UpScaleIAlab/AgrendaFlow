-- AgendaFlow 0010: asegura que el trigger de registro cree trials de 15 días.
-- Repetible/seguro: extiende solo trials que siguen activos y no acorta fechas.

UPDATE public.businesses
SET trial_ends_at = trial_started_at + INTERVAL '15 days'
WHERE subscription_status = 'trial'
  AND trial_started_at IS NOT NULL
  AND trial_ends_at > now()
  AND trial_ends_at < trial_started_at + INTERVAL '15 days';

CREATE OR REPLACE FUNCTION public.handle_new_agendaflow_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_sector text;
  v_slug text;
BEGIN
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'business_name'), ''),
    'Mi negocio'
  );

  v_sector := coalesce(
    nullif(trim(new.raw_user_meta_data->>'sector'), ''),
    'other'
  );

  v_slug := trim(
    both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')
  ) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);

  INSERT INTO public.businesses (
    owner_id, name, slug, sector, trial_started_at, trial_ends_at
  )
  VALUES (
    new.id, v_name, v_slug, v_sector, now(), now() + INTERVAL '15 days'
  )
  ON CONFLICT (owner_id) DO NOTHING;

  RETURN new;
END;
$function$;

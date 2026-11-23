-- AgendaFlow 0009: amplía el periodo gratuito a 15 días.
-- Las cuentas que aún estén dentro de su prueba reciben el nuevo plazo.
update public.businesses
set trial_ends_at = trial_started_at + interval '15 days'
where subscription_status = 'trial'
  and trial_started_at is not null
  and trial_ends_at > now()
  and trial_ends_at < trial_started_at + interval '15 days';

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
    new.id, v_name, v_slug, v_sector, now(), now() + interval '15 days'
  )
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop policy if exists "owner creates business" on public.businesses;
create policy "owner creates business" on public.businesses
  for insert to authenticated with check (
    owner_id = (select auth.uid())
    and subscription_status = 'trial'
    and trial_started_at between now()-interval '10 minutes' and now()
    and trial_ends_at > now()
    and trial_ends_at <= trial_started_at+interval '15 days'
    and trial_ends_at <= now()+interval '15 days'
    and subscription_period_end is null
    and mp_preapproval_id is null
  );

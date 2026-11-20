-- AgendaFlow: rubro del negocio y creación automática del perfil al registrarse.
alter table public.businesses add column if not exists sector text not null default 'other';
create unique index if not exists businesses_owner_id_unique on public.businesses(owner_id);
create or replace function public.handle_new_agendaflow_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text; v_sector text; v_slug text;
begin
 v_name:=coalesce(nullif(trim(new.raw_user_meta_data->>'business_name'),''),'Mi negocio');
 v_sector:=coalesce(nullif(trim(new.raw_user_meta_data->>'sector'),''),'other');
 v_slug:=trim(both '-' from regexp_replace(lower(unaccent(v_name)),'[^a-z0-9]+','-','g'))||'-'||substr(replace(new.id::text,'-',''),1,6);
 insert into public.businesses(owner_id,name,slug,sector)
 values(new.id,v_name,v_slug,v_sector)
 on conflict(owner_id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created_agendaflow on auth.users;
create trigger on_auth_user_created_agendaflow after insert on auth.users
for each row execute procedure public.handle_new_agendaflow_user();

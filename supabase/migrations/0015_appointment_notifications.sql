-- FlowAgenda: tenant-scoped notifications for newly requested appointments.
begin;
create table if not exists public.appointment_notifications (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 appointment_id uuid not null references public.appointments(id) on delete cascade,
 customer_name text not null, customer_phone text not null, service_name text not null,
 starts_at timestamptz not null, created_at timestamptz not null default now(), read_at timestamptz
);
create index if not exists appointment_notifications_business_created_idx on public.appointment_notifications(business_id,created_at desc);
alter table public.appointment_notifications enable row level security;
revoke all on table public.appointment_notifications from anon,authenticated;
grant select,update(read_at) on table public.appointment_notifications to authenticated;
drop policy if exists "af_notifications_tenant_select" on public.appointment_notifications;
create policy "af_notifications_tenant_select" on public.appointment_notifications for select to authenticated using(public.agendaflow_business_access(business_id));
drop policy if exists "af_notifications_tenant_update" on public.appointment_notifications;
create policy "af_notifications_tenant_update" on public.appointment_notifications for update to authenticated using(public.agendaflow_business_access(business_id)) with check(public.agendaflow_business_access(business_id));
create or replace function public.af_create_appointment_notification() returns trigger language plpgsql security definer set search_path=public as $$
declare v_name text;v_phone text;v_service text;
begin
 if new.status<>'pending' then return new;end if;
 select c.full_name,c.phone,coalesce(s.name,'Servicio') into v_name,v_phone,v_service from public.customers c left join public.services s on s.id=new.service_id and s.business_id=new.business_id where c.id=new.customer_id and c.business_id=new.business_id;
 if v_name is not null then insert into public.appointment_notifications(business_id,appointment_id,customer_name,customer_phone,service_name,starts_at) values(new.business_id,new.id,v_name,v_phone,v_service,new.starts_at);end if;
 return new;
end $$;
revoke all on function public.af_create_appointment_notification() from public,anon,authenticated;
drop trigger if exists af_appointment_notification_created on public.appointments;
create trigger af_appointment_notification_created after insert on public.appointments for each row execute function public.af_create_appointment_notification();
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='appointment_notifications') then alter publication supabase_realtime add table public.appointment_notifications;end if;
exception when undefined_object then raise notice 'Supabase Realtime publication not found; polling fallback will be used.';
end $$;
notify pgrst,'reload schema';
commit;

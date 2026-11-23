-- FlowAgenda: retire generic signup sectors and make independent professional the fallback.
alter table public.businesses alter column sector set default 'independent';

update public.businesses
set sector = 'independent'
where sector in ('general', 'custom', 'other');

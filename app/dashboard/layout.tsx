import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BusinessInitializer } from '@/components/business-initializer';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: business } = await supabase
    .from('businesses')
    .select('id,name,slug,phone,trial_ends_at,subscription_status,subscription_period_end')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (business) {
    // La base de datos calcula el vencimiento; no dependemos del reloj del navegador.
    const { data: hasAccess, error } = await supabase.rpc(
      'agendaflow_business_access',
      { p_business_id: business.id }
    );
    if (error || !hasAccess) redirect('/cuenta-expirada');
  }

  return <>{business && <BusinessInitializer business={business} />}{children}</>;
}

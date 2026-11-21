import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BusinessInitializer } from '@/components/business-initializer';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: business } = await supabase
    .from('businesses')
    .select('name,slug,phone,trial_ends_at,subscription_status,subscription_period_end')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (business) {
    const trialValid = business.subscription_status === 'trial'
      && business.trial_ends_at
      && new Date(business.trial_ends_at).getTime() > Date.now();
    const subscriptionValid = business.subscription_status === 'active'
      && business.subscription_period_end
      && new Date(business.subscription_period_end).getTime() > Date.now();

    if (!trialValid && !subscriptionValid) redirect('/cuenta-expirada');
  }

  return <>{business && <BusinessInitializer business={business} />}{children}</>;
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRemainingLimits } from '@/lib/rateLimit';
import Sidebar, { type SidebarUserProfile } from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const enableFreemium = process.env.NEXT_PUBLIC_ENABLE_FREEMIUM === 'true';
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  const [profileResult, subscriptionResult, applicationCountResult, limitsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single(),
    supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null),
    enableFreemium ? getRemainingLimits(user.id) : Promise.resolve(null),
  ]);

  const profile: SidebarUserProfile | null = profileResult.data
    ? {
        full_name: profileResult.data.full_name ?? null,
        email: profileResult.data.email ?? user.email ?? null,
      }
    : {
        full_name: user.user_metadata?.full_name ?? null,
        email: user.email ?? null,
      };

  const plan = subscriptionResult.data?.plan === 'pro' ? 'pro' : 'free';
  const applicationCount = applicationCountResult.count ?? 0;
  const remainingTailorings = enableFreemium ? (limitsResult?.tailoring ?? null) : null;

  return (
    <div className="dashboard-shell">
      <Sidebar
        profile={profile}
        remainingTailorings={remainingTailorings}
        applicationCount={applicationCount}
        plan={plan}
        enableFreemium={enableFreemium}
      />
      <main className="dashboard-main">
        <div className="dashboard-main-inner">{children}</div>
      </main>
    </div>
  );
}
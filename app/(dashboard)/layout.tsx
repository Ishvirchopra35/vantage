import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRemainingLimits } from '@/lib/rateLimit';
import Sidebar, { type SidebarUserProfile } from '@/components/Sidebar';
import HelpChatWidget from '@/components/HelpChatWidget';
import OnboardingTour from '@/components/OnboardingTour';
import { readOnboarding, shouldRunTour } from '@/lib/onboarding';

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

  const [
    profileResult,
    subscriptionResult,
    applicationCountResult,
    limitsResult,
    onboardingResult,
  ] = await Promise.all([
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
    // Its own query: if the column is not there yet, the walkthrough simply
    // does not run and nothing else on the page is affected.
    supabase.from('profiles').select('onboarding').eq('id', user.id).maybeSingle(),
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

  // Mounted in the layout rather than on one page: the walkthrough visits every
  // section, so it has to survive navigating between them.
  const onboarding = readOnboarding(onboardingResult.error ? null : onboardingResult.data?.onboarding);

  return (
    <>
      {/* The dashboard is desktop-only: on phones the shell is hidden and
          this notice renders instead. Hidden inline by default so it can
          never flash on desktop even if the stylesheet is stale; the phone
          media query flips it on with !important (globals.css). */}
      <div className="mobile-blocker" style={{ display: 'none' }}>
        <div className="mobile-blocker-card">
          <img src="/logo.png" width={40} height={40} alt="Vantage logo" style={{ borderRadius: 'var(--radius-sm)' }} />
          <div className="mobile-blocker-title">Vantage is built for desktop</div>
          <div className="mobile-blocker-text">
            Tailoring resumes, tracking applications, and auto-filling forms need a bigger screen.
            Open Vantage on a laptop or desktop to continue.
          </div>
        </div>
      </div>
      <div className="dashboard-shell">
        <Sidebar
          profile={profile}
          remainingTailorings={remainingTailorings}
          applicationCount={applicationCount}
          plan={plan}
          enableFreemium={enableFreemium}
        />
        <main
          className="dashboard-main"
        >
          <div className="dashboard-main-inner">{children}</div>
        </main>
        <HelpChatWidget />
        <OnboardingTour
          run={shouldRunTour(onboarding)}
          startAt={onboarding.step}
          // The SERVER flag, not the public one: /billing redirects on this
          // rather than on NEXT_PUBLIC_ENABLE_FREEMIUM, and the two can
          // disagree. Gating the walkthrough on the public flag let it walk to
          // a page that bounced it straight back.
          includeBilling={process.env.ENABLE_FREEMIUM === 'true'}
        />
      </div>
    </>
  );
}

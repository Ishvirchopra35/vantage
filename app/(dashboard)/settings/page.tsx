import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from '@/components/SettingsClient'

export const metadata = {
  title: 'Settings',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  // marketing_emails_enabled may not exist until the batch3 migration runs;
  // treat a query error as "off" so Settings still renders.
  let marketingEmailsEnabled = false
  try {
    const { data } = await supabase
      .from('profiles')
      .select('marketing_emails_enabled')
      .eq('id', user.id)
      .maybeSingle()
    marketingEmailsEnabled = Boolean(
      (data as { marketing_emails_enabled?: boolean | null } | null)?.marketing_emails_enabled
    )
  } catch {
    // Column missing pre-migration - default to off.
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="dashboard-page">
        <SettingsClient
          userId={user.id}
          email={user.email ?? ''}
          marketingEmailsEnabled={marketingEmailsEnabled}
        />
      </div>
    </div>
  )
}

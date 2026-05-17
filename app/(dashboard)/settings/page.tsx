import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from '@/components/SettingsClient'

export const metadata = {
  title: 'Settings - Vantage',
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex w-full flex-col px-4 py-12">
        <div className="w-full">
          <SettingsClient
            userId={user.id}
            email={user.email ?? ''}
          />
        </div>
      </div>
    </div>
  )
}

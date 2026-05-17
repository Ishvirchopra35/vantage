import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsClient from '@/components/SettingsClient'

export const metadata = {
  title: 'Settings - Vantage',
}

interface ProfileRow {
  id: string
  full_name: string | null
  phone: string | null
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

  let profile: ProfileRow | null = null
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', user.id)
      .single()
    profile = data as ProfileRow
  } catch {
    profile = null
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex w-full flex-col px-4 py-12">
        <div className="w-full">
          <SettingsClient
            userId={user.id}
            email={user.email ?? ''}
            fullName={profile?.full_name ?? ''}
          />
        </div>
      </div>
    </div>
  )
}

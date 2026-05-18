import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from '@/components/ProfileForm';
import type { Profile as BaseProfile } from '@/components/ProfileForm';
import ExtensionTokenSection from '@/components/ExtensionTokenSection';

export const metadata = {
  title: 'Profile - Vantage',
  description: 'Complete your profile for better AI outputs',
};

export type Profile = BaseProfile & {
  extension_token: string | null;
  extension_token_created_at: string | null;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  let profile: Profile | null = null;
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, university, graduation_year, years_experience, skills, target_roles, linkedin_url, extension_token, extension_token_created_at, updated_at')
      .eq('id', user.id)
      .single();
    profile = data as Profile;
  } catch {
    profile = null;
  }

  const params = await searchParams;
  const isNew = params.new === 'true';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex w-full flex-col px-4 py-12">
        <div className="w-full">
          <ProfileForm initialData={profile} isNew={isNew} />
          <ExtensionTokenSection
            initialToken={profile?.extension_token ?? null}
            initialTokenCreatedAt={profile?.extension_token_created_at ?? null}
          />
        </div>
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from '@/components/ProfileForm';

export const metadata = {
  title: 'Profile - Vantage',
  description: 'Complete your profile for better AI outputs',
};

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  university: string | null;
  graduation_year: number | null;
  years_experience: number | null;
  skills: string[] | null;
  target_roles: string[] | null;
  linkedin_url: string | null;
  updated_at: string | null;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { new?: string };
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
      .select('id, full_name, email, university, graduation_year, years_experience, skills, target_roles, linkedin_url, updated_at')
      .eq('id', user.id)
      .single();
    profile = data as Profile;
  } catch {
    profile = null;
  }

  const isNew = searchParams.new === 'true';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="flex w-full flex-col px-4 py-12">
        <div className="w-full">
          <ProfileForm initialData={profile} isNew={isNew} />
        </div>
      </div>
    </div>
  );
}

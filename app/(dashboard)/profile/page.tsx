import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from '@/components/ProfileForm';
import ResumeUpload from '@/components/ResumeUpload';

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
        {/* Welcome Banner */}
        {isNew && (
          <div
            className="mb-8 p-4 rounded-lg"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#3b82f6',
            }}
          >
            <p className="text-sm font-medium">Welcome to Vantage — complete your profile to get the most accurate AI outputs</p>
          </div>
        )}

        {/* Resume Upload */}
        <div className="mb-8 w-full">
          <ResumeUpload />
        </div>

        {/* Profile Form */}
        <div className="w-full">
          <ProfileForm initialProfile={profile} />
        </div>
      </div>
    </div>
  );
}

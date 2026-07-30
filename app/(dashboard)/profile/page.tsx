import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from '@/components/ProfileForm';
import type { Profile as BaseProfile } from '@/components/ProfileForm';
import ExtensionTokenSection from '@/components/ExtensionTokenSection';
import PageHeader from '@/components/ui/PageHeader';

export const metadata = {
  title: 'Profile',
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
      .select('id, full_name, email, phone, university, graduation_year, years_experience, skills, target_roles, linkedin_url, portfolio_url, github_url, experience, projects, cover_letter_template, extension_token, extension_token_created_at, updated_at')
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
      <div className="dashboard-page flex flex-col px-4 py-12">
        <div className="w-full">
          <PageHeader
            title="Profile"
            subtitle="Complete your profile so every AI output sounds like you."
          />
          <ProfileForm initialData={profile} isNew={isNew} />
          {/* Resume design upload - hidden, not removed.
              It predates the rewrite pipeline. Downloads are now the user's own
              uploaded .docx with new wording written into it, so a separate
              "design" file is redundant for anyone with a Word resume and
              actively worse: resolveTemplate prefers it, which skips the
              rewrite and rebuilds the document instead.
              Everything behind it is left intact - the component, the API route
              and the stored template - so anyone who already uploaded one keeps
              exactly the behaviour they have today. Only the way in is closed.
              <ResumeTemplateUpload /> */}
          {/* Anchor target for "/profile#extension-token" links across the app. */}
          <div id="extension-token" style={{ scrollMarginTop: 96 }}>
            <ExtensionTokenSection
              initialToken={profile?.extension_token ?? null}
              initialTokenCreatedAt={profile?.extension_token_created_at ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

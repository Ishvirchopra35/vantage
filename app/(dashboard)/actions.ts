'use server';

import { createClient } from '@/lib/supabase/server';
import { track } from '@/lib/analytics';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  university: string | null;
  graduation_year: number | null;
  years_experience: number | null;
  skills: string[] | null;
  target_roles: string[] | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  updated_at: string | null;
}

export async function updateProfile(userId: string, data: Partial<Profile>) {
  try {
    const supabase = await createClient();

    // Check if we're completing profile for first time
    let existingProfile = null;
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('skills')
        .eq('id', userId)
        .single();
      existingProfile = profileData;
    } catch {
      existingProfile = null;
    }

    const wasSkillsEmpty = !existingProfile?.skills || existingProfile.skills.length === 0;

    // Upsert profile
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: data.full_name,
        phone: data.phone,
        university: data.university,
        graduation_year: data.graduation_year,
        years_experience: data.years_experience,
        skills: data.skills,
        target_roles: data.target_roles,
        linkedin_url: data.linkedin_url,
        portfolio_url: data.portfolio_url,
        github_url: data.github_url,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      });

    if (error) {
      return { success: false, error: error.message };
    }

    // Track completion on first save
    if (wasSkillsEmpty && data.skills && data.skills.length > 0) {
      await track('completed_profile');
    }

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: message };
  }
}

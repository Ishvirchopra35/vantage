-- ============================================================================
-- VANTAGE FULL SCHEMA — Run this in Supabase SQL editor
-- Creates all tables for profiles, resumes, jobs, documents, ATS, applications,
-- outreach, interviews, job feed, and strategy feedback
-- ============================================================================

-- ============================================================================
-- 1. PROFILES TABLE + AUTO-INSERT TRIGGER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  target_roles TEXT[],
  years_experience INT,
  skills TEXT[],
  linkedin_url TEXT,
  university TEXT,
  graduation_year INT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can INSERT their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can SELECT their own profile
DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
CREATE POLICY "Users can select own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- RLS Policy: Users can UPDATE their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger function: Auto-create profiles row on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Index on profiles.id (already PK)
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles (id);

-- ============================================================================
-- 2. RESUMES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  raw_text TEXT,
  is_base BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own resumes" ON public.resumes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resumes" ON public.resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resumes" ON public.resumes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own resumes" ON public.resumes
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON public.resumes (user_id);

-- ============================================================================
-- 3. JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  url TEXT,
  title TEXT,
  company TEXT,
  location TEXT,
  employment_type TEXT,
  required_skills TEXT[],
  nice_to_have_skills TEXT[],
  years_experience_required INT,
  key_responsibilities TEXT[],
  company_description TEXT,
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own jobs" ON public.jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs" ON public.jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON public.jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" ON public.jobs
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs (user_id);

-- ============================================================================
-- 4. DOCUMENTS TABLE (Tailored resumes & cover letters)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('tailored_resume', 'cover_letter')),
  content TEXT,
  skill_gaps TEXT[],
  keyword_matches JSONB,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own documents" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents (user_id);

-- ============================================================================
-- 5. ATS_SCORES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ats_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs (id) ON DELETE CASCADE,
  resume_id UUID REFERENCES public.resumes (id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents (id) ON DELETE CASCADE,
  overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
  keyword_score INT,
  format_score INT,
  experience_score INT,
  skills_score INT,
  missing_keywords TEXT[],
  present_keywords TEXT[],
  suggestions TEXT[],
  is_tailored BOOLEAN DEFAULT false,
  scored_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ats_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own ats_scores" ON public.ats_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ats_scores" ON public.ats_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ats_scores" ON public.ats_scores
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ats_scores" ON public.ats_scores
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ats_scores_user_id ON public.ats_scores (user_id);
CREATE INDEX IF NOT EXISTS idx_ats_scores_job_id ON public.ats_scores (job_id);
CREATE INDEX IF NOT EXISTS idx_ats_scores_document_id ON public.ats_scores (document_id);

-- ============================================================================
-- 6. APPLICATIONS TABLE (Updated version)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs (id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  job_url TEXT,
  status TEXT DEFAULT 'applied' CHECK (status IN ('applied', 'interviewing', 'rejected', 'offer', 'ghosted')),
  applied_date DATE DEFAULT current_date,
  resume_doc_id UUID REFERENCES public.documents (id) ON DELETE SET NULL,
  cover_letter_doc_id UUID REFERENCES public.documents (id) ON DELETE SET NULL,
  ats_score_id UUID REFERENCES public.ats_scores (id) ON DELETE SET NULL,
  notes TEXT,
  deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own applications" ON public.applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications" ON public.applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications" ON public.applications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications" ON public.applications
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications (user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications (status);

-- ============================================================================
-- 7. APPLICATION_QUESTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.application_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs (id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications (id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  generated_answer TEXT,
  user_edited_answer TEXT,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.application_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own questions" ON public.application_questions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own questions" ON public.application_questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own questions" ON public.application_questions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own questions" ON public.application_questions
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_application_questions_user_id ON public.application_questions (user_id);

-- ============================================================================
-- 8. OUTREACH_MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  contact_name TEXT,
  contact_title TEXT,
  contact_company TEXT,
  contact_linkedin_url TEXT,
  message_type TEXT CHECK (message_type IN ('connection_request', 'cold_email', 'follow_up')),
  generated_message TEXT,
  user_edited_message TEXT,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  job_id UUID REFERENCES public.jobs (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own messages" ON public.outreach_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" ON public.outreach_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages" ON public.outreach_messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages" ON public.outreach_messages
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_user_id ON public.outreach_messages (user_id);

-- ============================================================================
-- 9. INTERVIEW_SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs (id) ON DELETE CASCADE,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  practice_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own sessions" ON public.interview_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON public.interview_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.interview_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.interview_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions (user_id);

-- ============================================================================
-- 10. JOB_FEED_ITEMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.job_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  external_job_id TEXT,
  source TEXT,
  title TEXT,
  company TEXT,
  location TEXT,
  url TEXT,
  employment_type TEXT,
  relevance_score INT,
  is_saved BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.job_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own feed" ON public.job_feed_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feed" ON public.job_feed_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feed" ON public.job_feed_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feed" ON public.job_feed_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_job_feed_items_user_id ON public.job_feed_items (user_id);

-- ============================================================================
-- 11. STRATEGY_FEEDBACK TABLE (1 per user)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.strategy_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  feedback JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.strategy_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own strategy" ON public.strategy_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategy" ON public.strategy_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategy" ON public.strategy_feedback
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategy" ON public.strategy_feedback
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_strategy_feedback_user_id ON public.strategy_feedback (user_id);

-- ============================================================================
-- 12. STORAGE: RESUMES BUCKET
-- ============================================================================

-- Create bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resumes', 'resumes', false)
ON CONFLICT DO NOTHING;

-- RLS Policy: Users can upload resumes
CREATE POLICY "Users can upload resumes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS Policy: Users can read their own resumes
CREATE POLICY "Users can read own resumes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS Policy: Users can delete their own resumes
CREATE POLICY "Users can delete own resumes" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'resumes' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- 13. GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

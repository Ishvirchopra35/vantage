-- ============================================================================
-- Replaces the plain-text / generated-HTML resume pipeline with the tagged
-- ResumeDoc format. Resumes are stored as structured JSON, tailoring edits
-- bullet text in place, and downloads are produced by injecting that JSON into
-- the user's own Word template.
--
-- profiles.resume_html is deliberately NOT dropped: rows written by the old
-- pipeline stay readable for users who have not re-uploaded. Nothing in the
-- code reads or writes it any more.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TAGGED DOCUMENTS
-- ----------------------------------------------------------------------------

-- The base resume parsed into a ResumeDoc (see lib/tagged/schema.ts). Null for
-- resumes uploaded before this migration; /api/tailor-resume backfills lazily.
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS tagged_doc jsonb;

-- The tailored ResumeDoc. documents.content keeps the plain-text rendering so
-- ATS scoring, auto-apply and the documents list are unaffected.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS tailored_doc jsonb;

-- ----------------------------------------------------------------------------
-- 2. WORD TEMPLATE
-- ----------------------------------------------------------------------------

-- Storage object path, original file name, and the style-slot -> w:styleId map
-- produced by suggestMapping() when the template was uploaded.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resume_template_path text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resume_template_name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS resume_template_mapping jsonb;

-- ----------------------------------------------------------------------------
-- 3. STORAGE
-- ----------------------------------------------------------------------------

-- Templates live at `${user.id}/templates/template.docx` inside the existing
-- private `resumes` bucket, so the INSERT / SELECT / DELETE policies from
-- 02_full_schema.sql section 12 already cover them. Only UPDATE was missing,
-- and replacing a template is an upsert.
DROP POLICY IF EXISTS "Users can update own resumes" ON storage.objects;
CREATE POLICY "Users can update own resumes" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

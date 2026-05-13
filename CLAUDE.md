# Vantage — Claude Code Instructions

> Read this file completely before writing any code. Every rule here is non-negotiable.

---

## Project overview

**Vantage** is an AI-powered job application platform for university students and new graduates. Built by Ishvir Chopra at the University of Waterloo.

Tagline: **"Vantage — Your unfair advantage in job searching."**
Company name: **Echelon**

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS only |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| File storage | Supabase Storage |
| Deployment | Vercel |
| AI provider | Groq — `llama-3.3-70b-versatile` **(Groq only. Do not add Gemini code.)** |
| Background jobs | None yet — all synchronous |

---

## Folder structure

```
/app
  /(auth)          — login, signup — public, no auth required
  /(dashboard)     — all protected app pages — requires auth
  /(marketing)     — landing page, blog, changelog — public
  /admin           — analytics dashboard — ADMIN_USER_ID only
  /api             — all API route handlers

/lib
  /supabase
    client.ts      — BROWSER client (use client components only)
    server.ts      — SERVER client (server components + API routes only)
    middleware.ts  — session refresh helper
  ai.ts            — Groq wrapper: generateText(), generateJSON<T>()
  userContext.ts   — buildUserContext(), formatContextForPrompt()
  rateLimit.ts     — checkLimit(), getRemainingLimits()
  apiResponse.ts   — ok(), err(), unauthorized(), notFound(), rateLimited(), serverError()
  requireAuth.ts   — requireAuth() guard for API routes
  withTimeout.ts   — withTimeout(promise, ms, label)
  validateRequest.ts — validateBody(body, requiredKeys)
  logger.ts        — logRoute(route, userId, durationMs, status)
  analytics.ts     — track(eventName, properties) — fails silently

/components        — shared UI components
/content
  /blog            — MDX blog posts
  /changelog       — MDX changelog (latest.mdx is append-only)
/extension         — Chrome extension (separate codebase, not Next.js)
```

---

## Environment variables

### Required in `.env.local` and Vercel dashboard

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # SERVER ONLY — never NEXT_PUBLIC_

# AI
GROQ_API_KEY=
AI_PROVIDER=groq                  # 'groq' only for now. Gemini branch is commented out.

# Freemium gate
ENABLE_FREEMIUM=false             # 'false' = unlimited for everyone (dev mode)
                                  # 'true' = enforce limits + Stripe active

# Stripe (only matters when ENABLE_FREEMIUM=true)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRO_PRICE_ID=

# App
NEXT_PUBLIC_APP_URL=
ADMIN_USER_ID=                    # Your Supabase user ID — protects /admin

# Extension
# (Added later when building the Chrome extension)
# extension_token is stored in the profiles table, not env vars
```

### What is and isn't safe as `NEXT_PUBLIC_`

**Safe (client-visible):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_ENABLE_FREEMIUM` (optional, for sidebar UI only)

**Never `NEXT_PUBLIC_`:** `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_USER_ID`

---

## Non-negotiable rules

Every single one of these applies to every file you write. No exceptions.

### Supabase clients

```ts
// ✅ CORRECT — in server components and API routes
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// ✅ CORRECT — in 'use client' components only
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// ❌ NEVER — browser client in a server component or API route
// ❌ NEVER — server client in a 'use client' component
// ❌ NEVER — SUPABASE_SERVICE_ROLE_KEY in any client-side code
```

### API routes — required pattern

Every protected API route must follow this exact structure:

```ts
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, unauthorized, serverError, rateLimited } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'

export async function POST(request: Request) {
  const start = Date.now()

  // 1. Auth check
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  // 2. Body validation
  const body = await request.json()
  const validation = validateBody<{ jobId: string }>(body, ['jobId'])
  if (!validation.valid) return err(validation.error, 400)
  const { jobId } = validation.data

  // 3. Freemium check (on AI routes)
  const limit = await checkLimit(user.id, 'tailoring')
  if (!limit.allowed) return rateLimited('resume tailoring', 10, 30)

  try {
    // 4. Business logic
    const result = await withTimeout(someAsyncThing(), 30000, 'route-name')
    await logRoute('route-name', user.id, Date.now() - start, 200)
    return ok({ result })
  } catch (e) {
    await logRoute('route-name', user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
```

### AI calls

```ts
import { generateText, generateJSON } from '@/lib/ai'
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext'
import { withTimeout } from '@/lib/withTimeout'

// Always build user context first for every AI route
const ctx = await buildUserContext(user.id)

// Always wrap AI calls in withTimeout
const result = await withTimeout(
  generateText(systemPrompt, userPrompt),
  30000,
  'tailor-resume'
)

// For structured output
const parsed = await withTimeout(
  generateJSON<MyType>(systemPrompt, userPrompt),
  30000,
  'parse-job'
)
```

**The AI provider is Groq only.** `lib/ai.ts` has a commented-out Gemini branch that is not active. Do not uncomment it or add Gemini imports anywhere.

### Freemium gate

```ts
// ✅ CORRECT — always use checkLimit, never hardcode limit logic
const limit = await checkLimit(user.id, 'tailoring')
if (!limit.allowed) return rateLimited('resume tailoring', 10, 30)

// ❌ NEVER hardcode limit checks
// if (user.monthlyUses >= 10) return ...
```

When `ENABLE_FREEMIUM=false`, `checkLimit()` returns `{ allowed: true, remaining: 999 }` immediately without any database calls. This is the development mode.

### TypeScript

- No `any` types. If you truly cannot avoid it, add a comment explaining why.
- Explicit return types on all exported functions.
- TypeScript interfaces must match database table columns exactly.
- Run `npx tsc --noEmit` mentally before submitting — no type errors.

### React / Next.js

- No HTML `<form>` tags anywhere. Use `onClick` handlers with controlled `useState` inputs.
- Every async button must be `disabled` and show a `<Spinner>` while pending.
- Every list and table must have an `<EmptyState>` component for zero-data cases.
- No `console.log` or `console.error` in production code paths.
- Parallel fetches with `Promise.all()` — never sequential `await` for independent data.

### Styling

- Tailwind CSS only. No inline `style` objects except when truly unavoidable.
- All colors via CSS variables: `var(--bg)`, `var(--card)`, `var(--text)`, `var(--muted)`, `var(--border)`, `var(--accent)`.
- No hardcoded hex values in Tailwind classes (use `var()` in style when Tailwind can't express it).
- Consistent `border-radius: var(--radius)` = 12px everywhere.
- No purple-to-blue gradients. No emoji in UI. No shadows as primary depth.
- Dark mode default. Light mode via `[data-theme="light"]` on `<html>`.

---

## Design system

```css
/* Dark mode (default) */
--bg: #0a0a0a
--card: #111111
--text: #f2f2f2
--muted: #9ca3af
--border: #1f1f1f
--accent: #f2f2f2
--radius: 12px

/* Light mode — [data-theme="light"] on html element */
--bg: #fafafa
--card: #ffffff
--text: #111111
--muted: #6b7280
--border: #e5e7eb
--accent: #111111
```

**What "not vibe-coded" means for this project:**
- Real loading states on every async action — not just a spinner on the page, a spinner inside the button
- Skeleton loaders (`<SkeletonLoader>`) on data-heavy sections while fetching
- All social links go to real URLs, not `href="#"`
- Consistent spacing — 16px base unit, don't mix arbitrary values
- No default shadcn/ui component styling without customization
- Mobile-first: test at 375px width, not just desktop

---

## Database schema (all tables)

All tables have RLS enabled. Users can only access their own rows unless otherwise noted.

```sql
-- Core
profiles          -- id references auth.users, full_name, email, skills[], target_roles[], university, graduation_year, years_experience, linkedin_url, phone, extension_token, extension_token_created_at
resumes           -- id, user_id, file_url, file_name, raw_text, is_base boolean
subscriptions     -- id, user_id (unique), plan (free/pro), status, stripe_subscription_id, monthly counters, monthly_reset_at

-- Jobs & Documents
jobs              -- id, user_id, url, title, company, location, employment_type, required_skills[], nice_to_have_skills[], years_experience_required, key_responsibilities[], company_description, raw_text, keywords[]
documents         -- id, user_id, job_id, type (tailored_resume|cover_letter), content, skill_gaps[], keyword_matches jsonb, version

-- ATS
ats_scores        -- id, user_id, job_id, resume_id, document_id, overall_score, keyword_score, format_score, experience_score, skills_score, missing_keywords[], present_keywords[], suggestions[]

-- Applications
applications      -- id, user_id, job_id, company, role, job_url, status (applied|interviewing|rejected|offer|ghosted), applied_date, resume_doc_id, cover_letter_doc_id, ats_score_id, notes, deleted_at
application_questions -- id, user_id, job_id, application_id, question, generated_answer, user_edited_answer, is_used

-- Launch 3
outreach_messages -- id, user_id, contact_name, contact_title, contact_company, contact_linkedin_url, message_type (connection_request|cold_email|follow_up), generated_message, user_edited_message, sent, sent_at, job_id
interview_sessions -- id, user_id, job_id, questions jsonb, practice_answers jsonb, feedback jsonb
job_feed_items    -- id, user_id, external_job_id, source, title, company, location, url, employment_type, relevance_score, is_saved, is_dismissed, raw_data jsonb, fetched_at
strategy_feedback -- id, user_id (unique), feedback jsonb, generated_at

-- Analytics & Logging
events            -- id, user_id, event_name, properties jsonb, created_at
route_logs        -- route, user_id, duration_ms, status_code, created_at (no RLS)
costs             -- id, user_id, route, estimated_tokens, provider, created_at (no RLS)
```

**Never use `.select('*')`** — always specify explicit columns.

---

## Pricing

| Feature | Free ($0/mo) | Pro ($8/mo) |
|---|---|---|
| Resume tailorings | 10/month | Unlimited |
| Cover letters | 10/month | Unlimited |
| Auto-apply credits | 20/month | Unlimited |
| Application tracking | 150 total cap | Unlimited |
| Strategy feedback | 2/month | Unlimited |
| Networking drafts | 15/month | Unlimited |
| Interview prep sessions | 5/month | Unlimited |
| Support | Email | Priority |

Feature keys in `checkLimit()`: `'tailoring'`, `'cover_letter'`, `'auto_apply'`, `'applications'`, `'strategy_feedback'`, `'networking'`, `'interview'`

---

## `buildUserContext` — the core intelligence layer

This is the most important function in the codebase. Call it at the start of **every** AI route before building any prompt.

```ts
const ctx = await buildUserContext(user.id)
// ctx contains: profile, base resume text, application history summary,
// ATS performance summary, subscription plan, remaining limits

const promptSection = formatContextForPrompt(ctx)
// Returns a dense structured text block to inject into AI prompts
```

This is what makes Vantage not a GPT wrapper. Every AI call has full context about the user's history, patterns, and ATS performance. The outputs improve as the user builds their application history.

---

## Feature flags

| Env var | Values | Effect |
|---|---|---|
| `ENABLE_FREEMIUM` | `'false'` (default) | All users get unlimited everything. No Stripe. `checkLimit()` returns allowed immediately. |
| `ENABLE_FREEMIUM` | `'true'` | Free tier limits enforced. Stripe paywall active. |
| `AI_PROVIDER` | `'groq'` (only active option) | Uses Groq with `llama-3.3-70b-versatile` |
| `AI_PROVIDER` | `'gemini'` (commented out) | Do not use — implementation not active |

---

## Shared UI components

Located in `/components/ui/`:

- `Spinner` — size prop: `'sm' | 'md' | 'lg'`. CSS animation, no library.
- `EmptyState` — props: `title`, `description`, `actionLabel?`, `actionHref?`
- `Toast` + `useToast` hook — `showToast(message, type)`. Bottom-right, auto-dismiss 3.5s.
- `ScoreBadge` — props: `score: number`. Red/amber/green colored pill by range.
- `SkeletonLoader` — shimmer animation for loading placeholders.

---

## Auto-apply: 3 tiers (Month 6)

**Tier 1 (primary): Chrome Extension** — `/extension/` folder. Manifest V3. Runs in real Chrome. No console required. Uses `nativeSetter` + Shadow DOM walker + event dispatch. Same fill logic as Tier 2. User clicks button in popup, form fills, user reviews and submits.

**Tier 2 (fallback): Console snippet** — `/app/api/generate-fill-snippet/`. Server generates an IIFE with user data baked in. User pastes into browser console on the application page. Same fill logic as the extension.

**Tier 3 (last resort): Answers panel** — `/app/api/analyze-form/`. Jina.ai reads the form URL, AI generates all answers. User copies each answer manually.

**Fill logic (shared by Tier 1 and 2):**
- `nativeSetter` pattern for React/Vue/Angular controlled inputs — direct `.value=` is silently ignored by React's fiber reconciler
- Shadow DOM walker (`queryShadow`) for Workday
- Dispatch `input`, `change`, `blur` events to satisfy ATS field validation
- **Never call `form.submit()` or click Submit buttons**

---

## Key third-party integrations

| Service | Purpose | Cost |
|---|---|---|
| Jina.ai reader | Fetch clean markdown from any URL (job pages, application forms) | Free, no API key |
| Adzuna API | Job discovery feed | Free tier: 1000 calls/month |
| Stripe | Subscription billing ($8/mo Pro) | 2.9% + 30¢ per transaction |
| Chrome Web Store | Extension distribution | $5 one-time developer fee |

---

## Blog + Changelog

- Blog: MDX files in `/content/blog/`. Rendered at `/blog` (public). Frontmatter: `title`, `date`, `category`, `author`, `readTime`, `excerpt`.
- Changelog: MDX files in `/content/changelog/latest.mdx`. **Append-only** — new entries are added at the bottom, never overwrite. Rendered at `/changelog` (public).
- Both are fully static — no dynamic data fetching at request time.

---

## Admin dashboard

`/app/admin/page.tsx` — server component. First line: check `user.id === process.env.ADMIN_USER_ID`, redirect to `/dashboard` if not. Uses `SUPABASE_SERVICE_ROLE_KEY` client for all queries — this bypasses RLS intentionally.

---

## What to do after every code change

1. **Changelog:** Append an entry to `/content/changelog/latest.mdx`:
   ```
   date: YYYY-MM-DD
   type: Feature | Update | Fix | Improvement
   title: one-line summary
   - file created/modified: what it does
   - new DB columns if any
   - new env vars if any
   - packages installed if any
   ```

2. **TypeScript:** Mentally verify no `any` types and no type errors introduced.

3. **Freemium:** If you added a new AI route, verify `checkLimit()` is called before the AI call.

4. **Loading states:** If you added any async UI, verify the button is disabled + shows `<Spinner>` while pending.

5. **Empty states:** If you added any list or table, verify `<EmptyState>` renders when data is empty.

---

## What never to do

- `form` HTML tags — use `div` + `onClick`
- `console.log` or `console.error` in production paths
- `.select('*')` in Supabase queries
- Sequential `await` for independent data fetches — use `Promise.all()`
- Hardcoded color values in JSX — use `var(--*)` CSS variables
- `any` TypeScript type without a comment explaining why
- `SUPABASE_SERVICE_ROLE_KEY` anywhere near client-side code
- Gemini imports or implementation (Groq only)
- Auto-submitting forms in the auto-fill system — never, ever
- Hardcoded freemium limit checks — always use `checkLimit()`
- Purple-to-blue gradients, emoji in UI, `href="#"` dead links
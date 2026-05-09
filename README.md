# Vantage — Your Unfair Advantage in Job Searching

An AI-powered job application platform that helps you tailor resumes, generate cover letters, track ATS scores, and automate the job search process. Built with Next.js 14, Supabase, and Groq LLM.

## Features

- **AI Resume Tailoring** — Generate role-specific resumes optimized for ATS using Groq
- **AI Cover Letter Generation** — Create personalized cover letters in seconds
- **ATS Score Checking** — Real-time feedback on resume keyword alignment
- **Application Tracking** — Dashboard to monitor all job applications with status updates
- **Rate Limiting** — Freemium tier with monthly usage limits (free) or unlimited (pro)
- **Authentication** — Supabase auth with secure session management
- **Analytics** — Track user interactions and feature usage
- **Server-Side Context** — Comprehensive user context builder for intelligent AI prompts

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS v4
- **Backend**: Next.js API routes (server-side only)
- **Database**: Supabase (PostgreSQL) with Row-Level Security (RLS)
- **Authentication**: Supabase Auth with secure HTTP-only cookies
- **LLM**: Groq (llama-3.3-70b-versatile) with fallback to Gemini
- **Deployment**: Vercel with Edge Runtime middleware
- **Design System**: CSS variables with dark/light mode support

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Supabase account (free tier works)
- Groq API key (free tier available at [console.groq.com](https://console.groq.com))
- Vercel account (for deployment)

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/vantage.git
cd vantage
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `Anon Public Key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `Service Role Key` → `SUPABASE_SERVICE_ROLE_KEY`
3. Run all SQL scripts from `/sql` folder in Supabase SQL editor (creates tables with RLS policies):
   - Extensions
   - Subscriptions table
   - Events table
   - Route logs table
   - Applications table

### 4. Create `.env.local`

```env
# Supabase (public — safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Supabase (server-only — NEVER expose)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Groq (server-only)
GROQ_API_KEY=gsk_...
AI_PROVIDER=groq

# Feature flags
ENABLE_FREEMIUM=false  # Set to 'true' in production
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
├── (auth)/              # Auth route group (login, signup)
├── (dashboard)/         # Protected dashboard routes
├── (marketing)/         # Public marketing pages (/, /blog, /changelog)
├── admin/              # Admin routes (protected)
├── api/                # API routes
│   ├── example/        # Example endpoint using all utilities
│   └── auto-fill/      # AI-powered auto-fill (reserved 1GB/60s)
├── content/            # Blog & changelog content
├── layout.tsx          # Root layout with theme setup
└── globals.css         # Design system & CSS variables

lib/
├── supabase/
│   ├── client.ts       # Browser client (use client only)
│   ├── server.ts       # Server client (SSR/API routes)
│   └── middleware.ts   # Session refresh for middleware
├── ai.ts               # LLM calls (Groq/Gemini)
├── userContext.ts      # Parallel user data fetcher for AI prompts
├── rateLimit.ts        # Freemium limit checking with atomic increments
├── analytics.ts        # Event tracking
├── withTimeout.ts      # Promise timeout wrapper
├── validateRequest.ts  # Request body validation
├── apiResponse.ts      # Standardized response helpers
├── requireAuth.ts      # Auth guard for API routes
└── logger.ts           # Route performance logging

middleware.ts          # Session refresh on every request (Supabase auth fix)
vercel.json           # Vercel function config (auto-fill: 1GB/60s)
```

## Key Implementation Details

### Server-Side User Context
Every AI call includes comprehensive user context (profile, resume, application history, ATS scores, subscription, limits) fetched in parallel. See `lib/userContext.ts`.

### Rate Limiting
Atomic counter increments using optimistic locking prevent race conditions. Free tier limits reset monthly; pro tier is unlimited. See `lib/rateLimit.ts`.

### Supabase Auth on Vercel Edge
Session cookies are refreshed on every request via `middleware.ts` to work around Edge Runtime limitations. See `lib/supabase/middleware.ts`.

### TypeScript Safety
All database queries are wrapped in try-catch for error handling. API utilities enforce type safety on request/response validation.

## API Utilities

All API routes should use these helpers:

```typescript
import { ok, err, rateLimited, serverError } from '@/lib/apiResponse';
import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { withTimeout } from '@/lib/withTimeout';
import { logRoute } from '@/lib/logger';
import { checkLimit } from '@/lib/rateLimit';
import { track } from '@/lib/analytics';
import { buildUserContext } from '@/lib/userContext';

// Example POST route
export async function POST(req: Request) {
  const start = Date.now();
  try {
    // 1. Validate request
    const body = await req.json();
    const { valid, data, error } = validateBody(body, ['prompt', 'feature']);
    if (!valid) return err(error, 400);

    // 2. Require auth
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;

    // 3. Check rate limit
    const limit = await checkLimit(userId, 'your_feature');
    if (!limit.allowed) return rateLimited('your_feature', LIMITS.your_feature, 30);

    // 4. Build user context
    const ctx = await buildUserContext(userId);

    // 5. Call AI with timeout
    const result = await withTimeout(
      generateText(ctx, data.prompt),
      30000,
      'AI'
    );

    // 6. Log route
    await logRoute(req.url, userId, Date.now() - start, 200);
    
    // 7. Track event
    await track('feature_used', { feature: data.feature });

    return ok({ result });
  } catch (e) {
    await logRoute(req.url, null, Date.now() - start, 500);
    return serverError(e);
  }
}
```

## Deployment to Vercel

### 1. Push to GitHub
```bash
git add .
git commit -m "Your message"
git push origin main
```

### 2. Connect to Vercel
- Go to [vercel.com/dashboard](https://vercel.com/dashboard)
- Click "Add New" → "Project"
- Import your GitHub repo
- Vercel auto-detects Next.js settings

### 3. Add Environment Variables
In Vercel **Settings → Environment Variables**, add:
- `NEXT_PUBLIC_SUPABASE_URL` (safe to expose)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to expose)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `GROQ_API_KEY` (server-only)
- `AI_PROVIDER` (value: `groq`)
- `ENABLE_FREEMIUM` (value: `true`)

### 4. Deploy
Push to main branch — Vercel automatically deploys within 1-2 minutes.

## Freemium Limits (Free Tier)

- Resume tailoring: 10/month
- Cover letter generation: 10/month
- Auto-apply: 20/month
- Total applications tracked: 150 (hard cap)
- Strategy feedback: 2/month
- Networking messages: 15/month
- Interview prep: 5/month

Set `ENABLE_FREEMIUM=false` in dev to bypass limits for testing.

## Development Commands

```bash
npm run dev        # Start dev server on localhost:3000
npm run build      # Build for production
npm run start       # Start production server
npm run lint       # Run TypeScript and ESLint
npm run type-check # TypeScript check without emit
```

## Troubleshooting

### Supabase Auth Not Persisting
- Ensure middleware.ts is running (check `matcher` config)
- Verify `SERVICE_ROLE_KEY` is set in `.env.local`
- Check browser cookies are enabled

### AI Calls Timing Out
- Groq free tier has rate limits (requests/minute)
- Increase timeout in `withTimeout()` for slower networks
- Check `GROQ_API_KEY` is valid

### Vercel Build Fails
- Ensure all env vars are set in Vercel dashboard
- Run `npm run build` locally to debug
- Check TypeScript: `npx tsc --noEmit`

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Commit changes: `git commit -m "Add your feature"`
3. Push: `git push origin feature/your-feature`
4. Open a Pull Request

## License

MIT

## Support

For issues, questions, or feature requests, open an issue on GitHub.

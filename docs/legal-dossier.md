# Vantage — Legal Drafting Prompt

HOW TO USE THIS FILE: fill in the [CONFIRM] and [FILL IN] markers below, then
paste the ENTIRE file into your legal chatbot as one message. It is written
as a self-contained prompt: instructions for the chatbot first, then all the
facts it needs. Nothing else has to be attached.

The site currently carries interim versions of all three documents (written
in-house, dated 2026-07-13, at /terms, /privacy, /data-compliance). Replace
their contents with the chatbot's output when you're happy with it.

---

## Instructions (for the legal chatbot)

You are drafting legal documents for a small Canadian software product.
Using ONLY the facts below, produce three documents:

1. **Terms of Service**
2. **Privacy Policy**
3. **Data Compliance statement** (a plain-language page describing PIPEDA
   compliance posture, subprocessors, security measures, and how users
   exercise their rights)

Requirements:
- Plain English, readable by a university student; short sections with
  clear headings. No boilerplate that does not apply to this product.
- Governed by the law stated below. Address PIPEDA; include CCPA/GDPR
  sections only if the target markets below call for them.
- Do not invent features, data flows, or guarantees not stated here. If a
  legally important fact is missing, insert a clearly marked [OWNER: ...]
  placeholder instead of guessing.
- Each document ends with the contact email for questions/requests.

---

## Facts about the product

- **Vantage** — an AI-powered job application web app for university
  students and new graduates, plus a Chrome extension that fills job
  application forms (user-initiated only; it never auto-submits).
- Operator: Vantage, operated by Ishvir Chopra [CONFIRM: entity type —
  sole proprietor? incorporated as Echelon?].
- Governing law currently stated on the site: **Ontario, Canada** [CONFIRM].
- Minimum age currently stated: **16** [CONFIRM].
- Target markets: primarily Canada [CONFIRM: also US? EU? — determines
  whether CCPA/GDPR sections are needed].
- Privacy/legal contact: **ishvir.chopra@gmail.com** [CONFIRM: or a
  dedicated address].
- Pricing: Free tier with monthly usage limits; **Pro $8/month CAD** via
  Stripe. Cancel any time (access runs to period end). **Payments are
  non-refundable, including partial months.** Pricing changes with 30 days
  notice. No free trial - Pro billing starts immediately on upgrade.

## Features (what users do)

Resume upload (PDF/Word) and AI tailoring to specific jobs; AI cover
letters; resume-vs-job compatibility scoring; application tracking with
notes; AI answers to application questions; job discovery feed; AI
networking messages (connection requests, cold emails, follow-ups) to
contacts the user chooses; AI interview practice with voice input; AI
job-search strategy feedback; an in-app help chatbot (answers questions
about the product only); an experimental "Resume Studio" (edit a resume via
AI instructions - works entirely in the browser session, nothing stored
server-side); form auto-fill via the Chrome extension, which requires the
user to review and submit manually.

## Personal data collected

- Account: email, password hash OR Google sign-in identity; full name;
  signup metadata (marketing opt-in choice, terms-accepted timestamp -
  note: Google-OAuth signups accept terms via an inline notice, no
  checkbox, and no timestamp is recorded for them).
- Profile: phone, university, graduation year, degree, location, skills,
  target roles, LinkedIn/GitHub/portfolio URLs, work experience entries,
  project entries.
- Resume files (PDF/Word) and their full extracted text; an HTML version
  of the resume.
- Job postings the user saves (full text), applications (company, role,
  status, dates, notes), AI-generated documents, scoring results.
- Application question answers (AI-generated and user-edited).
- **Third-party personal data**: outreach contacts' names, titles,
  companies, LinkedIn URLs, and the messages written to them (the user
  supplies/chooses this data about other people).
- Interview practice answers (typed or transcribed from voice via the
  browser's Web Speech API - audio processing happens through the browser
  vendor's speech service).
- Help-chat messages; product analytics events (feature usage) keyed to
  user id; API logs (route, timing, counts) keyed to user id.
- Billing: Stripe customer/subscription ids and plan status only - card
  data never touches Vantage servers.

## Subprocessors (where data goes)

| Processor | Data | Purpose |
|---|---|---|
| Supabase | all stored data (database, auth, private file storage) | backend hosting |
| Vercel | request traffic, server logs | app hosting |
| Google Gemini API | resume text, job text, profile details, answers, chat messages | ALL AI features (single provider) |
| Google OAuth | sign-in identity | "Continue with Google" |
| Stripe | email, payment details (cards stay with Stripe) | subscriptions/refunds |
| Resend | email address, delivery events | opt-in product-update emails |
| Adzuna | role/location search queries | job discovery feed |
| Jina.ai | URLs of job postings/forms the user submits | fetching page text |
| SerpApi | company/role search queries | contact search (public results) |
| Feedback webhook (spreadsheet) | feedback form contents + optional email | user feedback |

Committed practices: no selling data, no training AI models on user data,
no sharing with employers/job boards, no advertising cookies or third-party
analytics, no collection of sensitive personal information (race, religion,
sexual orientation, biometric data, etc.) and no collection of data about
users from third parties. Cookies: Supabase auth cookies (essential) only;
localStorage for theme + UI dismissals; sessionStorage for the Resume
Studio working copy. Do-Not-Track browser signals are not currently acted
on (no accepted standard yet). Google Sign-In use of Google user data
follows Google's API Services User Data Policy, including Limited Use.
Standard business-transfer clause: data may transfer as part of a future
merger/acquisition/asset sale, with notice to users beforehand.

## User rights already implemented in-product

- Delete account (full erasure, Settings).
- "Reset my data" (wipe all app data, keep account, Settings).
- Marketing opt-out: Settings toggle + one-click unsubscribe link in every
  marketing email (opt-in is off by default, sourced from an explicit
  signup checkbox).
- Cancel/manage billing via Stripe portal; payments are non-refundable.
- NOT implemented: data export (portability). Requests would be handled
  manually via email [CONFIRM this is acceptable to state].

## Retention

Currently stated on the site: data kept while the account is active;
deleted within 30 days of account deletion [CONFIRM and provide retention
periods for server logs and analytics].

## Fill in before pasting

1. [FILL IN] Legal entity name/type + registered address.
2. [FILL IN] Confirm Ontario governing law, age 16+, target markets.
3. [FILL IN] Privacy contact address.
4. [FILL IN] Retention periods (account data after deletion; logs;
   analytics).
5. [FILL IN] Whether DPAs are in place with Supabase/Stripe/Google/Resend.

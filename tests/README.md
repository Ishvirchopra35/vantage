# Vantage test suite

All tests live here, mirroring the source tree — never next to the code they cover.

```
tests/
  lib/          — unit + property tests for lib/ modules (pure logic, mocked I/O)
  components/   — React component tests (@testing-library/react, jsdom)
  static/       — static source scans: design-system and layout invariants
                  asserted against source text (jsdom can't compute
                  stylesheet-derived state reliably)
```

## Conventions

- One test file per source module (`tests/lib/jobFilters.test.ts` covers `lib/jobFilters.ts`).
- Import sources via the `@/` alias, never relative paths.
- Property-based tests use fast-check; keep `numRuns` at 100–200 so the suite stays fast.
- Anything touching Supabase, Stripe, Gemini, or Resend is mocked — this suite
  never performs network or database I/O and needs no env vars.
- Static scans that allowlist literals must document WHY each entry is intentional.

Run with `npm test` (vitest run) or `npx vitest` for watch mode.

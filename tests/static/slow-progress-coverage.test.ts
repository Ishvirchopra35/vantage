// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Every wait long enough to lose someone's trust should say what it is doing.
// This is checked rather than remembered, because the loader was added to the
// tailor page first and the other seven were missed - exactly the kind of gap
// nobody notices until a user is staring at a spinner.

function sourceFiles(root: string, found: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    if (statSync(path).isDirectory()) sourceFiles(path, found)
    else if (/\.tsx$/.test(entry)) found.push(path)
  }
  return found
}

const CLIENT_SOURCES = [...sourceFiles('app'), ...sourceFiles('components')]
  .map((path) => ({ path, source: readFileSync(path, 'utf-8') }))
  // Both quote styles: the interview page uses double quotes, and filtering on
  // one of them silently excluded it - which made the check report that nothing
  // called the route rather than that the file was not being looked at.
  .filter(({ source }) => /^["']use client["']/.test(source))

/**
 * The AI-backed routes. Each one takes long enough that a bare spinner stops
 * being reassuring, so whatever calls it needs to explain the wait.
 */
const SLOW_ROUTES = [
  '/api/tailor-resume',
  '/api/parse-job',
  '/api/generate-cover-letter',
  '/api/ats-score',
  '/api/parse-resume',
  '/api/strategy-feedback',
  '/api/interview-prep',
  '/api/generate-outreach',
  '/api/resume-studio',
]

describe('long waits explain themselves', () => {
  it.each(SLOW_ROUTES)('whatever calls %s shows progress', (route) => {
    const callers = CLIENT_SOURCES.filter(({ source }) => source.includes(route))
    expect(callers.length, `nothing calls ${route}`).toBeGreaterThan(0)

    for (const { path, source } of callers) {
      expect(source, `${path} calls ${route} without SlowProgress`).toContain('SlowProgress')
    }
  })

  it('names real steps rather than a generic message', () => {
    // A single vague stage would technically pass the check above while telling
    // the user nothing, so every stage list has to have more than one step.
    for (const { path, source } of CLIENT_SOURCES) {
      if (!source.includes('LoadStage[]')) continue
      for (const [, body] of source.matchAll(/LoadStage\[\] = \[([\s\S]*?)\n\]/g)) {
        const labels = [...body.matchAll(/label: ['"]([^'"]+)/g)].map((m) => m[1])
        expect(labels.length, `${path} has a one-step stage list`).toBeGreaterThan(1)
        for (const label of labels) {
          expect(label.length, `${path}: "${label}" is too vague`).toBeGreaterThan(12)
        }
      }
    }
  })

  it('never promises a percentage it cannot measure', () => {
    const component = readFileSync('components/ui/SlowProgress.tsx', 'utf-8')
    // The bar is a time estimate. A number would invite the reader to treat it
    // as measured, and it is not.
    expect(component).not.toMatch(/\{\s*Math\.round\([^)]*\)\s*\}%/)
    expect(component).toContain('CEILING')
  })
})

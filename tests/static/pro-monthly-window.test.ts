// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Pro used to be rate limited per DAY while free was per month, which made the
// two tiers impossible to compare and forced the pricing pages to fall back on
// the word "unlimited". Pro is monthly now. The window lives in a literal in
// each route rather than in one shared place, so a new route can reintroduce
// the daily one just by copying its neighbour - which is what this checks.

const MONTH_MINUTES = 43200
const DAY_MINUTES = 1440

function sourceFiles(root: string, found: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    if (statSync(path).isDirectory()) sourceFiles(path, found)
    else if (/\.ts$/.test(entry)) found.push(path)
  }
  return found
}

interface RouteConfig {
  path: string
  key: string
  freeLimit: number
  proLimit: number
  proWindowMinutes: number
  freeWindowMinutes: number
}

/**
 * Every checkRateLimit config literal in the API routes. Read out of the source
 * rather than by importing the routes, which would drag in Supabase and Gemini.
 */
const ROUTE_CONFIGS: RouteConfig[] = sourceFiles('app/api')
  .map((path) => ({ path, source: readFileSync(path, 'utf-8') }))
  .flatMap(({ path, source }) => {
    const configs: RouteConfig[] = []
    const re = /checkRateLimit\(\{([\s\S]*?)\}\)/g
    let match: RegExpExecArray | null
    while ((match = re.exec(source)) !== null) {
      const body = match[1]
      const field = (name: string): number | null => {
        const m = body.match(new RegExp(`\\b${name}:\\s*(\\d+)`))
        return m ? Number(m[1]) : null
      }
      const keyMatch = body.match(/\bkey:\s*['"]([^'"]+)['"]/)
      const proWindow = field('proWindowMinutes')
      const freeWindow = field('freeWindowMinutes')
      const freeLimit = field('freeLimit')
      const proLimit = field('proLimit')
      if (!keyMatch || proWindow === null || freeWindow === null || freeLimit === null || proLimit === null) {
        continue
      }
      configs.push({
        path,
        key: keyMatch[1],
        freeLimit,
        proLimit,
        proWindowMinutes: proWindow,
        freeWindowMinutes: freeWindow,
      })
    }
    return configs
  })

describe('pro rate limits are monthly', () => {
  it('finds the rate limit configs to check', () => {
    // A regex that silently matches nothing would make every assertion below
    // pass over an empty list.
    expect(ROUTE_CONFIGS.length).toBeGreaterThan(15)
  })

  it('counts pro over a month in every route', () => {
    const daily = ROUTE_CONFIGS.filter((c) => c.proWindowMinutes !== MONTH_MINUTES)
    expect(
      daily.map((c) => `${c.path} (${c.key}): proWindowMinutes ${c.proWindowMinutes}`)
    ).toEqual([])
  })

  it('leaves free on a month and dev on a day', () => {
    for (const config of ROUTE_CONFIGS) {
      expect(config.freeWindowMinutes, `${config.key} in ${config.path}`).toBe(MONTH_MINUTES)
    }
    expect(MONTH_MINUTES).toBe(DAY_MINUTES * 30)
  })

  it('never charges for less than the free tier gets', () => {
    const worse = ROUTE_CONFIGS.filter((c) => c.proLimit < c.freeLimit)
    expect(
      worse.map((c) => `${c.path} (${c.key}): pro ${c.proLimit} < free ${c.freeLimit}`)
    ).toEqual([])
  })
})

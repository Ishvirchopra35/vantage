// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkCompleteness, MIN_COVERAGE } from '@/lib/tagged/completeness'
import { docToTagged } from '@/lib/tagged/serialize'
import type { ResumeDoc } from '@/lib/tagged/schema'
import { generateText } from '@/lib/ai'
import { parseResumeText } from '@/lib/tagged/parseResume'

vi.mock('@/lib/ai', () => ({ generateText: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

const generateTextMock = vi.mocked(generateText)

// A resume long enough that dropping one bullet matters. Each line is over the
// 30-character floor, so every one of them is checkable.
const SOURCE = `Ishvir Chopra
(639) 318-1531 | ischopra@uwaterloo.ca | Toronto

RELEVANT EXPERIENCE
National Research Council Canada
Software Developer Intern
Waterloo, ON  |  May 2026 - Present
• Cut older-adult input friction by roughly 28% in a Flask app via local Whisper ASR
• Rebuilt the session store on Postgres, dropping p95 latency from 400ms to 120ms
• Wrote the migration runner the team now uses for every schema change

EDUCATION
University of Waterloo
BCS - Bachelor of Computer Science
Relevant Coursework: Functional Programming, Algorithms, Calculus I`

/** The transcription a well-behaved model returns for SOURCE. */
const complete: ResumeDoc = {
  name: 'Ishvir Chopra',
  contact: '(639) 318-1531 | ischopra@uwaterloo.ca | Toronto',
  sections: [
    {
      heading: 'RELEVANT EXPERIENCE',
      blocks: [
        {
          bullet: false,
          text: 'National Research Council Canada | Software Developer Intern | Waterloo, ON	May 2026 - Present',
        },
        {
          bullet: true,
          text: 'Cut older-adult input friction by roughly 28% in a Flask app via local Whisper ASR',
        },
        {
          bullet: true,
          text: 'Rebuilt the session store on Postgres, dropping p95 latency from 400ms to 120ms',
        },
        {
          bullet: true,
          text: 'Wrote the migration runner the team now uses for every schema change',
        },
      ],
    },
    {
      heading: 'EDUCATION',
      blocks: [
        { bullet: false, text: 'University of Waterloo | BCS - Bachelor of Computer Science' },
        {
          bullet: true,
          text: 'Relevant Coursework: Functional Programming, Algorithms, Calculus I',
        },
      ],
    },
  ],
}

/** The same transcription with the last `count` bullets of experience dropped. */
function missingBullets(count: number): ResumeDoc {
  return {
    ...complete,
    sections: complete.sections.map((section, i) =>
      i === 0
        ? { ...section, blocks: section.blocks.slice(0, section.blocks.length - count) }
        : section
    ),
  }
}

/** The transcription with the second education line dropped. */
function missingCoursework(): ResumeDoc {
  return {
    ...complete,
    sections: complete.sections.map((section, i) =>
      i === 1 ? { ...section, blocks: section.blocks.slice(0, 1) } : section
    ),
  }
}

describe('checkCompleteness', () => {
  it('passes a transcription that kept everything', () => {
    const report = checkCompleteness(complete, SOURCE)
    expect(report.missing).toEqual([])
    expect(report.coverage).toBe(1)
  })

  it('names the bullet a transcription dropped', () => {
    const report = checkCompleteness(missingBullets(1), SOURCE)
    expect(report.missing).toHaveLength(1)
    expect(report.missing[0]).toContain('migration runner')
    expect(report.coverage).toBeLessThan(MIN_COVERAGE)
  })

  it('counts every dropped line, not just the first', () => {
    expect(checkCompleteness(missingBullets(2), SOURCE).missing).toHaveLength(2)
  })

  it('is not fooled by a bullet losing its glyph and spacing', () => {
    // The extractor strips the glyph and collapses whitespace, so a line is
    // never byte-identical to its source. Comparing fingerprints is what makes
    // the check about content rather than formatting.
    const spaced: ResumeDoc = {
      ...complete,
      sections: complete.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) => ({
          ...block,
          text: `  ${block.text.replace(/ /g, '  ')}  `,
        })),
      })),
    }
    expect(checkCompleteness(spaced, SOURCE).coverage).toBe(1)
  })

  it('catches a dropped education line, which used to be too short to check', () => {
    // The floor was high enough to exempt exactly the lines that went missing:
    // a coursework line and a skills line both fingerprint short.
    const report = checkCompleteness(missingCoursework(), SOURCE)
    expect(report.missing).toHaveLength(1)
    expect(report.missing[0]).toContain('Relevant Coursework')
  })

  it('ignores lines too short to carry evidence', () => {
    // "Toronto" appears inside longer lines by chance; counting it as its own
    // line would make coverage depend on noise.
    const report = checkCompleteness(complete, `${SOURCE}\nRemote\nC++\n2024`)
    expect(report.missing).toEqual([])
  })

  it('treats a source with nothing checkable as complete', () => {
    expect(checkCompleteness(complete, 'Hi\nthere').coverage).toBe(1)
  })
})

describe('parsing a resume the model transcribed badly', () => {
  beforeEach(() => generateTextMock.mockReset())

  it('retries, quoting back the exact lines that were left out', async () => {
    generateTextMock
      .mockResolvedValueOnce(docToTagged(missingBullets(2)))
      .mockResolvedValueOnce(docToTagged(complete))

    const { doc } = await parseResumeText(SOURCE)

    expect(generateTextMock).toHaveBeenCalledTimes(2)
    expect(doc.sections[0].blocks).toHaveLength(4)

    // The retry prompt has to contain the dropped text itself. Repeating the
    // rule does not work; showing the model the line it lost does.
    const retryPrompt = generateTextMock.mock.calls[1][1]
    expect(retryPrompt).toContain('migration runner')
    expect(retryPrompt).toContain('session store on Postgres')
  })

  it('accepts the first attempt when it is complete, without a second call', async () => {
    generateTextMock.mockResolvedValueOnce(docToTagged(complete))
    await parseResumeText(SOURCE)
    expect(generateTextMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after three attempts and returns the fullest one', async () => {
    generateTextMock
      .mockResolvedValueOnce(docToTagged(missingBullets(3)))
      .mockResolvedValueOnce(docToTagged(missingBullets(1))) // the best of the three
      .mockResolvedValueOnce(docToTagged(missingBullets(2)))

    const { doc } = await parseResumeText(SOURCE)

    expect(generateTextMock).toHaveBeenCalledTimes(3)
    // A resume missing one bullet beats no resume at all.
    expect(doc.sections[0].blocks).toHaveLength(3)
  })

  it('retries when the output does not parse at all', async () => {
    generateTextMock
      .mockResolvedValueOnce('Sure! Here is your resume:\n\n- Worked at Acme')
      .mockResolvedValueOnce(docToTagged(complete))

    const { doc } = await parseResumeText(SOURCE)
    expect(doc.name).toBe('Ishvir Chopra')
    expect(generateTextMock.mock.calls[1][1]).toContain('rejected')
  })

  it('refuses when no attempt ever parsed', async () => {
    generateTextMock.mockResolvedValue('not tagged output at all')
    await expect(parseResumeText(SOURCE)).rejects.toThrow(/Could not read that resume/)
  })

  it('refuses an empty file without calling the model', async () => {
    await expect(parseResumeText('   \n  ')).rejects.toThrow(/no readable text/)
    expect(generateTextMock).not.toHaveBeenCalled()
  })
})

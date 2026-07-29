import { describe, it, expect } from 'vitest'
import { buildResumePdf } from '@/lib/docx/pdf'
import type { ResumeDoc } from '@/lib/tagged/schema'

const doc: ResumeDoc = {
  name: 'Jane Doe',
  contact: 'Toronto | jane@example.com | LinkedIn (linkedin.com/in/jane)',
  sections: [
    {
      heading: '',
      blocks: [
        { bullet: false, text: 'Final-year computer science student focused on backend systems.' },
      ],
    },
    {
      heading: 'EXPERIENCE',
      blocks: [
        {
          bullet: false,
          text: 'Acme Robotics | Software Engineering Intern | Toronto, ON	May 2025 - Aug 2025',
        },
        { bullet: true, text: 'Built an internal dashboard used by 40 people' },
        { bullet: true, text: 'Cut report generation from 45s to 38s' },
      ],
    },
    {
      heading: 'EDUCATION',
      blocks: [
        { bullet: false, text: 'University of Waterloo | BSc Computer Science	2022 - 2026' },
      ],
    },
    { heading: 'SKILLS', blocks: [{ bullet: false, text: 'TypeScript, PostgreSQL' }] },
    {
      heading: 'PROJECTS',
      blocks: [
        { bullet: false, text: 'Wrap It Up | Github | TypeScript, Next.js	Jan. 2026' },
        { bullet: true, text: 'Built assignment tracker with panic scoring' },
      ],
    },
  ],
}


/** The raw PDF bytes as latin1, where URIs and structure are readable. */
function raw(buffer: Buffer): string {
  return buffer.toString('latin1')
}

async function renderedText(document: ResumeDoc): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(await buildResumePdf(document)) })
  try {
    return (await parser.getText()).text
  } finally {
    await parser.destroy()
  }
}

describe('buildResumePdf', () => {
  it('produces a valid PDF', async () => {
    const pdf = await buildResumePdf(doc)
    expect(pdf.length).toBeGreaterThan(1000)
    expect(raw(pdf).startsWith('%PDF-')).toBe(true)
    expect(raw(pdf)).toContain('%%EOF')
  })

  it('writes link annotations so addresses are clickable, not just coloured', async () => {
    const text = raw(await buildResumePdf(doc))

    // A /Link annotation with a /URI action is what makes a PDF address
    // actually open; colouring the text alone would look right and do nothing.
    expect(text).toContain('/Link')
    expect(text).toContain('/URI')
    expect(text).toContain('https://linkedin.com/in/jane')
    expect(text).toContain('mailto:jane@example.com')
  })

  it('renders the resume in its own section order', async () => {
    const text = await renderedText(doc)
    expect(text.indexOf('EXPERIENCE')).toBeLessThan(text.indexOf('EDUCATION'))
    expect(text.indexOf('SKILLS')).toBeLessThan(text.indexOf('PROJECTS'))
  })

  it('handles an all-but-empty resume without throwing', async () => {
    const pdf = await buildResumePdf({ name: 'Jane Doe', contact: '', sections: [] })
    expect(raw(pdf).startsWith('%PDF-')).toBe(true)
  })

  it('handles a resume with no links at all', async () => {
    const pdf = await buildResumePdf({
      name: 'Jane Doe',
      contact: 'Toronto',
      sections: [
        {
          heading: 'EXPERIENCE',
          blocks: [
            { bullet: false, text: 'Acme | Eng | 2024' },
            { bullet: true, text: 'Did a thing' },
          ],
        },
      ],
    })
    expect(raw(pdf).startsWith('%PDF-')).toBe(true)
  })

  it('handles a long resume by paginating rather than failing', async () => {
    const long: ResumeDoc = {
      name: 'Jane Doe',
      contact: '',
      sections: Array.from({ length: 12 }, (_, i) => ({
        heading: `SECTION ${i}`,
        blocks: [
          { bullet: false, text: `Company ${i} | Engineer | Toronto\t2024` },
          ...Array.from({ length: 6 }, (_unused, j) => ({
            bullet: true,
            text: `Bullet ${j} describing a substantial piece of work`,
          })),
        ],
      })),
    }
    const pdf = await buildResumePdf(long)
    expect(raw(pdf)).toContain('%%EOF')
    // More than one page object means pdfkit flowed onto a second page
    // instead of silently dropping the overflow.
    expect((raw(pdf).match(/\/Type \/Page[^s]/g) ?? []).length).toBeGreaterThan(1)
  })
})

describe('centred lines with links', () => {
  /** The [x1, y1, x2, y2] of every link annotation, in document order. */
  function linkRects(pdf: Buffer): number[][] {
    return (raw(pdf).match(/\/Rect \[[^\]]+\]/g) ?? []).map((rect) =>
      rect.replace(/[^\d. ]/g, '').trim().split(/\s+/).map(Number)
    )
  }

  it('lays the contact line out left to right without overlapping', async () => {
    // Regression: pdfkit's `align: 'center'` and `continued: true` do not
    // compose - each run was centred against the full column independently, so
    // the pieces of the contact line landed on top of each other.
    const rects = linkRects(
      await buildResumePdf({
        name: 'Jane Doe',
        contact:
          '(639) 318-1531 | jane@example.com | Toronto | LinkedIn (linkedin.com/in/jane) | GitHub (github.com/jane)',
        sections: [],
      })
    )

    expect(rects.length).toBe(3)
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i][0], `link ${i} starts before link ${i - 1} ends`).toBeGreaterThanOrEqual(
        rects[i - 1][2]
      )
    }
  })

  it('keeps the whole centred line inside the page margins', async () => {
    const rects = linkRects(
      await buildResumePdf({
        name: 'Jane Doe',
        contact: 'Toronto | LinkedIn (linkedin.com/in/jane) | GitHub (github.com/jane)',
        sections: [],
      })
    )

    for (const [x1, , x2] of rects) {
      expect(x1).toBeGreaterThanOrEqual(54)
      expect(x2).toBeLessThanOrEqual(612 - 54)
    }
  })

  it('actually centres it rather than starting at the left margin', async () => {
    const rects = linkRects(
      await buildResumePdf({
        name: 'Jane Doe',
        contact: 'Toronto | LinkedIn (linkedin.com/in/jane)',
        sections: [],
      })
    )
    expect(rects[0][0]).toBeGreaterThan(150)
  })
})

describe('characters the standard PDF fonts cannot encode', () => {
  it('renders a tabbed date instead of corrupting it', async () => {
    // From a real download. Resumes right-align dates with a tab, and pdfkit's
    // built-in fonts have no glyph for one: it emitted a replacement glyph
    // that also swallowed the character after it, so "\tJun. 2024" came out
    // as something that had lost its "J".
    const text = await renderedText({
      name: 'Ishvir Chopra',
      contact: '',
      sections: [
        {
          heading: 'PUBLICATIONS',
          blocks: [
            { bullet: false, text: 'A New Frontier | Co-Author | Research Paper\tJun. 2024' },
            { bullet: true, text: 'A finding' },
          ],
        },
      ],
    })

    expect(text).toContain('Jun. 2024')
  })

  it('renders every month a resume might tab-align', async () => {
    const months = ['Jan. 2026', 'Feb. 2026', 'May 2025', 'Nov. 2025', 'Jun. 2024']
    const text = await renderedText({
      name: 'Someone',
      contact: '',
      sections: [
        {
          heading: 'PROJECTS',
          blocks: months.flatMap((month) => [
            { bullet: false, text: `Project | Github | TypeScript\t${month}` },
            { bullet: true, text: 'Did the work' },
          ]),
        },
      ],
    })

    for (const month of months) expect(text, month).toContain(month)
  })

  it('leaves ordinary punctuation and symbols intact', async () => {
    const text = await renderedText({
      name: 'Someone',
      contact: '',
      sections: [
        {
          heading: 'EXPERIENCE',
          blocks: [
            { bullet: false, text: 'Acme | Engineer | Toronto\t2024' },
            {
              bullet: true,
              text: 'Improved pass rate by ~40% at 15/30/45 degrees, cutting cost by $45K+',
            },
          ],
        },
      ],
    })

    expect(text).toContain('~40%')
    expect(text).toContain('15/30/45')
    expect(text).toContain('$45K+')
  })
})

import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import JSZip from 'jszip'
import { splitAtTab } from '@/lib/docx/links'
import { buildResumePdf } from '@/lib/docx/pdf'
import { buildFallbackDocx } from '@/lib/docx/fallback'
import { buildBodyXml } from '@/lib/docx/inject'
import type { ResumeDoc } from '@/lib/tagged/schema'

// Resumes right-align their dates. In a Word file that is a tab against a
// right-aligned tab stop, and the tab survives extraction - so honouring the
// tab reproduces the layout exactly, rather than guessing which part of a line
// is a date.
const doc: ResumeDoc = {
  name: 'Ishvir Chopra',
  contact: 'Toronto',
  sections: [
    {
      heading: 'EXPERIENCE',
      blocks: [
        // One line, exactly as a resume prints it: everything up to the tab,
        // then the date pushed to the right margin.
        { bullet: false, text: 'Compunnel Canada | Project Intern | London, ON\tJun. 2024 - Sep. 2024' },
        { bullet: true, text: 'Refactored a Python ETL pipeline' },
      ],
    },
  ],
}

describe('splitAtTab', () => {
  it('splits a line at its tab', () => {
    expect(splitAtTab('London, ON\tJun. 2024')).toEqual({
      left: 'London, ON',
      right: 'Jun. 2024',
    })
  })

  it('splits at the last tab, which is where the right margin is', () => {
    expect(splitAtTab('Role\tTeam\tJan. 2026')).toEqual({ left: 'Role\tTeam', right: 'Jan. 2026' })
  })

  it('leaves a line with no tab alone', () => {
    expect(splitAtTab('Project Intern | London, ON | Jun. 2024')).toBeNull()
  })

  it('ignores a trailing tab with nothing after it', () => {
    expect(splitAtTab('Project Intern\t   ')).toBeNull()
  })
})

describe('the Word file', () => {
  it('gives a tabbed line a right tab stop, so the date reaches the margin', () => {
    const xml = buildBodyXml(doc, {})
    const paragraph = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*London(?:(?!<\/w:p>)[\s\S])*<\/w:p>/)?.[0] ?? ''

    expect(paragraph).toContain('<w:tab w:val="right"')
    // The tab itself is a <w:tab/> element, not a character inside <w:t>.
    expect(paragraph).toContain('<w:tab/>')
    expect(paragraph).toContain('Jun. 2024 - Sep. 2024')
  })

  it('does not put a tab stop on a line that has no tab', () => {
    const xml = buildBodyXml(doc, {})
    const bullet = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*Refactored(?:(?!<\/w:p>)[\s\S])*<\/w:p>/)?.[0] ?? ''
    expect(bullet).not.toContain('<w:tab w:val="right"')
  })

  it('does the same in the built-in layout', async () => {
    const zip = await JSZip.loadAsync(await buildFallbackDocx(doc))
    const xml = await zip.file('word/document.xml')!.async('string')

    expect(xml).toContain('London, ON')
    expect(xml).toContain('Jun. 2024 - Sep. 2024')
    // docx writes the stop as <w:tabs><w:tab .../></w:tabs> on the paragraph.
    expect(xml).toMatch(/<w:tabs>[\s\S]*?w:val="right"/)
  })
})

describe('the PDF', () => {
  /**
   * Every string drawn in the PDF, with the point it was drawn at.
   *
   * pdfkit positions with "1 0 0 1 x y Tm" and draws with a TJ array of hex
   * strings interleaved with kerning numbers - "[<4a> 20 <756e2e>] TJ" is
   * "Jun." nudged apart. Reading coordinates straight out of the content
   * stream is the only way to assert on *placement*; extracted text alone
   * cannot tell a right-aligned date from one sitting mid-line.
   */
  function draws(pdf: Buffer): { x: number; y: number; text: string }[] {
    const raw = pdf.toString('latin1')
    const out: { x: number; y: number; text: string }[] = []

    for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      let body: string
      try {
        body = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1')
      } catch {
        continue // not a compressed content stream (fonts, metadata)
      }

      const re = /1 0 0 1 ([-\d.]+) ([-\d.]+) Tm[\s\S]{0,80}?\[(.*?)\] TJ/g
      let m: RegExpExecArray | null
      while ((m = re.exec(body))) {
        const text = [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)]
          .map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1'))
          .join('')
        out.push({ x: Number(m[1]), y: Number(m[2]), text })
      }
    }
    return out
  }

  it('draws the date at the right margin, not in the middle of the line', async () => {
    const positions = draws(await buildResumePdf(doc))
    const date = positions.find((p) => p.text.includes('Jun. 2024'))
    const location = positions.find((p) => p.text.includes('London'))

    expect(date, 'the date should be drawn').toBeDefined()
    expect(location, 'the location should be drawn').toBeDefined()

    // Letter is 612pt wide with a 54pt margin, so the right edge is 558. The
    // date is right-aligned, meaning it ENDS there and therefore starts well
    // past the middle of the page.
    expect(date!.x).toBeGreaterThan(306)
    expect(date!.x).toBeGreaterThan(location!.x)
  })

  it('puts the date on the same baseline as the rest of its line', async () => {
    const positions = draws(await buildResumePdf(doc))
    const date = positions.find((p) => p.text.includes('Jun. 2024'))!
    const location = positions.find((p) => p.text.includes('London'))!

    // Exactly level. A couple of points out looks like nothing on screen and
    // like every date sitting low once printed.
    expect(date.y).toBeCloseTo(location.y, 3)
  })

  it('leaves the line after a tabbed one where it belongs', async () => {
    const positions = draws(await buildResumePdf(doc))
    const date = positions.find((p) => p.text.includes('Jun. 2024'))!
    const bullet = positions.find((p) => p.text.includes('Refactored'))!

    // Drawing the tail must not disturb the cursor: the bullet below sits one
    // line down, not on top of the date and not a line further than usual.
    const gap = Math.abs(bullet.y - date.y)
    expect(gap).toBeGreaterThan(4)
    expect(gap).toBeLessThan(20)
  })

  it('keeps both halves of the line on the same baseline', async () => {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(await buildResumePdf(doc)) })
    try {
      const text = (await parser.getText()).text
      // Both survive, and the bullet below them still follows.
      expect(text).toContain('London, ON')
      expect(text).toContain('Jun. 2024 - Sep. 2024')
      expect(text.indexOf('Jun. 2024')).toBeLessThan(text.indexOf('Refactored'))
    } finally {
      await parser.destroy()
    }
  })
})

import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { docToTagged, taggedToDoc } from '@/lib/tagged/serialize'
import { docToPlainText } from '@/lib/tagged/plainText'
import { buildFallbackDocx } from '@/lib/docx/fallback'
import { buildResumePdf } from '@/lib/docx/pdf'
import { fromLegacyDoc, isResumeDoc, readStoredDoc } from '@/lib/tagged/validate'
import { normaliseDoc, type ResumeDoc } from '@/lib/tagged/schema'

// The resume that drove this rewrite, in its real shape: the section is called
// "RELEVANT EXPERIENCE", each entry is ONE line with the date after a tab, the
// publication sits INSIDE the experience section after the jobs, skills run to
// two separate paragraphs, and the coursework is a bullet under the degree.
// Every one of those was unrepresentable in some earlier version of the format,
// and each produced its own bug.
const real: ResumeDoc = {
  name: 'Ishvir Chopra',
  contact: '(639) 318-1531 | ischopra@uwaterloo.ca | Toronto | LinkedIn (linkedin.com/in/ishvir)',
  sections: [
    {
      heading: 'TECHNICAL SKILLS',
      blocks: [
        { bullet: false, text: 'Languages: Python, C, Racket, Java, TypeScript, SQL' },
        { bullet: false, text: 'Tools: Supabase, Vercel, Git, Linux, Power BI' },
      ],
    },
    {
      heading: 'RELEVANT EXPERIENCE',
      blocks: [
        {
          bullet: false,
          text: 'National Research Council Canada | Software Developer Intern | Waterloo, ON\tMay. 2026 - Present',
        },
        { bullet: true, text: 'Cut older-adult input friction by ~28% in Flask app via Whisper ASR' },
        {
          bullet: false,
          text: 'Compunnel Canada | Project Intern | London, ON\tJun. 2024 - Sep. 2024',
        },
        { bullet: true, text: 'Refactored a Python ETL pipeline, reducing runtime from 45s to 38s' },
        // The publication, inside the experience section, exactly as printed.
        {
          bullet: false,
          text: 'Artificial Intelligence: A New Frontier | Co-Author | Research Paper\tJun. 2024',
        },
        { bullet: true, text: 'Published research in Arseam Foundation, analyzing study habits' },
      ],
    },
    {
      heading: 'EDUCATION',
      blocks: [
        {
          bullet: false,
          text: 'University of Waterloo | BCS - Bachelor of Computer Science | 4.0 GPA\tSep. 2025 - Present',
        },
        { bullet: true, text: 'Relevant Coursework: Functional Programming, Algorithms, Calculus I' },
      ],
    },
    {
      heading: 'PROJECTS',
      blocks: [
        { bullet: false, text: 'Vantage | Github | Next.js, Supabase\tJun. 2026' },
        { bullet: true, text: 'Built Chrome MV3 extension pre-filling job forms across Shadow DOM' },
      ],
    },
  ],
}

/** Every heading, in order, as a renderer would print them. */
function headings(text: string): string[] {
  return real.sections.map((section) => section.heading).filter((heading) => text.includes(heading))
}

describe('the real resume, end to end', () => {
  it('round-trips without losing or renaming anything', () => {
    expect(taggedToDoc(docToTagged(real))).toEqual(real)
  })

  it('keeps the section called what the candidate called it', () => {
    const text = docToPlainText(real)
    expect(text).toContain('RELEVANT EXPERIENCE')
    // Our own name for that section must never appear.
    expect(text).not.toMatch(/^EXPERIENCE$/m)
  })

  it('prints each heading exactly once', () => {
    const text = docToPlainText(real)
    for (const heading of ['RELEVANT EXPERIENCE', 'EDUCATION', 'TECHNICAL SKILLS', 'PROJECTS']) {
      expect(text.match(new RegExp(heading, 'g')), heading).toHaveLength(1)
    }
  })

  it('keeps the whole entry on one line, date included', () => {
    const entry = real.sections[1].blocks[0].text
    // Employer, role, location and date shared a line in the resume. Splitting
    // them across separate fields is what moved the date off it.
    expect(entry.split('\t')).toHaveLength(2)
    expect(entry).toContain('National Research Council Canada')
    expect(entry).toContain('\tMay. 2026 - Present')
  })

  it('keeps both paragraphs of the skills section', () => {
    const text = docToPlainText(real)
    expect(text).toContain('Languages:')
    expect(text).toContain('Tools:')
  })

  it('keeps the publication inside the experience section, after the jobs', () => {
    const text = docToPlainText(real)
    const heading = text.indexOf('RELEVANT EXPERIENCE')
    const lastJob = text.indexOf('Compunnel Canada')
    const publication = text.indexOf('Co-Author')
    const education = text.indexOf('EDUCATION')

    expect(lastJob).toBeGreaterThan(heading)
    expect(publication).toBeGreaterThan(lastJob)
    expect(publication).toBeLessThan(education)
  })

  it('keeps the coursework under education', () => {
    const text = docToPlainText(real)
    expect(text.indexOf('Relevant Coursework')).toBeGreaterThan(text.indexOf('EDUCATION'))
    expect(text.indexOf('Relevant Coursework')).toBeLessThan(text.indexOf('PROJECTS'))
  })

  it('has no unnamed section', () => {
    expect(real.sections.every((section) => section.heading.trim())).toBe(true)
  })

  it('renders the same order into Word', async () => {
    const zip = await JSZip.loadAsync(await buildFallbackDocx(real))
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(headings(xml)).toEqual([
      'TECHNICAL SKILLS',
      'RELEVANT EXPERIENCE',
      'EDUCATION',
      'PROJECTS',
    ])
    expect(xml.indexOf('Co-Author')).toBeLessThan(xml.indexOf('EDUCATION'))
  })

  it('renders the same order into the PDF, with links intact', async () => {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(await buildResumePdf(real)) })
    try {
      const text = (await parser.getText()).text
      expect(headings(text)).toEqual([
        'TECHNICAL SKILLS',
        'RELEVANT EXPERIENCE',
        'EDUCATION',
        'PROJECTS',
      ])
      expect(text.indexOf('Co-Author')).toBeLessThan(text.indexOf('EDUCATION'))
    } finally {
      await parser.destroy()
    }
  })
})

describe('documents stored in the original bucketed format', () => {
  const legacy = {
    name: 'Jane Doe',
    contact: 'Toronto',
    summary: 'A summary.',
    experience: [
      {
        company: 'Acme',
        title: 'Engineer',
        location: 'Toronto',
        dates: '2024',
        bullets: ['Did a thing'],
      },
    ],
    education: [{ school: 'A University', degree: 'BSc', dates: '2020', bullets: ['Coursework'] }],
    skills: ['TypeScript', 'Python'],
    certifications: [],
    languages: [],
    publications: [],
    awards: [],
    custom: [
      { heading: 'PROJECTS', entries: [{ label: 'A project', bullets: ['Built it'] }], items: [] },
    ],
  }

  it('converts rather than failing, so nobody has to start again', () => {
    const converted = fromLegacyDoc(legacy)
    expect(converted).not.toBeNull()
    expect(isResumeDoc(converted)).toBe(true)
  })

  it('loses nothing in the conversion', () => {
    const text = docToPlainText(fromLegacyDoc(legacy)!)
    for (const expected of [
      'Jane Doe',
      'A summary.',
      'Acme',
      'Did a thing',
      'A University',
      'Coursework',
      'TypeScript, Python',
      'A project',
      'Built it',
    ]) {
      expect(text, expected).toContain(expected)
    }
  })

  it('ignores anything that is not the old shape', () => {
    expect(fromLegacyDoc(null)).toBeNull()
    expect(fromLegacyDoc({ name: 'Jane' })).toBeNull()
    expect(fromLegacyDoc(real)).toBeNull()
  })
})

describe('documents stored with fixed slots inside each entry', () => {
  // The shape between the buckets and this one. It could not represent an
  // entry printed on a single line, so the conversion cannot put the line back
  // together - but it must not lose a word either.
  const entryShaped = {
    name: 'Jane Doe',
    contact: 'Toronto',
    sections: [
      {
        heading: 'EXPERIENCE',
        text: '',
        entries: [
          {
            title: 'Acme',
            subtitle: 'Engineer',
            meta: 'Toronto | 2024',
            bullets: ['Did a thing', 'Did another'],
          },
        ],
        items: ['A standalone line'],
      },
      { heading: 'SKILLS', text: 'TypeScript, Python', entries: [], items: [] },
    ],
  }

  it('converts rather than refusing', () => {
    const doc = readStoredDoc(entryShaped)
    expect(doc).not.toBeNull()
    expect(isResumeDoc(doc)).toBe(true)
  })

  it('keeps every word, in order', () => {
    const doc = readStoredDoc(entryShaped)!
    expect(doc.sections[0].blocks.map((b) => b.text)).toEqual([
      'Acme',
      'Engineer',
      'Toronto | 2024',
      'Did a thing',
      'Did another',
      'A standalone line',
    ])
    expect(doc.sections[1].blocks[0].text).toBe('TypeScript, Python')
  })

  it('remembers which lines were bullets', () => {
    const doc = readStoredDoc(entryShaped)!
    expect(doc.sections[0].blocks.map((b) => b.bullet)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
    ])
  })
})

describe('stored documents from an older build', () => {
  it('passes a current document straight through', () => {
    expect(readStoredDoc(real)).toEqual(real)
  })

  it('refuses anything that is neither', () => {
    for (const value of [null, undefined, 'a string', 42, {}, { name: 'Jane' }]) {
      expect(readStoredDoc(value), String(value)).toBeNull()
    }
  })

  it('normalises a document missing its sections rather than throwing', () => {
    // What the editor now does defensively before rendering anything. Resume
    // Studio keeps the working document in sessionStorage, so one left there
    // before the format changed comes back missing fields entirely.
    expect(normaliseDoc({ name: 'Jane', contact: 'Toronto' })).toEqual({
      name: 'Jane',
      contact: 'Toronto',
      sections: [],
    })
    expect(normaliseDoc(null)).toEqual({ name: '', contact: '', sections: [] })
  })

  it('fills in a section missing its fields', () => {
    const partial = { name: 'Jane', contact: '', sections: [{ heading: 'X' }] }
    expect(normaliseDoc(partial as never).sections[0]).toEqual({ heading: 'X', blocks: [] })
  })

  it('drops a paragraph reference that is not a real index', () => {
    // These decide which paragraph of the user's file a line is written into,
    // so a malformed one has to be forgotten rather than trusted.
    const doc = normaliseDoc({
      name: 'Jane',
      contact: '',
      sections: [
        {
          heading: 'X',
          blocks: [
            { bullet: false, text: 'A', source: -1 },
            { bullet: false, text: 'B', source: 1.5 },
            { bullet: false, text: 'C', source: 4 },
          ],
        },
      ],
    } as never)

    expect(doc.sections[0].blocks.map((b) => b.source)).toEqual([undefined, undefined, 4])
  })
})

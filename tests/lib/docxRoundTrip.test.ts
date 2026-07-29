import { describe, it, expect } from 'vitest'
import { buildFallbackDocx } from '@/lib/docx/fallback'
import { extractResumeText, isDocxFile } from '@/lib/docx/extractText'
import { emptyDoc, type ResumeDoc } from '@/lib/tagged/schema'

// The end-to-end claim this whole change rests on: a hyperlink written into a
// Word file survives being read back out. That is not hypothetical - it is the
// real user path. Someone downloads their tailored resume, then months later
// uploads that same file as their new base resume. If extraction dropped the
// link target, their portfolio URL would vanish on the round trip.
//
// Both halves run for real here: the `docx` library writes the file, mammoth
// reads it back.

const doc: ResumeDoc = {
  name: 'Jane Doe',
  contact: 'Toronto | jane@example.com | LinkedIn (linkedin.com/in/jane) | Portfolio (janedoe.dev)',
  sections: [
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
  ],
}

describe('docx round trip', () => {
  it('recognises a generated file as Word', () => {
    expect(isDocxFile('resume.docx', '')).toBe(true)
    expect(isDocxFile('resume.pdf', 'application/pdf')).toBe(false)
  })

  it('reads back every section it wrote', async () => {
    const text = await extractResumeText(await buildFallbackDocx(doc), true)

    expect(text).toContain('Jane Doe')
    expect(text).toContain('Acme Robotics')
    expect(text).toContain('Built an internal dashboard used by 40 people')
    expect(text).toContain('Cut report generation from 45s to 38s')
    expect(text).toContain('University of Waterloo')
    expect(text).toContain('TypeScript, PostgreSQL')
  })

  it('keeps the hyperlink destination, not just the visible label', async () => {
    const text = await extractResumeText(await buildFallbackDocx(doc), true)

    // The address has to come back, or the candidate's links are lost.
    expect(text).toContain('linkedin.com/in/jane')
    expect(text).toContain('janedoe.dev')
    expect(text).toContain('jane@example.com')
  })

  it('survives a second round trip unchanged', async () => {
    // Generating from what was extracted must not degrade the links further -
    // a user who downloads and re-uploads twice should not lose anything.
    const first = await extractResumeText(await buildFallbackDocx(doc), true)
    const second = await extractResumeText(
      await buildFallbackDocx({ ...doc, contact: first.split('\n').find((l) => l.includes('@')) ?? doc.contact }),
      true
    )

    expect(second).toContain('linkedin.com/in/jane')
    expect(second).toContain('jane@example.com')
  })
})

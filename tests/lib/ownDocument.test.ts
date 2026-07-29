// @vitest-environment node
//
// The guarantee this file exists to hold: when a resume is uploaded as Word,
// the download is the user's own document with different words in it - not a
// document we built to look like theirs.
//
// The fixture is a real resume in the shape that broke every earlier version:
// each entry printed on ONE line as "Employer | Role | Location<TAB>Dates" with
// the employer bold and the location not, a skills section of TWO paragraphs,
// a publication sitting inside the experience section, and coursework under the
// degree. Three separate bugs came from a format that could not hold any of it.

import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { Document, Packer, Paragraph, TextRun, Tab, LevelFormat, AlignmentType } from 'docx'
import { readParagraphs, paragraphText, isBulletParagraph } from '@/lib/docx/paragraphs'
import { rewriteBodyXml, rewriteDocx, sourcesFit } from '@/lib/docx/rewrite'
import { assemble } from '@/lib/tagged/fromParagraphs'
import { docToTagged, taggedToDoc } from '@/lib/tagged/serialize'
import { lockFields, clampBulletLengths } from '@/lib/tagged/tailor'
import { assertSameSkeleton } from '@/lib/tagged/skeleton'
import { carrySources } from '@/lib/tagged/sources'
import { hasSourceParagraphs } from '@/lib/docx/buildDocx'
import type { ResumeDoc } from '@/lib/tagged/schema'

/** A line, with the parts of it that were bold marked. */
interface Line {
  text: string
  bold?: boolean
  /** Text after a tab, pushed to the right margin. Bold like the lead. */
  tail?: string
  bullet?: boolean
  heading?: boolean
}

const RESUME: Line[] = [
  { text: 'Ishvir Chopra', heading: true },
  { text: '(639) 318-1531 | ischopra@uwaterloo.ca | Toronto' },
  { text: 'TECHNICAL SKILLS', heading: true },
  { text: 'Languages: Python, C, Racket, Java, JavaScript, TypeScript, C#, SQL' },
  { text: 'Frameworks: Next.js, React, PyTorch, OpenCV, Pandas Tools: Supabase, Git, Linux' },
  { text: 'RELEVANT EXPERIENCE', heading: true },
  {
    text: 'National Research Council Canada | Software Developer Intern | Waterloo, ON',
    tail: 'May. 2026 - Present',
    bold: true,
  },
  { text: 'Cut older-adult input friction by ~28% in Flask app via local Whisper ASR', bullet: true },
  { text: 'Redesigned 4 Flask workflows for older adults', bullet: true },
  {
    text: 'Artificial Intelligence and Machine Learning | Co-Author | Research Paper',
    tail: 'Jun. 2024',
    bold: true,
  },
  { text: 'Published research in Arseam Foundation, analyzing study habits', bullet: true },
  { text: 'EDUCATION', heading: true },
  {
    text: 'University of Waterloo | BCS - Bachelor of Computer Science | 4.0 GPA',
    tail: 'Sep. 2025 - Present',
    bold: true,
  },
  { text: 'Relevant Coursework: Functional Programming, Algorithms, Calculus I', bullet: true },
]

/** Builds the fixture as a real .docx, the way Word would write it. */
async function buildFixture(): Promise<Buffer> {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'resume-bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT }],
        },
      ],
    },
    sections: [
      {
        children: RESUME.map((line) => {
          const children = [new TextRun({ text: line.text, bold: line.bold || line.heading })]
          if (line.tail) {
            children.push(new TextRun({ children: [new Tab()], bold: line.bold }))
            children.push(new TextRun({ text: line.tail, bold: line.bold }))
          }
          return new Paragraph({
            children,
            ...(line.bullet
              ? { numbering: { reference: 'resume-bullets', level: 0 } }
              : {}),
          })
        }),
      },
    ],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  return zip.file('word/document.xml')!.async('string')
}

/** The document as the app sees it, with headings identified as the model would. */
async function readFixture(): Promise<{ xml: string; doc: ResumeDoc }> {
  const xml = await documentXml(await buildFixture())
  const paragraphs = readParagraphs(xml)
  const headingLines = paragraphs
    .filter((p) => RESUME[p.index]?.heading && p.index > 0)
    .map((p) => p.index)

  return { xml, doc: assemble(paragraphs, { nameLine: 0, contactLine: 1, headingLines }) }
}

describe('reading the user’s Word file', () => {
  it('finds every line, in order, losing none of them', async () => {
    const { xml } = await readFixture()
    const paragraphs = readParagraphs(xml).filter((p) => p.text.trim())

    expect(paragraphs).toHaveLength(RESUME.length)
    paragraphs.forEach((p, i) => {
      const expected = RESUME[i].tail ? `${RESUME[i].text}\t${RESUME[i].tail}` : RESUME[i].text
      expect(p.text, `line ${i}`).toBe(expected)
    })
  })

  it('keeps the whole entry on one line, with the date after a tab', async () => {
    const { doc } = await readFixture()
    const experience = doc.sections.find((s) => s.heading === 'RELEVANT EXPERIENCE')!
    const entry = experience.blocks[0].text

    // The employer, the role, the location and the date all shared a line in
    // the resume. Splitting them across three fields is what moved the date.
    expect(entry).toContain('National Research Council Canada')
    expect(entry).toContain('Software Developer Intern')
    expect(entry).toContain('Waterloo, ON')
    expect(entry).toContain('\tMay. 2026 - Present')
    expect(entry.split('\t')).toHaveLength(2)
  })

  it('keeps both paragraphs of the skills section', async () => {
    const { doc } = await readFixture()
    const skills = doc.sections.find((s) => s.heading === 'TECHNICAL SKILLS')!

    // One `text` field per section could hold only the first of these, so the
    // second was silently dropped. This is the reported missing skills line.
    expect(skills.blocks).toHaveLength(2)
    expect(skills.blocks[0].text).toContain('Languages:')
    expect(skills.blocks[1].text).toContain('Frameworks:')
  })

  it('keeps the coursework line under education', async () => {
    const { doc } = await readFixture()
    const education = doc.sections.find((s) => s.heading === 'EDUCATION')!

    expect(education.blocks.map((b) => b.text).join('\n')).toContain('Relevant Coursework')
    expect(education.blocks.at(-1)!.bullet).toBe(true)
  })

  it('keeps the publication inside the experience section', async () => {
    const { doc } = await readFixture()
    const experience = doc.sections.find((s) => s.heading === 'RELEVANT EXPERIENCE')!
    const text = experience.blocks.map((b) => b.text).join('\n')

    expect(text).toContain('Co-Author')
    expect(doc.sections.map((s) => s.heading)).not.toContain('PUBLICATIONS')
  })

  it('reads bullet-ness from the file rather than guessing it', async () => {
    const { doc } = await readFixture()
    const experience = doc.sections.find((s) => s.heading === 'RELEVANT EXPERIENCE')!

    expect(experience.blocks.map((b) => b.bullet)).toEqual([false, true, true, false, true])
  })

  it('gives every line a reference back to its own paragraph', async () => {
    const { doc } = await readFixture()
    expect(hasSourceParagraphs(doc)).toBe(true)
    for (const section of doc.sections) {
      for (const block of section.blocks) expect(block.source).toBeTypeOf('number')
    }
  })
})

describe('writing back into the user’s Word file', () => {
  it('changes nothing at all when nothing was tailored', async () => {
    const { xml, doc } = await readFixture()
    const before = readParagraphs(xml)
    const after = readParagraphs(`<w:document><w:body>${rewriteBodyXml(xml, doc)}</w:body></w:document>`)

    // Byte-for-byte on every paragraph. This is the property the whole design
    // rests on: an untouched line is not re-rendered, it is re-emitted.
    expect(after.map((p) => p.xml)).toEqual(before.map((p) => p.xml))
  })

  it('changes only the bullet that was tailored', async () => {
    const { xml, doc } = await readFixture()

    const tailored: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) =>
          block.text.startsWith('Cut older-adult')
            ? { ...block, text: 'Cut older-adult input friction by ~28% in a Python Flask service' }
            : block
        ),
      })),
    }

    const before = readParagraphs(xml)
    const after = readParagraphs(
      `<w:document><w:body>${rewriteBodyXml(xml, tailored)}</w:body></w:document>`
    )

    const differing = after.filter((p, i) => p.xml !== before[i].xml)
    expect(differing).toHaveLength(1)
    expect(differing[0].text).toContain('Python Flask service')
    // Still a bullet, because its paragraph properties came across untouched.
    expect(differing[0].bullet).toBe(true)
  })

  it('keeps the tab, and therefore the date, on a rewritten line', async () => {
    const { xml, doc } = await readFixture()

    const tailored: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) =>
          block.text.startsWith('National Research')
            ? { ...block, text: 'NRC Canada | Software Developer Intern | Waterloo, ON\tMay. 2026 - Present' }
            : block
        ),
      })),
    }

    const rewritten = rewriteBodyXml(xml, tailored)
    const line = readParagraphs(`<w:document><w:body>${rewritten}</w:body></w:document>`).find((p) =>
      p.text.startsWith('NRC Canada')
    )!

    expect(line.text).toContain('\tMay. 2026 - Present')
    // A real <w:tab/> element, not a tab character Word would ignore.
    expect(rewritten).toContain('<w:tab/>')
  })

  it('keeps the paragraph’s own formatting on a rewritten line', async () => {
    const { xml, doc } = await readFixture()

    const tailored: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) =>
          block.text.startsWith('Published research') ? { ...block, text: 'Published ML research' } : block
        ),
      })),
    }

    const after = readParagraphs(
      `<w:document><w:body>${rewriteBodyXml(xml, tailored)}</w:body></w:document>`
    )
    const line = after.find((p) => p.text === 'Published ML research')!

    // Its list numbering came from <w:pPr>, which was carried across verbatim.
    expect(isBulletParagraph(line.xml)).toBe(true)
  })

  it('drops a line the user deleted, and keeps the rest', async () => {
    const { xml, doc } = await readFixture()

    const trimmed: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => !block.text.startsWith('Redesigned 4 Flask')),
      })),
    }

    const after = readParagraphs(
      `<w:document><w:body>${rewriteBodyXml(xml, trimmed)}</w:body></w:document>`
    ).filter((p) => p.text.trim())

    expect(after).toHaveLength(RESUME.length - 1)
    expect(after.map((p) => p.text).join('\n')).not.toContain('Redesigned')
  })

  it('formats a line the user added like the lines around it', async () => {
    const { xml, doc } = await readFixture()

    const grown: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section) =>
        section.heading === 'EDUCATION'
          ? { ...section, blocks: [...section.blocks, { bullet: true, text: 'Dean’s List 2026' }] }
          : section
      ),
    }

    const after = readParagraphs(
      `<w:document><w:body>${rewriteBodyXml(xml, grown)}</w:body></w:document>`
    )
    const added = after.find((p) => p.text === 'Dean’s List 2026')!

    // No style of ours was invented for it - it copied a real bullet's.
    expect(isBulletParagraph(added.xml)).toBe(true)
  })

  it('produces a .docx that still opens, keeping every other part of the archive', async () => {
    const original = await buildFixture()
    const { doc } = await readFixture()

    const before = await JSZip.loadAsync(original)
    const after = await JSZip.loadAsync(await rewriteDocx(original, doc))

    expect(Object.keys(after.files).sort()).toEqual(Object.keys(before.files).sort())
    for (const name of Object.keys(before.files)) {
      if (name === 'word/document.xml' || before.files[name].dir) continue
      // Numbering, styles, relationships and settings all pass through
      // untouched, which is why the bullets and fonts still work.
      expect(await after.file(name)!.async('string'), name).toBe(
        await before.file(name)!.async('string')
      )
    }
  })
})

describe('tailoring a document read from a Word file', () => {
  it('survives the round trip through the model’s format with its sources intact', async () => {
    const { doc } = await readFixture()

    const tagged = docToTagged(doc)
    const returned = taggedToDoc(tagged)
    assertSameSkeleton(tagged, docToTagged(returned))

    const locked = lockFields(doc, returned)

    // The tagged format carries text only, so the paragraph references have to
    // come back from the original - and they do, positionally.
    expect(locked.sections.flatMap((s) => s.blocks.map((b) => b.source))).toEqual(
      doc.sections.flatMap((s) => s.blocks.map((b) => b.source))
    )
    expect(locked.nameSource).toBe(0)
  })

  it('carries a tab through the model’s format unharmed', async () => {
    const { doc } = await readFixture()
    const returned = taggedToDoc(docToTagged(doc))
    const entry = returned.sections.find((s) => s.heading === 'RELEVANT EXPERIENCE')!.blocks[0]

    expect(entry.text).toContain('\tMay. 2026 - Present')
  })

  it('lets a bullet change and refuses everything else', async () => {
    const { doc } = await readFixture()

    // A model that rewrote a heading, an employer line and a bullet.
    const meddled: ResumeDoc = {
      ...doc,
      name: 'Someone Else',
      sections: doc.sections.map((section) => ({
        ...section,
        heading: section.heading ? 'EXPERIENCE' : '',
        blocks: section.blocks.map((block) => ({
          ...block,
          text: block.bullet ? `${block.text} using React` : 'Rewritten Employer Line',
        })),
      })),
    }

    const locked = lockFields(doc, meddled)

    expect(locked.name).toBe('Ishvir Chopra')
    expect(locked.sections.map((s) => s.heading)).toEqual(doc.sections.map((s) => s.heading))
    for (const [i, section] of locked.sections.entries()) {
      section.blocks.forEach((block, j) => {
        const original = doc.sections[i].blocks[j]
        if (block.bullet) expect(block.text).toBe(`${original.text} using React`)
        else expect(block.text).toBe(original.text)
      })
    }
  })

  it('reverts a bullet that grew long enough to wrap', async () => {
    const { doc } = await readFixture()
    const grown: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) =>
          block.bullet ? { ...block, text: `${block.text} ${'and more detail '.repeat(6)}` } : block
        ),
      })),
    }

    const clamped = clampBulletLengths(doc, grown)
    for (const [i, section] of clamped.sections.entries()) {
      section.blocks.forEach((block, j) => {
        expect(block.text).toBe(doc.sections[i].blocks[j].text)
      })
    }
  })
})

describe('tailoring end to end, as the route runs it', () => {
  /**
   * Stands in for the AI: returns the tagged document with every bullet
   * rewritten. Kept SHORTER than the original, because clampBulletLengths
   * reverts a bullet that grows past about a sixth - that is the one-page
   * guard, and a mock that trips it would be testing nothing.
   */
  function respond(tagged: string): string {
    return tagged.replace(/<bullet>[\s\S]*?<\/bullet>/g, '<bullet>Rewritten in React</bullet>')
  }

  it('keeps every paragraph reference through a whole tailoring', async () => {
    const { doc } = await readFixture()

    // What tailorTagged does, without the network: serialise, let the model
    // answer, check the skeleton, restore everything that is not a bullet.
    const tagged = docToTagged(doc)
    const returned = taggedToDoc(respond(tagged))
    assertSameSkeleton(tagged, docToTagged(returned))
    const tailored = clampBulletLengths(doc, lockFields(doc, returned))

    // This is the property the download depends on. The tagged format carries
    // text only, so if the "original" handed to lockFields is a re-parse of
    // that string rather than the real document, every reference is gone and
    // the download quietly rebuilds the resume instead of editing the user's
    // file - with nothing about the result looking wrong.
    expect(hasSourceParagraphs(tailored)).toBe(true)
    expect(tailored.sections.flatMap((s) => s.blocks.map((b) => b.source))).toEqual(
      doc.sections.flatMap((s) => s.blocks.map((b) => b.source))
    )
    expect(tailored.nameSource).toBe(doc.nameSource)
    expect(tailored.sections.map((s) => s.headingSource)).toEqual(
      doc.sections.map((s) => s.headingSource)
    )
  })

  it('writes the tailored resume back into the user’s own file', async () => {
    const original = await buildFixture()
    const { xml, doc } = await readFixture()

    const tagged = docToTagged(doc)
    const tailored = clampBulletLengths(doc, lockFields(doc, taggedToDoc(respond(tagged))))

    const before = readParagraphs(xml)
    const after = readParagraphs(
      await documentXml(await rewriteDocx(original, tailored))
    )

    // Every bullet changed; nothing else did.
    const differing = after.filter((p, i) => p.xml !== before[i].xml)
    expect(differing.every((p) => p.bullet)).toBe(true)
    expect(differing).toHaveLength(before.filter((p) => p.bullet).length)
    for (const p of differing) expect(p.text).toBe('Rewritten in React')

    // And the lines that carry the layout are untouched, tab and all.
    const entry = after.find((p) => p.text.startsWith('National Research'))!
    expect(entry.text).toContain('\tMay. 2026 - Present')
    expect(entry.xml).toBe(before[entry.index].xml)
  })
})

describe('Resume Studio, which may restructure', () => {
  it('honours a section moved in the editor, rather than the file’s order', async () => {
    const { xml, doc } = await readFixture()

    // "Move EDUCATION above RELEVANT EXPERIENCE."
    const order = ['TECHNICAL SKILLS', 'EDUCATION', 'RELEVANT EXPERIENCE']
    const moved: ResumeDoc = {
      ...doc,
      sections: order.map((heading) => doc.sections.find((s) => s.heading === heading)!),
    }

    const after = readParagraphs(
      `<w:document><w:body>${rewriteBodyXml(xml, moved)}</w:body></w:document>`
    ).filter((p) => p.text.trim())

    const headings = after.filter((p) => order.includes(p.text)).map((p) => p.text)
    expect(headings).toEqual(order)

    // Every line still travels with its own section, and every one survives.
    expect(after).toHaveLength(RESUME.length)
    const education = after.findIndex((p) => p.text === 'EDUCATION')
    expect(after[education + 1].text).toContain('University of Waterloo')
  })

  it('keeps each moved line’s own formatting', async () => {
    const { xml, doc } = await readFixture()
    const before = readParagraphs(xml)

    const moved: ResumeDoc = { ...doc, sections: [...doc.sections].reverse() }
    const after = readParagraphs(
      `<w:document><w:body>${rewriteBodyXml(xml, moved)}</w:body></w:document>`
    )

    // Moving a line does not re-render it: the paragraph is the same bytes,
    // just somewhere else in the document.
    const coursework = after.find((p) => p.text.startsWith('Relevant Coursework'))!
    const original = before.find((p) => p.text.startsWith('Relevant Coursework'))!
    expect(coursework.xml).toBe(original.xml)
    expect(isBulletParagraph(coursework.xml)).toBe(true)
  })

  it('gives an edited line its paragraph back when the wording did not change', async () => {
    const { doc } = await readFixture()

    // What editTagged returns: the same document, one bullet reworded, and no
    // paragraph references at all because the tagged format cannot carry them.
    const returned = taggedToDoc(
      docToTagged(doc).replace(
        '<bullet>Redesigned 4 Flask workflows for older adults</bullet>',
        '<bullet>Rebuilt four Flask workflows</bullet>'
      )
    )
    expect(returned.sections.every((s) => s.blocks.every((b) => b.source === undefined))).toBe(true)

    const restored = carrySources(doc, returned)

    // Every untouched line is reconnected...
    const untouched = restored.sections[1].blocks[0]
    expect(untouched.text).toContain('National Research Council Canada')
    expect(untouched.source).toBe(doc.sections[1].blocks[0].source)
    expect(restored.nameSource).toBe(doc.nameSource)
    expect(restored.sections.map((s) => s.headingSource)).toEqual(
      doc.sections.map((s) => s.headingSource)
    )

    // ...and the reworded one is not, so it is rebuilt rather than written
    // into a paragraph whose formatting belonged to different words.
    const edited = restored.sections[1].blocks.find((b) => b.text === 'Rebuilt four Flask workflows')!
    expect(edited.source).toBeUndefined()
  })

  it('does not hand two lines the same paragraph', async () => {
    const { doc } = await readFixture()
    const duplicated: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section, i) =>
        i === 1 ? { ...section, blocks: [...section.blocks, { ...section.blocks[1] }] } : section
      ),
    }

    const restored = carrySources(doc, duplicated)
    const sources = restored.sections
      .flatMap((s) => s.blocks.map((b) => b.source))
      .filter((s): s is number => s !== undefined)

    expect(new Set(sources).size).toBe(sources.length)
  })

  it('does not reclaim the name paragraph when the name was changed', async () => {
    const { doc } = await readFixture()
    const renamed = carrySources(doc, { ...doc, name: 'I. Chopra' })
    expect(renamed.nameSource).toBeUndefined()
  })
})

describe('refusing to write into the wrong file', () => {
  it('accepts a document that came from this file', async () => {
    const { xml, doc } = await readFixture()
    expect(sourcesFit(xml, doc)).toBe(true)
  })

  it('refuses a document whose lines do not match', async () => {
    const { xml, doc } = await readFixture()

    // What a different resume's references look like: valid indices, wrong
    // text. Left unchecked this writes each line into whatever paragraph sits
    // at that number and quietly scrambles the document.
    const foreign: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) => ({ ...block, text: `Something else entirely ${block.source}` })),
      })),
    }

    expect(sourcesFit(xml, foreign)).toBe(false)
    await expect(rewriteDocx(await buildFixture(), foreign)).rejects.toThrow(/does not match/)
  })

  it('refuses a document with too little evidence to judge', async () => {
    const { xml } = await readFixture()
    expect(
      sourcesFit(xml, {
        name: 'Ishvir Chopra',
        contact: '',
        sections: [{ heading: 'X', blocks: [{ bullet: true, text: 'A bullet', source: 7 }] }],
      })
    ).toBe(false)
  })

  it('still accepts a tailored document, where every bullet differs', async () => {
    const { xml, doc } = await readFixture()
    const tailored: ResumeDoc = {
      ...doc,
      sections: doc.sections.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) =>
          block.bullet ? { ...block, text: 'Completely rewritten' } : block
        ),
      })),
    }
    // Bullets are expected to change; lines are the evidence.
    expect(sourcesFit(xml, tailored)).toBe(true)
  })
})

describe('paragraph reading', () => {
  it('renders a tab element as a tab, not as nothing', () => {
    expect(paragraphText('<w:p><w:r><w:t>Role</w:t><w:tab/><w:t>2026</w:t></w:r></w:p>')).toBe(
      'Role\t2026'
    )
  })

  it('decodes entities so text compares equal to what the user typed', () => {
    expect(paragraphText('<w:p><w:r><w:t>R&amp;D &lt;lead&gt;</w:t></w:r></w:p>')).toBe('R&D <lead>')
  })

  it('keeps significant spaces', () => {
    expect(
      paragraphText('<w:p><w:r><w:t xml:space="preserve">Tools: </w:t><w:t>Git</w:t></w:r></w:p>')
    ).toBe('Tools: Git')
  })

  it('reads a soft line break as a newline', () => {
    expect(paragraphText('<w:p><w:r><w:t>A</w:t><w:br/><w:t>B</w:t></w:r></w:p>')).toBe('A\nB')
  })
})

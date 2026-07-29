import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { docToTagged, taggedToDoc, escapeXml } from '@/lib/tagged/serialize'
import { tagSkeleton, assertSameSkeleton } from '@/lib/tagged/skeleton'
import { emptyDoc, type ResumeBlock, type ResumeDoc } from '@/lib/tagged/schema'
import { docToPlainText } from '@/lib/tagged/plainText'

// Text that has broken naive serializers before: XML metacharacters, quotes,
// the entities they encode to (which must not double-decode), and a tab, which
// is layout rather than whitespace and has to survive the trip intact.
const awkwardText = fc.oneof(
  fc.constant('R&D lead for the Q3 launch'),
  fc.constant('Reduced latency <50ms while handling >2k req/s'),
  fc.constant('Shipped the "one click" checkout flow'),
  fc.constant("Owned the team's roadmap & hiring"),
  fc.constant('&amp; should survive as literal text'),
  fc.constant('Acme | Engineer | Toronto\tMay 2024 - Present'),
  fc.constant('Ran C:\\tools\\build.ps1 nightly'),
  fc.string({ minLength: 1, maxLength: 60 })
)

const blockArb: fc.Arbitrary<ResumeBlock> = fc.record({
  bullet: fc.boolean(),
  text: awkwardText,
})

const docArb: fc.Arbitrary<ResumeDoc> = fc.record({
  name: awkwardText,
  contact: awkwardText,
  sections: fc.array(
    fc.record({
      heading: fc.oneof(fc.constant(''), awkwardText),
      blocks: fc.array(blockArb, { maxLength: 6 }),
    }),
    { maxLength: 4 }
  ),
})

/** Serializing trims every field and drops blanks, so compare against that. */
function normalized(doc: ResumeDoc): ResumeDoc {
  const t = (s: string) => s.trim()
  return {
    name: t(doc.name),
    contact: t(doc.contact),
    sections: doc.sections
      .map((s) => ({
        heading: t(s.heading),
        blocks: s.blocks
          .map((b) => ({ bullet: b.bullet, text: t(b.text) }))
          .filter((b) => b.text),
      }))
      .filter((s) => s.heading || s.blocks.length > 0),
  }
}

describe('serialize', () => {
  it('round-trips any document back to itself', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        expect(taggedToDoc(docToTagged(doc))).toEqual(normalized(doc))
      }),
      { numRuns: 200 }
    )
  })

  it('is stable across a second round trip', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        const once = docToTagged(doc)
        expect(docToTagged(taggedToDoc(once))).toBe(once)
      }),
      { numRuns: 100 }
    )
  })

  it('keeps a line and a bullet interleaved as the resume printed them', () => {
    // Reading all the lines then all the bullets would quietly reorder a
    // section, putting every entry title above every bullet.
    const doc: ResumeDoc = {
      ...emptyDoc(),
      name: 'Jane',
      sections: [
        {
          heading: 'EXPERIENCE',
          blocks: [
            { bullet: false, text: 'Acme' },
            { bullet: true, text: 'Did a thing' },
            { bullet: false, text: 'Globex' },
            { bullet: true, text: 'Did another' },
          ],
        },
      ],
    }
    expect(taggedToDoc(docToTagged(doc)).sections[0].blocks).toEqual(doc.sections[0].blocks)
  })

  it('does not turn a literal backslash-t into a tab', () => {
    // Two characters, a backslash and a t - not a tab. The escape that carries
    // real tabs through the wire format has to be reversible, or a round trip
    // invents layout out of somebody's file path.
    const text = 'Ran C:\\tools\\build.ps1 nightly'
    const doc: ResumeDoc = {
      ...emptyDoc(),
      name: 'Jane',
      sections: [{ heading: 'X', blocks: [{ bullet: true, text }] }],
    }
    const back = taggedToDoc(docToTagged(doc)).sections[0].blocks[0].text
    expect(back).toBe(text)
    expect(back).not.toContain('\t')
  })

  it('carries a tab through unharmed, because it is the layout', () => {
    const doc: ResumeDoc = {
      ...emptyDoc(),
      name: 'Jane',
      sections: [
        { heading: 'EXPERIENCE', blocks: [{ bullet: false, text: 'Acme | Toronto\tMay 2024' }] },
      ],
    }
    // Written as an escape so trimming cannot silently take the layout with it.
    expect(docToTagged(doc)).toContain('Acme | Toronto\\tMay 2024')
    expect(taggedToDoc(docToTagged(doc)).sections[0].blocks[0].text).toBe(
      'Acme | Toronto\tMay 2024'
    )
  })

  it('escapes XML metacharacters rather than emitting them raw', () => {
    const doc = { ...emptyDoc(), name: 'A & B <C>' }
    expect(docToTagged(doc)).toContain('<name>A &amp; B &lt;C&gt;</name>')
    expect(taggedToDoc(docToTagged(doc)).name).toBe('A & B <C>')
  })

  it('does not double-decode an escaped entity', () => {
    expect(escapeXml('&amp;lt;')).toBe('&amp;amp;lt;')
    const doc: ResumeDoc = {
      ...emptyDoc(),
      name: 'Jane',
      sections: [{ heading: 'X', blocks: [{ bullet: false, text: '&amp;lt;' }] }],
    }
    expect(taggedToDoc(docToTagged(doc)).sections[0].blocks[0].text).toBe('&amp;lt;')
  })

  it('rejects a tag outside the vocabulary rather than dropping it', () => {
    expect(() =>
      taggedToDoc('<resume><name>Jane</name><achievements>Won</achievements></resume>')
    ).toThrow(/unknown tags: achievements/)
  })

  it('rejects the tags of the previous format, rather than silently losing them', () => {
    // <entry>, <title> and <item> are gone. A stored string in the old format
    // must fail loudly and be re-derived, not parse to a resume missing half
    // its content.
    expect(() =>
      taggedToDoc('<resume><section><entry><title>Acme</title></entry></section></resume>')
    ).toThrow(/unknown tags/)
  })

  it('rejects a document with no resume wrapper', () => {
    expect(() => taggedToDoc('<name>Jane</name>')).toThrow(/missing its <resume> wrapper/)
  })

  it('tolerates the code fence models add unprompted', () => {
    expect(taggedToDoc('```xml\n<resume><name>Jane</name></resume>\n```').name).toBe('Jane')
  })

  it('keeps a section heading verbatim, whatever it is called', () => {
    // The whole point of the format: the resume names its own sections, and
    // nothing in the pipeline substitutes a more standard name.
    for (const heading of ['RELEVANT EXPERIENCE', 'Technical Skills', 'Board Positions']) {
      const doc: ResumeDoc = {
        ...emptyDoc(),
        name: 'Jane',
        sections: [{ heading, blocks: [{ bullet: false, text: 'A line' }] }],
      }
      expect(taggedToDoc(docToTagged(doc)).sections[0].heading).toBe(heading)
    }
  })

  it('keeps the sections in the order the resume had them', () => {
    const doc: ResumeDoc = {
      ...emptyDoc(),
      name: 'Jane',
      sections: [
        { heading: 'PROJECTS', blocks: [{ bullet: true, text: 'A project' }] },
        { heading: 'EXPERIENCE', blocks: [{ bullet: true, text: 'A job' }] },
        { heading: 'EDUCATION', blocks: [{ bullet: true, text: 'A degree' }] },
      ],
    }
    expect(taggedToDoc(docToTagged(doc)).sections.map((s) => s.heading)).toEqual([
      'PROJECTS',
      'EXPERIENCE',
      'EDUCATION',
    ])
  })

  it('keeps several paragraphs in one section, rather than only the first', () => {
    // A skills section printed as two paragraphs. One `text` field per section
    // could hold only one of them, and the other was silently dropped.
    const doc: ResumeDoc = {
      ...emptyDoc(),
      name: 'Jane',
      sections: [
        {
          heading: 'SKILLS',
          blocks: [
            { bullet: false, text: 'Languages: Python, C, SQL' },
            { bullet: false, text: 'Tools: Git, Docker' },
          ],
        },
      ],
    }
    expect(taggedToDoc(docToTagged(doc)).sections[0].blocks).toHaveLength(2)
  })

  it('drops a blank line so serializing stays idempotent', () => {
    const doc: ResumeDoc = {
      ...emptyDoc(),
      name: 'Jane',
      sections: [
        { heading: 'X', blocks: [{ bullet: true, text: 'Real' }, { bullet: true, text: '  ' }] },
      ],
    }
    const once = docToTagged(doc)
    expect(once).not.toContain('<bullet></bullet>')
    expect(docToTagged(taggedToDoc(once))).toBe(once)
  })
})

describe('tagSkeleton', () => {
  const base: ResumeDoc = {
    ...emptyDoc(),
    name: 'Jane Doe',
    sections: [
      {
        heading: 'EXPERIENCE',
        blocks: [
          { bullet: false, text: 'Acme | Engineer | Toronto' },
          { bullet: true, text: 'One' },
          { bullet: true, text: 'Two' },
        ],
      },
    ],
  }

  const withBlocks = (blocks: ResumeBlock[]): string =>
    docToTagged({ ...base, sections: [{ ...base.sections[0], blocks }] })

  it('ignores text but records every tag in order', () => {
    expect(tagSkeleton(docToTagged(base))).toEqual(
      tagSkeleton(docToTagged({ ...base, name: 'Someone Else Entirely' }))
    )
  })

  it('accepts an edit that only changes bullet text', () => {
    const after = withBlocks([
      base.sections[0].blocks[0],
      { bullet: true, text: 'New one' },
      { bullet: true, text: 'New two' },
    ])
    expect(() => assertSameSkeleton(docToTagged(base), after)).not.toThrow()
  })

  it('rejects a removed bullet', () => {
    const after = withBlocks(base.sections[0].blocks.slice(0, 2))
    expect(() => assertSameSkeleton(docToTagged(base), after)).toThrow(
      /altered the resume structure/
    )
  })

  it('rejects a line turned into a bullet', () => {
    // The tag name changes, so the skeleton catches it. This is what stops a
    // model deciding an employer was really a bullet point.
    const after = withBlocks([
      { bullet: true, text: 'Acme | Engineer | Toronto' },
      ...base.sections[0].blocks.slice(1),
    ])
    expect(() => assertSameSkeleton(docToTagged(base), after)).toThrow(
      /altered the resume structure/
    )
  })

  it('rejects an added section', () => {
    const after = docToTagged({
      ...base,
      sections: [...base.sections, { heading: 'INVENTED', blocks: [{ bullet: true, text: 'Made up' }] }],
    })
    expect(() => assertSameSkeleton(docToTagged(base), after)).toThrow(
      /altered the resume structure/
    )
  })
})

describe('docToPlainText', () => {
  it('renders sections in order with bullets marked', () => {
    const text = docToPlainText({
      name: 'Jane Doe',
      contact: 'jane@example.com',
      sections: [
        {
          heading: 'RELEVANT EXPERIENCE',
          blocks: [
            { bullet: false, text: 'Acme | Engineer | Toronto\t2024' },
            { bullet: true, text: 'Built the pipeline' },
          ],
        },
        { heading: 'SKILLS', blocks: [{ bullet: false, text: 'TypeScript, PostgreSQL' }] },
      ],
    })

    expect(text).toContain('RELEVANT EXPERIENCE')
    expect(text).toContain('- Built the pipeline')
    expect(text).toContain('TypeScript, PostgreSQL')
    expect(text.indexOf('RELEVANT EXPERIENCE')).toBeLessThan(text.indexOf('SKILLS'))
  })

  it('flattens a tab, because this feeds keyword matching rather than a layout', () => {
    const text = docToPlainText({
      ...emptyDoc(),
      name: 'Jane',
      sections: [{ heading: 'X', blocks: [{ bullet: false, text: 'Acme\t2024' }] }],
    })
    expect(text).not.toContain('\t')
    expect(text).toContain('Acme  2024')
  })

  it('omits a section with nothing in it', () => {
    const text = docToPlainText({
      ...emptyDoc(),
      name: 'Jane',
      sections: [{ heading: 'EMPTY', blocks: [] }],
    })
    expect(text).not.toContain('EMPTY')
  })
})

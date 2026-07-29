import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { injectIntoTemplate } from '@/lib/docx/inject'
import { buildFallbackDocx } from '@/lib/docx/fallback'
import { readTemplateStyles, suggestMapping } from '@/lib/docx/template'
import { emptyDoc, type ResumeDoc } from '@/lib/tagged/schema'

// A minimal but structurally real .docx. The pieces that matter for these
// tests are the ones injectIntoTemplate must preserve or extend: the sectPr
// (page setup + header reference), an existing relationship with a high rId,
// and a styles.xml carrying the paragraph styles suggestMapping looks for.
async function makeTemplate(options: { hyperlinkStyle?: boolean } = {}): Promise<Buffer> {
  const zip = new JSZip()

  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'
  )

  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<w:body>' +
      '<w:p><w:r><w:t>Placeholder content that must be replaced</w:t></w:r></w:p>' +
      '<w:sectPr><w:headerReference r:id="rId7"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:bottom="720"/></w:sectPr>' +
      '</w:body></w:document>'
  )

  zip.file(
    'word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '</Relationships>'
  )

  const hyperlinkStyle = options.hyperlinkStyle
    ? '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/></w:style>'
    : ''

  zip.file(
    'word/styles.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:style w:type="paragraph" w:styleId="ResumeBullet"><w:name w:val="Resume Bullet"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="SectionHeading"><w:name w:val="Section Heading"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="CandidateName"><w:name w:val="Candidate Name"/></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ContactLine"><w:name w:val="Contact Line"/></w:style>' +
      hyperlinkStyle +
      '</w:styles>'
  )

  zip.file('word/header1.xml', '<?xml version="1.0"?><w:hdr/>')

  return zip.generateAsync({ type: 'nodebuffer' })
}

const doc: ResumeDoc = {
  name: 'Jane Doe',
  contact: 'Toronto | jane@example.com | LinkedIn (linkedin.com/in/jane)',
  sections: [
    {
      heading: 'EXPERIENCE',
      blocks: [
        {
          bullet: false,
          text: 'Acme Robotics | Software Engineering Intern | Toronto, ON	May 2025 - Aug 2025',
        },
        { bullet: true, text: 'Built an internal dashboard used by 40 people & counting' },
      ],
    },
    { heading: 'SKILLS', blocks: [{ bullet: false, text: 'TypeScript, PostgreSQL' }] },
    { heading: 'PROJECTS', blocks: [{ bullet: true, text: 'Wrote a toy compiler' }] },
  ],
}

async function readEntry(buffer: Buffer, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const file = zip.file(path)
  if (!file) throw new Error(`missing ${path}`)
  return file.async('string')
}

describe('injectIntoTemplate', () => {
  it('replaces the body content but keeps the section properties', async () => {
    const out = await injectIntoTemplate(await makeTemplate(), doc, {})
    const xml = await readEntry(out, 'word/document.xml')

    expect(xml).not.toContain('Placeholder content')
    expect(xml).toContain('Jane Doe')
    expect(xml).toContain('Built an internal dashboard')
    // The sectPr carries the page size, margins and the header reference -
    // dropping it is how the template's logo and layout get lost.
    expect(xml).toContain('<w:headerReference r:id="rId7"/>')
    expect(xml).toContain('<w:pgSz w:w="12240" w:h="15840"/>')
  })

  it('leaves the template\'s other parts untouched', async () => {
    const template = await makeTemplate()
    const out = await injectIntoTemplate(template, doc, {})

    expect(await readEntry(out, 'word/styles.xml')).toBe(await readEntry(template, 'word/styles.xml'))
    expect(await readEntry(out, 'word/header1.xml')).toBe(await readEntry(template, 'word/header1.xml'))
  })

  it('applies the mapped style ids', async () => {
    const template = await makeTemplate()
    const mapping = suggestMapping(await readTemplateStyles(template))
    const xml = await readEntry(await injectIntoTemplate(template, doc, mapping), 'word/document.xml')

    expect(mapping.bullet).toBe('ResumeBullet')
    expect(mapping.name).toBe('CandidateName')
    expect(xml).toContain('<w:pStyle w:val="ResumeBullet"/>')
    expect(xml).toContain('<w:pStyle w:val="CandidateName"/>')
    expect(xml).toContain('<w:pStyle w:val="SectionHeading"/>')
  })

  it('writes hyperlink relationships that do not collide with existing ids', async () => {
    const out = await injectIntoTemplate(await makeTemplate(), doc, {})
    const rels = await readEntry(out, 'word/_rels/document.xml.rels')
    const xml = await readEntry(out, 'word/document.xml')

    // rId7 was taken by the header, so allocation must start above it.
    expect(rels).toContain('Id="rId8"')
    expect(rels).toContain('Target="mailto:jane@example.com"')
    expect(rels).toContain('Target="https://linkedin.com/in/jane"')
    expect(rels).toContain('TargetMode="External"')
    // The header's own relationship survives.
    expect(rels).toContain('Target="header1.xml"')

    expect(xml).toContain('<w:hyperlink r:id="rId8">')
    // The label is what shows, not the raw address beside it.
    expect(xml).toContain('<w:t xml:space="preserve">LinkedIn</w:t>')
    expect(xml).not.toContain('(linkedin.com/in/jane)')
  })

  it('uses the template Hyperlink style when it has one', async () => {
    const withStyle = await readEntry(
      await injectIntoTemplate(await makeTemplate({ hyperlinkStyle: true }), doc, {}),
      'word/document.xml'
    )
    expect(withStyle).toContain('<w:rStyle w:val="Hyperlink"/>')

    const without = await readEntry(
      await injectIntoTemplate(await makeTemplate(), doc, {}),
      'word/document.xml'
    )
    expect(without).toContain('<w:u w:val="single"/>')
  })

  it('escapes XML metacharacters in the content', async () => {
    const xml = await readEntry(await injectIntoTemplate(await makeTemplate(), doc, {}), 'word/document.xml')
    expect(xml).toContain('40 people &amp; counting')
  })

  it('keeps a custom section under its own heading', async () => {
    const xml = await readEntry(await injectIntoTemplate(await makeTemplate(), doc, {}), 'word/document.xml')
    expect(xml).toContain('PROJECTS')
    expect(xml).toContain('Wrote a toy compiler')
  })

  it('adds no relationships when the resume has no links', async () => {
    const template = await makeTemplate()
    const plain: ResumeDoc = { name: 'Jane Doe', contact: 'Toronto', sections: [] }
    const out = await injectIntoTemplate(template, plain, {})

    expect(await readEntry(out, 'word/_rels/document.xml.rels')).toBe(
      await readEntry(template, 'word/_rels/document.xml.rels')
    )
  })

  it('rejects a file that is not a Word document', async () => {
    const notADocx = await new JSZip().file('hello.txt', 'hi').generateAsync({ type: 'nodebuffer' })
    await expect(injectIntoTemplate(notADocx, doc, {})).rejects.toThrow(
      /not a valid \.docx/
    )
  })
})

describe('buildFallbackDocx', () => {
  it('produces a readable Word document with the resume in it', async () => {
    const xml = await readEntry(await buildFallbackDocx(doc), 'word/document.xml')

    expect(xml).toContain('Jane Doe')
    expect(xml).toContain('Acme Robotics')
    expect(xml).toContain('Built an internal dashboard')
    expect(xml).toContain('TypeScript, PostgreSQL')
    expect(xml).toContain('PROJECTS')
  })

  it('makes links clickable without a template too', async () => {
    const out = await buildFallbackDocx(doc)
    const rels = await readEntry(out, 'word/_rels/document.xml.rels')

    expect(rels).toContain('linkedin.com/in/jane')
    expect(rels).toContain('mailto:jane@example.com')
    expect(rels).toContain('TargetMode="External"')
  })

  it('handles an all-but-empty document without throwing', async () => {
    const out = await buildFallbackDocx({ ...emptyDoc(), name: 'Jane Doe' })
    expect(await readEntry(out, 'word/document.xml')).toContain('Jane Doe')
  })
})

describe('formatting fallback when the template has no named styles', () => {
  // The case that matters most in practice: a resume exported from Word
  // declares Heading1-6, Title and ListParagraph and nothing else, because the
  // author formatted it by hand. Every slot therefore falls through to
  // SLOT_FORMATS, and without that the whole document would inherit plain
  // left-aligned body text - the "everything gathered up in one spot" failure.
  const bare = async (): Promise<Buffer> => {
    const zip = new JSZip()
    zip.file(
      'word/document.xml',
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p/><w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>'
    )
    zip.file(
      'word/_rels/document.xml.rels',
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
    )
    // Only Word's built-ins, which is what a hand-formatted resume looks like.
    zip.file(
      'word/styles.xml',
      '<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/></w:style>' +
        '</w:styles>'
    )
    return zip.generateAsync({ type: 'nodebuffer' })
  }

  it('maps nothing to Word built-ins', async () => {
    // Heading1 is 16pt blue Calibri Light - nothing like a resume's section
    // heading, so matching against it was worse than not matching at all.
    const mapping = suggestMapping(await readTemplateStyles(await bare()))
    expect(mapping).toEqual({})
  })

  it('centres and enlarges the name instead of leaving it as body text', async () => {
    const xml = await readEntry(await injectIntoTemplate(await bare(), doc, {}), 'word/document.xml')
    const name = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*Jane Doe(?:(?!<\/w:p>)[\s\S])*<\/w:p>/)?.[0] ?? ''

    expect(name).toContain('<w:jc w:val="center"/>')
    expect(name).toContain('<w:b/>')
    expect(name).toContain('<w:sz w:val="30"/>')
  })

  it('centres the contact line so it does not run into the name', async () => {
    const xml = await readEntry(await injectIntoTemplate(await bare(), doc, {}), 'word/document.xml')
    const contact = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*Toronto(?:(?!<\/w:p>)[\s\S])*<\/w:p>/)?.[0] ?? ''
    expect(contact).toContain('<w:jc w:val="center"/>')
  })

  it('gives section headings a rule and bold caps', async () => {
    const xml = await readEntry(await injectIntoTemplate(await bare(), doc, {}), 'word/document.xml')
    const heading = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*EXPERIENCE(?:(?!<\/w:p>)[\s\S])*<\/w:p>/)?.[0] ?? ''

    expect(heading).toContain('<w:pBdr>')
    expect(heading).toContain('<w:b/>')
    expect(heading).toContain('<w:caps/>')
  })

  it('indents bullets and gives them a glyph', async () => {
    const xml = await readEntry(await injectIntoTemplate(await bare(), doc, {}), 'word/document.xml')
    const bullet = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*Built an internal(?:(?!<\/w:p>)[\s\S])*<\/w:p>/)?.[0] ?? ''

    expect(bullet).toContain('<w:ind w:left="360" w:hanging="180"/>')
    expect(bullet).toContain('•')
  })

  it('keeps links clickable and correctly formatted at the same time', async () => {
    const out = await injectIntoTemplate(await bare(), doc, {})
    const xml = await readEntry(out, 'word/document.xml')
    const rels = await readEntry(out, 'word/_rels/document.xml.rels')

    expect(rels).toContain('Target="https://linkedin.com/in/jane"')
    // The link run carries the contact line's own size, not just the link
    // decoration - otherwise an address would jump to the default body size.
    expect(xml).toMatch(/<w:hyperlink[^>]*><w:r><w:rPr><w:color[^>]*\/><w:u[^>]*\/><w:sz w:val="19"\/>/)
  })

  it('still defers to a template that does define its own styles', async () => {
    const styled = await makeTemplate()
    const mapping = suggestMapping(await readTemplateStyles(styled))
    const xml = await readEntry(await injectIntoTemplate(styled, doc, mapping), 'word/document.xml')

    // A mapped slot references the style and imposes nothing of its own.
    expect(mapping.bullet).toBe('ResumeBullet')
    expect(xml).toContain('<w:pStyle w:val="ResumeBullet"/>')
    const bullet = xml.match(/<w:p>(?:(?!<\/w:p>)[\s\S])*Built an internal(?:(?!<\/w:p>)[\s\S])*<\/w:p>/)?.[0] ?? ''
    expect(bullet).not.toContain('<w:ind')
    expect(bullet).not.toContain('•')
  })
})

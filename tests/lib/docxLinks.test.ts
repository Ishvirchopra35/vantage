import { describe, it, expect } from 'vitest'
import { splitRuns, hasLinks, collapseLinkText } from '@/lib/docx/links'
import { buildBodyXml, type LinkContext } from '@/lib/docx/inject'
import { emptyDoc, type ResumeDoc } from '@/lib/tagged/schema'

/** A LinkContext that hands out predictable ids, for asserting on the XML. */
function testLinks(hasHyperlinkStyle = true): LinkContext & { hrefs: string[] } {
  const hrefs: string[] = []
  return {
    hasHyperlinkStyle,
    hrefs,
    relationshipId(href: string) {
      const existing = hrefs.indexOf(href)
      if (existing !== -1) return `rId${existing + 100}`
      hrefs.push(href)
      return `rId${hrefs.length + 99}`
    },
  }
}

describe('splitRuns', () => {
  it('collapses a labelled link back to just its label', () => {
    // This is the shape flattenLink() writes when the original Word file had
    // the address hidden behind the word "LinkedIn".
    expect(splitRuns('LinkedIn (linkedin.com/in/jane)')).toEqual([
      { text: 'LinkedIn', href: 'https://linkedin.com/in/jane' },
    ])
  })

  it('links a bare address on the contact line', () => {
    expect(splitRuns('janedoe.com', { addressesExpected: true })).toEqual([
      { text: 'janedoe.com', href: 'https://janedoe.com' },
    ])
  })

  it('links a bare address of any TLD, including ones nobody listed', () => {
    // No allowlist to fall off the end of. A resume on a .quest or a .zone
    // works exactly like one on a .com.
    for (const address of ['jane.quest', 'jane.zone', 'jane.보고', 'jane.engineering']) {
      const parts = splitRuns(address, { addressesExpected: true })
      expect(parts[0].href, address).toBeTruthy()
    }
  })

  it('leaves a bare dotted word alone anywhere else', () => {
    // Same characters, different place. In a bullet a dotted word is a
    // technology, and this is what replaced the list of technologies that
    // happened to collide with real TLDs.
    for (const text of ['Node.js', 'socket.io', 'ASP.NET', 'Vue.js', 'janedoe.com']) {
      expect(hasLinks(text), text).toBe(false)
    }
  })

  it('links an address with a path wherever it appears', () => {
    // A path is structural evidence: names do not have them.
    expect(hasLinks('Shipped it to github.com/jane/repo last spring')).toBe(true)
  })

  it('links a full URL', () => {
    expect(splitRuns('https://github.com/jane')).toEqual([
      { text: 'https://github.com/jane', href: 'https://github.com/jane' },
    ])
  })

  it('gives an email address a mailto: target', () => {
    expect(splitRuns('jane@example.com')).toEqual([
      { text: 'jane@example.com', href: 'mailto:jane@example.com' },
    ])
  })

  it('splits a contact line into its plain and linked pieces', () => {
    const parts = splitRuns('Toronto | jane@example.com | LinkedIn (linkedin.com/in/jane) | Portfolio (janedoe.dev)')

    expect(parts.filter((p) => p.href)).toEqual([
      { text: 'jane@example.com', href: 'mailto:jane@example.com' },
      { text: 'LinkedIn', href: 'https://linkedin.com/in/jane' },
      { text: 'Portfolio', href: 'https://janedoe.dev' },
    ])
    expect(parts[0]).toEqual({ text: 'Toronto | ' })
  })

  it('leaves a technology name alone', () => {
    // The obvious "word dot letters" pattern matches all of these, which is
    // why the bare-domain arm uses a TLD allowlist instead.
    for (const text of ['Node.js', 'Vue.js', 'React.ts', 'Next.js']) {
      expect(hasLinks(text), text).toBe(false)
    }
  })

  it('still finds a real address on a contact line that also names a product', () => {
    expect(
      splitRuns('ASP.NET work at janedoe.dev', { addressesExpected: true }).filter((p) => p.href)
    ).toEqual([
      { text: 'ASP.NET', href: 'https://ASP.NET' },
      { text: 'janedoe.dev', href: 'https://janedoe.dev' },
    ])
  })

  it('links a collision name written as a full address, since that was deliberate', () => {
    expect(hasLinks('https://socket.io')).toBe(true)
  })

  it('leaves a version number alone', () => {
    expect(hasLinks('Upgraded pdf.js to v1.10.100')).toBe(false)
  })

  it('returns one plain run for text with nothing to link', () => {
    expect(splitRuns('Built the data pipeline')).toEqual([{ text: 'Built the data pipeline' }])
  })

  it('returns one run for empty text', () => {
    expect(splitRuns('')).toEqual([{ text: '' }])
  })

  it('does not link inside a bullet that merely mentions a domain-like word', () => {
    expect(hasLinks('Reduced p99 latency by 40%')).toBe(false)
  })
})

describe('buildBodyXml hyperlinks', () => {
  const doc: ResumeDoc = {
  name: 'Jane Doe',
  contact: 'Toronto | LinkedIn (linkedin.com/in/jane)',
  sections: [],
}

  it('emits plain runs when no link context is supplied', () => {
    const xml = buildBodyXml(doc, {})
    expect(xml).not.toContain('<w:hyperlink')
    expect(xml).toContain('Toronto | LinkedIn (linkedin.com/in/jane)')
  })

  it('emits a w:hyperlink referencing an allocated relationship id', () => {
    const links = testLinks()
    const xml = buildBodyXml(doc, {}, links)

    expect(xml).toContain('<w:hyperlink r:id="rId100">')
    expect(xml).toContain('<w:rStyle w:val="Hyperlink"/>')
    expect(xml).toContain('<w:t xml:space="preserve">LinkedIn</w:t>')
    expect(links.hrefs).toEqual(['https://linkedin.com/in/jane'])
  })

  it('falls back to direct formatting when the template has no Hyperlink style', () => {
    const xml = buildBodyXml(doc, {}, testLinks(false))
    expect(xml).toContain('<w:color w:val="0563C1"/><w:u w:val="single"/>')
    expect(xml).not.toContain('<w:rStyle w:val="Hyperlink"/>')
  })

  it('reuses one relationship id for a repeated address', () => {
    const links = testLinks()
    buildBodyXml({ ...doc, contact: 'janedoe.dev' }, {}, links)
    expect(links.hrefs).toEqual(['https://janedoe.dev'])
  })

  it('escapes XML metacharacters in linked and unlinked text alike', () => {
    const xml = buildBodyXml({ ...emptyDoc(), name: 'A & B' }, {}, testLinks())
    expect(xml).toContain('A &amp; B')
  })

  it('applies the mapped style id to a bullet', () => {
    const xml = buildBodyXml(
      {
        name: 'Jane',
        contact: '',
        sections: [
          {
            heading: 'EXPERIENCE',
            blocks: [
              { bullet: false, text: 'Acme | Eng' },
              { bullet: true, text: 'Did a thing' },
            ],
          },
        ],
      },
      { bullet: 'ResumeBullet' }
    )
    expect(xml).toContain('<w:pStyle w:val="ResumeBullet"/>')
  })
})

describe('collapseLinkText', () => {
  it('hides the address behind its label', () => {
    expect(collapseLinkText('LinkedIn (linkedin.com/in/jane)')).toBe('LinkedIn')
  })

  it('collapses every link in a contact line but keeps the rest verbatim', () => {
    expect(
      collapseLinkText('Toronto | jane@example.com | LinkedIn (linkedin.com/in/jane) | Portfolio (janedoe.dev)')
    ).toBe('Toronto | jane@example.com | LinkedIn | Portfolio')
  })

  it('leaves an address the candidate wrote out in full alone', () => {
    // Nothing is hidden here - the visible text IS the address, so collapsing
    // it would remove content the resume deliberately shows.
    expect(collapseLinkText('https://github.com/jane')).toBe('https://github.com/jane')
  })

  it('is a no-op for text with no links', () => {
    expect(collapseLinkText('Built the data pipeline')).toBe('Built the data pipeline')
  })

  it('never loses a non-link character', () => {
    const text = 'Toronto, ON | (639) 318-1531 | ASP.NET | Node.js'
    expect(collapseLinkText(text)).toBe(text)
  })
})

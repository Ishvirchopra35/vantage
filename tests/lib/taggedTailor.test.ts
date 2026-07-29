import { describe, it, expect } from 'vitest'
import {
  lockFields,
  clampBulletLengths,
  diffBullets,
  findSkillGaps,
  type TailorTarget,
} from '@/lib/tagged/tailor'
import type { ResumeDoc } from '@/lib/tagged/schema'

// The resume as its own file states it: each entry on ONE line with the date
// after a tab, and every line carrying the paragraph index it came from.
const base: ResumeDoc = {
  name: 'Ishvir Chopra',
  contact: 'Toronto | ischopra@uwaterloo.ca',
  nameSource: 0,
  contactSource: 1,
  sections: [
    {
      // Deliberately not "EXPERIENCE": the resume names its own sections and
      // nothing in the tailoring may rename one.
      heading: 'RELEVANT EXPERIENCE',
      headingSource: 2,
      blocks: [
        {
          bullet: false,
          text: 'Acme Robotics | Software Engineering Intern | Toronto, ON\tMay 2025 - Aug 2025',
          source: 3,
        },
        { bullet: true, text: 'Built an internal dashboard used by 40 people', source: 4 },
        { bullet: true, text: 'Cut report generation from 45s to 38s', source: 5 },
      ],
    },
    {
      heading: 'EDUCATION',
      headingSource: 6,
      blocks: [
        {
          bullet: false,
          text: 'University of Waterloo | BCS Computer Science\t2022 - 2026',
          source: 7,
        },
        { bullet: true, text: 'Relevant Coursework: Algorithms, Calculus', source: 8 },
      ],
    },
    {
      heading: 'SKILLS',
      headingSource: 9,
      blocks: [{ bullet: false, text: 'TypeScript, Python', source: 10 }],
    },
  ],
}

const target: TailorTarget = {
  title: 'Backend Engineer',
  company: 'Globex',
  requiredSkills: ['React', 'PostgreSQL'],
  niceToHaveSkills: ['Jest'],
  keyResponsibilities: ['Build internal tooling'],
  keywords: ['data pipeline', 'C#'],
}

/** Replaces the text of the block at `[section][block]`. */
function withBlock(doc: ResumeDoc, section: number, block: number, text: string): ResumeDoc {
  return {
    ...doc,
    sections: doc.sections.map((s, i) =>
      i === section
        ? { ...s, blocks: s.blocks.map((b, j) => (j === block ? { ...b, text } : b)) }
        : s
    ),
  }
}

/** The document with one bullet rewritten, which is the only legal change. */
const tailored = withBlock(base, 0, 1, 'Built a React dashboard used by 40 people')

describe('lockFields', () => {
  it('keeps the rewritten bullet, which is the point', () => {
    expect(lockFields(base, tailored).sections[0].blocks[1].text).toBe(
      'Built a React dashboard used by 40 people'
    )
  })

  it('restores a section heading the model renamed', () => {
    const renamed: ResumeDoc = {
      ...tailored,
      sections: tailored.sections.map((s, i) => (i === 0 ? { ...s, heading: 'EXPERIENCE' } : s)),
    }
    expect(lockFields(base, renamed).sections[0].heading).toBe('RELEVANT EXPERIENCE')
  })

  it('restores an entry line the model rewrote', () => {
    // The employer, the role, the location and the date share this line. A
    // model touching any of them changes what the resume says about a job.
    const drifted = withBlock(tailored, 0, 0, 'Acme Robotics Inc. | Senior Engineer | Remote\t2024')
    expect(lockFields(base, drifted).sections[0].blocks[0].text).toBe(
      'Acme Robotics | Software Engineering Intern | Toronto, ON\tMay 2025 - Aug 2025'
    )
  })

  it('restores the name and contact line', () => {
    const drifted: ResumeDoc = { ...tailored, name: 'I. Chopra', contact: 'Remote' }
    const locked = lockFields(base, drifted)
    expect(locked.name).toBe('Ishvir Chopra')
    expect(locked.contact).toBe('Toronto | ischopra@uwaterloo.ca')
  })

  it('restores a paragraph line - only bullets may change', () => {
    const drifted = withBlock(tailored, 2, 0, 'React, PostgreSQL')
    expect(lockFields(base, drifted).sections[2].blocks[0].text).toBe('TypeScript, Python')
  })

  it('keeps every paragraph reference, so a rewrite cannot be redirected', () => {
    // These indices decide which paragraph of the user's file each line is
    // written back into. A model that could renumber them could put a tailored
    // bullet in the middle of somebody's job title.
    const locked = lockFields(base, { ...tailored, nameSource: 99 })
    expect(locked.nameSource).toBe(0)
    expect(locked.sections.flatMap((s) => s.blocks.map((b) => b.source))).toEqual([
      3, 4, 5, 7, 8, 10,
    ])
    expect(locked.sections.map((s) => s.headingSource)).toEqual([2, 6, 9])
  })

  it('cannot be made to add or drop a section', () => {
    const invented: ResumeDoc = {
      ...tailored,
      sections: [...tailored.sections, { heading: 'INVENTED', blocks: [{ bullet: true, text: 'x' }] }],
    }
    expect(lockFields(base, invented).sections).toHaveLength(base.sections.length)
  })
})

describe('clampBulletLengths', () => {
  it('reverts a bullet that grew well past the original', () => {
    const long =
      'Built an internal analytics dashboard in React and PostgreSQL used daily by more than 40 people across three teams'
    expect(clampBulletLengths(base, withBlock(base, 0, 1, long)).sections[0].blocks[1].text).toBe(
      'Built an internal dashboard used by 40 people'
    )
  })

  it('allows modest growth, since naming a technology costs characters', () => {
    const slightly = 'Built a React dashboard used by 40 people'
    expect(
      clampBulletLengths(base, withBlock(base, 0, 1, slightly)).sections[0].blocks[1].text
    ).toBe(slightly)
  })

  it('always allows a shorter bullet', () => {
    expect(
      clampBulletLengths(base, withBlock(base, 0, 1, 'Built a dashboard')).sections[0].blocks[1]
        .text
    ).toBe('Built a dashboard')
  })

  it('leaves a non-bullet line alone, however its length compares', () => {
    // Length is a one-page guard for bullets. A line is locked outright, so
    // clamping it would be a second opinion on a decision already made.
    const short = withBlock(base, 0, 0, 'Acme')
    expect(clampBulletLengths(base, short).sections[0].blocks[0].text).toBe('Acme')
  })
})

describe('diffBullets', () => {
  it("reports a rewritten bullet under the resume's own heading", () => {
    const changes = diffBullets(base, tailored, target)
    expect(changes).toHaveLength(1)
    expect(changes[0].section).toBe('RELEVANT EXPERIENCE')
    expect(changes[0].reason).toBe('Added React from the job description')
  })

  it('labels a change with the entry line it sits under', () => {
    // Which entry a bullet belongs to is its position under a line, not a
    // field - so it is tracked while walking rather than stored.
    expect(diffBullets(base, tailored, target)[0].entry).toContain('Acme Robotics')
  })

  it('names every job term the rewrite introduced', () => {
    const both = withBlock(base, 0, 1, 'Built a React and PostgreSQL dashboard for 40 people')
    expect(diffBullets(base, both, target)[0].reason).toBe(
      'Added React, PostgreSQL from the job description'
    )
  })

  it('ignores a cosmetic rewrite', () => {
    const cosmetic = withBlock(base, 0, 1, 'Developed internal dashboard used by 40 people')
    expect(diffBullets(base, cosmetic, target)).toEqual([])
  })

  it('reports an unchanged resume as no changes at all', () => {
    expect(diffBullets(base, base, target)).toEqual([])
  })

  it('never reports a non-bullet line, even if one somehow differs', () => {
    const drifted = withBlock(base, 2, 0, 'React, PostgreSQL')
    expect(diffBullets(base, drifted, target)).toEqual([])
  })

  it('does not match a job term inside a longer word', () => {
    const reactor = withBlock(base, 0, 1, 'Built a Reactor control dashboard for 40 people')
    expect(diffBullets(base, reactor, target)[0].reason).toBe('Re-framed toward the job description')
  })
})

describe('findSkillGaps', () => {
  it('reports required skills the resume never mentions', () => {
    expect(findSkillGaps(base, target)).toEqual(['React', 'PostgreSQL'])
  })

  it('searches every line of every section, including paragraphs', () => {
    // "TypeScript" lives on a plain line, not in any bullet.
    expect(findSkillGaps(base, { ...target, requiredSkills: ['TypeScript', 'Algorithms'] })).toEqual(
      []
    )
  })

  it('reports nothing when the job asks for nothing', () => {
    expect(findSkillGaps(base, { ...target, requiredSkills: [] })).toEqual([])
  })
})

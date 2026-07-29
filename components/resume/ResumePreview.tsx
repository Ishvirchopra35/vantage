'use client';

// The reviewable, editable rendering of a resume.
//
// This is NOT a document editor - it is a form wearing a resume's clothes.
// Every editable region is bound to exactly one line, and structural changes
// happen only through the add/remove buttons, which operate on the data model
// rather than on text. So a user can restructure their resume freely and still
// never produce something the generators cannot render.
//
// It renders the resume's own sections, in the resume's own order, under the
// resume's own headings, with the resume's own lines - the same list the Word
// and PDF generators walk, so what is on screen is what the download contains.

import { useState } from 'react';
import {
  emptySection,
  normaliseDoc,
  type ResumeBlock,
  type ResumeDoc,
  type ResumeSection,
} from '@/lib/tagged/schema';
import { collapseLinkText } from '@/lib/docx/links';
import Editable from './Editable';
import { AddButton, DeleteButton } from './RowControls';

interface ResumePreviewProps {
  doc: ResumeDoc;
  onChange: (next: ResumeDoc) => void;
}

/**
 * A tab means the resume pushes what follows it to the right margin - a date.
 * On screen that is shown as a right-aligned tail on the same row, which is
 * what the .docx and the PDF both do, so the preview is not quietly the one
 * place the layout looks different.
 */
function splitTail(text: string): { left: string; right: string | null } {
  const at = text.lastIndexOf('\t');
  if (at === -1) return { left: text, right: null };
  return { left: text.slice(0, at).trimEnd(), right: text.slice(at + 1).trim() || null };
}

export default function ResumePreview({ doc, onChange }: ResumePreviewProps): React.ReactElement {
  // Identifies the row that was just added, so it can take focus. Without
  // this, focus stays on the "+" button after a click and every space the user
  // types adds another empty row.
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Defensive: a document from sessionStorage or an older row may be
  // missing fields entirely, and a crash here takes the whole page with it.
  const sections = normaliseDoc(doc).sections;

  const setSections = (next: ResumeSection[]) => onChange({ ...doc, sections: next });

  const patchSection = (index: number, patch: Partial<ResumeSection>) =>
    setSections(sections.map((section, i) => (i === index ? { ...section, ...patch } : section)));

  const setBlocks = (sectionIndex: number, blocks: ResumeBlock[]) =>
    patchSection(sectionIndex, { blocks });

  // -- structural edits -------------------------------------------------------

  const addSection = () => {
    setFocusKey(`heading:${sections.length}`);
    setSections([...sections, { ...emptySection(), heading: 'NEW SECTION' }]);
  };

  const removeSection = (index: number) => setSections(sections.filter((_, i) => i !== index));

  /**
   * A new line carries no `source`, which is exactly right: it has no
   * paragraph in the uploaded file, so the writer clones the formatting of the
   * nearest line of the same kind instead of inventing one.
   */
  const addBlock = (sectionIndex: number, bullet: boolean) => {
    const blocks = sections[sectionIndex].blocks;
    setFocusKey(`block:${sectionIndex}:${blocks.length}`);
    setBlocks(sectionIndex, [...blocks, { bullet, text: '' }]);
  };

  const removeBlock = (sectionIndex: number, blockIndex: number) =>
    setBlocks(
      sectionIndex,
      sections[sectionIndex].blocks.filter((_, i) => i !== blockIndex)
    );

  const editBlock = (sectionIndex: number, blockIndex: number, text: string) =>
    setBlocks(
      sectionIndex,
      sections[sectionIndex].blocks.map((block, i) => (i === blockIndex ? { ...block, text } : block))
    );

  return (
    <div className="resume-sheet">
      <div className="resume-name">
        <Editable
          value={doc.name}
          onChange={(v) => onChange({ ...doc, name: v })}
          placeholder="Your name"
        />
      </div>
      <div className="resume-contact">
        <Editable
          value={doc.contact}
          onChange={(v) => onChange({ ...doc, contact: v })}
          placeholder="Email, phone, links"
        />
      </div>

      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="resume-entry">
          <div className="resume-entry-head">
            <div className="resume-heading resume-flex">
              <Editable
                value={section.heading}
                onChange={(v) => patchSection(sectionIndex, { heading: v })}
                placeholder="Section heading"
                autoFocus={focusKey === `heading:${sectionIndex}`}
              />
            </div>
            <button
              type="button"
              onClick={() => removeSection(sectionIndex)}
              title="Remove this section"
              className="resume-remove-entry"
            >
              Remove section
            </button>
          </div>

          <ul className="resume-list">
            {section.blocks.map((block, blockIndex) => {
              const focusId = `block:${sectionIndex}:${blockIndex}`;
              // The address behind a link is shown as its label, the way the
              // finished document reads. The underlying value keeps the
              // address so the download can still rebuild the link.
              const { left, right } = splitTail(collapseLinkText(block.text));

              return (
                <li key={focusId} className={block.bullet ? 'resume-row' : 'resume-row-line'}>
                  {block.bullet && (
                    <span className="resume-bullet-dot" aria-hidden="true">
                      •
                    </span>
                  )}
                  <Editable
                    value={left}
                    onChange={(v) =>
                      editBlock(sectionIndex, blockIndex, right === null ? v : `${v}\t${right}`)
                    }
                    className="resume-flex"
                    autoFocus={focusKey === focusId}
                  />
                  {right !== null && (
                    <Editable
                      value={right}
                      onChange={(v) => editBlock(sectionIndex, blockIndex, `${left}\t${v}`)}
                      className="resume-tail"
                    />
                  )}
                  <DeleteButton
                    onClick={() => removeBlock(sectionIndex, blockIndex)}
                    label={block.bullet ? 'Remove this bullet' : 'Remove this line'}
                  />
                </li>
              );
            })}
          </ul>

          <div className="resume-add-inset" style={{ display: 'flex', gap: '6px' }}>
            <AddButton onClick={() => addBlock(sectionIndex, false)}>line</AddButton>
            <AddButton onClick={() => addBlock(sectionIndex, true)}>bullet</AddButton>
          </div>
        </div>
      ))}

      <div className="resume-add-section">
        <AddButton onClick={addSection}>section</AddButton>
      </div>
    </div>
  );
}

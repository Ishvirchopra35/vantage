// Renders a ResumeDoc as plain text.
//
// The .docx and PDF are the real output formats; this exists because
// documents.content has always held plain text and several features read it as
// such - ATS scoring, the extension's auto-fill, the documents list. Keeping
// that column plain text means none of them had to change.

import { hasContent, normaliseSection, type ResumeDoc } from './schema';

export function docToPlainText(doc: ResumeDoc): string {
  const out: string[] = [];

  const push = (text: string) => {
    if (text.trim()) out.push(text.trim());
  };

  push(doc.name);
  push(doc.contact);

  for (const raw of doc.sections) {
    const section = normaliseSection(raw);
    if (!hasContent(section)) continue;

    if (section.heading.trim()) out.push('', section.heading.trim());

    for (const block of section.blocks) {
      if (!block.text.trim()) continue;
      // Tabs become spaces here and only here: this feeds keyword matching and
      // form filling, where a tab is noise. Every format that lays the resume
      // out keeps it.
      const text = block.text.replace(/\t/g, '  ').trim();
      out.push(block.bullet ? `- ${text}` : text);
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

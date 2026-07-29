// pdfkit's standalone build ships without type declarations, so it borrows the
// ones from the package's normal entry point - the two expose the same API and
// differ only in where the font metrics come from.
//
// See lib/docx/pdf.ts for why the standalone build is the one we import.
declare module 'pdfkit/js/pdfkit.standalone.js' {
  import PDFDocument from 'pdfkit';
  export default PDFDocument;
}

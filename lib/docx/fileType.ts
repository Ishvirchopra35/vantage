// Which kind of resume file this is.
//
// Its own module, with no imports, because the browser needs it too: the
// prompt asking someone to upload a Word version has to know whether they
// already have one. Everything else in lib/docx pulls in JSZip, mammoth or
// pdf-parse, none of which belong in a client bundle.

/** True when the file should be treated as Word rather than PDF. */
export function isDocxFile(fileName: string, contentType: string): boolean {
  return (
    /\.docx?$/i.test(fileName) ||
    contentType.includes('officedocument') ||
    contentType.includes('msword')
  );
}

// Print stylesheet for generated resumes. Lives in its own file (no server
// imports) so both the Puppeteer PDF renderer (lib/generatePdf.ts) and the
// Resume Studio browser preview can share it - what you see in the preview
// iframe is exactly what the PDF prints.
export const RESUME_CSS = `
@page { size: letter; margin: 0.55in 0.65in; }
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: 'Arial', 'Helvetica Neue', sans-serif;
  font-size: 10.5px;
  line-height: 1.3;
  color: #000;
  background: #fff;
  margin: 0;
  padding: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
h1 {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 2px;
  letter-spacing: 0.3px;
}
/* Contact line - <p> directly under h1 */
h1 + p {
  font-size: 10px;
  text-align: center;
  color: #000;
  margin: 0 0 6px;
}
h2 {
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #000;
  margin: 5px 0 2px;
  padding-bottom: 1px;
}
h3 {
  font-size: 10.5px;
  font-weight: 700;
  margin: 3px 0 1px;
}
p {
  margin: 0 0 2px;
  font-size: 10.5px;
}
ul {
  margin: 0;
  padding-left: 16px;
}
li {
  list-style-type: disc;
  font-size: 10.5px;
  line-height: 1.35;
  margin: 1px 0;
}
a { color: #000; text-decoration: underline; }
strong { font-weight: 700; }
em { font-style: italic; }
`

// SERVER-SIDE ONLY — never import in client components
// CHROMIUM_EXECUTABLE_PATH:
//   Dev:  local Chrome path (e.g. C:\Program Files\Google\Chrome\Application\chrome.exe)
//   Prod: CDN tarball URL (e.g. https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar)

const RESUME_CSS = `
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
/* Contact line — <p> directly under h1 */
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

export async function generateResumeBuffer(htmlBody: string): Promise<Buffer | null> {
  const chromiumPath = process.env.CHROMIUM_EXECUTABLE_PATH
  if (!chromiumPath) return null

  let browser = null
  try {
    const chromium = (await import('@sparticuz/chromium-min')).default
    const puppeteer = (await import('puppeteer-core')).default

    const executablePath = chromiumPath.startsWith('http')
      ? await chromium.executablePath(chromiumPath)
      : chromiumPath

    browser = await puppeteer.launch({
      args: [...chromium.args, '--disable-web-security'],
      defaultViewport: { width: 816, height: 1056 },
      executablePath,
      headless: true,
    })

    const page = await browser.newPage()
    await page.setContent(
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>${RESUME_CSS}</style></head><body>${htmlBody}</body></html>`,
      { waitUntil: 'domcontentloaded' }
    )

    const pdfResult = await page.pdf({ format: 'Letter', printBackground: true })
    return Buffer.from(pdfResult)
  } catch {
    return null
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

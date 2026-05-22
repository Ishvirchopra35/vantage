// SERVER-SIDE ONLY — never import in client components
// CHROMIUM_EXECUTABLE_PATH:
//   Dev:  local Chrome path (e.g. C:\Program Files\Google\Chrome\Application\chrome.exe)
//   Prod: CDN tarball URL (e.g. https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar)

const RESUME_CSS = `
@page { size: letter; margin: 0.5in 0.6in; }
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: 'Times New Roman', Times, serif;
  font-size: 10.5pt;
  line-height: 1.4;
  color: #000;
  background: #fff;
  margin: 0;
  padding: 0;
}
h1 { font-size: 20pt; font-weight: 700; margin: 0 0 3pt; text-align: center; }
h2 {
  font-size: 11pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8pt;
  border-bottom: 0.75pt solid #000;
  margin: 9pt 0 3pt;
  padding-bottom: 1pt;
}
h3 { font-size: 10.5pt; font-weight: 700; margin: 5pt 0 1pt; }
p { margin: 0 0 3pt; }
ul { margin: 1pt 0 5pt; padding-left: 14pt; }
li { margin-bottom: 1.5pt; }
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

    const pdfResult = await page.pdf({ format: 'Letter', printBackground: false })
    return Buffer.from(pdfResult)
  } catch {
    return null
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

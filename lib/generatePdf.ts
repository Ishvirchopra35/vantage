// SERVER-SIDE ONLY - never import in client components
// CHROMIUM_EXECUTABLE_PATH:
//   Dev:  local Chrome path (e.g. C:\Program Files\Google\Chrome\Application\chrome.exe)
//   Prod: CDN tarball URL (e.g. https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar)

// Stylesheet shared with the Resume Studio preview - see lib/resumeCss.ts.
import { RESUME_CSS } from '@/lib/resumeCss'

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

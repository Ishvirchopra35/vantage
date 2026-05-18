import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { withTimeout } from '@/lib/withTimeout';
type PdfResult = { text: string; numpages: number };

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const body = await request.json().catch(() => null);
  const validation = validateBody<{ fileUrl: string; fileName?: string }>(body, ['fileUrl']);
  if (!validation.valid) return err(validation.error, 400);
  const { fileUrl, fileName = '' } = validation.data;

  let arrayBuffer: ArrayBuffer;
  let contentType = '';
  try {
    const response = await withTimeout(fetch(fileUrl), 10000, 'file fetch');
    if (!response.ok) {
      return err('Could not download the uploaded file — please try uploading again', 400);
    }
    contentType = response.headers.get('content-type') ?? '';
    arrayBuffer = await response.arrayBuffer();
  } catch {
    return err('Could not download the uploaded file — please try uploading again', 400);
  }

  const buffer = Buffer.from(arrayBuffer);
  const isDocx =
    /\.docx?$/i.test(fileName) ||
    contentType.includes('officedocument') ||
    contentType.includes('msword');

  let text: string;
  try {
    if (isDocx) {
      const mammoth = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buffer: Buffer) => Promise<PdfResult>;
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    }
  } catch (e) {
    await logRoute('/api/parse-resume', user.id, Date.now() - start, 500);
    return serverError(e);
  }

  await logRoute('/api/parse-resume', user.id, Date.now() - start, 200);
  return ok({ text });
}

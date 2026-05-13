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

  const body = await request.json();
  const validation = validateBody<{ fileUrl: string }>(body, ['fileUrl']);
  if (!validation.valid) return err(validation.error, 400);
  const { fileUrl } = validation.data;

  let arrayBuffer: ArrayBuffer;
  try {
    const response = await withTimeout(fetch(fileUrl), 10000, 'PDF fetch');
    if (!response.ok) {
      return err('Could not download the uploaded file — please try uploading again', 400);
    }
    arrayBuffer = await response.arrayBuffer();
  } catch {
    return err('Could not download the uploaded file — please try uploading again', 400);
  }

  let pdfData: PdfResult;
  try {
    const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<PdfResult>;
    const buffer = Buffer.from(arrayBuffer);
    pdfData = await pdfParse(buffer);
  } catch (e) {
    await logRoute('/api/parse-resume', user.id, Date.now() - start, 500);
    return serverError(e);
  }

  await logRoute('/api/parse-resume', user.id, Date.now() - start, 200);
  return ok({ text: pdfData.text, pageCount: pdfData.numpages });
}

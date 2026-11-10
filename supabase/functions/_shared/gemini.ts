/** Google's native Gemini API (generateContent); the key never leaves the server. */
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
/** Current models served to this key (older 2.x/1.x ids now return 404). */
export const GEMINI_MODEL = 'gemini-3.6-flash';
export const GEMINI_LITE_MODEL = 'gemini-3.5-flash-lite';

export const geminiUrl = (model: string, stream = false) =>
  `${GEMINI_BASE_URL}/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;

export class GeminiError extends Error {
  constructor(message: string, public status: number, public retryAfter: string | null = null) {
    super(message);
  }
}

export async function requireGeminiResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => null);
  const err = Array.isArray(body) ? body[0]?.error : body?.error;
  const message = err?.message || `Google Gemini request failed (${response.status})`;
  throw new GeminiError(message, response.status, response.headers.get('Retry-After'));
}

export function geminiErrorResponse(error: unknown, cors: Record<string, string>): Response {
  const headers = { ...cors, 'Content-Type': 'application/json' };
  if (error instanceof GeminiError && error.retryAfter) Object.assign(headers, { 'Retry-After': error.retryAfter });
  return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'AI request failed' }), {
    status: error instanceof GeminiError ? error.status : 500, headers,
  });
}

export type GeminiPart = { text: string } | { image: string };

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Accepts data: URLs, plain base64 (assumed JPEG) or http(s) URLs. */
async function toNativePart(part: GeminiPart) {
  if ('text' in part) return { text: part.text };
  const src = part.image;
  const m = src.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) return { inline_data: { mime_type: m[1], data: m[2] } };
  if (/^https?:\/\//.test(src)) {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`Could not load photo (${r.status})`);
    const mime = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    return { inline_data: { mime_type: mime, data: bytesToBase64(new Uint8Array(await r.arrayBuffer())) } };
  }
  return { inline_data: { mime_type: 'image/jpeg', data: src } };
}

export interface GeminiRequest {
  model?: string;
  system?: string;
  user: string | GeminiPart[];
  /** JSON schema for the reply; when set the reply is parsed JSON. */
  schema?: Record<string, unknown>;
  temperature?: number;
}

async function buildBody(req: GeminiRequest) {
  const parts = typeof req.user === 'string' ? [{ text: req.user }] : await Promise.all(req.user.map(toNativePart));
  const generationConfig: Record<string, unknown> = {};
  if (req.schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseJsonSchema = req.schema;
  }
  if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
  return JSON.stringify({
    ...(req.system ? { system_instruction: { parts: [{ text: req.system }] } } : {}),
    contents: [{ role: 'user', parts }],
    generationConfig,
  });
}

function apiKey(): string {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not configured');
  return key;
}

/** POST with one retry on Google's transient 500/503/504 overload responses. */
async function post(url: string, body: string): Promise<Response> {
  const key = apiKey();
  const call = () => fetch(url, { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body });
  let res = await call();
  for (const wait of [1500, 3000]) {
    if (![500, 503, 504].includes(res.status)) break;
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, wait));
    res = await call();
  }
  await requireGeminiResponse(res);
  return res;
}

const textOf = (data: any): string =>
  (data?.candidates?.[0]?.content?.parts ?? []).filter((p: any) => !p.thought).map((p: any) => p.text ?? '').join('');

export async function geminiText(req: GeminiRequest): Promise<string> {
  const res = await post(geminiUrl(req.model ?? GEMINI_MODEL), await buildBody(req));
  const text = textOf(await res.json());
  if (!text) throw new Error('Google Gemini returned an empty reply');
  return text;
}

export async function geminiJson<T = any>(req: GeminiRequest & { schema: Record<string, unknown> }): Promise<T> {
  const text = await geminiText(req);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Google Gemini returned invalid JSON');
  }
}

/** Streams only the answer text as a plain-text ReadableStream. */
export async function geminiStream(req: GeminiRequest): Promise<ReadableStream<Uint8Array>> {
  const res = await post(geminiUrl(req.model ?? GEMINI_MODEL, true), await buildBody(req));
  if (!res.body) throw new Error('Google returned no stream');
  const body = res.body;
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const reader = body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            try {
              const t = textOf(JSON.parse(line.slice(5).trim()));
              if (t) controller.enqueue(encoder.encode(t));
            } catch { /* partial line */ }
          }
        }
      } catch (e) {
        controller.error(e);
        return;
      }
      controller.close();
    },
  });
}

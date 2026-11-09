/** Google's documented OpenAI-compatible endpoint; credentials never leave the server. */
export const GEMINI_CHAT_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export class GeminiError extends Error {
  constructor(message: string, public status: number, public retryAfter: string | null = null) {
    super(message);
  }
}

export async function requireGeminiResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => null);
  const message = body?.error?.message || `Google Gemini request failed (${response.status})`;
  throw new GeminiError(message, response.status, response.headers.get('Retry-After'));
}

export function geminiErrorResponse(error: unknown, cors: Record<string, string>): Response {
  const headers = { ...cors, 'Content-Type': 'application/json' };
  if (error instanceof GeminiError && error.retryAfter) Object.assign(headers, { 'Retry-After': error.retryAfter });
  return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'AI request failed' }), {
    status: error instanceof GeminiError ? error.status : 500, headers,
  });
}
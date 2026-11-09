// @ts-nocheck -- run with bun test
import { expect, it } from 'bun:test';
import { GEMINI_CHAT_URL, geminiErrorResponse, requireGeminiResponse } from '../supabase/functions/_shared/gemini';

it('uses Google directly, not the Lovable gateway', () => {
  expect(GEMINI_CHAT_URL).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
});

for (const status of [402, 403, 429]) {
  it(`preserves provider status ${status} and its error message`, async () => {
    const upstream = new Response(JSON.stringify({ error: { message: 'Google quota or access error' } }), { status, headers: { 'Retry-After': '60' } });
    const error = await requireGeminiResponse(upstream).catch((e) => e);
    const response = geminiErrorResponse(error, { 'Access-Control-Allow-Origin': '*' });
    expect(response.status).toBe(status);
    expect((await response.json()).error).toBe('Google quota or access error');
    expect(response.headers.get('Retry-After')).toBe('60');
  });
}
// @ts-nocheck -- run with bun test
import { expect, it } from 'bun:test';
import { GEMINI_MODEL, geminiUrl, geminiErrorResponse, requireGeminiResponse } from '../supabase/functions/_shared/gemini';

it("uses Google's native generateContent endpoint, not the Lovable gateway or OpenAI bridge", () => {
  expect(geminiUrl('gemini-3.6-flash')).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
  expect(geminiUrl('gemini-3.6-flash', true)).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse');
});

it('does not request the retired 2.5 models that return 404', () => {
  expect(GEMINI_MODEL.startsWith('gemini-2.5')).toBe(false);
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

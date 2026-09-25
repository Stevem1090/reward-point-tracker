const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

export async function createTaskActionToken(taskId: string, secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
  const payload = `${taskId}.${expiresAt}`;
  return `${expiresAt}.${await signature(payload, secret)}`;
}

export async function verifyTaskActionToken(taskId: string, token: string, secret: string) {
  const [expiresText, supplied] = token.split('.');
  const expiresAt = Number(expiresText);
  if (!expiresText || !supplied || !Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
  const expected = await signature(`${taskId}.${expiresAt}`, secret);
  if (expected.length !== supplied.length) return false;
  let different = 0;
  for (let i = 0; i < expected.length; i++) different |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return different === 0;
}
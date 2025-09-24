export async function sha256(text: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return bufferToHex(digest);
  }

  const { createHash } = await import('crypto');
  return createHash('sha256').update(text).digest('hex');
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

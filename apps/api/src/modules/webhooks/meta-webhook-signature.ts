import * as crypto from 'node:crypto';

export function assinaturaHmacValida(
  rawBody: Buffer,
  assinatura: string | undefined,
  appSecret: string,
): boolean {
  if (!assinatura?.startsWith('sha256=') || !appSecret) return false;
  const esperada = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return igualTimingSafe(assinatura, esperada);
}

export function igualTimingSafe(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

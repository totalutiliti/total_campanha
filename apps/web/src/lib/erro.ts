/**
 * Extrai uma mensagem amigável de um erro vindo do api-client.
 * O api-client lança Error com texto "API POST /x → 400: <corpo>".
 * Aqui pegamos o corpo e, se for JSON do Nest ({ message }), usamos a message.
 */
export function mensagemErro(e: unknown, fallback = 'Algo deu errado. Tente de novo.'): string {
  if (!(e instanceof Error)) return fallback;
  let msg = e.message;
  const idx = msg.indexOf('→');
  if (idx >= 0) {
    msg = msg.slice(idx).replace(/^→\s*\d+:\s*/, '');
  }
  try {
    const j = JSON.parse(msg) as { message?: unknown };
    if (typeof j.message === 'string') return j.message;
    if (Array.isArray(j.message)) return j.message.join('; ');
  } catch {
    // corpo não-JSON — usa o texto como veio
  }
  return msg.trim() || fallback;
}

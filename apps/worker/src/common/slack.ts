/**
 * Alerta simples via Slack incoming webhook. No-op se a URL não estiver setada.
 * Usado para falha em massa de campanha (RULES 7.4) e outros alertas críticos.
 */
export async function enviarAlertaSlack(
  webhookUrl: string | undefined,
  alerta: { titulo: string; texto: string },
): Promise<void> {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `*${alerta.titulo}*\n${alerta.texto}` }),
    });
  } catch {
    // Alerta é best-effort — não propaga erro.
  }
}

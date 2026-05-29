/**
 * Conversão texto-simples <-> MJML para o editor de e-mail.
 *
 * O backend guarda o corpo do e-mail como MJML (renderizado com Mustache para
 * as {{variaveis}}). Mas pedir para um dono de autopeças escrever MJML é cruel.
 * Então deixamos a pessoa escrever texto normal e embrulhamos num MJML mínimo,
 * marcado com um comentário para conseguirmos extrair de volta na edição.
 *
 * Templates criados "à mão" (sem o marcador) abrem em modo avançado (MJML cru).
 */
const MARCADOR = '<!--tc:texto-->';

function escaparHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function desescaparHtml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/** Embrulha texto simples (com {{variaveis}}) num documento MJML válido. */
export function textoParaMjml(texto: string): string {
  const corpo = escaparHtml(texto).replace(/\r?\n/g, '<br/>');
  return `${MARCADOR}
<mjml>
  <mj-body background-color="#f6f6f6">
    <mj-section background-color="#ffffff" padding="24px">
      <mj-column>
        <mj-text font-size="15px" line-height="1.6" color="#333333">${corpo}</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

/**
 * Extrai o texto simples de um MJML que nós mesmos geramos. Retorna null se o
 * MJML não tiver o marcador (foi escrito à mão / modo avançado).
 */
export function mjmlParaTexto(mjml: string | null | undefined): string | null {
  if (!mjml || !mjml.startsWith(MARCADOR)) return null;
  const m = mjml.match(/<mj-text[^>]*>([\s\S]*?)<\/mj-text>/);
  if (!m) return '';
  return desescaparHtml(m[1].replace(/<br\s*\/?>/gi, '\n'));
}

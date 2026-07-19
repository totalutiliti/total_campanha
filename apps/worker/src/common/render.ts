import mjml2html from 'mjml';
import Mustache from 'mustache';

/**
 * Contato mínimo para interpolar variáveis.
 */
export interface ContatoRender {
  nome: string | null;
  email: string | null;
  telefoneE164: string | null;
  extras: Record<string, unknown>;
}

/**
 * Monta o dicionário de variáveis disponível para um template, a partir do
 * contato. Campos fixos + tudo de `extras`.
 */
export function variaveisDoContato(contato: ContatoRender): Record<string, unknown> {
  return {
    nome: contato.nome ?? '',
    email: contato.email ?? '',
    telefone: contato.telefoneE164 ?? '',
    ...contato.extras,
  };
}

/**
 * Renderiza MJML → HTML com interpolação Mustache (igual ao MjmlRenderService
 * da API). Mustache antes do MJML para variáveis em href/style funcionarem.
 */
export async function renderizarEmail(
  mjml: string,
  variaveis: Record<string, unknown>,
): Promise<string> {
  if (mjml.length > 200_000) throw new Error('Template MJML excede o limite de 200 mil caracteres.');
  const interpolado = Mustache.render(mjml, variaveis);
  const r = await mjml2html(interpolado, {
    keepComments: false,
    validationLevel: 'soft',
  });
  return r.html;
}

export function renderizarAssunto(
  assunto: string,
  variaveis: Record<string, unknown>,
): string {
  return Mustache.render(assunto, variaveis);
}

/**
 * Resolve os parâmetros de body de um template WhatsApp na ordem declarada.
 * `variaveis` do template: `[{ key, exemplo }]`. Mapeia cada `key` para o
 * valor do contato (campo fixo ou `extras`).
 */
export function resolverVariaveisWhatsapp(
  variaveisTemplate: Array<{ key: string }>,
  contato: ContatoRender,
): string[] {
  const dict = variaveisDoContato(contato);
  return variaveisTemplate.map((v) => {
    const valor = dict[v.key];
    return valor === undefined || valor === null ? '' : String(valor);
  });
}

/**
 * Lógica de mapeamento de colunas do CSV do usuário para os campos
 * conhecidos pelo backend (`nome`, `email`, `telefone`, `tags`) + extras.
 *
 * Mantida fora da tela para ser testável isoladamente e reutilizada quando a
 * UX-14 entrar na fase de importação assíncrona (>1.000 contatos).
 */

export type CampoAlvo =
  | 'nome'
  | 'email'
  | 'telefone'
  | 'tags'
  | 'ignorar'
  | 'extra';

export interface ColunaMapeada {
  /** Cabeçalho original do CSV do usuário (preservando caps). */
  origem: string;
  /** Para onde vai. */
  alvo: CampoAlvo;
  /**
   * Quando `alvo === 'extra'`, este é o nome final da chave no JSONB `extras`.
   * Default: cabeçalho original em snake_case minúsculo.
   */
  chaveExtra?: string;
}

/**
 * Heurística de auto-detecção. Tenta identificar nome / email / telefone /
 * tags pelos cabeçalhos típicos de exports brasileiros (RG2, Bling, Tiny,
 * Omie, planilhas manuais). Resto cai como `extra`.
 *
 * Primeiro match vence — segundas ocorrências do mesmo alvo viram extra.
 */
export function detectarMapeamento(cabecalhos: string[]): ColunaMapeada[] {
  const usados = new Set<CampoAlvo>();
  return cabecalhos.map((origem) => {
    const norm = normalizar(origem);

    const palpite: CampoAlvo | null = (() => {
      if (!usados.has('nome') && bate(norm, ['nome', 'razao social', 'razao', 'cliente', 'empresa', 'fantasia', 'apelido']))
        return 'nome';
      if (!usados.has('email') && bate(norm, ['email', 'e mail', 'mail', 'correio']))
        return 'email';
      if (
        !usados.has('telefone') &&
        bate(norm, ['telefone', 'tel', 'celular', 'fone', 'phone', 'whatsapp'])
      )
        return 'telefone';
      if (!usados.has('tags') && bate(norm, ['tags', 'tag', 'categoria', 'categorias', 'grupo', 'grupos']))
        return 'tags';
      return null;
    })();

    if (palpite) {
      usados.add(palpite);
      return { origem, alvo: palpite };
    }
    return { origem, alvo: 'extra', chaveExtra: snakeCase(origem) };
  });
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    // remove acentos
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_\-./]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bate(norm: string, alvos: string[]): boolean {
  return alvos.some((a) => norm === a || norm.includes(a));
}

function snakeCase(texto: string): string {
  return normalizar(texto).replace(/\s+/g, '_');
}

/**
 * Reescreve as linhas do CSV original, aplicando o mapeamento, em um formato
 * que o backend entende:
 *   - colunas `nome`, `email`, `telefone`, `tags` ficam com os nomes fixos
 *   - colunas mapeadas como `extra` mantêm o nome `chaveExtra` (cai no
 *     JSONB `extras` no banco)
 *   - colunas marcadas como `ignorar` somem
 *
 * O parser do backend trata cada coluna não-fixa como extra automaticamente,
 * então o que importa é (a) renomear o que vira fixo e (b) tirar o que é
 * ignorado.
 */
export function aplicarMapeamento(
  cabecalhosOriginais: string[],
  linhas: string[][],
  mapeamento: ColunaMapeada[],
): { cabecalhos: string[]; linhas: string[][] } {
  // Index do cabeçalho original → posição
  const indexOrigem = new Map<string, number>();
  cabecalhosOriginais.forEach((c, i) => indexOrigem.set(c, i));

  const colunasMantidas = mapeamento.filter((m) => m.alvo !== 'ignorar');

  const cabecalhos = colunasMantidas.map((m) => {
    if (m.alvo === 'extra') return m.chaveExtra ?? snakeCase(m.origem);
    return m.alvo;
  });

  const linhasNovas = linhas.map((linha) =>
    colunasMantidas.map((m) => {
      const idx = indexOrigem.get(m.origem);
      return idx !== undefined ? (linha[idx] ?? '') : '';
    }),
  );

  return { cabecalhos, linhas: linhasNovas };
}

/**
 * Validação local rápida das linhas mapeadas — só para mostrar contadores
 * antes do upload. A validação autoritativa continua sendo a do backend.
 */
export interface ValidacaoLocal {
  totalLinhas: number;
  comEmail: number;
  comTelefone: number;
  semContato: number;
  emailInvalido: number;
}

export function validarLocal(
  cabecalhos: string[],
  linhas: string[][],
): ValidacaoLocal {
  const idxEmail = cabecalhos.indexOf('email');
  const idxTel = cabecalhos.indexOf('telefone');
  let comEmail = 0;
  let comTelefone = 0;
  let semContato = 0;
  let emailInvalido = 0;

  for (const linha of linhas) {
    const email = (idxEmail >= 0 ? linha[idxEmail] : '').trim();
    const tel = (idxTel >= 0 ? linha[idxTel] : '').trim();
    const temEmail = email.length > 0;
    const temTel = tel.length > 0;

    if (temEmail) comEmail += 1;
    if (temTel) comTelefone += 1;
    if (!temEmail && !temTel) semContato += 1;
    if (temEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) emailInvalido += 1;
  }

  return {
    totalLinhas: linhas.length,
    comEmail,
    comTelefone,
    semContato,
    emailInvalido,
  };
}

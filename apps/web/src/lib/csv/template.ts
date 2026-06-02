/**
 * Modelo de CSV para importação de contatos.
 *
 * Convenções alinhadas com o parser do backend
 * (`apps/api/src/modules/contatos/importar/parser-csv.ts`):
 *  - Cabeçalhos reconhecidos: `nome`, `email`, `telefone`, `tags`
 *    (qualquer outra coluna vai para `extras` JSONB do contato)
 *  - Telefone aceita qualquer formato com DDD; backend normaliza para E.164
 *  - Tags separadas por **ponto-e-vírgula** (`;`) — vírgula confunde com o
 *    separador de coluna
 *  - Encoding UTF-8 com BOM (Excel BR abre direito sem perder acentuação)
 *
 * O exemplo usa 3 clientes reais de transporte (caso piloto Cardans Tencar)
 * para o usuário entender, na primeira leitura, o que cada coluna espera.
 */

export const CABECALHOS = [
  'nome',
  'email',
  'telefone',
  'tags',
  'cnpj',
  'fantasia',
  'regiao',
];

export const LINHAS_EXEMPLO: string[][] = [
  [
    'ARMAC LOCACAO LOGISTICA E SERVICOS S.A',
    'mariana.abreu@armac.com.br',
    '(11) 93246-7384',
    'transporte;sao-paulo',
    '00.242.184/0001-04',
    'ARMAC',
    '',
  ],
  [
    'SERTRAN SERTAOZINHO TRANSPORTES COLETIVOS LTDA',
    'eduardo.pupin@sertran.com.br',
    '(16) 2101-3600',
    'onibus;ribeirao-preto',
    '01.302.083/0001-36',
    'SERTRAN SERTAOZINHO',
    '',
  ],
  [
    'VIACAO PIRACEMA DE TRANSPORTES LTDA',
    'williamcvs@viacaopiracema.com.br',
    '(19) 9 9826-2332',
    'onibus;piracicaba',
    '44.810.034/0001-17',
    'PIRACEMA',
    '',
  ],
];

export function montarTemplateCsv(): string {
  const escapar = (s: string): string =>
    /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const linhaCsv = (cols: string[]): string => cols.map(escapar).join(',');
  // BOM UTF-8 (\uFEFF) — Excel pt-BR abre como UTF-8 sem prompt de encoding.
  return (
    '\uFEFF' +
    [linhaCsv(CABECALHOS), ...LINHAS_EXEMPLO.map(linhaCsv)].join('\n') +
    '\n'
  );
}

export function baixarTemplate(): void {
  const conteudo = montarTemplateCsv();
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modelo-contatos-total-campanha.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // libera o object URL no próximo tick — alguns browsers só liberam após o
  // download iniciar de fato.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

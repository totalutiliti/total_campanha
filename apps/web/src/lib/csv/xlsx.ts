/**
 * Modelo e leitura de planilhas Excel (.xlsx) para importação de contatos.
 *
 * Usa SheetJS (@e965/xlsx — mirror npm patcheado do SheetJS) carregado via
 * import dinâmico, para não pesar no bundle principal (só baixa quando o usuário
 * baixa o modelo ou sobe um .xlsx).
 *
 * O modelo reusa as mesmas colunas/exemplos do modelo CSV (`./template`), então
 * os dois formatos ficam sempre consistentes com o que o backend espera.
 */

import type { CsvParseado } from './parser';
import { CABECALHOS, LINHAS_EXEMPLO } from './template';

const NOME_ARQUIVO = 'modelo-contatos-total-campanha.xlsx';

/** Gera e baixa o modelo .xlsx com cabeçalhos + 3 exemplos. */
export async function baixarModeloXlsx(): Promise<void> {
  const XLSX = await import('@e965/xlsx');
  const aoa = [CABECALHOS, ...LINHAS_EXEMPLO];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Larguras de coluna para ficar legível ao abrir.
  ws['!cols'] = CABECALHOS.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
  XLSX.writeFile(wb, NOME_ARQUIVO);
}

/**
 * Lê um .xlsx no mesmo formato do parser de CSV ({ cabecalhos, linhas }).
 * Usa a primeira aba; trata tudo como texto; ignora linhas totalmente vazias.
 */
export async function parsearXlsx(arquivo: File): Promise<CsvParseado> {
  const XLSX = await import('@e965/xlsx');
  const buffer = await arquivo.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const nomeAba = wb.SheetNames[0];
  const ws = nomeAba ? wb.Sheets[nomeAba] : undefined;
  if (!ws) return { cabecalhos: [], linhas: [], separador: ',' };

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
  const naoVazias = matriz.filter(
    (l) => Array.isArray(l) && l.some((c) => String(c ?? '').trim() !== ''),
  );
  if (naoVazias.length === 0) return { cabecalhos: [], linhas: [], separador: ',' };

  const cabecalhos = naoVazias[0].map((c) => String(c ?? '').trim());
  const linhas = naoVazias
    .slice(1)
    .map((l) => cabecalhos.map((_, i) => String(l[i] ?? '').trim()));

  return { cabecalhos, linhas, separador: ',' };
}

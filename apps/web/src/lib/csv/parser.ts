/**
 * Parser CSV mínimo (RFC 4180-ish) para uso no frontend.
 *
 * Por que não usar papaparse? Para não acrescentar 45 KB ao bundle só por uma
 * tela. O backend já usa papaparse no parsing autoritativo (`parser-csv.ts`).
 * Esta versão do frontend serve apenas para pré-visualização e mapeamento —
 * a fonte da verdade continua sendo o parse server-side.
 *
 * Suporta:
 *  - Separador `,` ou `;` (auto-detecta pelo cabeçalho)
 *  - Campos entre aspas com aspas duplas escapando (`""`)
 *  - Quebras de linha LF, CRLF e CR
 *  - Cabeçalho na primeira linha
 *
 * Limitações conscientes:
 *  - Não suporta separador `\t` (TSV) — fora de escopo
 *  - Trata BOM UTF-8 (`\uFEFF`) silenciosamente
 */

export interface CsvParseado {
  /** Cabeçalhos como vieram no arquivo (preservando caps), trimados. */
  cabecalhos: string[];
  /** Linhas como arrays na mesma ordem dos cabeçalhos. */
  linhas: string[][];
  /** Separador detectado (informativo). */
  separador: ',' | ';';
}

/**
 * Detecta o separador olhando a primeira linha não vazia.
 * Conta vírgulas vs ponto-e-vírgulas fora de aspas.
 * Vence o mais frequente; empate fica em vírgula.
 */
function detectarSeparador(texto: string): ',' | ';' {
  // Pega só a primeira linha lógica (até a primeira quebra fora de aspas).
  let dentroAspas = false;
  let primeiraLinha = '';
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === '"') {
      dentroAspas = !dentroAspas;
      primeiraLinha += c;
    } else if ((c === '\n' || c === '\r') && !dentroAspas) {
      break;
    } else {
      primeiraLinha += c;
    }
  }
  let virg = 0;
  let pv = 0;
  let aspas = false;
  for (let i = 0; i < primeiraLinha.length; i += 1) {
    const c = primeiraLinha[i];
    if (c === '"') aspas = !aspas;
    else if (!aspas && c === ',') virg += 1;
    else if (!aspas && c === ';') pv += 1;
  }
  return pv > virg ? ';' : ',';
}

export function parsearCsv(textoBruto: string): CsvParseado {
  // Remove BOM se presente.
  const texto = textoBruto.replace(/^\uFEFF/, '');
  const sep = detectarSeparador(texto);

  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let dentroAspas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];

    if (dentroAspas) {
      if (c === '"') {
        // Aspas dupla escapada: `""` vira `"` dentro do campo.
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          dentroAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      dentroAspas = true;
      continue;
    }

    if (c === sep) {
      linha.push(campo);
      campo = '';
      continue;
    }

    if (c === '\r' || c === '\n') {
      // Engole \r\n como uma quebra só.
      if (c === '\r' && texto[i + 1] === '\n') i += 1;
      linha.push(campo);
      campo = '';
      // Linha 100% vazia: ignora (CSV pode terminar com \n a mais).
      if (!linha.every((c) => c.trim() === '')) {
        linhas.push(linha);
      }
      linha = [];
      continue;
    }

    campo += c;
  }

  // Último campo sem newline final.
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    if (!linha.every((c) => c.trim() === '')) {
      linhas.push(linha);
    }
  }

  if (linhas.length === 0) {
    return { cabecalhos: [], linhas: [], separador: sep };
  }

  const cabecalhos = linhas[0].map((c) => c.trim());
  const restoLinhas = linhas.slice(1).map((l) => l.map((c) => c.trim()));

  return { cabecalhos, linhas: restoLinhas, separador: sep };
}

/**
 * Reescreve um CSV a partir das linhas + cabeçalhos, usando sempre `,` como
 * separador (formato esperado pelo backend) e escapando aspas/quebras.
 */
export function gerarCsv(cabecalhos: string[], linhas: string[][]): string {
  const escapar = (s: string): string => {
    if (s === '') return '';
    // RFC 4180: campo que contém ", ", quebra de linha precisa de aspas; e
    // aspas internas viram "".
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const linhaCsv = (cols: string[]): string => cols.map(escapar).join(',');
  return [linhaCsv(cabecalhos), ...linhas.map(linhaCsv)].join('\n');
}

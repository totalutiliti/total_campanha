import Papa from 'papaparse';
import { normalizarTelefoneE164 } from '@total-campanha/shared';

/**
 * Linhas válidas e relatório de inválidas após parsing/normalização.
 */
export interface LinhaValida {
  nome: string | null;
  email: string | null;
  telefoneE164: string | null;
  tags: string[];
  extras: Record<string, unknown>;
}

export interface LinhaInvalida {
  linha: number;
  motivo: string;
  bruta: Record<string, string>;
}

export interface ResultadoParse {
  validas: LinhaValida[];
  invalidas: LinhaInvalida[];
  totalLido: number;
}

const COLUNAS_FIXAS = new Set(['nome', 'email', 'telefone', 'telefoneE164', 'tags']);

/**
 * Faz parse do CSV usando papaparse, normaliza telefone para E.164,
 * lowercaseia email, e move qualquer coluna não-fixa para `extras` JSONB
 * (RULES 8.7, 8.8; SPECS seção 4).
 *
 * NÃO acessa banco — pode ser usado tanto na API (sync ≤ SYNC_LIMITE)
 * quanto no Worker (job grande).
 */
export function parsearCsvContatos(conteudoUtf8: string): ResultadoParse {
  const result = Papa.parse<Record<string, string>>(conteudoUtf8, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === 'string' ? v.trim() : v),
  });

  const validas: LinhaValida[] = [];
  const invalidas: LinhaInvalida[] = [];
  let totalLido = 0;

  for (const erro of result.errors) {
    invalidas.push({
      linha: erro.row ?? -1,
      motivo: `parse: ${erro.message}`,
      bruta: {},
    });
  }

  for (let i = 0; i < result.data.length; i += 1) {
    const raw = result.data[i];
    totalLido += 1;
    const numeroLinha = i + 2; // 1-based + cabeçalho

    const nome = (raw.nome ?? '').trim() || null;
    const emailBruto = (raw.email ?? '').trim().toLowerCase();
    const email = emailBruto || null;
    const telefoneBruto = (raw.telefoneE164 ?? raw.telefone ?? '').trim();
    const telefoneE164 = telefoneBruto ? normalizarTelefoneE164(telefoneBruto) : null;

    if (!email && !telefoneE164) {
      invalidas.push({
        linha: numeroLinha,
        motivo: 'Sem email nem telefone válido',
        bruta: raw,
      });
      continue;
    }

    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      invalidas.push({ linha: numeroLinha, motivo: 'Email inválido', bruta: raw });
      continue;
    }

    if (telefoneBruto && !telefoneE164) {
      invalidas.push({
        linha: numeroLinha,
        motivo: `Telefone inválido: ${telefoneBruto}`,
        bruta: raw,
      });
      continue;
    }

    const tags = (raw.tags ?? '')
      .split(';')
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= 60);

    const extras: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!COLUNAS_FIXAS.has(k) && k !== 'telefone' && k !== 'telefoneE164') {
        extras[k] = v;
      }
    }

    validas.push({ nome, email, telefoneE164, tags, extras });
  }

  return { validas, invalidas, totalLido };
}

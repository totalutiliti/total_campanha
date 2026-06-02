'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '../../../../lib/auth/context';
import {
  aplicarMapeamento,
  CampoAlvo,
  ColunaMapeada,
  detectarMapeamento,
  validarLocal,
  ValidacaoLocal,
} from '../../../../lib/csv/mapeamento';
import { CsvParseado, gerarCsv, parsearCsv } from '../../../../lib/csv/parser';
import { baixarModeloXlsx, parsearXlsx } from '../../../../lib/csv/xlsx';

/**
 * Importação de contatos via CSV — UX-14 (Fase 1).
 *
 * Fluxo em 4 etapas controladas por discriminated union para evitar estados
 * intermediários inválidos (e.g., "preview" sem ter feito mapeamento antes):
 *
 *   1. upload    — drop zone + botão "Baixar modelo"
 *   2. mapear    — usuário confirma/ajusta o mapeamento auto-detectado
 *   3. preview   — resumo numérico + opções (opt-in, modo) antes de enviar
 *   4. concluido — eco do backend: criados / atualizados / inválidos
 *
 * Fora de escopo desta PR (Fase 2 do UX-14):
 *  - Upload direto de .xlsx (precisa SheetJS — usuário hoje "Salvar como CSV")
 *  - Detecção de duplicatas client-side (backend já trata no upsert)
 *  - Acompanhamento de job assíncrono (>1.000 contatos) — backend devolve
 *    `{ modo: 'async', jobId }`, mas a tela ainda não polla
 */

type ResultadoImportSync = {
  modo: 'sync';
  totalLido: number;
  importados: number;
  ignorados: number;
  invalidos: number;
  invalidas: { linha: number; motivo: string }[];
};

type ResultadoImportAsync = { modo: 'async'; jobId: string };
type ResultadoImport = ResultadoImportSync | ResultadoImportAsync;

interface OpcoesImport {
  modo: 'upsert' | 'ignorar';
  optInEmail: boolean;
  optInWhatsapp: boolean;
}

type Etapa =
  | { tipo: 'upload' }
  | {
      tipo: 'mapear';
      nomeArquivo: string;
      csv: CsvParseado;
      mapeamento: ColunaMapeada[];
    }
  | {
      tipo: 'preview';
      nomeArquivo: string;
      csvFinal: { cabecalhos: string[]; linhas: string[][] };
      validacao: ValidacaoLocal;
      opcoes: OpcoesImport;
    }
  | { tipo: 'enviando' }
  | { tipo: 'concluido'; resultado: ResultadoImport }
  | { tipo: 'erro'; mensagem: string; podeVoltar: boolean };

export default function ImportarContatosPage() {
  const { api } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'upload' });

  async function aoEscolherArquivo(arquivo: File): Promise<void> {
    const nomeArq = arquivo.name.toLowerCase();
    const ehXlsx = nomeArq.endsWith('.xlsx');
    const ehCsv = nomeArq.endsWith('.csv');
    if (!ehXlsx && !ehCsv) {
      setEtapa({
        tipo: 'erro',
        mensagem:
          'Formato não suportado. Envie .xlsx (Excel) ou .csv — baixe o modelo na tela de Contatos para começar no formato certo.',
        podeVoltar: true,
      });
      return;
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      setEtapa({
        tipo: 'erro',
        mensagem: 'Arquivo maior que 10 MB. Divida em partes menores.',
        podeVoltar: true,
      });
      return;
    }
    try {
      const csv = ehXlsx ? await parsearXlsx(arquivo) : parsearCsv(await arquivo.text());
      if (csv.cabecalhos.length === 0) {
        setEtapa({
          tipo: 'erro',
          mensagem: 'O arquivo parece vazio. Não consegui ler nenhum cabeçalho.',
          podeVoltar: true,
        });
        return;
      }
      const mapeamento = detectarMapeamento(csv.cabecalhos);
      setEtapa({ tipo: 'mapear', nomeArquivo: arquivo.name, csv, mapeamento });
    } catch (e) {
      setEtapa({
        tipo: 'erro',
        mensagem: `Falha ao ler o arquivo: ${e instanceof Error ? e.message : String(e)}`,
        podeVoltar: true,
      });
    }
  }

  function aoConfirmarMapeamento(): void {
    if (etapa.tipo !== 'mapear') return;
    const csvFinal = aplicarMapeamento(etapa.csv.cabecalhos, etapa.csv.linhas, etapa.mapeamento);
    const validacao = validarLocal(csvFinal.cabecalhos, csvFinal.linhas);
    setEtapa({
      tipo: 'preview',
      nomeArquivo: etapa.nomeArquivo,
      csvFinal,
      validacao,
      opcoes: { modo: 'upsert', optInEmail: false, optInWhatsapp: false },
    });
  }

  async function aoEnviar(): Promise<void> {
    if (etapa.tipo !== 'preview') return;
    setEtapa({ tipo: 'enviando' });
    try {
      const csvTexto = gerarCsv(etapa.csvFinal.cabecalhos, etapa.csvFinal.linhas);
      const blob = new Blob([csvTexto], { type: 'text/csv;charset=utf-8' });
      const form = new FormData();
      form.append('arquivo', blob, 'contatos.csv');
      form.append('modo', etapa.opcoes.modo);
      form.append('optInEmail', String(etapa.opcoes.optInEmail));
      form.append('optInWhatsapp', String(etapa.opcoes.optInWhatsapp));

      const r = await api<ResultadoImport>({
        method: 'POST',
        path: '/contatos/importar',
        formData: form,
      });
      setEtapa({ tipo: 'concluido', resultado: r });
    } catch (e) {
      const status = (e as { status?: number }).status;
      const mensagemRaw = e instanceof Error ? e.message : String(e);
      setEtapa({
        tipo: 'erro',
        mensagem:
          status === 403
            ? 'Você precisa ser ADMIN da empresa para importar contatos.'
            : status === 413
              ? 'Arquivo grande demais. Divida em partes menores.'
              : `Falha ao enviar para o servidor. ${mensagemRaw}`,
        podeVoltar: true,
      });
    }
  }

  return (
    <div className="max-w-3xl">
      <Cabecalho etapa={etapa.tipo} />

      {etapa.tipo === 'upload' && <EtapaUpload aoEscolher={aoEscolherArquivo} />}

      {etapa.tipo === 'mapear' && (
        <EtapaMapeamento
          nomeArquivo={etapa.nomeArquivo}
          csv={etapa.csv}
          mapeamento={etapa.mapeamento}
          aoMudarMapeamento={(novo) =>
            setEtapa({ ...etapa, mapeamento: novo })
          }
          aoCancelar={() => setEtapa({ tipo: 'upload' })}
          aoContinuar={aoConfirmarMapeamento}
        />
      )}

      {etapa.tipo === 'preview' && (
        <EtapaPreview
          nomeArquivo={etapa.nomeArquivo}
          csvFinal={etapa.csvFinal}
          validacao={etapa.validacao}
          opcoes={etapa.opcoes}
          aoMudarOpcoes={(novas) => setEtapa({ ...etapa, opcoes: novas })}
          aoVoltar={() => setEtapa({ tipo: 'upload' })}
          aoEnviar={aoEnviar}
        />
      )}

      {etapa.tipo === 'enviando' && (
        <div className="mt-6 rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Enviando para o servidor…</p>
          <p className="mt-1 text-gray-600">
            Não feche esta aba. Lotes pequenos vão concluir em poucos segundos.
          </p>
        </div>
      )}

      {etapa.tipo === 'concluido' && (
        <EtapaConcluido resultado={etapa.resultado} />
      )}

      {etapa.tipo === 'erro' && (
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <p className="font-medium">Algo deu errado.</p>
          <p className="mt-1 whitespace-pre-wrap">{etapa.mensagem}</p>
          {etapa.podeVoltar && (
            <button
              type="button"
              onClick={() => setEtapa({ tipo: 'upload' })}
              className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:outline-none"
            >
              Tentar de novo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cabeçalho com stepper das 4 etapas
// ---------------------------------------------------------------------------

function Cabecalho({ etapa }: { etapa: Etapa['tipo'] }) {
  const indice =
    etapa === 'upload' ? 0 : etapa === 'mapear' ? 1 : etapa === 'preview' ? 2 : 3;
  const titulos = ['Escolher arquivo', 'Mapear colunas', 'Pré-visualizar', 'Concluir'];
  return (
    <div className="mb-6">
      <Link
        href="/contatos"
        className="text-xs text-gray-600 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none rounded px-1"
      >
        ← Voltar para contatos
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
        Importar contatos
      </h1>
      <ol className="mt-3 flex items-center gap-2 text-xs text-gray-600 flex-wrap">
        {titulos.map((t, i) => (
          <li key={t} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border tabular-nums ${
                i <= indice
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 text-gray-500'
              }`}
            >
              {i + 1}
            </span>
            <span className={i === indice ? 'font-medium text-gray-900' : ''}>{t}</span>
            {i < titulos.length - 1 && <span className="text-gray-300">→</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 1 — Upload
// ---------------------------------------------------------------------------

function EtapaUpload({ aoEscolher }: { aoEscolher: (f: File) => void }) {
  const [arrastando, setArrastando] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gray-200 bg-white p-4 text-sm">
        <p className="font-medium text-gray-900">Primeira vez importando?</p>
        <p className="text-gray-700 mt-1">
          Baixe nosso modelo em Excel preenchido com 3 exemplos. Use-o como
          referência das colunas que esperamos.
        </p>
        <button
          type="button"
          onClick={() => {
            baixarModeloXlsx().catch(() => {});
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        >
          Baixar modelo (Excel)
        </button>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          const arq = e.dataTransfer.files[0];
          if (arq) aoEscolher(arq);
        }}
        className={`block cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
          arrastando ? 'border-gray-900 bg-gray-50' : 'border-gray-300 bg-white'
        } focus-within:ring-2 focus-within:ring-gray-900 focus-within:outline-none`}
      >
        <p className="text-sm font-medium text-gray-900">
          Arraste o arquivo aqui ou clique para escolher
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Aceita .xlsx (Excel) e .csv, até 10 MB.
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const arq = e.currentTarget.files?.[0];
            if (arq) aoEscolher(arq);
          }}
        />
      </label>

      <details className="rounded-md border border-gray-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium text-gray-900">
          O que cada coluna do modelo significa?
        </summary>
        <ul className="mt-3 space-y-1.5 text-gray-700">
          <li>
            <strong>nome</strong> — razão social ou nome do contato. Opcional, mas recomendado.
          </li>
          <li>
            <strong>email</strong> — e-mail do contato. Pelo menos um entre <em>email</em> e <em>telefone</em> precisa estar preenchido.
          </li>
          <li>
            <strong>telefone</strong> — aceita qualquer formato com DDD (ex.: <code className="bg-gray-100 px-1 rounded">(11) 98765-4321</code>). Normalizamos para padrão internacional.
          </li>
          <li>
            <strong>tags</strong> — categorias separadas por <code className="bg-gray-100 px-1 rounded">;</code> (ponto-e-vírgula). Ex.: <code className="bg-gray-100 px-1 rounded">cliente-ativo;regiao-oeste</code>.
          </li>
          <li>
            <strong>qualquer outra coluna</strong> — fica salva como atributo personalizado e pode ser usada em segmentos (ex.: <em>cnpj</em>, <em>fantasia</em>, <em>regiao</em>).
          </li>
        </ul>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 2 — Mapeamento
// ---------------------------------------------------------------------------

function EtapaMapeamento({
  nomeArquivo,
  csv,
  mapeamento,
  aoMudarMapeamento,
  aoCancelar,
  aoContinuar,
}: {
  nomeArquivo: string;
  csv: CsvParseado;
  mapeamento: ColunaMapeada[];
  aoMudarMapeamento: (m: ColunaMapeada[]) => void;
  aoCancelar: () => void;
  aoContinuar: () => void;
}) {
  function mudarAlvo(i: number, alvo: CampoAlvo): void {
    const novo = mapeamento.slice();
    novo[i] = { ...novo[i], alvo };
    aoMudarMapeamento(novo);
  }

  const totalLinhas = csv.linhas.length;
  const amostra = csv.linhas.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gray-200 bg-white p-4 text-sm">
        <p className="text-gray-900">
          <strong>{nomeArquivo}</strong> —{' '}
          <span className="text-gray-700 tabular-nums">{totalLinhas}</span> linhas detectadas, separador <code className="bg-gray-100 px-1 rounded">{csv.separador}</code>.
        </p>
      </div>

      <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-700 border-b border-gray-200">
          <div className="col-span-4">Sua coluna</div>
          <div className="col-span-4">Mapear para</div>
          <div className="col-span-4">Amostra (1ª linha)</div>
        </div>
        <ul className="divide-y divide-gray-100">
          {mapeamento.map((m, i) => (
            <li key={`${m.origem}-${i}`} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm items-center">
              <div className="col-span-4 font-medium text-gray-900 truncate" title={m.origem}>
                {m.origem || <em className="text-gray-500">(sem nome)</em>}
              </div>
              <div className="col-span-4">
                <select
                  value={m.alvo}
                  onChange={(e) => mudarAlvo(i, e.target.value as CampoAlvo)}
                  aria-label={`Para onde vai a coluna ${m.origem}`}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm bg-white focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
                >
                  <option value="nome">Nome do contato</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="tags">Tags</option>
                  <option value="extra">Atributo personalizado</option>
                  <option value="ignorar">Ignorar esta coluna</option>
                </select>
              </div>
              <div className="col-span-4 text-xs text-gray-600 truncate" title={csv.linhas[0]?.[i] ?? ''}>
                {csv.linhas[0]?.[i] || <span className="text-gray-400">(vazio)</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <details className="rounded-md border border-gray-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium text-gray-900">
          Ver as primeiras 5 linhas do arquivo
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {csv.cabecalhos.map((c) => (
                  <th key={c} className="px-2 py-1 text-left font-medium text-gray-700 border-b border-gray-200">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {amostra.map((linha, i) => (
                <tr key={i} className="border-b border-gray-100">
                  {csv.cabecalhos.map((_c, j) => (
                    <td key={j} className="px-2 py-1 text-gray-700">
                      {linha[j] || <span className="text-gray-400">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={aoCancelar}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={aoContinuar}
          className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 3 — Preview + opções
// ---------------------------------------------------------------------------

function EtapaPreview({
  nomeArquivo,
  csvFinal,
  validacao,
  opcoes,
  aoMudarOpcoes,
  aoVoltar,
  aoEnviar,
}: {
  nomeArquivo: string;
  csvFinal: { cabecalhos: string[]; linhas: string[][] };
  validacao: ValidacaoLocal;
  opcoes: OpcoesImport;
  aoMudarOpcoes: (o: OpcoesImport) => void;
  aoVoltar: () => void;
  aoEnviar: () => void;
}) {
  const importaveis = validacao.totalLinhas - validacao.semContato - validacao.emailInvalido;
  const semNome = !csvFinal.cabecalhos.includes('nome');
  const semContato = !csvFinal.cabecalhos.includes('email') && !csvFinal.cabecalhos.includes('telefone');

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gray-200 bg-white p-4 text-sm">
        <p className="text-gray-900">
          <strong>{nomeArquivo}</strong> — pronto para importar.
        </p>

        {semContato && (
          <p
            role="alert"
            className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800"
          >
            Você precisa mapear pelo menos uma coluna como <strong>E-mail</strong> ou <strong>Telefone</strong>. Sem isso, nenhum contato é importável.
          </p>
        )}
        {semNome && !semContato && (
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            Nenhuma coluna foi mapeada como <strong>Nome</strong>. Os contatos vão entrar sem nome (você pode editar depois).
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Linhas no arquivo" valor={validacao.totalLinhas} cor="cinza" />
        <Kpi label="Com e-mail" valor={validacao.comEmail} cor="verde" />
        <Kpi label="Com telefone" valor={validacao.comTelefone} cor="verde" />
        <Kpi
          label="Sem contato válido"
          valor={validacao.semContato + validacao.emailInvalido}
          cor={validacao.semContato + validacao.emailInvalido > 0 ? 'amarelo' : 'cinza'}
        />
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-4 text-sm space-y-3">
        <h3 className="font-medium text-gray-900">Opções de importação</h3>

        <fieldset>
          <legend className="text-xs font-medium text-gray-700 mb-1">
            Quando o contato já existir (mesmo e-mail ou telefone):
          </legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="modo"
                checked={opcoes.modo === 'upsert'}
                onChange={() => aoMudarOpcoes({ ...opcoes, modo: 'upsert' })}
                className="accent-gray-900"
              />
              <span>Atualizar dados</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="modo"
                checked={opcoes.modo === 'ignorar'}
                onChange={() => aoMudarOpcoes({ ...opcoes, modo: 'ignorar' })}
                className="accent-gray-900"
              />
              <span>Ignorar (manter o atual)</span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-medium text-gray-700 mb-1">
            Marcar como já tendo aceitado receber por:
          </legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opcoes.optInEmail}
                onChange={(e) => aoMudarOpcoes({ ...opcoes, optInEmail: e.target.checked })}
                className="accent-gray-900"
              />
              <span>E-mail</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opcoes.optInWhatsapp}
                onChange={(e) => aoMudarOpcoes({ ...opcoes, optInWhatsapp: e.target.checked })}
                className="accent-gray-900"
              />
              <span>WhatsApp</span>
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Só marque se você tem o consentimento documentado (LGPD). Em caso de dúvida, deixe desmarcado e use a página pública de opt-in.
          </p>
        </fieldset>
      </div>

      <p className="text-xs text-gray-500">
        O total pode diminuir no envio: contatos repetidos (no arquivo ou já cadastrados) e
        telefones em formato inválido são resolvidos pelo servidor. O resultado exato aparece
        na próxima etapa.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={aoVoltar}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={aoEnviar}
          disabled={semContato || importaveis === 0}
          className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Importar {importaveis} {importaveis === 1 ? 'contato' : 'contatos'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 4 — Concluído
// ---------------------------------------------------------------------------

function EtapaConcluido({ resultado }: { resultado: ResultadoImport }) {
  if (resultado.modo === 'async') {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
        <p className="font-medium">Arquivo grande — processando em segundo plano.</p>
        <p>
          Como você importou mais de 1.000 contatos, o servidor está processando aos poucos.
          Volte para a lista de contatos em alguns minutos — os novos vão aparecendo.
        </p>
        <p className="text-xs text-amber-800">
          ID do trabalho: <code className="bg-white/60 px-1 rounded">{resultado.jobId}</code>
        </p>
        <Link
          href="/contatos"
          className="inline-block mt-2 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          Ver contatos
        </Link>
      </div>
    );
  }

  const { importados, ignorados, invalidas, totalLido } = resultado;
  return (
    <div className="space-y-4">
      <div
        role="status"
        className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900"
      >
        <p className="font-medium">Importação concluída.</p>
        <p className="mt-1">
          Lemos <strong className="tabular-nums">{totalLido}</strong>{' '}
          {totalLido === 1 ? 'linha' : 'linhas'} do arquivo e gravamos{' '}
          <strong className="tabular-nums">{importados}</strong>{' '}
          {importados === 1 ? 'contato' : 'contatos'} na sua base.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Adicionados / atualizados" valor={importados} cor="verde" />
        <Kpi label="Ignorados (já existiam)" valor={ignorados} cor="cinza" />
        <Kpi
          label="Não entraram"
          valor={invalidas.length}
          cor={invalidas.length > 0 ? 'amarelo' : 'cinza'}
        />
      </div>

      {invalidas.length > 0 && (
        <details className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">
            Ver as {invalidas.length} linhas que não entraram
          </summary>
          <ul className="mt-3 space-y-1 text-xs max-h-60 overflow-y-auto">
            {invalidas.slice(0, 200).map((inv, i) => (
              <li key={i} className="tabular-nums">
                Linha {inv.linha}: {inv.motivo}
              </li>
            ))}
            {invalidas.length > 200 && (
              <li className="text-amber-700">
                … e mais {invalidas.length - 200} linhas (truncado).
              </li>
            )}
          </ul>
        </details>
      )}

      <Link
        href="/contatos"
        className="inline-block rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
      >
        Ver contatos
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card pequeno (versão local — vira shadcn/Card no UX-01)
// ---------------------------------------------------------------------------

function Kpi({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: number;
  cor: 'verde' | 'cinza' | 'amarelo' | 'vermelho';
}) {
  const valorCor: Record<typeof cor, string> = {
    verde: 'text-green-700',
    cinza: 'text-gray-900',
    amarelo: 'text-amber-700',
    vermelho: 'text-red-700',
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${valorCor[cor]}`}>
        {valor}
      </div>
    </div>
  );
}

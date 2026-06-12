'use client';

import { ArrowLeft, ChevronRight, Download, Loader2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AlertAviso, AlertErro, AlertSucesso } from '../../../../components/ui/alerts';
import { Button, buttonVariants } from '../../../../components/ui/button';
import { useAuth } from '../../../../lib/auth/context';
import { cn } from '../../../../lib/cn';
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
import { mensagemErro } from '../../../../lib/erro';

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

const SELECT_CLASSES =
  'flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

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
        mensagem: mensagemErro(e, 'Não conseguimos ler o arquivo. Confira o formato e tente de novo.'),
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
      setEtapa({
        tipo: 'erro',
        mensagem:
          status === 403
            ? 'Você precisa ser Administrador da empresa para importar contatos.'
            : status === 413
              ? 'Arquivo grande demais. Divida em partes menores.'
              : mensagemErro(e),
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
        <div className="mt-6 rounded-lg border bg-card p-6 text-sm text-card-foreground shadow-sm">
          <p className="flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando para o servidor…
          </p>
          <p className="mt-1 text-muted-foreground">
            Não feche esta aba. Lotes pequenos vão concluir em poucos segundos.
          </p>
        </div>
      )}

      {etapa.tipo === 'concluido' && (
        <EtapaConcluido resultado={etapa.resultado} />
      )}

      {etapa.tipo === 'erro' && (
        <div className="mt-6 space-y-3">
          <AlertErro>
            <p className="font-medium">Algo deu errado.</p>
            <p className="mt-1 whitespace-pre-wrap">{etapa.mensagem}</p>
          </AlertErro>
          {etapa.podeVoltar && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEtapa({ tipo: 'upload' })}
            >
              Tentar de novo
            </Button>
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
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para contatos
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Importar contatos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Traga sua planilha de clientes em 4 passos simples.
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {titulos.map((t, i) => (
          <li key={t} className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border tabular-nums',
                i <= indice
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {i + 1}
            </span>
            <span className={cn(i === indice && 'font-medium text-foreground')}>{t}</span>
            {i < titulos.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            )}
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
      <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
        <p className="font-medium">Primeira vez importando?</p>
        <p className="mt-1 text-muted-foreground">
          Baixe nosso modelo em Excel preenchido com 3 exemplos. Use-o como
          referência das colunas que esperamos.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-2"
          onClick={() => {
            baixarModeloXlsx().catch(() => {});
          }}
        >
          <Download className="h-4 w-4" />
          Baixar modelo (Excel)
        </Button>
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
        className={cn(
          'block cursor-pointer rounded-lg border-2 border-dashed bg-card p-8 text-center transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring',
          arrastando ? 'border-primary bg-primary/5' : 'hover:border-primary/50',
        )}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-medium">
          Arraste o arquivo aqui ou clique para escolher
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
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

      <details className="rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
        <summary className="cursor-pointer font-medium">
          O que cada coluna do modelo significa?
        </summary>
        <ul className="mt-3 space-y-1.5 text-muted-foreground">
          <li>
            <strong className="text-foreground">nome</strong> — razão social ou nome do contato. Opcional, mas recomendado.
          </li>
          <li>
            <strong className="text-foreground">email</strong> — e-mail do contato. Pelo menos um entre <em>email</em> e <em>telefone</em> precisa estar preenchido.
          </li>
          <li>
            <strong className="text-foreground">telefone</strong> — aceita qualquer formato com DDD (ex.: <code className="rounded bg-muted px-1">(11) 98765-4321</code>). Normalizamos para padrão internacional.
          </li>
          <li>
            <strong className="text-foreground">tags</strong> — categorias separadas por <code className="rounded bg-muted px-1">;</code> (ponto-e-vírgula). Ex.: <code className="rounded bg-muted px-1">cliente-ativo;regiao-oeste</code>.
          </li>
          <li>
            <strong className="text-foreground">qualquer outra coluna</strong> — fica salva como atributo personalizado e pode ser usada em grupos (ex.: <em>cnpj</em>, <em>fantasia</em>, <em>regiao</em>).
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
      <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
        <p>
          <strong>{nomeArquivo}</strong> —{' '}
          <span className="tabular-nums text-muted-foreground">{totalLinhas}</span> linhas detectadas, separador <code className="rounded bg-muted px-1">{csv.separador}</code>.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="grid grid-cols-12 gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
          <div className="col-span-4">Sua coluna</div>
          <div className="col-span-4">Mapear para</div>
          <div className="col-span-4">Amostra (1ª linha)</div>
        </div>
        <ul className="divide-y">
          {mapeamento.map((m, i) => (
            <li key={`${m.origem}-${i}`} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
              <div className="col-span-4 truncate font-medium" title={m.origem}>
                {m.origem || <em className="text-muted-foreground">(sem nome)</em>}
              </div>
              <div className="col-span-4">
                <select
                  value={m.alvo}
                  onChange={(e) => mudarAlvo(i, e.target.value as CampoAlvo)}
                  aria-label={`Para onde vai a coluna ${m.origem}`}
                  className={SELECT_CLASSES}
                >
                  <option value="nome">Nome do contato</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="tags">Tags</option>
                  <option value="extra">Atributo personalizado</option>
                  <option value="ignorar">Ignorar esta coluna</option>
                </select>
              </div>
              <div className="col-span-4 truncate text-xs text-muted-foreground" title={csv.linhas[0]?.[i] ?? ''}>
                {csv.linhas[0]?.[i] || <span className="text-muted-foreground/60">(vazio)</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <details className="rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
        <summary className="cursor-pointer font-medium">
          Ver as primeiras 5 linhas do arquivo
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {csv.cabecalhos.map((c) => (
                  <th key={c} className="border-b px-2 py-1 text-left font-medium text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {amostra.map((linha, i) => (
                <tr key={i} className="border-b last:border-0">
                  {csv.cabecalhos.map((_c, j) => (
                    <td key={j} className="px-2 py-1">
                      {linha[j] || <span className="text-muted-foreground/60">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={aoCancelar}>
          Voltar
        </Button>
        <Button type="button" onClick={aoContinuar}>
          Continuar
        </Button>
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
      <div className="space-y-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
        <p>
          <strong>{nomeArquivo}</strong> — pronto para importar.
        </p>

        {semContato && (
          <AlertErro>
            Você precisa mapear pelo menos uma coluna como <strong>E-mail</strong> ou{' '}
            <strong>Telefone</strong>. Sem isso, nenhum contato é importável.
          </AlertErro>
        )}
        {semNome && !semContato && (
          <AlertAviso>
            Nenhuma coluna foi mapeada como <strong>Nome</strong>. Os contatos vão entrar sem nome
            (você pode editar depois).
          </AlertAviso>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Linhas no arquivo" valor={validacao.totalLinhas} cor="cinza" />
        <Kpi label="Com e-mail" valor={validacao.comEmail} cor="verde" />
        <Kpi label="Com telefone" valor={validacao.comTelefone} cor="verde" />
        <Kpi
          label="Sem contato válido"
          valor={validacao.semContato + validacao.emailInvalido}
          cor={validacao.semContato + validacao.emailInvalido > 0 ? 'amarelo' : 'cinza'}
        />
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
        <h3 className="font-medium">Opções de importação</h3>

        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted-foreground">
            Quando o contato já existir (mesmo e-mail ou telefone):
          </legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="modo"
                checked={opcoes.modo === 'upsert'}
                onChange={() => aoMudarOpcoes({ ...opcoes, modo: 'upsert' })}
                className="h-4 w-4 accent-primary"
              />
              <span>Atualizar dados</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="modo"
                checked={opcoes.modo === 'ignorar'}
                onChange={() => aoMudarOpcoes({ ...opcoes, modo: 'ignorar' })}
                className="h-4 w-4 accent-primary"
              />
              <span>Ignorar (manter o atual)</span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted-foreground">
            Marcar como já tendo aceitado receber por:
          </legend>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opcoes.optInEmail}
                onChange={(e) => aoMudarOpcoes({ ...opcoes, optInEmail: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span>E-mail</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opcoes.optInWhatsapp}
                onChange={(e) => aoMudarOpcoes({ ...opcoes, optInWhatsapp: e.target.checked })}
                className="h-4 w-4 rounded accent-primary"
              />
              <span>WhatsApp</span>
            </label>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Só marque se você tem o consentimento documentado (LGPD). Em caso de dúvida, deixe desmarcado e use a página pública de opt-in.
          </p>
        </fieldset>
      </div>

      <p className="text-xs text-muted-foreground">
        O total pode diminuir no envio: contatos repetidos (no arquivo ou já cadastrados) e
        telefones em formato inválido são resolvidos pelo servidor. O resultado exato aparece
        na próxima etapa.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={aoVoltar}>
          Voltar
        </Button>
        <Button
          type="button"
          onClick={aoEnviar}
          disabled={semContato || importaveis === 0}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Importar {importaveis} {importaveis === 1 ? 'contato' : 'contatos'}
        </Button>
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
      <div className="space-y-3">
        <AlertAviso>
          <div className="space-y-2">
            <p className="font-medium">Arquivo grande — processando em segundo plano.</p>
            <p>
              Como você importou mais de 1.000 contatos, o servidor está processando aos poucos.
              Volte para a lista de contatos em alguns minutos — os novos vão aparecendo.
            </p>
            <p className="text-xs text-muted-foreground">
              ID do trabalho: <code className="rounded bg-muted px-1">{resultado.jobId}</code>
            </p>
          </div>
        </AlertAviso>
        <Link href="/contatos" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Ver contatos
        </Link>
      </div>
    );
  }

  const { importados, ignorados, invalidas, totalLido } = resultado;
  return (
    <div className="space-y-4">
      <AlertSucesso>
        <p className="font-medium">Importação concluída.</p>
        <p className="mt-1">
          Lemos <strong className="tabular-nums">{totalLido}</strong>{' '}
          {totalLido === 1 ? 'linha' : 'linhas'} do arquivo e gravamos{' '}
          <strong className="tabular-nums">{importados}</strong>{' '}
          {importados === 1 ? 'contato' : 'contatos'} na sua base.
        </p>
      </AlertSucesso>

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
        <details className="rounded-lg border border-yellow-500/50 bg-yellow-50 p-4 text-sm dark:bg-yellow-950/20">
          <summary className="cursor-pointer font-medium">
            Ver as {invalidas.length} linhas que não entraram
          </summary>
          <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {invalidas.slice(0, 200).map((inv, i) => (
              <li key={i} className="tabular-nums">
                Linha {inv.linha}: {inv.motivo}
              </li>
            ))}
            {invalidas.length > 200 && (
              <li>… e mais {invalidas.length - 200} linhas (truncado).</li>
            )}
          </ul>
        </details>
      )}

      <Link href="/contatos" className={cn(buttonVariants(), 'gap-2')}>
        Ver contatos
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card pequeno
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
    verde: 'text-green-700 dark:text-green-400',
    cinza: '',
    amarelo: 'text-amber-700 dark:text-amber-400',
    vermelho: 'text-red-700 dark:text-red-400',
  };
  return (
    <div className="rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-bold tabular-nums', valorCor[cor])}>
        {valor}
      </div>
    </div>
  );
}

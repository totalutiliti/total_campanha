'use client';

import { Check, Download, Loader2, Plus, Upload, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AlertErro } from '../../../components/ui/alerts';
import { Badge } from '../../../components/ui/badge';
import { Button, buttonVariants } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useAuth } from '../../../lib/auth/context';
import { cn } from '../../../lib/cn';
import { baixarModeloXlsx } from '../../../lib/csv/xlsx';
import { mensagemErro } from '../../../lib/erro';

interface Contato {
  id: string;
  nome: string | null;
  email: string | null;
  telefoneE164: string | null;
  tags: string[];
  optInEmail: boolean;
  optInWhatsapp: boolean;
  createdAt: string;
}

interface Resposta {
  itens: Contato[];
  paginacao: { pagina: number; porPagina: number; total: number; totalPaginas: number };
}

export default function ContatosListPage() {
  const { api } = useAuth();
  const router = useRouter();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const timer = setTimeout(
      async () => {
        try {
          const q = new URLSearchParams({ porPagina: '200' });
          if (busca.trim()) q.set('busca', busca.trim());
          const r = await api<Resposta>({ path: `/contatos?${q.toString()}` });
          if (!cancelado) {
            setDados(r);
            setErro(null);
          }
        } catch (e) {
          if (!cancelado) setErro(mensagemErro(e));
        }
      },
      busca ? 300 : 0,
    );
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [api, busca]);

  function alternar(id: string) {
    setSel((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function criarGrupoECampanha() {
    const nome = window.prompt(
      'Dê um nome para este grupo de contatos selecionados:',
      'Selecionados',
    );
    if (!nome || !nome.trim()) return;
    setCriando(true);
    setErro(null);
    try {
      const grupo = await api<{ id: string }>({
        method: 'POST',
        path: '/segmentos',
        body: {
          nome: nome.trim(),
          filtros: {
            modo: 'or',
            condicoes: [{ campo: 'id', operador: 'in', valor: Array.from(sel) }],
          },
        },
      });
      router.push(`/campanhas/nova?segmento=${grupo.id}`);
    } catch (e) {
      setErro(mensagemErro(e));
      setCriando(false);
    }
  }

  const total = dados?.paginacao.total ?? 0;
  const mostrando = dados?.itens.length ?? 0;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Contatos</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              baixarModeloXlsx().catch(() => setErro('Não foi possível gerar o modelo. Tente de novo.'))
            }
            className="gap-2"
            title="Baixa uma planilha Excel no formato certo para preencher e importar"
          >
            <Download className="h-4 w-4" />
            Baixar modelo
          </Button>
          <Link
            href="/contatos/importar"
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
          >
            <Upload className="h-4 w-4" />
            Importar contatos
          </Link>
          <Link href="/contatos/novo" className={cn(buttonVariants(), 'gap-2')}>
            <Plus className="h-4 w-4" />
            Adicionar contato
          </Link>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Sua base de clientes — é daqui que saem os grupos das campanhas.
      </p>

      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome, e-mail ou telefone…"
        className="mb-3 max-w-md"
      />

      {erro && <AlertErro className="mb-3">{erro}</AlertErro>}

      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">
            {sel.size} selecionado{sel.size === 1 ? '' : 's'}
          </span>
          <Button type="button" size="sm" onClick={criarGrupoECampanha} disabled={criando}>
            {criando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando grupo…
              </>
            ) : (
              'Criar grupo e campanha'
            )}
          </Button>
          <button
            type="button"
            onClick={() => setSel(new Set())}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {dados === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando contatos…
        </p>
      ) : total === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          {busca ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contato encontrado para “{busca}”.
            </p>
          ) : (
            <>
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">Sua base de contatos está vazia.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Importe sua planilha de clientes ou adicione um contato manualmente para começar.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/contatos/importar" className={cn(buttonVariants(), 'gap-2')}>
                  <Upload className="h-4 w-4" />
                  Importar contatos
                </Link>
                <Link
                  href="/contatos/novo"
                  className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar contato
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {total} contato{total === 1 ? '' : 's'} no total
            {mostrando < total ? ` · mostrando os primeiros ${mostrando}` : ''} · marque para criar
            um grupo e enviar.
          </p>
          <ul className="space-y-2">
            {dados.itens.map((c) => (
              <li
                key={c.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-sm transition-colors hover:bg-muted/50',
                  sel.has(c.id) && 'border-primary bg-primary/5',
                )}
              >
                <input
                  type="checkbox"
                  checked={sel.has(c.id)}
                  onChange={() => alternar(c.id)}
                  aria-label={`Selecionar ${c.nome ?? 'contato'}`}
                  className="h-4 w-4 shrink-0 rounded accent-primary"
                />
                <Link
                  href={`/contatos/${c.id}`}
                  className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.nome ?? '(sem nome)'}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.email ?? '—'} · {c.telefoneE164 ?? '—'}
                      </div>
                      {c.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="font-normal">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      {c.optInEmail && (
                        <div className="flex items-center justify-end gap-1 text-green-700 dark:text-green-400">
                          <Check className="h-3 w-3" />
                          E-mail
                        </div>
                      )}
                      {c.optInWhatsapp && (
                        <div className="flex items-center justify-end gap-1 text-green-700 dark:text-green-400">
                          <Check className="h-3 w-3" />
                          WhatsApp
                        </div>
                      )}
                      {!c.optInEmail && !c.optInWhatsapp && (
                        <div className="text-muted-foreground">sem opt-in</div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

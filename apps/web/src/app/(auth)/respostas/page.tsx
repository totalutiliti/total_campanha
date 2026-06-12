'use client';

import { Inbox, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AlertAviso, AlertErro } from '../../../components/ui/alerts';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { useAuth } from '../../../lib/auth/context';
import { cn } from '../../../lib/cn';
import { mensagemErro } from '../../../lib/erro';

interface Conversa {
  id: string;
  ultimoMsgAt: string;
  janela24hExpiraEm: string;
  status: string;
  contato: { id: string; nome: string | null; telefoneE164: string | null } | null;
  ultimaMensagem: { conteudo: string; direcao: 'in' | 'out' } | null;
}

interface Mensagem {
  id: string;
  direcao: 'in' | 'out';
  conteudo: string;
  createdAt: string;
}

/**
 * Respostas (inbox WhatsApp) — quando um cliente responde a campanha, a
 * conversa aparece aqui e o vendedor responde direto, sem sair do sistema.
 */
export default function RespostasPage() {
  const { api } = useAuth();
  const [conversas, setConversas] = useState<Conversa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<Conversa | null>(null);

  const carregar = useCallback(() => {
    api<Conversa[]>({ method: 'GET', path: '/inbox/conversas' })
      .then(setConversas)
      .catch((e) => setErro(mensagemErro(e)));
  }, [api]);

  useEffect(() => {
    carregar();
    // Atualiza a lista a cada 30s — resposta de cliente é sensível a tempo.
    const timer = setInterval(carregar, 30_000);
    return () => clearInterval(timer);
  }, [carregar]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Respostas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quando alguém responde suas campanhas de WhatsApp, a conversa aparece aqui.
        </p>
      </div>

      {erro && <AlertErro>{erro}</AlertErro>}

      {conversas !== null && conversas.length === 0 && (
        <Card className="p-10 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Nenhuma resposta ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Assim que um cliente responder uma campanha, a conversa aparece nesta tela.
          </p>
        </Card>
      )}

      {conversas !== null && conversas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-[320px,1fr]">
          <Card className="overflow-hidden">
            <ul className="divide-y max-h-[70vh] overflow-y-auto">
              {conversas.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelecionada(c)}
                    className={cn(
                      'w-full px-4 py-3 text-left transition-colors hover:bg-accent',
                      selecionada?.id === c.id && 'bg-primary/10',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {c.contato?.nome ?? c.contato?.telefoneE164 ?? 'Contato'}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatarHora(c.ultimoMsgAt)}
                      </span>
                    </div>
                    {c.ultimaMensagem && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {c.ultimaMensagem.direcao === 'out' ? 'Você: ' : ''}
                        {c.ultimaMensagem.conteudo}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {selecionada ? (
            <Thread key={selecionada.id} conversa={selecionada} onEnviou={carregar} />
          ) : (
            <Card className="p-10 text-center text-sm text-muted-foreground hidden md:flex items-center justify-center">
              Escolha uma conversa ao lado para ler e responder.
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Thread({ conversa, onEnviou }: { conversa: Conversa; onEnviou: () => void }) {
  const { api } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[] | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const janelaAberta = new Date(conversa.janela24hExpiraEm).getTime() > Date.now();

  const carregarMensagens = useCallback(() => {
    api<{ mensagens: Mensagem[] }>({
      method: 'GET',
      path: `/inbox/conversas/${conversa.id}/mensagens`,
    })
      .then((r) => setMensagens(r.mensagens))
      .catch((e) => setErro(mensagemErro(e)));
  }, [api, conversa.id]);

  useEffect(() => {
    carregarMensagens();
  }, [carregarMensagens]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' });
  }, [mensagens]);

  async function responder(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setErro(null);
    setEnviando(true);
    try {
      await api({
        method: 'POST',
        path: `/inbox/conversas/${conversa.id}/responder`,
        body: { conteudo: texto.trim() },
      });
      setTexto('');
      carregarMensagens();
      onEnviou();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="flex flex-col max-h-[70vh]">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-medium">
          {conversa.contato?.nome ?? 'Contato'}
        </p>
        <p className="text-xs text-muted-foreground">{conversa.contato?.telefoneE164}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {mensagens === null && (
          <p className="text-sm text-muted-foreground">Carregando conversa…</p>
        )}
        {mensagens?.map((m) => (
          <div
            key={m.id}
            className={cn('flex', m.direcao === 'out' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                m.direcao === 'out'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.conteudo}</p>
              <p
                className={cn(
                  'mt-1 text-[10px]',
                  m.direcao === 'out' ? 'text-primary-foreground/70' : 'text-muted-foreground',
                )}
              >
                {formatarHora(m.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      <div className="border-t p-3 space-y-2">
        {erro && <AlertErro>{erro}</AlertErro>}
        {janelaAberta ? (
          <form onSubmit={responder} className="flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva sua resposta…"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <Button type="submit" disabled={enviando || !texto.trim()} className="gap-2 shrink-0">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </form>
        ) : (
          <AlertAviso>
            O WhatsApp só deixa responder em até 24 horas depois da última mensagem do cliente.
            Essa janela fechou — se precisar falar com ele, envie uma nova campanha.
          </AlertAviso>
        )}
      </div>
    </Card>
  );
}

function formatarHora(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  if (mesmoDia) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

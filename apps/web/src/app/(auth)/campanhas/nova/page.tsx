'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AlertErro } from '../../../../components/ui/alerts';
import { Button, buttonVariants } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { useAuth } from '../../../../lib/auth/context';
import { canalLabel } from '../../../../lib/campanha-status';
import { mensagemErro } from '../../../../lib/erro';

type Canal = 'EMAIL' | 'WHATSAPP';
interface Template {
  id: string;
  nome: string;
  canal: Canal;
}
interface Segmento {
  id: string;
  nome: string;
}

const SELECT_CLASSES =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export default function NovaCampanhaPage() {
  const router = useRouter();
  const { api } = useAuth();

  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState<Canal>('WHATSAPP');
  const [templateId, setTemplateId] = useState('');
  const [segmentoId, setSegmentoId] = useState('');
  const [agendar, setAgendar] = useState(false);
  const [agendadoPara, setAgendadoPara] = useState('');

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [segmentos, setSegmentos] = useState<Segmento[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setSegmentos(await api<Segmento[]>({ path: '/segmentos' }));
      } catch (e) {
        setErro(mensagemErro(e));
      }
    })();
  }, [api]);

  useEffect(() => {
    let cancelado = false;
    setTemplates(null);
    setTemplateId('');
    (async () => {
      try {
        const ts = await api<Template[]>({ path: `/templates?canal=${canal}` });
        if (!cancelado) setTemplates(ts);
      } catch (e) {
        if (!cancelado) setErro(mensagemErro(e));
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [api, canal]);

  // Pré-seleciona o grupo vindo da seleção manual de contatos (?segmento=ID).
  useEffect(() => {
    const seg = new URLSearchParams(window.location.search).get('segmento');
    if (seg) setSegmentoId(seg);
  }, []);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) return setErro('Dê um nome para a campanha.');
    if (!templateId) return setErro('Escolha a mensagem (template) que será enviada.');
    if (!segmentoId) return setErro('Escolha o grupo de contatos que vai receber.');
    if (agendar && !agendadoPara) return setErro('Informe a data e a hora do agendamento.');

    setSalvando(true);
    try {
      const body: Record<string, unknown> = { nome: nome.trim(), canal, templateId, segmentoId };
      if (agendar && agendadoPara) body.agendadoPara = new Date(agendadoPara).toISOString();
      const criada = await api<{ id: string }>({ method: 'POST', path: '/campanhas', body });
      router.push(`/campanhas/${criada.id}`);
    } catch (err) {
      setErro(mensagemErro(err));
      setSalvando(false);
    }
  }

  return (
    <div>
      <Link
        href="/campanhas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para campanhas
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Nova campanha</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Escolha a mensagem, quem vai receber e quando enviar.
      </p>

      <form onSubmit={submeter} className="max-w-lg space-y-5">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome da campanha</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Promoção de novembro"
          />
          <p className="text-xs text-muted-foreground">
            Só para você identificar — o contato não vê.
          </p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium leading-none">Canal</legend>
          <div className="flex gap-4">
            {(['WHATSAPP', 'EMAIL'] as Canal[]).map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="canal"
                  checked={canal === c}
                  onChange={() => setCanal(c)}
                  className="h-4 w-4 accent-primary"
                />
                <span>{canalLabel(c)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="template">Mensagem</Label>
          {templates === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você ainda não tem mensagem de {canalLabel(canal)}.{' '}
              <Link href="/templates/novo" className="font-medium text-primary hover:underline">
                Criar uma agora
              </Link>
              .
            </p>
          ) : (
            <select
              id="template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className={SELECT_CLASSES}
            >
              <option value="">Selecione…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="segmento">Quem vai receber (grupo)</Label>
          {segmentos === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </p>
          ) : segmentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Você ainda não tem grupos.{' '}
              <Link href="/segmentos/novo" className="font-medium text-primary hover:underline">
                Criar um agora
              </Link>
              .
            </p>
          ) : (
            <select
              id="segmento"
              value={segmentoId}
              onChange={(e) => setSegmentoId(e.target.value)}
              className={SELECT_CLASSES}
            >
              <option value="">Selecione…</option>
              {segmentos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-muted-foreground">
            Só recebem os contatos com opt-in para {canalLabel(canal)}.
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agendar}
              onChange={(e) => setAgendar(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            <span>Agendar para depois</span>
          </label>
          {agendar && (
            <Input
              type="datetime-local"
              value={agendadoPara}
              onChange={(e) => setAgendadoPara(e.target.value)}
              className="mt-2 max-w-xs"
            />
          )}
        </div>

        {erro && <AlertErro>{erro}</AlertErro>}

        <div className="flex gap-2">
          <Button type="submit" disabled={salvando}>
            {salvando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando…
              </>
            ) : (
              'Criar campanha'
            )}
          </Button>
          <Link href="/campanhas" className={buttonVariants({ variant: 'outline' })}>
            Cancelar
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Criar não envia nada — você confere o número de destinatários e o custo na próxima tela
          antes de disparar.
        </p>
      </form>
    </div>
  );
}

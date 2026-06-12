'use client';

import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContatoForm, ContatoPayload } from '../../../../components/contatos/contato-form';
import { AlertErro } from '../../../../components/ui/alerts';
import { Button } from '../../../../components/ui/button';
import { useAuth } from '../../../../lib/auth/context';
import { mensagemErro } from '../../../../lib/erro';

interface Contato {
  id: string;
  nome: string | null;
  email: string | null;
  telefoneE164: string | null;
  tags: string[];
  optInEmail: boolean;
  optInWhatsapp: boolean;
}

export default function EditarContatoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuth();

  const [contato, setContato] = useState<Contato | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [lgpd, setLgpd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setContato(await api<Contato>({ path: `/contatos/${id}` }));
      } catch (e) {
        setErroCarga(mensagemErro(e));
      } finally {
        setCarregando(false);
      }
    })();
  }, [api, id]);

  async function salvar(p: ContatoPayload) {
    setSalvando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = {
        email: p.email,
        telefoneE164: p.telefoneE164,
        tags: p.tags,
        optInEmail: p.optInEmail,
        optInWhatsapp: p.optInWhatsapp,
      };
      if (p.nome) body.nome = p.nome;
      await api({ method: 'PATCH', path: `/contatos/${id}`, body });
      router.push('/contatos');
    } catch (e) {
      setErro(mensagemErro(e));
      setSalvando(false);
    }
  }

  async function excluir() {
    const msg = lgpd
      ? 'Apagar definitivamente este contato e anonimizar o histórico de mensagens? Isso não pode ser desfeito.'
      : 'Excluir este contato? Ele deixa de aparecer na lista e não recebe mais campanhas.';
    if (!window.confirm(msg)) return;
    setExcluindo(true);
    setErro(null);
    try {
      await api({ method: 'DELETE', path: `/contatos/${id}${lgpd ? '?lgpd=true' : ''}` });
      router.push('/contatos');
    } catch (e) {
      setErro(mensagemErro(e));
      setExcluindo(false);
    }
  }

  return (
    <div>
      <Link
        href="/contatos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para contatos
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Editar contato</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Atualize os dados ou o consentimento (opt-in) deste cliente.
      </p>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando contato…
        </p>
      ) : erroCarga ? (
        <AlertErro>{erroCarga}</AlertErro>
      ) : contato ? (
        <>
          <ContatoForm
            inicial={contato}
            salvando={salvando}
            erroServidor={erro}
            textoBotao="Salvar alterações"
            onSalvar={salvar}
          />

          <div className="mt-10 max-w-lg rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <h2 className="text-sm font-semibold text-destructive">Excluir contato</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              O contato sai da lista e não recebe mais campanhas.
            </p>
            <label className="mt-3 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={lgpd}
                onChange={(e) => setLgpd(e.target.checked)}
                className="h-4 w-4 rounded accent-destructive"
              />
              Apagar definitivamente (direito ao esquecimento — LGPD)
            </label>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={excluir}
              disabled={excluindo}
              className="mt-3"
            >
              {excluindo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir contato
                </>
              )}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

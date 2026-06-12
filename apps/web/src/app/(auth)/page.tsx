'use client';

import { Check, FolderOpen, Megaphone, MessageSquare, Plug, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { buttonVariants } from '../../components/ui/button';
import { useAuth } from '../../lib/auth/context';
import { cn } from '../../lib/cn';

interface Progresso {
  canal: boolean;
  contatos: boolean;
  template: boolean;
  campanha: boolean;
}

export default function DashboardPage() {
  const { estado, api } = useAuth();
  const [prog, setProg] = useState<Progresso | null>(null);

  useEffect(() => {
    if (estado.tipo !== 'autenticado') return;
    let ativo = true;
    (async () => {
      async function tenta<T>(p: Promise<T>, fallback: T): Promise<T> {
        try {
          return await p;
        } catch {
          return fallback;
        }
      }
      const [wa, emails, contatos, templates, campanhas] = await Promise.all([
        tenta(api<{ status: string } | null>({ path: '/conexoes/whatsapp' }), null),
        tenta(api<{ status: string }[]>({ path: '/conexoes/email' }), []),
        tenta(api<{ paginacao: { total: number } }>({ path: '/contatos?porPagina=1' }), {
          paginacao: { total: 0 },
        }),
        tenta(api<unknown[]>({ path: '/templates' }), []),
        tenta(api<unknown[]>({ path: '/campanhas' }), []),
      ]);
      if (!ativo) return;
      const canal =
        (!!wa && wa.status === 'ATIVA') ||
        (Array.isArray(emails) && emails.some((e) => e.status === 'ATIVA'));
      setProg({
        canal,
        contatos: (contatos?.paginacao?.total ?? 0) > 0,
        template: Array.isArray(templates) && templates.length > 0,
        campanha: Array.isArray(campanhas) && campanhas.length > 0,
      });
    })();
    return () => {
      ativo = false;
    };
  }, [estado, api]);

  if (estado.tipo !== 'autenticado') return null;
  const { me } = estado;
  const plano = me.tenantAtual?.plano
    ? me.tenantAtual.plano.charAt(0) + me.tenantAtual.plano.slice(1).toLowerCase()
    : '';

  const passos = [
    {
      feito: prog?.canal ?? false,
      titulo: 'Conectar um canal',
      descricao: 'WhatsApp ou e-mail — é por onde as campanhas saem.',
      href: '/conexoes',
      cta: 'Conectar',
    },
    {
      feito: prog?.contatos ?? false,
      titulo: 'Trazer seus contatos',
      descricao: 'Importe sua planilha de clientes ou adicione um a um.',
      href: '/contatos',
      cta: 'Adicionar contatos',
    },
    {
      feito: prog?.template ?? false,
      titulo: 'Criar uma mensagem',
      descricao: 'O texto que será enviado (template de WhatsApp ou e-mail).',
      href: '/templates/novo',
      cta: 'Criar mensagem',
    },
    {
      feito: prog?.campanha ?? false,
      titulo: 'Criar e disparar a campanha',
      descricao: 'Junte a mensagem com um grupo de contatos e envie.',
      href: '/campanhas/nova',
      cta: 'Nova campanha',
    },
  ];
  const concluidos = passos.filter((p) => p.feito).length;
  const proximo = passos.find((p) => !p.feito);

  return (
    <div>
      <h1 className="text-3xl font-bold">Início</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {me.tenantAtual?.razaoSocial}
        {plano ? ` · plano ${plano}` : ''}
      </p>

      <section className="mt-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Comece por aqui</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {concluidos} de 4 concluídos
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Quatro passos para enviar sua primeira campanha.
        </p>

        <ol className="mt-4 space-y-2">
          {passos.map((p, i) => {
            const ehProximo = !p.feito && proximo === p;
            return (
              <li
                key={p.titulo}
                className={cn(
                  'flex items-center gap-3 rounded-md border p-3 transition-colors',
                  ehProximo && 'border-primary bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium',
                    p.feito
                      ? 'bg-green-600 text-white'
                      : ehProximo
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {p.feito ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'text-sm font-medium',
                      p.feito && 'text-muted-foreground line-through',
                    )}
                  >
                    {p.titulo}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.descricao}</div>
                </div>
                {!p.feito && (
                  <Link
                    href={p.href}
                    className={cn(
                      buttonVariants({ variant: ehProximo ? 'default' : 'outline', size: 'sm' }),
                      'shrink-0',
                    )}
                  >
                    {p.cta}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Atalhos</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Atalho href="/campanhas" titulo="Campanhas" descricao="Criar e disparar." icone={Megaphone} />
          <Atalho href="/contatos" titulo="Contatos" descricao="Sua base de clientes." icone={Users} />
          <Atalho href="/segmentos" titulo="Grupos" descricao="Quem vai receber." icone={FolderOpen} />
          <Atalho href="/templates" titulo="Mensagens" descricao="O que você envia." icone={MessageSquare} />
          <Atalho href="/conexoes" titulo="Conexões" descricao="WhatsApp e e-mail." icone={Plug} />
        </div>
      </section>
    </div>
  );
}

function Atalho({
  href,
  titulo,
  descricao,
  icone: Icone,
}: {
  href: string;
  titulo: string;
  descricao: string;
  icone: typeof Megaphone;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:border-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Icone className="h-5 w-5 text-primary" />
      <div className="mt-2 text-sm font-medium">{titulo}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{descricao}</div>
    </Link>
  );
}

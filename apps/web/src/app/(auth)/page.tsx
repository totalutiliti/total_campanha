'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth/context';

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
      <h1 className="text-2xl font-semibold">Início</h1>
      <p className="text-sm text-gray-600 mt-1">
        {me.tenantAtual?.razaoSocial}
        {plano ? ` · plano ${plano}` : ''}
      </p>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-medium">Comece por aqui</h2>
          <span className="text-xs text-gray-500 tabular-nums">{concluidos} de 4 concluídos</span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Quatro passos para enviar sua primeira campanha.
        </p>

        <ol className="mt-4 space-y-2">
          {passos.map((p, i) => {
            const ehProximo = !p.feito && proximo === p;
            return (
              <li
                key={p.titulo}
                className={`flex items-center gap-3 rounded-md border p-3 ${
                  ehProximo ? 'border-gray-900' : 'border-gray-200'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                    p.feito
                      ? 'bg-green-600 text-white'
                      : ehProximo
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {p.feito ? '✓' : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${p.feito ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {p.titulo}
                  </div>
                  <div className="text-xs text-gray-500">{p.descricao}</div>
                </div>
                {!p.feito && (
                  <Link
                    href={p.href}
                    className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
                      ehProximo
                        ? 'bg-gray-900 text-white hover:bg-gray-700'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
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
        <h2 className="text-sm font-medium text-gray-700 mb-2">Atalhos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Card href="/campanhas" titulo="Campanhas" descricao="Criar e disparar." />
          <Card href="/contatos" titulo="Contatos" descricao="Sua base de clientes." />
          <Card href="/segmentos" titulo="Segmentos" descricao="Grupos para enviar." />
          <Card href="/templates" titulo="Templates" descricao="Suas mensagens." />
          <Card href="/conexoes" titulo="Conexões" descricao="WhatsApp e e-mail." />
        </div>
      </section>
    </div>
  );
}

function Card({ href, titulo, descricao }: { href: string; titulo: string; descricao: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-900 transition"
    >
      <div className="font-medium">{titulo}</div>
      <div className="text-xs text-gray-500 mt-1">{descricao}</div>
    </Link>
  );
}

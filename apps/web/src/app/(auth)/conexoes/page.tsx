'use client';

import { Loader2, Mail, MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { buttonVariants } from '../../../components/ui/button';
import { useAuth } from '../../../lib/auth/context';
import { cn } from '../../../lib/cn';

interface ConexaoWhatsapp {
  id: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  status: string;
  qualityRating: string | null;
  webhook: { url: string; secret: string };
}

interface ConexaoEmail {
  id: string;
  dominio: string;
  remetente: string;
  status: string;
  dkimStatus: string;
}

/** Rótulo amigável + cores (com par dark:) para o status de uma conexão. */
function statusConexao(status: string): { label: string; classe: string } {
  switch (status) {
    case 'ATIVA':
      return {
        label: 'Ativa',
        classe: 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300',
      };
    case 'PENDENTE_VERIFICACAO':
      return {
        label: 'Verificando',
        classe: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300',
      };
    case 'SUSPENSA':
      return {
        label: 'Suspensa',
        classe: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300',
      };
    case 'ERRO':
      return {
        label: 'Erro',
        classe: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
      };
    default:
      return {
        label: status,
        classe: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      };
  }
}

export default function ConexoesPage() {
  const { api } = useAuth();
  const [wa, setWa] = useState<ConexaoWhatsapp | null | 'sem'>(null);
  const [emails, setEmails] = useState<ConexaoEmail[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const w = await api<ConexaoWhatsapp>({ path: '/conexoes/whatsapp' });
        setWa(w);
      } catch (e) {
        const err = e as { status?: number };
        if (err.status === 404) setWa('sem');
      }
      try {
        setEmails(await api<ConexaoEmail[]>({ path: '/conexoes/email' }));
      } catch {
        setEmails([]);
      }
    })();
  }, [api]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Conexões</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os canais por onde suas campanhas saem: o WhatsApp e o e-mail da sua empresa.
        </p>
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5 text-primary" />
          WhatsApp
        </h2>
        {wa === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </p>
        ) : wa === 'sem' ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm font-medium">Ainda sem WhatsApp conectado.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Conecte a conta WhatsApp Business da sua empresa para disparar campanhas por
              WhatsApp.
            </p>
            <Link
              href="/conexoes/whatsapp/novo"
              className={cn(buttonVariants(), 'mt-4 gap-2')}
            >
              <Plus className="h-4 w-4" />
              Conectar WhatsApp
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <Item label="Número">{wa.displayPhoneNumber || '—'}</Item>
              <Item label="Status">
                <Badge
                  variant="outline"
                  className={cn('border-transparent', statusConexao(wa.status).classe)}
                >
                  {statusConexao(wa.status).label}
                </Badge>
              </Item>
              <Item label="WABA ID">{wa.wabaId}</Item>
              <Item label="Qualidade">{wa.qualityRating ?? '—'}</Item>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Mail className="h-5 w-5 text-primary" />
            E-mail
          </h2>
          {emails !== null && emails.length > 0 && (
            <Link
              href="/conexoes/email/novo"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}
            >
              <Plus className="h-4 w-4" />
              Conectar outro e-mail
            </Link>
          )}
        </div>
        {emails === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </p>
        ) : emails.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm font-medium">Ainda sem e-mail conectado.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Conecte o domínio do seu e-mail para disparar campanhas por e-mail.
            </p>
            <Link href="/conexoes/email/novo" className={cn(buttonVariants(), 'mt-4 gap-2')}>
              <Plus className="h-4 w-4" />
              Conectar e-mail
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {emails.map((c) => {
              const st = statusConexao(c.status);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 text-sm text-card-foreground shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.dominio}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.remetente}</div>
                  </div>
                  <Badge variant="outline" className={cn('shrink-0 border-transparent', st.classe)}>
                    {st.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{children}</div>
    </div>
  );
}

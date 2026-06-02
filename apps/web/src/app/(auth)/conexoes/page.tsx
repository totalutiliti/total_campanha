'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '../../../lib/auth/context';

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
      <h1 className="text-2xl font-semibold">Conexões</h1>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium">WhatsApp</h2>
          {wa === 'sem' && (
            <Link
              href="/conexoes/whatsapp/novo"
              className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium"
            >
              Conectar
            </Link>
          )}
        </div>
        {wa === null ? (
          <p className="text-sm text-gray-500">carregando…</p>
        ) : wa === 'sem' ? (
          <p className="text-sm text-gray-500">
            Ainda sem WhatsApp conectado. Conecte a conta WhatsApp Business da sua empresa para
            disparar campanhas por WhatsApp.
          </p>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <Item label="Número">{wa.displayPhoneNumber || '—'}</Item>
              <Item label="Status">{wa.status}</Item>
              <Item label="WABA ID">{wa.wabaId}</Item>
              <Item label="Quality">{wa.qualityRating ?? '—'}</Item>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium">E-mail</h2>
          <Link
            href="/conexoes/email/novo"
            className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium"
          >
            Conectar e-mail
          </Link>
        </div>
        {emails === null ? (
          <p className="text-sm text-gray-500">carregando…</p>
        ) : emails.length === 0 ? (
          <p className="text-sm text-gray-500">
            Ainda sem e-mail conectado. Conecte o domínio do seu e-mail para disparar campanhas
            por e-mail.
          </p>
        ) : (
          <ul className="space-y-2">
            {emails.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-gray-200 bg-white p-3 text-sm flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{c.dominio}</div>
                  <div className="text-xs text-gray-500">{c.remetente}</div>
                </div>
                <div className="text-xs">
                  <span
                    className={`rounded px-2 py-0.5 ${c.status === 'ATIVA' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
                  >
                    {c.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

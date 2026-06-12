'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth/context';

interface BillingAtual {
  status: 'TRIAL' | 'ATIVO' | 'INADIMPLENTE' | 'SUSPENSO' | 'CANCELADO';
  trialAteEm: string | null;
  linkPagamento: string | null;
}

/**
 * Faixa de estado da conta no topo do app — linguagem direta para o vendedor
 * saber o que está acontecendo e (se for admin) o que fazer.
 */
export function BannerConta({ isAdmin }: { isAdmin: boolean }) {
  const { api } = useAuth();
  const [billing, setBilling] = useState<BillingAtual | null>(null);

  useEffect(() => {
    let ativo = true;
    api<BillingAtual>({ method: 'GET', path: '/billing/atual' })
      .then((b) => {
        if (ativo) setBilling(b);
      })
      .catch(() => {
        // Sem billing não bloqueia o app — banner simplesmente não aparece.
      });
    return () => {
      ativo = false;
    };
  }, [api]);

  if (!billing) return null;

  if (billing.status === 'TRIAL' && billing.trialAteEm) {
    const dias = Math.ceil(
      (new Date(billing.trialAteEm).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    if (dias > 7 || dias < 0) return null; // longe do fim (ou já virou INADIMPLENTE no servidor)
    return (
      <div className="border-b border-yellow-500/30 bg-yellow-50 px-4 py-2 text-center text-sm text-yellow-900 dark:bg-yellow-950/20 dark:text-yellow-200">
        Seu período de teste termina em <strong>{dias === 0 ? 'hoje' : `${dias} dia${dias === 1 ? '' : 's'}`}</strong>.
        {isAdmin ? (
          <>
            {' '}
            <Link href="/plano" className="font-semibold underline">
              Escolha um plano
            </Link>{' '}
            para não parar de enviar.
          </>
        ) : (
          ' Avise o administrador da conta.'
        )}
      </div>
    );
  }

  if (billing.status === 'INADIMPLENTE') {
    return (
      <div className="border-b border-red-500/30 bg-red-50 px-4 py-2 text-center text-sm text-red-800 dark:bg-red-950/20 dark:text-red-300">
        O pagamento da conta está pendente — os envios estão pausados.
        {isAdmin ? (
          <>
            {' '}
            {billing.linkPagamento ? (
              <a
                href={billing.linkPagamento}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                Pagar agora
              </a>
            ) : (
              <Link href="/plano" className="font-semibold underline">
                Regularizar na página Plano
              </Link>
            )}
            .
          </>
        ) : (
          ' Avise o administrador da conta.'
        )}
      </div>
    );
  }

  return null;
}

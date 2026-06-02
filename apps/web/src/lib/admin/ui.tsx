import type { ReactNode } from 'react';

import { statusTenant } from './format';

/** Cartão de estatística (número grande). */
export function EstatCartao({
  titulo,
  valor,
  sub,
}: {
  titulo: string;
  valor: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{valor}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

/** Badge de status do tenant (Ativo / Em teste / Suspenso). */
export function BadgeStatusTenant({ status }: { status: string }) {
  const s = statusTenant(status);
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${s.classe}`}>
      {s.label}
    </span>
  );
}

/** Mensagem de erro padrão. */
export function MensagemErro({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{children}</p>
  );
}

/** Estado vazio em caixa tracejada. */
export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-600">
      {children}
    </div>
  );
}

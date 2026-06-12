import type { ReactNode } from 'react';

import { AlertErro } from '../../components/ui/alerts';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';

import { statusTenant } from './format';

/** Cartão de estatística (número grande) no padrão de KPI da identidade. */
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
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{valor}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </Card>
  );
}

/** Badge de status do tenant (verde=ativo, amarelo=em teste, vermelho=suspenso). */
export function BadgeStatusTenant({ status }: { status: string }) {
  const s = statusTenant(status);
  return <Badge className={s.classe}>{s.label}</Badge>;
}

/** Mensagem de erro padrão — alert de erro do kit da identidade. */
export function MensagemErro({ children }: { children: ReactNode }) {
  return <AlertErro>{children}</AlertErro>;
}

/** Estado vazio em caixa tracejada. */
export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

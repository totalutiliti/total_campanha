import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/cn';

/** Alerts inline da identidade (erro/sucesso/aviso) — usar acima do submit. */

export function AlertErro({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2',
        'dark:bg-red-950/20 dark:border-red-900 dark:text-red-400',
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function AlertSucesso({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2',
        className,
      )}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function AlertAviso({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 p-4 flex items-start gap-2 text-sm',
        className,
      )}
    >
      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}

'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** max-w-lg por padrão; passe ex. 'max-w-2xl' para conteúdo largo. */
  className?: string;
}

const DialogA11yContext = React.createContext<{ tituloId: string; descricaoId: string } | null>(
  null,
);

/**
 * Modal próprio da identidade (sem Radix). Overlay bg-black/50, clicar fora
 * fecha, X no canto. Combine com DialogHeader/DialogFooter abaixo.
 */
export function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const focoAnteriorRef = React.useRef<HTMLElement | null>(null);
  const tituloId = React.useId();
  const descricaoId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    focoAnteriorRef.current = document.activeElement as HTMLElement | null;
    const focoTimer = window.setTimeout(() => {
      const primeiro = contentRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      primeiro?.focus();
    }, 0);
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
      if (e.key !== 'Tab' || !contentRef.current) return;
      const focaveis = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(focoTimer);
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
      focoAnteriorRef.current?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          aria-describedby={descricaoId}
          className={cn(
            'relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            className,
          )}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <DialogA11yContext.Provider value={{ tituloId, descricaoId }}>
            {children}
          </DialogA11yContext.Provider>
        </div>
      </div>
    </div>
  );
}

export function DialogHeader({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao?: string;
}) {
  const ids = React.useContext(DialogA11yContext);
  return (
    <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
      <h2 id={ids?.tituloId} className="text-lg font-semibold">
        {titulo}
      </h2>
      {descricao ? (
        <p id={ids?.descricaoId} className="text-sm text-muted-foreground">
          {descricao}
        </p>
      ) : null}
    </div>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6 gap-2 sm:gap-0">
      {children}
    </div>
  );
}

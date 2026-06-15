'use client';

import { Image as ImageIcon, Lightbulb } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { cn } from '../../lib/cn';

/**
 * Blocos de montagem do Manual (passo a passo, capturas de tela, dicas).
 * Visual alinhado à identidade Total (tokens semânticos, sem hex cru).
 */

/** Passo numerado dentro de uma lista `<ol>` (use com `<Passos>`). */
export function Passo({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <li className="relative pl-11">
      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold tabular-nums text-primary-foreground">
        {n}
      </span>
      <h4 className="text-base font-semibold leading-8">{titulo}</h4>
      <div className="mt-1 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </li>
  );
}

/** Wrapper da lista de passos. */
export function Passos({ children }: { children: ReactNode }) {
  return <ol className="space-y-6">{children}</ol>;
}

/**
 * Slot de captura de tela. Enquanto não houver imagem em `src` (ou se ela
 * falhar ao carregar), mostra um placeholder com a legenda — assim o manual
 * já fica completo e os prints podem ser adicionados depois em `public/manual/`.
 */
export function Figura({ src, legenda, alt }: { src?: string; legenda: string; alt?: string }) {
  const [erro, setErro] = useState(false);
  const mostrarImagem = Boolean(src) && !erro;

  return (
    <figure className="my-4 overflow-hidden rounded-lg border bg-muted/30">
      {mostrarImagem ? (
        <img
          src={src}
          alt={alt ?? legenda}
          onError={() => setErro(true)}
          className="block w-full"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          <span className="text-xs font-medium text-muted-foreground">
            Captura de tela em breve
          </span>
        </div>
      )}
      <figcaption className="border-t bg-card px-3 py-2 text-xs text-muted-foreground">
        {legenda}
      </figcaption>
    </figure>
  );
}

/** Caixa de dica (positiva, cor primária). */
export function Dica({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
      <Lightbulb className="h-5 w-5 shrink-0 text-primary" />
      <div className="[&_strong]:font-semibold [&_strong]:text-foreground">{children}</div>
    </div>
  );
}

/** Termo/rótulo da interface citado no texto (ex.: o botão **Conectar**). */
export function UI({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border bg-muted px-1.5 py-0.5 text-[0.8em] font-medium text-foreground">
      {children}
    </span>
  );
}

/** Título de subseção dentro do conteúdo de uma seção. */
export function Subtitulo({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-lg font-semibold tracking-tight', className)}>{children}</h3>;
}

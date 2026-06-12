import * as React from 'react';

/**
 * Logo Total Utiliti — réplica fiel do logotipo do site oficial
 * (www.totalutiliti.com.br): quadrado arredondado com gradiente
 * cyan #00E5FF → electric #00B4D8 e o glifo T/U em navy #0A1628
 * (cores FIXAS da marca, independem do tema). O wordmark usa
 * currentColor e se adapta ao tema claro/escuro.
 *
 * Dimensione pela altura (ex.: className="h-8 w-auto").
 */
export function LogoTotal({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 48"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Total Utiliti"
    >
      <defs>
        <linearGradient id="tu-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00E5FF" />
          <stop offset="1" stopColor="#00B4D8" />
        </linearGradient>
      </defs>

      {/* Ícone: container arredondado com gradiente da marca */}
      <rect x="0" y="4" width="40" height="40" rx="8" fill="url(#tu-grad)" />
      {/* Glifo T/U do site (viewBox original 100×100, escalado para 28×28 centrado) */}
      <g transform="translate(6 10) scale(0.28)" fill="#0A1628">
        <path d="M 10 10 L 90 10 L 90 34 L 62 34 L 62 66 L 38 66 L 38 34 L 10 34 Z" />
        <path d="M 10 38 L 34 38 L 34 70 L 66 70 L 66 38 L 90 38 L 90 82 C 90 88.627 84.627 94 78 94 L 22 94 C 15.373 94 10 88.627 10 82 Z" />
      </g>

      {/* Wordmark — bold, adapta ao tema via currentColor */}
      <text
        x="50"
        y="31.5"
        fontFamily="Inter, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
        fontSize="21"
        fontWeight="700"
        fill="currentColor"
      >
        Total Utiliti
      </text>
    </svg>
  );
}

import * as React from 'react';

/**
 * Logo Total Campanha — derivada do componente canônico da família "total"
 * (skill identidade-visual-totalia): 3 barras de gráfico em verde crescente
 * (#2ECC71 / #27AE60 / #1B7A3D — cores FIXAS, independem do tema) + wordmark.
 * O texto usa currentColor e se adapta ao tema.
 */
export function LogoTotal({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 158 50"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Total Campanha"
    >
      <rect x="0" y="28" width="9" height="20" rx="1.5" fill="#2ECC71" />
      <rect x="12" y="18" width="9" height="30" rx="1.5" fill="#27AE60" />
      <rect x="24" y="6" width="9" height="42" rx="1.5" fill="#1B7A3D" />
      <text
        x="40"
        y="34"
        fontFamily="Inter, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
        fontSize="28"
        fontWeight="800"
        fill="currentColor"
      >
        total
      </text>
      <text
        x="40"
        y="47"
        fontFamily="Inter, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif"
        fontSize="9.5"
        fontWeight="800"
        fill="#2ECC71"
        letterSpacing="2"
      >
        CAMPANHA
      </text>
    </svg>
  );
}

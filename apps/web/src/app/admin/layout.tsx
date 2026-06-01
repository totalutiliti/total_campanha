import type { ReactNode } from 'react';

import { AdminAuthProvider } from '../../lib/admin/context';

/**
 * Layout raiz do escopo Super Admin (/admin/*).
 * Apenas provê o AdminAuthProvider — a guarda + chrome ficam no layout do
 * grupo (painel). A tela de login (/admin/login) usa o provider mas não é
 * guardada.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}

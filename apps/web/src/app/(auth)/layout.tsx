import { AuthProvider } from '../../lib/auth/context';

import { GuardiaoAuth } from './guardiao-auth';

/**
 * Layout das páginas autenticadas (route group `(auth)`).
 * - Envolve o subtree no AuthProvider.
 * - Delega a guarda + chrome ao componente client GuardiaoAuth.
 */
export default function AuthRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GuardiaoAuth>{children}</GuardiaoAuth>
    </AuthProvider>
  );
}

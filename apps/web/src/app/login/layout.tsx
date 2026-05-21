import { AuthProvider } from '../../lib/auth/context';

/**
 * Login envolve o AuthProvider porque depois do login bem-sucedido a página
 * redireciona para `/` (autenticado) e o provider já tem o estado pronto.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

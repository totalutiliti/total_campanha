import { notFound } from 'next/navigation';

import { apiGet } from '../../../../lib/api';

import { OptInForm } from './opt-in-form';

interface PageProps {
  params: { tenantSlug: string };
}

interface TenantLanding {
  slug: string;
  razaoSocial: string;
}

// Página pública — sem rastreadores, sem analytics, sem cookies (LGPD).
export default async function OptInPage({ params }: PageProps) {
  let tenant: TenantLanding;
  try {
    tenant = await apiGet<TenantLanding>(`/p/opt-in/${encodeURIComponent(params.tenantSlug)}`);
  } catch {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 flex items-start justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold leading-tight">{tenant.razaoSocial}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Cadastre-se para receber novidades e promoções. Você pode cancelar a qualquer momento.
          </p>
        </header>
        <OptInForm tenantSlug={tenant.slug} razaoSocial={tenant.razaoSocial} />
        <footer className="mt-8 text-xs text-gray-500">
          Seus dados serão tratados conforme a LGPD. Operador: TotalUtiliti / {tenant.razaoSocial}.
        </footer>
      </div>
    </main>
  );
}

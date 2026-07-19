import { notFound } from 'next/navigation';

import { Card, CardContent, CardHeader } from '../../../../components/ui/card';
import { apiGet } from '../../../../lib/api';

import { OptInForm } from './opt-in-form';

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

interface TenantLanding {
  slug: string;
  razaoSocial: string;
}

// Página pública — sem rastreadores, sem analytics, sem cookies (LGPD).
// A página é do TENANT: o nome da empresa dele é o título (sem logo da plataforma).
export default async function OptInPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  let tenant: TenantLanding;
  try {
    tenant = await apiGet<TenantLanding>(`/p/opt-in/${encodeURIComponent(tenantSlug)}`);
  } catch {
    notFound();
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-muted/40 px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Card className="shadow-sm">
          <CardHeader>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              {tenant.razaoSocial}
            </h1>
            <p className="text-sm text-muted-foreground">
              Cadastre-se para receber novidades e promoções. Você pode cancelar a qualquer
              momento.
            </p>
          </CardHeader>
          <CardContent>
            <OptInForm tenantSlug={tenant.slug} razaoSocial={tenant.razaoSocial} />
          </CardContent>
        </Card>
        <footer className="mt-6 text-center text-xs text-muted-foreground">
          Seus dados serão tratados conforme a LGPD. Operador: TotalUtiliti / {tenant.razaoSocial}.
        </footer>
      </div>
    </main>
  );
}

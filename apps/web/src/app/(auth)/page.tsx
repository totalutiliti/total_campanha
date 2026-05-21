'use client';

import Link from 'next/link';

import { useAuth } from '../../lib/auth/context';

export default function DashboardPage() {
  const { estado } = useAuth();
  if (estado.tipo !== 'autenticado') return null;
  const { me } = estado;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Olá, {me.email.split('@')[0]}</h1>
      <p className="text-sm text-gray-600 mt-1">
        Tenant: <strong>{me.tenantAtual?.razaoSocial}</strong> ({me.tenantAtual?.plano}).
        Role: {me.role}.
      </p>

      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card href="/contatos" titulo="Contatos" descricao="Gerencie sua base de contatos." />
        <Card href="/segmentos" titulo="Segmentos" descricao="Filtros para campanhas." />
        <Card href="/templates" titulo="Templates" descricao="Email e WhatsApp." />
        <Card href="/conexoes" titulo="Conexões" descricao="Configure WhatsApp e Email." />
      </section>
    </div>
  );
}

function Card({ href, titulo, descricao }: { href: string; titulo: string; descricao: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-900 transition"
    >
      <div className="font-medium">{titulo}</div>
      <div className="text-xs text-gray-500 mt-1">{descricao}</div>
    </Link>
  );
}

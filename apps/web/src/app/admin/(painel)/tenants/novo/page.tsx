'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useAdminAuth } from '../../../../../lib/admin/context';
import { MensagemErro } from '../../../../../lib/admin/ui';

interface TenantCriado {
  id: string;
  slug: string;
  razaoSocial: string;
  emailAdmin: string;
  senhaTemporaria: string;
}

const INPUT_CLS =
  'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none';

// Range de marcas diacríticas combinantes (U+0300–U+036F) montado via RegExp
// de string para manter o código em ASCII puro.
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function NovoTenantPage() {
  const { api } = useAdminAuth();

  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [emailAdmin, setEmailAdmin] = useState('');
  const [plano, setPlano] = useState('STARTER');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [criado, setCriado] = useState<TenantCriado | null>(null);
  const [copiado, setCopiado] = useState(false);

  function aoMudarRazao(v: string) {
    setRazaoSocial(v);
    if (!slugTocado) setSlug(slugify(v));
  }

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) {
      setErro('CNPJ deve ter 14 dígitos.');
      return;
    }
    setEnviando(true);
    try {
      const r = await api<TenantCriado>({
        method: 'POST',
        path: '/admin/tenants',
        body: {
          razaoSocial: razaoSocial.trim(),
          cnpj: cnpjLimpo,
          slug: slug.trim(),
          emailAdmin: emailAdmin.trim(),
          plano,
        },
      });
      setCriado(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar o tenant.');
    } finally {
      setEnviando(false);
    }
  }

  async function copiarSenha() {
    if (!criado) return;
    try {
      await navigator.clipboard.writeText(criado.senhaTemporaria);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard pode estar bloqueado — o operador copia manualmente
    }
  }

  function recomecar() {
    setCriado(null);
    setRazaoSocial('');
    setCnpj('');
    setSlug('');
    setSlugTocado(false);
    setEmailAdmin('');
    setPlano('STARTER');
  }

  if (criado) {
    return (
      <div className="max-w-xl space-y-5">
        <Link href="/admin/tenants" className="text-sm text-gray-500 hover:text-gray-700">
          ← Tenants
        </Link>

        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h1 className="text-lg font-semibold text-green-900">Tenant criado ✓</h1>
          <p className="mt-1 text-sm text-green-800">
            <strong>{criado.razaoSocial}</strong> ({criado.slug}) foi criado com o administrador{' '}
            <strong>{criado.emailAdmin}</strong>.
          </p>
        </div>

        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Senha temporária (aparece só agora)</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded border border-amber-300 bg-white px-3 py-2 text-sm font-mono break-all">
              {criado.senhaTemporaria}
            </code>
            <button
              type="button"
              onClick={copiarSenha}
              className="shrink-0 rounded-md bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-gray-800"
            >
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-800">
            Repasse com segurança ao cliente e oriente a trocar no primeiro acesso (link “Esqueci a
            senha” na tela de login). Não será exibida de novo.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/admin/tenants/${criado.id}`}
            className="rounded-md bg-gray-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-gray-800"
          >
            Ver tenant
          </Link>
          <button
            type="button"
            onClick={recomecar}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Criar outro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <Link href="/admin/tenants" className="text-sm text-gray-500 hover:text-gray-700">
        ← Tenants
      </Link>
      <h1 className="text-2xl font-semibold mt-2 mb-4">Novo tenant</h1>

      {erro && (
        <div className="mb-3">
          <MensagemErro>{erro}</MensagemErro>
        </div>
      )}

      <form onSubmit={aoSubmeter} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-900">Razão social</span>
          <input
            value={razaoSocial}
            onChange={(e) => aoMudarRazao(e.target.value)}
            required
            className={INPUT_CLS}
            placeholder="Cardans Tencar Autopeças LTDA"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-900">CNPJ</span>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            required
            inputMode="numeric"
            className={INPUT_CLS}
            placeholder="11.222.333/0001-44"
          />
          <p className="mt-1 text-xs text-gray-500">
            14 dígitos. Pode digitar com pontuação — só os números são usados.
          </p>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-900">Identificador (slug)</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTocado(true);
            }}
            required
            className={INPUT_CLS}
            placeholder="cardanstencar"
          />
          <p className="mt-1 text-xs text-gray-500">
            Letras minúsculas, números e hífen. Vira parte de links (ex.: páginas de opt-in).
          </p>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-900">E-mail do administrador</span>
          <input
            type="email"
            value={emailAdmin}
            onChange={(e) => setEmailAdmin(e.target.value)}
            required
            className={INPUT_CLS}
            placeholder="dono@empresa.com.br"
          />
          <p className="mt-1 text-xs text-gray-500">
            Vira o primeiro usuário (papel Administrador) e recebe a senha temporária.
          </p>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-900">Plano</span>
          <select value={plano} onChange={(e) => setPlano(e.target.value)} className={INPUT_CLS}>
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">Começa em teste (TRIAL) por 14 dias.</p>
        </label>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {enviando ? 'Criando…' : 'Criar tenant'}
          </button>
          <Link
            href="/admin/tenants"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

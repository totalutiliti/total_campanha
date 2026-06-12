'use client';

import { Check, Copy, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { AlertAviso, AlertSucesso } from '../../../../../components/ui/alerts';
import { Button, buttonVariants } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { Label } from '../../../../../components/ui/label';
import { useAdminAuth } from '../../../../../lib/admin/context';
import { MensagemErro } from '../../../../../lib/admin/ui';
import { cn } from '../../../../../lib/cn';
import { mensagemErro } from '../../../../../lib/erro';

interface TenantCriado {
  id: string;
  slug: string;
  razaoSocial: string;
  emailAdmin: string;
  senhaTemporaria: string;
}

/** Select nativo com as mesmas classes de token do Input do kit. */
const SELECT_CLS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

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
      setErro(mensagemErro(e, 'Falha ao criar o tenant.'));
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
        <Link
          href="/admin/tenants"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Tenants
        </Link>

        <AlertSucesso>
          <h1 className="text-base font-semibold">Tenant criado!</h1>
          <p className="mt-1">
            <strong>{criado.razaoSocial}</strong> ({criado.slug}) foi criado com o administrador{' '}
            <strong>{criado.emailAdmin}</strong>.
          </p>
        </AlertSucesso>

        <AlertAviso>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Senha temporária (aparece só agora)</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm break-all">
                {criado.senhaTemporaria}
              </code>
              <Button type="button" size="sm" onClick={copiarSenha} className="shrink-0 gap-2">
                {copiado ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Repasse com segurança ao cliente e oriente a trocar no primeiro acesso (link “Esqueci
              a senha” na tela de login). Não será exibida de novo.
            </p>
          </div>
        </AlertAviso>

        <div className="flex gap-2">
          <Link href={`/admin/tenants/${criado.id}`} className={cn(buttonVariants({ size: 'sm' }))}>
            Ver tenant
          </Link>
          <Button type="button" variant="outline" size="sm" onClick={recomecar}>
            Criar outro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <Link
        href="/admin/tenants"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Tenants
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mt-2 mb-4">Novo tenant</h1>

      {erro && (
        <div className="mb-3">
          <MensagemErro>{erro}</MensagemErro>
        </div>
      )}

      <form onSubmit={aoSubmeter} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="razao-social">Razão social</Label>
          <Input
            id="razao-social"
            value={razaoSocial}
            onChange={(e) => aoMudarRazao(e.target.value)}
            required
            placeholder="Cardans Tencar Autopeças LTDA"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            required
            inputMode="numeric"
            placeholder="11.222.333/0001-44"
          />
          <p className="text-xs text-muted-foreground">
            14 dígitos. Pode digitar com pontuação — só os números são usados.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Identificador (slug)</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTocado(true);
            }}
            required
            placeholder="cardanstencar"
          />
          <p className="text-xs text-muted-foreground">
            Letras minúsculas, números e hífen. Vira parte de links (ex.: páginas de opt-in).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email-admin">E-mail do administrador</Label>
          <Input
            id="email-admin"
            type="email"
            value={emailAdmin}
            onChange={(e) => setEmailAdmin(e.target.value)}
            required
            placeholder="dono@empresa.com.br"
          />
          <p className="text-xs text-muted-foreground">
            Vira o primeiro usuário (papel Administrador) e recebe a senha temporária.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="plano">Plano</Label>
          <select
            id="plano"
            value={plano}
            onChange={(e) => setPlano(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="STARTER">Starter</option>
            <option value="PRO">Pro</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
          <p className="text-xs text-muted-foreground">Começa em teste (TRIAL) por 14 dias.</p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={enviando}>
            {enviando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando…
              </>
            ) : (
              'Criar tenant'
            )}
          </Button>
          <Link href="/admin/tenants" className={cn(buttonVariants({ variant: 'outline' }))}>
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

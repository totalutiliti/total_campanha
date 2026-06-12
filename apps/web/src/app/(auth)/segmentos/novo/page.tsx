'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FiltroBuilderComPreview } from '../../../../components/segmentos/filtro-builder';
import { grupoVazio, Grupo } from '../../../../components/segmentos/filtros-tipos';
import { AlertErro } from '../../../../components/ui/alerts';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { useAuth } from '../../../../lib/auth/context';
import { mensagemErro } from '../../../../lib/erro';

export default function NovoSegmentoPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [nome, setNome] = useState('');
  const [filtros, setFiltros] = useState<Grupo>(grupoVazio);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api({
        method: 'POST',
        path: '/segmentos',
        body: { nome, filtros },
      });
      router.replace('/segmentos');
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <Link
        href="/segmentos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para grupos
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Novo grupo</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Monte as regras (tags, opt-in, dados do contato) e veja na hora quantos contatos entram.
      </p>

      <form onSubmit={salvar} className="space-y-4">
        <div className="max-w-lg space-y-2">
          <Label htmlFor="nome">Nome do grupo</Label>
          <Input
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            maxLength={120}
            placeholder="Clientes da região oeste"
          />
        </div>

        <FiltroBuilderComPreview
          valor={filtros}
          onChange={setFiltros}
          fetchPreview={(g) => api({ method: 'POST', path: '/segmentos/previa', body: { filtros: g } })}
        />

        {erro && <AlertErro>{erro}</AlertErro>}

        <div className="flex gap-2">
          <Button type="submit" disabled={enviando || !nome.trim()}>
            {enviando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              'Salvar grupo'
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

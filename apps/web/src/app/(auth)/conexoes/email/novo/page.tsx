'use client';

import { ArrowLeft, Check, Copy, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AlertErro, AlertSucesso } from '../../../../../components/ui/alerts';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { Label } from '../../../../../components/ui/label';
import { useAuth } from '../../../../../lib/auth/context';
import { mensagemErro } from '../../../../../lib/erro';

interface RegistroDns {
  tipo: 'CNAME' | 'TXT' | 'MX';
  nome: string;
  valor: string;
  descricao: string;
}

interface Resultado {
  id: string;
  dominio: string;
  remetente: string;
  status: string;
  registrosDns: RegistroDns[];
}

export default function NovaConexaoEmailPage() {
  const router = useRouter();
  const { api } = useAuth();
  const [dominio, setDominio] = useState('');
  const [remetente, setRemetente] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [copiou, setCopiou] = useState<number | null>(null);

  async function aoSubmeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await api<Resultado>({
        method: 'POST',
        path: '/conexoes/email',
        body: { dominio, remetente },
      });
      setResultado(r);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  function copiar(texto: string, idx: number) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiou(idx);
      setTimeout(() => setCopiou(null), 1500);
    });
  }

  if (resultado) {
    return (
      <div className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold">Conectar e-mail</h1>
        <AlertSucesso>
          E-mail cadastrado. Configure estes registros no seu provedor de domínio (Registro.br,
          Cloudflare, etc). A verificação pode levar de minutos a algumas horas.
        </AlertSucesso>

        <div className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Nome</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Valor</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {resultado.registrosDns.map((r, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">{r.tipo}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.nome}</td>
                  <td className="break-all px-3 py-2 font-mono text-xs">{r.valor}</td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copiar(r.valor, i)}
                      className="gap-2"
                    >
                      {copiou === i ? (
                        <>
                          <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar valor
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button type="button" variant="outline" onClick={() => router.push('/conexoes')}>
          Voltar para conexões
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/conexoes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para conexões
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Conectar e-mail</h1>
      <p className="mb-6 mt-1 max-w-md text-sm text-muted-foreground">
        Para enviar campanhas por e-mail você usa um domínio próprio (o que vem depois do @).
        Informe o domínio e o remetente; na etapa seguinte mostramos os registros para liberar o
        envio junto ao seu provedor de domínio.
      </p>

      <form onSubmit={aoSubmeter} className="max-w-md space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dominio">Domínio de envio</Label>
          <Input
            id="dominio"
            value={dominio}
            onChange={(e) => setDominio(e.target.value)}
            required
            placeholder="campanhas.suaempresa.com.br"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="remetente">Remetente (From)</Label>
          <Input
            id="remetente"
            type="email"
            value={remetente}
            onChange={(e) => setRemetente(e.target.value)}
            required
            placeholder="no-reply@campanhas.suaempresa.com.br"
          />
        </div>

        {erro && <AlertErro>{erro}</AlertErro>}

        <Button type="submit" disabled={enviando}>
          {enviando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Conectando…
            </>
          ) : (
            'Conectar e-mail'
          )}
        </Button>
      </form>
    </div>
  );
}

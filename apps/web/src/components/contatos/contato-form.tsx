'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '../../lib/cn';
import { paraE164 } from '../../lib/telefone';
import { AlertErro } from '../ui/alerts';
import { Button, buttonVariants } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface ContatoPayload {
  nome: string | null;
  email: string | null;
  telefoneE164: string | null;
  tags: string[];
  optInEmail: boolean;
  optInWhatsapp: boolean;
}

export interface ContatoInicial {
  nome?: string | null;
  email?: string | null;
  telefoneE164?: string | null;
  tags?: string[];
  optInEmail?: boolean;
  optInWhatsapp?: boolean;
}

/**
 * Formulário reutilizável de contato (criar e editar). Normaliza o telefone
 * para E.164 com a mesma função usada na importação, valida que há ao menos
 * e-mail ou telefone, e devolve um payload limpo para o caller persistir.
 */
export function ContatoForm({
  inicial,
  salvando,
  erroServidor,
  textoBotao,
  hrefCancelar = '/contatos',
  onSalvar,
}: {
  inicial?: ContatoInicial;
  salvando: boolean;
  erroServidor: string | null;
  textoBotao: string;
  hrefCancelar?: string;
  onSalvar: (p: ContatoPayload) => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [email, setEmail] = useState(inicial?.email ?? '');
  const [telefone, setTelefone] = useState(inicial?.telefoneE164 ?? '');
  const [tags, setTags] = useState((inicial?.tags ?? []).join(', '));
  const [optInEmail, setOptInEmail] = useState(inicial?.optInEmail ?? false);
  const [optInWhatsapp, setOptInWhatsapp] = useState(inicial?.optInWhatsapp ?? false);
  const [erro, setErro] = useState<string | null>(null);

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const emailLimpo = email.trim().toLowerCase();
    const telLimpo = telefone.trim();
    if (!emailLimpo && !telLimpo) {
      setErro('Informe ao menos um e-mail ou um telefone.');
      return;
    }
    let telefoneE164: string | null = null;
    if (telLimpo) {
      telefoneE164 = paraE164(telLimpo);
      if (!telefoneE164) {
        setErro('Telefone inválido. Use o DDD — ex.: (11) 98765-4321.');
        return;
      }
    }
    const tagsArr = Array.from(
      new Set(
        tags
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      ),
    );
    onSalvar({
      nome: nome.trim() || null,
      email: emailLimpo || null,
      telefoneE164,
      tags: tagsArr,
      optInEmail,
      optInWhatsapp,
    });
  }

  const mensagem = erro ?? erroServidor;

  return (
    <form onSubmit={submeter} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="contato-nome">Nome</Label>
        <Input
          id="contato-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Auto Peças Silva"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contato-email">E-mail</Label>
        <Input
          id="contato-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contato@empresa.com.br"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contato-telefone">Telefone (com DDD)</Label>
        <Input
          id="contato-telefone"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(11) 98765-4321"
          inputMode="tel"
        />
        <p className="text-xs text-muted-foreground">
          Pode digitar com parênteses e traços — ajustamos o formato automaticamente.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contato-tags">Tags</Label>
        <Input
          id="contato-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="cliente-ativo, regiao-oeste"
        />
        <p className="text-xs text-muted-foreground">
          Separe por vírgula. Use para criar grupos depois.
        </p>
      </div>

      <fieldset className="rounded-md border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          Pode receber campanhas por
        </legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={optInEmail}
              onChange={(e) => setOptInEmail(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            <span>E-mail</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={optInWhatsapp}
              onChange={(e) => setOptInWhatsapp(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            <span>WhatsApp</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Marque só se você tem o consentimento da pessoa (LGPD). Sem isso, ela não entra nas
          campanhas daquele canal.
        </p>
      </fieldset>

      {mensagem && <AlertErro>{mensagem}</AlertErro>}

      <div className="flex gap-2">
        <Button type="submit" disabled={salvando}>
          {salvando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando…
            </>
          ) : (
            textoBotao
          )}
        </Button>
        <a href={hrefCancelar} className={cn(buttonVariants({ variant: 'outline' }))}>
          Cancelar
        </a>
      </div>
    </form>
  );
}

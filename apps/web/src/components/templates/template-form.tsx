'use client';

import { Loader2, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { mjmlParaTexto, textoParaMjml } from '../../lib/template-email';
import { AlertAviso, AlertErro } from '../ui/alerts';
import { Button, buttonVariants } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface Variavel {
  key: string;
  exemplo: string;
}

export interface TemplatePayload {
  nome: string;
  assunto?: string;
  mjml?: string;
  metaTemplateName?: string;
  metaLanguage?: string;
  variaveis: Variavel[];
}

export interface TemplateInicial {
  nome?: string;
  assunto?: string | null;
  mjml?: string | null;
  metaTemplateName?: string | null;
  metaLanguage?: string | null;
  variaveis?: Variavel[];
}

const CHAVE_VALIDA = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const META_NOME_VALIDO = /^[a-z0-9_]+$/;

export function TemplateForm({
  canal,
  inicial,
  salvando,
  erroServidor,
  textoBotao,
  onSalvar,
  rodape,
}: {
  canal: 'EMAIL' | 'WHATSAPP';
  inicial?: TemplateInicial;
  salvando: boolean;
  erroServidor: string | null;
  textoBotao: string;
  onSalvar: (p: TemplatePayload) => void;
  rodape?: React.ReactNode;
}) {
  const textoInicial = mjmlParaTexto(inicial?.mjml);
  const avancado = !!inicial?.mjml && textoInicial === null;

  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [assunto, setAssunto] = useState(inicial?.assunto ?? '');
  const [mensagem, setMensagem] = useState(textoInicial ?? '');
  const [mjmlBruto, setMjmlBruto] = useState(inicial?.mjml ?? '');
  const [metaTemplateName, setMetaTemplateName] = useState(inicial?.metaTemplateName ?? '');
  const [metaLanguage, setMetaLanguage] = useState(inicial?.metaLanguage ?? 'pt_BR');
  const [variaveis, setVariaveis] = useState<Variavel[]>(inicial?.variaveis ?? []);
  const [erro, setErro] = useState<string | null>(null);

  function setVar(i: number, campo: keyof Variavel, valor: string) {
    setVariaveis((vs) => vs.map((v, j) => (j === i ? { ...v, [campo]: valor } : v)));
  }

  function submeter(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro('Dê um nome para o template (só para você se organizar).');
      return;
    }

    const vars = variaveis.map((v) => ({ key: v.key.trim(), exemplo: v.exemplo })).filter((v) => v.key);
    for (const v of vars) {
      if (!CHAVE_VALIDA.test(v.key)) {
        setErro(`Variável "${v.key}" inválida: use letras/números/sublinhado, começando por letra.`);
        return;
      }
    }

    const payload: TemplatePayload = { nome: nome.trim(), variaveis: vars };

    if (canal === 'EMAIL') {
      if (!assunto.trim()) {
        setErro('Informe o assunto do e-mail.');
        return;
      }
      const mjml = avancado ? mjmlBruto.trim() : textoParaMjml(mensagem.trim());
      if (!avancado && mensagem.trim().length < 3) {
        setErro('Escreva o conteúdo do e-mail.');
        return;
      }
      if (mjml.length < 10) {
        setErro('Conteúdo do e-mail muito curto.');
        return;
      }
      payload.assunto = assunto.trim();
      payload.mjml = mjml;
    } else {
      const nomeMeta = metaTemplateName.trim();
      if (!META_NOME_VALIDO.test(nomeMeta)) {
        setErro('O nome do template na Meta usa só letras minúsculas, números e _ (ex.: promo_barras).');
        return;
      }
      payload.metaTemplateName = nomeMeta;
      payload.metaLanguage = metaLanguage.trim() || 'pt_BR';
    }

    onSalvar(payload);
  }

  const mensagemErro = erro ?? erroServidor;

  return (
    <form onSubmit={submeter} className="space-y-4 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="tpl-nome">Nome do template</Label>
        <Input
          id="tpl-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={canal === 'EMAIL' ? 'Boas-vindas' : 'Promoção de barras'}
        />
      </div>

      {canal === 'EMAIL' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="tpl-assunto">Assunto do e-mail</Label>
            <Input
              id="tpl-assunto"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Novidades da {{empresa}}"
            />
          </div>

          {avancado ? (
            <div className="space-y-2">
              <Label htmlFor="tpl-mjml">Conteúdo (MJML — modo avançado)</Label>
              <textarea
                id="tpl-mjml"
                value={mjmlBruto}
                onChange={(e) => setMjmlBruto(e.target.value)}
                rows={12}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <p className="text-xs text-muted-foreground">
                Este template foi escrito em MJML. Edite com cuidado.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="tpl-conteudo">Conteúdo do e-mail</Label>
              <textarea
                id="tpl-conteudo"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={8}
                placeholder={'Olá {{nome}},\n\nTemos uma novidade para você...'}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <p className="text-xs text-muted-foreground">
                Escreva normalmente. Use{' '}
                <code className="bg-muted px-1 rounded">{'{{nome}}'}</code> para personalizar com
                dados do contato.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <AlertAviso>
            No WhatsApp, a mensagem precisa ser um template <strong>aprovado pela Meta</strong>.
            Aqui você só aponta para ele pelo nome. O texto em si é o que foi aprovado na sua
            conta Meta.
          </AlertAviso>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-meta-nome">Nome do template na Meta</Label>
              <Input
                id="tpl-meta-nome"
                value={metaTemplateName}
                onChange={(e) => setMetaTemplateName(e.target.value)}
                placeholder="promo_barras_direcao"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-meta-idioma">Idioma</Label>
              <Input
                id="tpl-meta-idioma"
                value={metaLanguage}
                onChange={(e) => setMetaLanguage(e.target.value)}
                placeholder="pt_BR"
              />
            </div>
          </div>
        </>
      )}

      <fieldset className="rounded-md border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          Variáveis {canal === 'WHATSAPP' ? '(na ordem do template Meta)' : '(personalização)'}
        </legend>
        <div className="space-y-2">
          {variaveis.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhuma variável. Use o botão abaixo se quiser personalizar (ex.: nome do cliente).
            </p>
          )}
          {variaveis.map((v, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                value={v.key}
                onChange={(e) => setVar(i, 'key', e.target.value)}
                placeholder="nome"
                className="w-40 h-9 font-mono"
              />
              <Input
                value={v.exemplo}
                onChange={(e) => setVar(i, 'exemplo', e.target.value)}
                placeholder="exemplo (ex.: João)"
                className="flex-1 h-9"
              />
              <button
                type="button"
                onClick={() => setVariaveis((vs) => vs.filter((_, j) => j !== i))}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="h-3 w-3" />
                remover
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setVariaveis((vs) => [...vs, { key: '', exemplo: '' }])}
          >
            <Plus className="h-4 w-4" />
            Variável
          </Button>
        </div>
      </fieldset>

      {mensagemErro && <AlertErro>{mensagemErro}</AlertErro>}

      <div className="flex flex-wrap gap-2 items-center">
        <Button type="submit" disabled={salvando}>
          {salvando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            textoBotao
          )}
        </Button>
        <Link href="/templates" className={buttonVariants({ variant: 'outline' })}>
          Cancelar
        </Link>
        {rodape}
      </div>
    </form>
  );
}

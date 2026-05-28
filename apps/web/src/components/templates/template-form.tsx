'use client';

import { useState } from 'react';

import { mjmlParaTexto, textoParaMjml } from '../../lib/template-email';

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
      <Campo label="Nome do template">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={canal === 'EMAIL' ? 'Boas-vindas' : 'Promoção de barras'}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        />
      </Campo>

      {canal === 'EMAIL' ? (
        <>
          <Campo label="Assunto do e-mail">
            <input
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Novidades da {{empresa}}"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
            />
          </Campo>

          {avancado ? (
            <Campo label="Conteúdo (MJML — modo avançado)">
              <textarea
                value={mjmlBruto}
                onChange={(e) => setMjmlBruto(e.target.value)}
                rows={12}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Este template foi escrito em MJML. Edite com cuidado.
              </p>
            </Campo>
          ) : (
            <Campo label="Conteúdo do e-mail">
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={8}
                placeholder={'Olá {{nome}},\n\nTemos uma novidade para você...'}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Escreva normalmente. Use <code className="bg-gray-100 px-1 rounded">{'{{nome}}'}</code>{' '}
                para personalizar com dados do contato.
              </p>
            </Campo>
          )}
        </>
      ) : (
        <>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            No WhatsApp, a mensagem precisa ser um template <strong>aprovado pela Meta</strong>. Aqui
            você só aponta para ele pelo nome. O texto em si é o que foi aprovado na sua conta Meta.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Nome do template na Meta">
              <input
                value={metaTemplateName}
                onChange={(e) => setMetaTemplateName(e.target.value)}
                placeholder="promo_barras_direcao"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
              />
            </Campo>
            <Campo label="Idioma">
              <input
                value={metaLanguage}
                onChange={(e) => setMetaLanguage(e.target.value)}
                placeholder="pt_BR"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
              />
            </Campo>
          </div>
        </>
      )}

      <fieldset className="rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-xs font-medium text-gray-700">
          Variáveis {canal === 'WHATSAPP' ? '(na ordem do template Meta)' : '(personalização)'}
        </legend>
        <div className="space-y-2">
          {variaveis.length === 0 && (
            <p className="text-xs text-gray-500">
              Nenhuma variável. Use o botão abaixo se quiser personalizar (ex.: nome do cliente).
            </p>
          )}
          {variaveis.map((v, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={v.key}
                onChange={(e) => setVar(i, 'key', e.target.value)}
                placeholder="nome"
                className="w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm font-mono focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
              />
              <input
                value={v.exemplo}
                onChange={(e) => setVar(i, 'exemplo', e.target.value)}
                placeholder="exemplo (ex.: João)"
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => setVariaveis((vs) => vs.filter((_, j) => j !== i))}
                className="text-xs text-red-700 hover:underline px-1"
              >
                remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setVariaveis((vs) => [...vs, { key: '', exemplo: '' }])}
            className="text-sm rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
          >
            + Variável
          </button>
        </div>
      </fieldset>

      {mensagemErro && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {mensagemErro}
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {salvando ? 'Salvando…' : textoBotao}
        </button>
        <a
          href="/templates"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
        >
          Cancelar
        </a>
        {rodape}
      </div>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      {children}
    </label>
  );
}

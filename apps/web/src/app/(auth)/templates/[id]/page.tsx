'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { TemplateForm, TemplatePayload, Variavel } from '../../../../components/templates/template-form';
import { useAuth } from '../../../../lib/auth/context';
import { mensagemErro } from '../../../../lib/erro';

interface Template {
  id: string;
  canal: 'EMAIL' | 'WHATSAPP';
  nome: string;
  assunto: string | null;
  mjml: string | null;
  metaTemplateName: string | null;
  metaLanguage: string | null;
  variaveis: Variavel[];
}

interface PreviewEmail {
  canal: 'EMAIL';
  assunto: string;
  html: string;
  warnings?: string[];
}
interface PreviewWhats {
  canal: 'WHATSAPP';
  metaTemplateName: string | null;
  metaLanguage: string | null;
  variaveisAplicadas: Record<string, string>;
}

export default function EditarTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuth();

  const [template, setTemplate] = useState<Template | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewEmail | PreviewWhats | null>(null);
  const [previewErro, setPreviewErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setTemplate(await api<Template>({ path: `/templates/${id}` }));
      } catch (e) {
        setErroCarga(mensagemErro(e));
      } finally {
        setCarregando(false);
      }
    })();
  }, [api, id]);

  async function salvar(p: TemplatePayload) {
    if (!template) return;
    setSalvando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = { nome: p.nome, variaveis: p.variaveis };
      if (template.canal === 'EMAIL') {
        body.assunto = p.assunto;
        body.mjml = p.mjml;
      } else {
        body.metaTemplateName = p.metaTemplateName;
        body.metaLanguage = p.metaLanguage;
      }
      await api({ method: 'PATCH', path: `/templates/${id}`, body });
      setPreview(null);
      router.push('/templates');
    } catch (e) {
      setErro(mensagemErro(e));
      setSalvando(false);
    }
  }

  async function previsualizar() {
    setPreviewErro(null);
    try {
      const r = await api<PreviewEmail | PreviewWhats>({
        method: 'POST',
        path: `/templates/${id}/preview`,
        body: { variaveis: {} },
      });
      setPreview(r);
    } catch (e) {
      setPreviewErro(mensagemErro(e));
    }
  }

  async function excluir() {
    if (!window.confirm('Excluir esta mensagem? Campanhas que já usaram ela não são afetadas.')) return;
    setErro(null);
    try {
      await api({ method: 'DELETE', path: `/templates/${id}` });
      router.push('/templates');
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  return (
    <div>
      <Link href="/templates" className="text-xs text-gray-600 hover:text-gray-900">
        ← Voltar para mensagens
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold">Editar mensagem</h1>

      {carregando ? (
        <p className="text-sm text-gray-500">carregando…</p>
      ) : erroCarga ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erroCarga}</p>
      ) : template ? (
        <>
          <p className="text-sm text-gray-600 mb-4">
            Canal: <strong>{template.canal === 'EMAIL' ? 'E-mail' : 'WhatsApp'}</strong>
          </p>

          <TemplateForm
            canal={template.canal}
            inicial={template}
            salvando={salvando}
            erroServidor={erro}
            textoBotao="Salvar alterações"
            onSalvar={salvar}
            rodape={
              <button
                type="button"
                onClick={previsualizar}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
              >
                Pré-visualizar
              </button>
            }
          />

          {previewErro && (
            <p className="mt-4 max-w-2xl text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
              {previewErro}
            </p>
          )}

          {preview && (
            <div className="mt-6 max-w-2xl">
              <h2 className="text-sm font-medium text-gray-900 mb-2">Pré-visualização (com exemplos)</h2>
              <p className="text-xs text-gray-500 mb-2">
                Mostra a versão salva. Salve antes para ver as últimas alterações.
              </p>
              {preview.canal === 'EMAIL' ? (
                <div>
                  <div className="text-xs text-gray-600 mb-1">
                    Assunto: <strong>{preview.assunto}</strong>
                  </div>
                  <iframe
                    title="Pré-visualização do e-mail"
                    srcDoc={preview.html}
                    sandbox=""
                    className="w-full h-96 rounded-md border border-gray-200 bg-white"
                  />
                </div>
              ) : (
                <div className="rounded-md border border-gray-200 bg-white p-4 text-sm">
                  <div>
                    Template Meta: <strong>{preview.metaTemplateName}</strong> ({preview.metaLanguage})
                  </div>
                  {Object.keys(preview.variaveisAplicadas).length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      Variáveis: {Object.entries(preview.variaveisAplicadas).map(([k, v]) => `${k}=${v}`).join(', ')}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    O texto real do WhatsApp é o aprovado na Meta — aqui mostramos só a referência e os
                    exemplos das variáveis.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-10 max-w-2xl rounded-md border border-red-200 bg-red-50/40 p-4">
            <h2 className="text-sm font-medium text-red-800">Excluir mensagem</h2>
            <button
              type="button"
              onClick={excluir}
              className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:outline-none"
            >
              Excluir mensagem
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

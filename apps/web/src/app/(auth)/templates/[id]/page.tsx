'use client';

import { ArrowLeft, Eye, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { TemplateForm, TemplatePayload, Variavel } from '../../../../components/templates/template-form';
import { AlertErro } from '../../../../components/ui/alerts';
import { Button } from '../../../../components/ui/button';
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
      <Link
        href="/templates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para mensagens
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Editar mensagem</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Ajuste o texto e confira a pré-visualização antes de usar em uma campanha.
      </p>

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando mensagem…
        </p>
      ) : erroCarga ? (
        <AlertErro>{erroCarga}</AlertErro>
      ) : template ? (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Canal:{' '}
            <strong className="text-foreground">
              {template.canal === 'EMAIL' ? 'E-mail' : 'WhatsApp'}
            </strong>
          </p>

          <TemplateForm
            canal={template.canal}
            inicial={template}
            salvando={salvando}
            erroServidor={erro}
            textoBotao="Salvar alterações"
            onSalvar={salvar}
            rodape={
              <Button type="button" variant="outline" onClick={previsualizar} className="gap-2">
                <Eye className="h-4 w-4" />
                Pré-visualizar
              </Button>
            }
          />

          {previewErro && <AlertErro className="mt-4 max-w-2xl">{previewErro}</AlertErro>}

          {preview && (
            <div className="mt-6 max-w-2xl">
              <h2 className="mb-2 text-sm font-medium">Pré-visualização (com exemplos)</h2>
              <p className="mb-2 text-xs text-muted-foreground">
                Mostra a versão salva. Salve antes para ver as últimas alterações.
              </p>
              {preview.canal === 'EMAIL' ? (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    Assunto: <strong className="text-foreground">{preview.assunto}</strong>
                  </div>
                  <iframe
                    title="Pré-visualização do e-mail"
                    srcDoc={preview.html}
                    sandbox=""
                    className="h-96 w-full rounded-md border bg-white"
                  />
                </div>
              ) : (
                <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-sm">
                  <div>
                    Template Meta: <strong>{preview.metaTemplateName}</strong> ({preview.metaLanguage})
                  </div>
                  {Object.keys(preview.variaveisAplicadas).length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Variáveis: {Object.entries(preview.variaveisAplicadas).map(([k, v]) => `${k}=${v}`).join(', ')}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    O texto real do WhatsApp é o aprovado na Meta — aqui mostramos só a referência e
                    os exemplos das variáveis.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-10 max-w-2xl rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <h2 className="text-sm font-semibold text-destructive">Excluir mensagem</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Campanhas que já usaram esta mensagem não são afetadas.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={excluir}
              className="mt-3"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir mensagem
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

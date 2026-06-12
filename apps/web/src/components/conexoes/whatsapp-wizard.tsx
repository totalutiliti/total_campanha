'use client';

import { Check, ChevronRight, Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '../../lib/cn';
import { mensagemErro } from '../../lib/erro';
import { AlertAviso, AlertErro, AlertSucesso } from '../ui/alerts';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type Passo = 'pre-requisitos' | 'token' | 'dados' | 'webhook';

export interface DadosForm {
  wabaId: string;
  phoneNumberId: string;
  token: string;
}

export interface ResultadoConexao {
  id: string;
  displayPhoneNumber: string;
  webhook: { url: string; secret: string };
}

interface Props {
  /**
   * Função que persiste a conexão. Injetada pelo caller — o componente
   * não conhece o endpoint para não acoplar com auth context (ainda
   * não existente no Next.js).
   */
  salvar?: (dados: DadosForm) => Promise<ResultadoConexao>;
}

/**
 * Wizard de 4 passos para BYOA WhatsApp (BOOTSTRAP 4.1):
 *   1. Pré-requisitos (CNPJ, Meta Business Manager verificado, número dedicado)
 *   2. Como obter token permanente (passo a passo Meta)
 *   3. Colar wabaId + phoneNumberId + token → validar contra Meta
 *   4. Configurar webhook na Meta (mostra URL + secret gerados)
 *
 * Estado isolado por passo. Avança apenas quando o passo atual está OK.
 */
export function WhatsappWizard({ salvar }: Props) {
  const [passo, setPasso] = useState<Passo>('pre-requisitos');
  const [dados, setDados] = useState<DadosForm>({ wabaId: '', phoneNumberId: '', token: '' });
  const [resultado, setResultado] = useState<ResultadoConexao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmarDados() {
    if (!salvar) {
      setErro('Função `salvar` não foi fornecida (página de demo).');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await salvar(dados);
      setResultado(r);
      setPasso('webhook');
    } catch (e) {
      setErro(mensagemErro(e, 'Não conseguimos validar com a Meta. Confira os dados e tente de novo.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Stepper atual={passo} />

      <div className="mt-6 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        {passo === 'pre-requisitos' && (
          <PassoPreRequisitos onContinuar={() => setPasso('token')} />
        )}

        {passo === 'token' && (
          <PassoToken
            onVoltar={() => setPasso('pre-requisitos')}
            onContinuar={() => setPasso('dados')}
          />
        )}

        {passo === 'dados' && (
          <PassoDados
            dados={dados}
            onChange={setDados}
            onVoltar={() => setPasso('token')}
            onContinuar={confirmarDados}
            enviando={enviando}
            erro={erro}
          />
        )}

        {passo === 'webhook' && resultado && (
          <PassoWebhook resultado={resultado} />
        )}
      </div>
    </div>
  );
}

function Stepper({ atual }: { atual: Passo }) {
  const passos: Array<{ chave: Passo; titulo: string }> = [
    { chave: 'pre-requisitos', titulo: 'Pré-requisitos' },
    { chave: 'token', titulo: 'Token Meta' },
    { chave: 'dados', titulo: 'Validação' },
    { chave: 'webhook', titulo: 'Webhook' },
  ];
  const ativoIdx = passos.findIndex((p) => p.chave === atual);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {passos.map((p, i) => (
        <li key={p.chave} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full border tabular-nums',
              i <= ativoIdx && 'border-primary bg-primary text-primary-foreground',
            )}
          >
            {i + 1}
          </span>
          <span className={cn(i === ativoIdx && 'font-medium text-foreground')}>{p.titulo}</span>
          {i < passos.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
        </li>
      ))}
    </ol>
  );
}

function PassoPreRequisitos({ onContinuar }: { onContinuar: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Antes de começar</h2>
      <p className="text-sm text-muted-foreground">
        Conectar o WhatsApp oficial exige uma conta na Meta. Você (ou quem cuida da sua
        TI/marketing) vai precisar de:
      </p>
      <ul className="space-y-2 text-sm">
        <li className="flex gap-2">
          <span className="text-muted-foreground">•</span>
          <span>CNPJ ativo registrado no Meta Business Manager.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-muted-foreground">•</span>
          <span>
            Conta WhatsApp Business API criada em{' '}
            <a
              href="https://business.facebook.com/wa/manage"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              business.facebook.com/wa/manage
            </a>
            .
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-muted-foreground">•</span>
          <span>
            Número de telefone dedicado <strong>e</strong> verificado dentro da WABA. (Não
            funciona com número que está no app pessoal.)
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-muted-foreground">•</span>
          <span>App de sistema criado no Meta for Developers para emitir token permanente.</span>
        </li>
      </ul>
      <Button type="button" onClick={onContinuar}>
        Já tenho tudo — continuar
      </Button>
    </div>
  );
}

function PassoToken({ onVoltar, onContinuar }: { onVoltar: () => void; onContinuar: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Como gerar o token permanente</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          Acesse{' '}
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Meta for Developers
          </a>
          {' '}e abra o app de sistema da empresa.
        </li>
        <li>
          Em <em>Business Settings → Users → System Users</em>, crie um usuário de sistema com
          perfil <strong>Admin</strong>.
        </li>
        <li>
          Atribua a WABA ao usuário de sistema (Add Assets → WhatsApp Accounts → Manage).
        </li>
        <li>
          Gere um <strong>token permanente</strong> com as permissões{' '}
          <code className="rounded bg-muted px-1">whatsapp_business_messaging</code> e{' '}
          <code className="rounded bg-muted px-1">whatsapp_business_management</code>.
        </li>
        <li>
          Copie o token e <strong>guarde em local seguro</strong>. Ele não pode ser visto de novo.
        </li>
      </ol>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onVoltar}>
          Voltar
        </Button>
        <Button type="button" onClick={onContinuar}>
          Tenho o token
        </Button>
      </div>
    </div>
  );
}

function PassoDados({
  dados,
  onChange,
  onVoltar,
  onContinuar,
  enviando,
  erro,
}: {
  dados: DadosForm;
  onChange: (d: DadosForm) => void;
  onVoltar: () => void;
  onContinuar: () => void;
  enviando: boolean;
  erro: string | null;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Validação</h2>
      <p className="text-sm text-muted-foreground">
        Cole os IDs e o token. A plataforma valida com a Meta antes de salvar e guarda o
        token criptografado — ele nunca fica visível depois.
      </p>
      <AlertAviso>
        Use o <strong>token da Meta</strong> (começa com EAA…), não a senha do seu login. Se o
        navegador preencher sozinho, apague e cole o token correto.
      </AlertAviso>

      <Campo label="WABA ID">
        <Input
          value={dados.wabaId}
          onChange={(e) => onChange({ ...dados, wabaId: e.target.value.trim() })}
          placeholder="ex: 123456789012345"
          name="wabaId"
          autoComplete="off"
          inputMode="numeric"
        />
      </Campo>

      <Campo label="Phone Number ID">
        <Input
          value={dados.phoneNumberId}
          onChange={(e) => onChange({ ...dados, phoneNumberId: e.target.value.trim() })}
          placeholder="ex: 987654321012345"
          name="phoneNumberId"
          autoComplete="off"
          inputMode="numeric"
        />
      </Campo>

      <Campo label="Token permanente">
        <Input
          type="password"
          value={dados.token}
          onChange={(e) => onChange({ ...dados, token: e.target.value.trim() })}
          placeholder="EAA..."
          name="metaToken"
          autoComplete="new-password"
          className="font-mono"
        />
      </Campo>

      {erro && <AlertErro>{erro}</AlertErro>}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onVoltar}>
          Voltar
        </Button>
        <Button
          type="button"
          onClick={onContinuar}
          disabled={enviando || !dados.wabaId || !dados.phoneNumberId || !dados.token}
        >
          {enviando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validando com a Meta…
            </>
          ) : (
            'Validar e conectar'
          )}
        </Button>
      </div>
    </div>
  );
}

function PassoWebhook({ resultado }: { resultado: ResultadoConexao }) {
  const [copiou, setCopiou] = useState<string | null>(null);

  function copiar(texto: string, label: string) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiou(label);
      setTimeout(() => setCopiou(null), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <AlertSucesso>
        Conexão validada para <strong>{resultado.displayPhoneNumber}</strong>.
      </AlertSucesso>

      <h2 className="text-lg font-semibold">Configure o webhook na Meta</h2>
      <p className="text-sm text-muted-foreground">
        Em <em>WhatsApp → Configuration → Webhooks</em>, cole estes valores e ative os campos
        <code className="ml-1 rounded bg-muted px-1">messages</code> e{' '}
        <code className="rounded bg-muted px-1">message_template_status_update</code>.
      </p>

      <Campo label="Callback URL">
        <div className="flex gap-2">
          <Input readOnly value={resultado.webhook.url} className="flex-1 font-mono" />
          <Button
            type="button"
            variant="outline"
            onClick={() => copiar(resultado.webhook.url, 'url')}
            className="shrink-0 gap-2"
          >
            {copiou === 'url' ? (
              <>
                <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar
              </>
            )}
          </Button>
        </div>
      </Campo>

      <Campo label="Verify Token">
        <div className="flex gap-2">
          <Input readOnly value={resultado.webhook.secret} className="flex-1 font-mono" />
          <Button
            type="button"
            variant="outline"
            onClick={() => copiar(resultado.webhook.secret, 'secret')}
            className="shrink-0 gap-2"
          >
            {copiou === 'secret' ? (
              <>
                <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar
              </>
            )}
          </Button>
        </div>
      </Campo>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium leading-none">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

'use client';

import { useState } from 'react';

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
      setErro(e instanceof Error ? e.message : 'Falha ao conectar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Stepper atual={passo} />

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
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
    <ol className="flex items-center gap-2 text-xs text-gray-600">
      {passos.map((p, i) => (
        <li key={p.chave} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border ${
              i <= ativoIdx ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'
            }`}
          >
            {i + 1}
          </span>
          <span className={i === ativoIdx ? 'font-medium text-gray-900' : ''}>{p.titulo}</span>
          {i < passos.length - 1 && <span className="text-gray-300">→</span>}
        </li>
      ))}
    </ol>
  );
}

function PassoPreRequisitos({ onContinuar }: { onContinuar: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Antes de começar</h2>
      <ul className="space-y-2 text-sm">
        <li className="flex gap-2">
          <span>✓</span>
          <span>CNPJ ativo registrado no Meta Business Manager.</span>
        </li>
        <li className="flex gap-2">
          <span>✓</span>
          <span>
            Conta WhatsApp Business API criada em{' '}
            <a
              href="https://business.facebook.com/wa/manage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline"
            >
              business.facebook.com/wa/manage
            </a>
            .
          </span>
        </li>
        <li className="flex gap-2">
          <span>✓</span>
          <span>
            Número de telefone dedicado <strong>e</strong> verificado dentro da WABA. (Não
            funciona com número que está no app pessoal.)
          </span>
        </li>
        <li className="flex gap-2">
          <span>✓</span>
          <span>App de sistema criado no Meta for Developers para emitir token permanente.</span>
        </li>
      </ul>
      <button
        type="button"
        onClick={onContinuar}
        className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium"
      >
        Já tenho tudo — continuar
      </button>
    </div>
  );
}

function PassoToken({ onVoltar, onContinuar }: { onVoltar: () => void; onContinuar: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Como gerar o token permanente</h2>
      <ol className="list-decimal pl-5 space-y-2 text-sm">
        <li>
          Acesse{' '}
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline"
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
          <code className="bg-gray-100 px-1 rounded">whatsapp_business_messaging</code> e{' '}
          <code className="bg-gray-100 px-1 rounded">whatsapp_business_management</code>.
        </li>
        <li>
          Copie o token e <strong>guarde em local seguro</strong>. Ele não pode ser visto de novo.
        </li>
      </ol>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onVoltar}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onContinuar}
          className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium"
        >
          Tenho o token
        </button>
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
      <p className="text-sm text-gray-600">
        Cole os IDs e o token. A plataforma faz uma chamada à Meta para validar antes de
        salvar — o token será cifrado em repouso (pgcrypto).
      </p>

      <Campo label="WABA ID">
        <input
          value={dados.wabaId}
          onChange={(e) => onChange({ ...dados, wabaId: e.target.value.trim() })}
          placeholder="ex: 123456789012345"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </Campo>

      <Campo label="Phone Number ID">
        <input
          value={dados.phoneNumberId}
          onChange={(e) => onChange({ ...dados, phoneNumberId: e.target.value.trim() })}
          placeholder="ex: 987654321012345"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </Campo>

      <Campo label="Token permanente">
        <input
          type="password"
          value={dados.token}
          onChange={(e) => onChange({ ...dados, token: e.target.value.trim() })}
          placeholder="EAA..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
        />
      </Campo>

      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onVoltar}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onContinuar}
          disabled={enviando || !dados.wabaId || !dados.phoneNumberId || !dados.token}
          className="rounded-md bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {enviando ? 'Validando com Meta…' : 'Validar e conectar'}
        </button>
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
      <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
        Conexão validada para <strong>{resultado.displayPhoneNumber}</strong>.
      </div>

      <h2 className="text-lg font-semibold">Configure o webhook na Meta</h2>
      <p className="text-sm text-gray-600">
        Em <em>WhatsApp → Configuration → Webhooks</em>, cole estes valores e ative os campos
        <code className="bg-gray-100 px-1 rounded ml-1">messages</code> e{' '}
        <code className="bg-gray-100 px-1 rounded">message_template_status_update</code>.
      </p>

      <Campo label="Callback URL">
        <div className="flex gap-2">
          <input
            readOnly
            value={resultado.webhook.url}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => copiar(resultado.webhook.url, 'url')}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {copiou === 'url' ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </Campo>

      <Campo label="Verify Token">
        <div className="flex gap-2">
          <input
            readOnly
            value={resultado.webhook.secret}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <button
            type="button"
            onClick={() => copiar(resultado.webhook.secret, 'secret')}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {copiou === 'secret' ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </Campo>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '../../lib/auth/context';

/**
 * Dashboard — Fase A do redesign (`docs/UX_BACKLOG.md` UX-04).
 *
 * Princípios aplicados (ver `docs/UX_PRINCIPLES.md`):
 *  - P1 (vocabulário): "Tenant" → "Empresa"; "STARTER" → "Plano Starter";
 *    remove "Role: ADMIN" (usuário só vê a própria role, não precisa exibir);
 *    "Olá, admin" → "Olá, Admin" (cap até signup pedir nome real).
 *  - P3 (custo visível): card "Consumo do mês" sempre presente, ainda que
 *    com placeholder R$ 0,00 — espaço reservado força o aprendizado do usuário
 *    de que o serviço tem custo, e cria o slot que a Fase B preenche com dados
 *    reais.
 *  - P6 (mobile): 3 KPI cards empilham em < md; atalhos em 2 colunas no mobile.
 *  - P7 (a11y): foco visível em todos os links, contraste corrigido
 *    (`text-gray-600` em vez de `text-gray-500` sobre fundo claro).
 *  - P8 (loading/empty): valores numéricos têm skeleton enquanto carregam;
 *    estados vazios viram CTA acionável ("Importar contatos", "Conectar canal").
 *
 * Fase B (depende de novos endpoints):
 *  - "Consumo do mês": precisa `GET /usage/mes-atual` agregando `usage_log`.
 *  - "Saúde dos canais" com semáforo de quality rating Meta: já há
 *    `qualityRating` no `/conexoes/whatsapp` — usar quando entrar no PR seguinte.
 *  - "Próxima campanha": depende de `/campanhas` existir (UX-06).
 *  - Banner do trial com contagem regressiva: precisa `trialAteEm` no `/me`.
 */
export default function DashboardPage() {
  const { estado, api } = useAuth();
  const [snap, setSnap] = useState<SnapshotConta>({
    whatsappConectado: false,
    emailConectado: false,
    totalContatos: 0,
    totalTemplates: 0,
    canaisEmailAtivos: 0,
    carregando: true,
  });

  useEffect(() => {
    if (estado.tipo !== 'autenticado') return;
    let cancelado = false;
    (async () => {
      // Buscas em paralelo. Cada uma pode falhar isoladamente (sem WhatsApp =
      // 404; sem rede = erro). `Promise.allSettled` evita que uma derrube as
      // outras — o dashboard sempre renderiza com o que conseguiu trazer.
      const [whats, mails, contatos, templates] = await Promise.allSettled([
        api<{ id: string }>({ path: '/conexoes/whatsapp' }),
        api<EmailConexao[]>({ path: '/conexoes/email' }),
        api<{ paginacao: { total: number } }>({ path: '/contatos?porPagina=1' }),
        api<{ paginacao: { total: number } }>({ path: '/templates?porPagina=1' }),
      ]);

      if (cancelado) return;

      const mailsArr = mails.status === 'fulfilled' ? mails.value : [];
      setSnap({
        whatsappConectado: whats.status === 'fulfilled',
        emailConectado: mailsArr.length > 0,
        canaisEmailAtivos: mailsArr.filter((e) => e.status === 'ATIVA').length,
        totalContatos: contatos.status === 'fulfilled' ? contatos.value.paginacao.total : 0,
        totalTemplates: templates.status === 'fulfilled' ? templates.value.paginacao.total : 0,
        carregando: false,
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [estado, api]);

  if (estado.tipo !== 'autenticado') return null;
  const { me } = estado;
  const empresa = me.tenantAtual;
  if (!empresa) return null;

  const emTrial = empresa.status === 'TRIAL';
  const nomeUsuario = capitalizar(me.email.split('@')[0]);
  const planoLabel = capitalizar(empresa.plano.toLowerCase());
  const canaisConectados = (snap.whatsappConectado ? 1 : 0) + (snap.emailConectado ? 1 : 0);

  const itensOnboarding = [
    { feito: true, label: 'Cadastrar empresa', cta: null },
    {
      feito: snap.whatsappConectado,
      label: 'Conectar WhatsApp (Conta Business)',
      cta: { href: '/conexoes/whatsapp/novo', label: 'Conectar' },
    },
    {
      feito: snap.emailConectado,
      label: 'Conectar domínio de e-mail',
      cta: { href: '/conexoes/email/novo', label: 'Conectar' },
    },
    {
      feito: snap.totalContatos > 0,
      label: 'Importar primeiros contatos',
      cta: { href: '/contatos', label: 'Importar' },
    },
    {
      feito: snap.totalTemplates > 0,
      label: 'Criar primeiro template',
      cta: { href: '/templates', label: 'Criar' },
    },
    // Disparar campanha fica como "em breve" — não existe rota /campanhas/nova
    // (UX-06 do backlog).
    { feito: false, label: 'Disparar primeira campanha', cta: null },
  ];
  const feitos = itensOnboarding.filter((i) => i.feito).length;
  const total = itensOnboarding.length;
  const onboardingCompleto = feitos === total;

  return (
    <div className="space-y-6">
      {/* Banner trial — sem CTA até /configuracoes/faturamento existir
          (evita link quebrado). */}
      {emTrial && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <strong>Você está no teste grátis.</strong>{' '}
          <span className="text-amber-800">
            Plano {planoLabel}. Conecte WhatsApp ou e-mail para começar a enviar.
          </span>
        </div>
      )}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Olá, {nomeUsuario}
        </h1>
        <p className="text-sm text-gray-600 mt-1">Veja como está sua operação hoje.</p>
      </header>

      <section
        aria-label="Indicadores principais"
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        <KpiCard
          titulo="Consumo do mês"
          valor="R$ 0,00"
          sub="de R$ 50,00 do plano"
          rodape={<BarraConsumo pct={0} />}
        />

        <KpiCard
          titulo="Saúde dos canais"
          valor={`${canaisConectados}/2 conectados`}
          rodape={
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-2">
                <Indicador cor={snap.whatsappConectado ? 'verde' : 'cinza'} />
                <span className="text-gray-700">
                  WhatsApp: {snap.whatsappConectado ? 'conectado' : 'não conectado'}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Indicador cor={snap.emailConectado ? 'verde' : 'cinza'} />
                <span className="text-gray-700">
                  E-mail: {snap.emailConectado ? 'conectado' : 'não conectado'}
                </span>
              </li>
            </ul>
          }
        />

        <KpiCard
          titulo="Próxima campanha"
          valor="Nenhuma agendada"
          rodape={
            <span className="text-xs text-gray-600">
              Tela de campanhas em construção.
            </span>
          }
        />
      </section>

      {!onboardingCompleto && (
        <section aria-label="Checklist de configuração">
          <header className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              Termine de configurar sua conta
            </h2>
            <span className="text-xs text-gray-600 tabular-nums">
              {feitos} de {total}
            </span>
          </header>
          <ul className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {itensOnboarding.map((item, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <CheckOuCirculo feito={item.feito} />
                  <span
                    className={
                      item.feito ? 'text-gray-500 line-through' : 'text-gray-900'
                    }
                  >
                    {item.label}
                  </span>
                </span>
                {item.feito ? (
                  <span className="text-xs text-gray-500 whitespace-nowrap">feito</span>
                ) : item.cta ? (
                  <Link
                    href={item.cta.href}
                    className="text-xs font-medium text-gray-900 hover:underline focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none rounded px-1 whitespace-nowrap"
                  >
                    {item.cta.label} →
                  </Link>
                ) : (
                  <span className="text-xs text-gray-400 whitespace-nowrap">em breve</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Atalhos">
        <h2 className="text-base font-semibold text-gray-900 mb-2">Atalhos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <AtalhoCard
            href="/contatos"
            titulo="Contatos"
            contagem={snap.totalContatos}
            unidade={snap.totalContatos === 1 ? 'contato cadastrado' : 'contatos cadastrados'}
            carregando={snap.carregando}
          />
          <AtalhoCard
            href="/segmentos"
            titulo="Segmentos"
            contagem={null}
            unidade="grupos de envio"
            carregando={false}
          />
          <AtalhoCard
            href="/templates"
            titulo="Templates"
            contagem={snap.totalTemplates}
            unidade={snap.totalTemplates === 1 ? 'template criado' : 'templates criados'}
            carregando={snap.carregando}
          />
          <AtalhoCard
            href="/conexoes"
            titulo="Canais"
            contagem={canaisConectados}
            unidade="de 2 conectados"
            carregando={snap.carregando}
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

interface SnapshotConta {
  whatsappConectado: boolean;
  emailConectado: boolean;
  canaisEmailAtivos: number;
  totalContatos: number;
  totalTemplates: number;
  carregando: boolean;
}

interface EmailConexao {
  id: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Componentes locais — futuramente migram para `components/ui/` quando o
// shadcn for instalado (UX-01 do backlog).
// ---------------------------------------------------------------------------

function KpiCard({
  titulo,
  valor,
  sub,
  rodape,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  rodape: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-600">
        {titulo}
      </h3>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{valor}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
      <div className="mt-3">{rodape}</div>
    </article>
  );
}

function BarraConsumo({ pct }: { pct: number }) {
  const clamp = Math.min(100, Math.max(0, pct));
  return (
    <div className="space-y-1">
      <div
        role="progressbar"
        aria-valuenow={clamp}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full rounded-full bg-gray-100 overflow-hidden"
      >
        <div className="h-full bg-gray-900" style={{ width: `${clamp}%` }} />
      </div>
      <div className="text-xs text-gray-600">{clamp.toFixed(0)}% utilizado</div>
    </div>
  );
}

function Indicador({ cor }: { cor: 'verde' | 'cinza' | 'amarelo' | 'vermelho' }) {
  const classes: Record<typeof cor, string> = {
    verde: 'bg-green-500',
    cinza: 'bg-gray-300',
    amarelo: 'bg-amber-400',
    vermelho: 'bg-red-500',
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 rounded-full ${classes[cor]}`}
    />
  );
}

function CheckOuCirculo({ feito }: { feito: boolean }) {
  if (feito) {
    return (
      <span
        aria-label="concluído"
        className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white text-xs"
      >
        ✓
      </span>
    );
  }
  return (
    <span
      aria-label="pendente"
      className="block h-5 w-5 rounded-full border-2 border-gray-300"
    />
  );
}

function AtalhoCard({
  href,
  titulo,
  contagem,
  unidade,
  carregando,
}: {
  href: string;
  titulo: string;
  contagem: number | null;
  unidade: string;
  carregando: boolean;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-900 transition focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:outline-none"
    >
      <div className="text-sm font-medium text-gray-900">{titulo}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">
        {carregando ? (
          <span
            aria-hidden="true"
            className="inline-block h-7 w-10 rounded bg-gray-100 animate-pulse"
          />
        ) : contagem === null ? (
          '—'
        ) : (
          contagem
        )}
      </div>
      <div className="text-xs text-gray-600 mt-1">{unidade}</div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function capitalizar(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

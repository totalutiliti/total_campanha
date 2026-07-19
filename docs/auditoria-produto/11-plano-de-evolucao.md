# 11 — Plano de evolução

**Baseline:** `dev`/`origin/dev`, commit `34f7d15f98a09ee753ae43fa8e6f8ff054095193`, revalidado em 19/07/2026.
**Regra de avanço:** critérios são cumulativos; uma fase posterior não compensa risco aberto da fase anterior.

## Princípios

- Corrigir segurança, isolamento e confiabilidade antes de ampliar volume ou promessa comercial.
- Fechar achado apenas com correção revisada, teste de regressão e evidência observável.
- Usar ambientes descartáveis, fakes de Meta/SES/Asaas e dados 100% sintéticos.
- Nunca enviar comunicação real em teste automatizado; smoke autorizado usa apenas destinatários internos.
- Mudança de schema em PROD segue o runbook de recuperação, backup e aprovação humana explícita.
- Decisões jurídicas, comerciais e de risco permanecem humanas; este plano não as presume.

## F0 — Bloqueadores críticos

**Objetivo:** remover a possibilidade de cruzamento de tenants, envio duplicado/forjado, cadastro parcial e exposição conhecida por dependência crítica.

**Critério de entrada:** baseline e backlog aprovados; owners técnico, produto, segurança e privacidade nomeados; staging/test descartável com PostgreSQL e Redis isolados; Node 20/pnpm 9.12; fakes de provedores bloqueando rede externa.

**Escopo obrigatório:**

1. `SEC-001`: worker operacional sem `BYPASSRLS`; scheduler cross-tenant separado, mínimo privilégio e relações derivadas do registro tenant-scoped.
2. `ARC-001/003/DATA-001`: claim/lease, tentativa durável, outbox e reconciliação entre DB, fila, provedor e custo.
3. `WA-001/ARC-005`: HMAC do corpo bruto, limite de payload, ledger de evento, replay e ordem monotônica.
4. `ARC-002`: signup, vínculo e auditoria em unidade atômica com contexto RLS correto.
5. `SEC-002/SUPPLY-001`: atualizar Next e dependências exploráveis com build, regressão e política de exceção expirada.
6. Controles altos diretamente ligados ao disparo: throttle agregado, sender tenant, double opt-in/prova, confirmação final e remoção de exemplos potencialmente reais.
7. Definir o perfil mínimo de infraestrutura, RPO/RTO e executar restore cronometrado.

**Testes e evidências obrigatórios:** job adulterado A/B falha antes do fake; duas execuções simultâneas geram uma aceitação; fault injection antes/depois de claim, enqueue, aceitação e commit converge; HMAC inválido não enfileira; replay 10× tem um efeito; signup falho faz rollback; opt-in pendente não entra em campanha; sender A/B não se mistura; cancelar modal produz zero POST; audit sem crítica aplicável; restore registra tempo, counts e RLS.

**Critério de saída:** cinco críticos fechados; zero crítico aberto; altos acoplados ao efeito externo mitigados; suites P0 verdes no CI; revisão de segurança e go/no-go assinados; nenhuma comunicação externa real nos testes.

**Exclusões:** catálogo, white-label avançado, novos canais, BI sofisticado e otimização para centenas de tenants.

**Decisões humanas:** App Secret/rotação Meta; aceitação de risco residual; perfil lean ou completo; RPO/RTO; modelo de consentimento/base legal; autorização do piloto.

## F1 — Antes do primeiro cliente externo

**Objetivo:** tornar um piloto externo pequeno recuperável, observável e operável com suporte presente.

**Critério de entrada:** F0 concluída; staging isolado; canais sandbox/fake; política de piloto, limites e responsáveis definidos; backup restaurável.

**Escopo obrigatório:**

- retry com cursor/lock, DLQ, backoff e reconciliação; cancelamento/pausa sem corrida;
- FKs tenant-safe, `usage_logs` isolado e audit append-only/minimizado;
- feedback SES assinado/idempotente, provider ID, bounce/complaint e supressão;
- timeouts, jitter e circuit breaker por tenant/provedor; billing idempotente e monotônico;
- hard delete/DSAR/retenção em DB, Redis, Blob e backup, com exceções jurídicas documentadas;
- CSV streaming/limites/neutralização de fórmulas e Redis sem PII integral;
- edição de rascunho, paginação, RBAC coerente na UI, confirmação/teste de envio;
- dialogs, drawer, formulários e tabelas em WCAG 2.2 A/AA aplicável;
- runbooks de suporte/incidente e dashboards de fila, custo, provedor e reputação.

**Testes e evidências obrigatórios:** E2E desktop e 360 px por papel; teclado/axe/leitor de tela; replay/out-of-order; provider lento/indisponível; bounce/complaint; CSV adversarial; cancelamento em barreira concorrente; restore/failover de componentes do piloto; campanha exclusivamente para destinatários internos com reconciliação final.

**Critério de saída:** nenhum P1 de segurança, privacidade ou confiabilidade aberto; suporte diagnostica por correlation ID sem PII; jornada fictícia completa passa; piloto tem limites, monitoramento, rollback e critério de interrupção.

**Exclusões:** aquisição self-service ampla, catálogo não decidido, customizações exclusivas de um cliente e SLA comercial pleno.

**Decisões humanas:** cliente/vertical do piloto; volume e janela; quem aprova campanhas; SLA experimental; retenção/DPA; conta SES e modelo de reputação; aceite explícito do risco infra.

## F2 — Antes de 10 clientes

**Objetivo:** retirar dependência de operação artesanal e sustentar isolamento, onboarding e administração para dez tenants pagantes.

**Critério de entrada:** F1 estável pelo período definido; métricas do piloto dentro dos SLOs; incidentes P0/P1 encerrados; capacidade medida com pelo menos a carga-alvo de dez tenants.

**Escopo obrigatório:**

- signup/confirm email/empresa/trial/termos retomáveis;
- usuários, convites, papéis, desativação, sessões, MFA e step-up;
- entitlements e quotas server-side em CRUD, import, campanha e billing;
- control plane/scheduler privilegiado separado de workers tenant-scoped;
- lifecycle de tenant: suspensão, reativação, cancelamento, export, retenção e purge;
- índices medidos, cursor/paginação, import staging e prévia de audiência verificável;
- UX BYOA assistida ou Embedded Signup, ajuda completa e central de supressão;
- SLOs, alertas, on-call do horário contratado, custos e capacidade por tenant;
- pipeline com CI em `dev`/`main`, SBOM, scan e release coordenada dos três componentes.

**Testes e evidências obrigatórios:** onboarding sem operador até campanha fictícia; RBAC A/B; quotas em todos os caminhos; lifecycle/export/purge; concorrência de dez tenants com fairness; contratos Meta/SES/Asaas; disaster game day; relatório de custo e SLO por tenant.

**Critério de saída:** dez clientes operam dentro de SLO/budget; novo tenant não exige acesso de banco/Swagger; nenhum dado, credencial, fila ou custo cruza tenant; suporte e billing têm trilha auditável.

**Exclusões:** multi-região, marketplace, BI avançado e isolamento dedicado por cliente.

**Decisões humanas:** planos/preços/overage; Embedded Signup/Tech Provider; política antifraude/abuso; white-label básico; SLA e horário de suporte.

## F3 — Antes de 100 clientes

**Objetivo:** preparar capacidade, disponibilidade e operação para cem tenants sem blast radius global descontrolado.

**Critério de entrada:** F2 estável e lucrativa; volumes e sazonalidade medidos; forecast aprovado; gargalos demonstrados por métricas, não por suposição.

**Escopo obrigatório:**

- fan-out paginado durável, backpressure, fair scheduling e isolamento de heavy tenants;
- cursor em listas/scans, staging set-based, índices por `EXPLAIN`, pré-agregação e retenção/particionamento;
- pool/PgBouncer compatível, capacidade Redis/PostgreSQL e limites por conexão;
- HA, geo-backup conforme RPO/RTO, failover/restore periódico e on-call;
- observabilidade ponta a ponta, error budgets, status page e comunicação de incidentes;
- canary/rollback coordenado, imagens non-root/read-only, assinatura e attestations;
- operação de reputação Meta/SES e abuso com suspensão segura por tenant.

**Testes e evidências obrigatórios:** carga isolada representando 100 tenants; multi-réplica e falhas nas janelas críticas; chaos de DB/Redis/provedor; restore e failover cronometrados; custo por cenário; dashboards de SLO/headroom e exercícios de incidente.

**Critério de saída:** cem clientes com headroom aprovado; falha de tenant/provedor não paralisa a plataforma; RPO/RTO/SLA demonstrados; releases e rollback identificam o conjunto completo de artefatos.

**Exclusões:** microserviços por preferência, multi-região automática e customizações sem caso econômico.

**Decisões humanas:** orçamento HA/SRE; on-call 24×7; tiers dedicados; risco regional; metas contratuais de disponibilidade e suporte.

## F4 — Evolução futura

**Objetivo:** evoluir produto e plataforma após product-market fit, orientado por demanda comprovada.

**Critério de entrada:** operação de 100 clientes estável; dados de aquisição, retenção, margem, suporte e capacidade; tese comercial aprovada.

**Escopo candidato:**

- executar a decisão sobre catálogo/produtos/imagens/promoções ou remover definitivamente a promessa;
- white-label avançado, múltiplos domínios/marcas e planos dedicados;
- marketplace, novos canais, automação de growth e analytics avançado;
- isolamento dedicado ou multi-região quando SLA/blast radius justificarem;
- otimização de storage/CDN/imagens, somente se catálogo existir;
- automação de compliance, DSAR e evidências operacionais recorrentes.

**Testes e evidências obrigatórios:** discovery/UAT com ICP; security/privacy review por nova superfície; capacity e custo antes do rollout; acessibilidade A/AA; feature flags, canary e rollback; métricas de adoção e descontinuação.

**Critério de saída:** definido por iniciativa, com owner, métrica de valor, SLO, threat model, custo total e plano de reversão; nenhum item futuro reabre invariantes F0–F3.

**Exclusões:** qualquer feature sem problema/cliente/métrica comprovados; compartilhamento de credenciais; atalho que contorne RLS, consentimento, pipeline ou testes.

**Decisões humanas:** posicionamento final, ICP/verticais, catálogo, canais, white-label, regiões, investimento e estrutura de equipe.

## Sequência executiva

```text
F0: segurança + isolamento + exatamente-uma-vez
                         ↓
F1: primeiro externo recuperável e assistido
                         ↓
F2: dez clientes com onboarding, quotas e operação
                         ↓
F3: cem clientes com capacidade, HA e SRE
                         ↓
F4: evolução por product-market fit e evidência
```

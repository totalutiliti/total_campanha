# 02 — Arquitetura e qualidade

## Síntese

**Fato:** o projeto é um monólito modular bem separado em frontend Next.js, API NestJS, worker BullMQ, pacotes de banco/shared e IaC Azure. **Risco confirmado:** as fronteiras banco↔fila↔provedor não são transacionais e o worker documentado com `BYPASSRLS` invalida a principal barreira multi-tenant. A estrutura serve como base de piloto após Fase 0; não é confiável para disparos comerciais hoje.

## Arquitetura observada

```text
Browser Next.js
    │ Bearer + refresh cookie
    ▼
API NestJS ── PostgreSQL/Prisma/RLS
    │              ▲
    ├── Redis/BullMQ│
    ▼              │
Worker ── Meta Cloud API / SES-SMTP / Slack
    ▲
    └── webhooks Meta/Asaas via API
```

### Pontos fortes

- Módulos por domínio e worker separado das requisições web.
- DTOs Zod e TypeScript passaram `tsc --noEmit` nos cinco projetos.
- RLS usa `ENABLE`, `FORCE` e `WITH CHECK`; `tenantId` é validado antes de `SET LOCAL`.
- Jobs têm IDs determinísticos e há tentativas de chunking, pause/cancel e reconciliação.
- Env é validado por Zod; Swagger é desativado em produção; logs HTTP redigem cabeçalhos/alguns campos sensíveis.
- IaC e runbooks são extensos e incluem Key Vault, observabilidade, backup e rollback conceituais.

## Achados de arquitetura e código

### ACHADO ARC-001 — Envio não é exactly-once

**Área:** Arquitetura/filas
**Severidade:** Crítica · **Prioridade:** P0 · **Status:** Confirmado
**Evidência:** `dispatch-email.processor.ts:60-164`; `dispatch-whatsapp.processor.ts:72-166`.
**Descrição/impacto:** status é lido numa transação que termina antes da chamada externa; dois consumidores ou crash podem enviar novamente.
**Recomendação/aceite:** claim atômico com lease/versão, ledger/outbox e reconciliação; teste concorrente comprova uma chamada/cobrança.
**Esforço:** grande.

### ACHADO ARC-002 — Signup não é uma unidade atômica

**Área:** Auth/consistência
**Severidade:** Crítica · **Prioridade:** P0 · **Status:** Confirmado estaticamente; runtime não validado
**Evidência:** `auth.service.ts:77-110`; audit RLS.
**Impacto:** conta criada com resposta de erro e retry conflitante.
**Aceite:** rollback total quando auditoria falha usando role `app_user`.

### ACHADOS ARC-003/004/005/006

| ID      | Fato/risco                                                                             | Recomendação/aceite                                                               |
| ------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| ARC-003 | Status/mensagens/Redis são etapas separadas; falha produz estado parcial               | Transactional outbox e produtor reentrante; fault injection converge              |
| ARC-004 | Retry usa `take` fixo sem cursor, altera estado antes do enqueue e pode ignorar órfãos | `retry_count`, `next_attempt_at`, cursor/lock e DLQ; nenhum item sofre starvation |
| ARC-005 | Webhooks repetidos duplicam falhas/inbox/respostas                                     | Ledger de event ID e transições monotônicas; replay 10× = um efeito               |
| ARC-006 | Pause/cancel pode ocorrer após leitura e antes da chamada                              | Claim/revalidação junto ao efeito; zero chamadas após cancel efetivo              |

### ACHADO ARC-007 — Integrações sem deadline/breaker

Meta `fetch`, SMTP/SES e Asaas não configuram deadlines/circuit breaker explícitos. Jobs podem ocupar consumidores por tempo indeterminado. Aceite: fake lento dispara timeout, retry com jitter e breaker isolado por tenant/provedor.

### Qualidade e manutenção

- API e worker duplicam PrismaService, Crypto/Mail/Meta/Usage/render/env; correções podem divergir (`DEV-001`).
- Documentação descreve concorrências e infraestrutura que nem sempre correspondem ao código/perfil lean.
- MJML/CSV e filtros são superfícies complexas com dependências vulneráveis; validação precisa ser reforçada.
- `runUnscoped` existe no PrismaService normal apesar de o super-admin já ter cliente separado; reduzir APIs privilegiadas.
- API/worker não têm unitários; `--passWithNoTests` mascara ausência.

## Persistência

### Isolamento

- Tabelas tenant-scoped listadas têm RLS forte.
- `usage_logs` possui `tenant_id` mas é deliberadamente global, contrariando a regra do projeto (`DATA-003`).
- Worker documentado com migration role/BYPASSRLS torna `runInTenant` ineficaz (`SEC-001`).
- Testes cobrem apenas sete entidades; faltam opt-in, audit e inbox.

### Integridade

- Só `user_tenants` tem FKs robustas; campanha, mensagem, inbox e logs não garantem relações no mesmo tenant (`DATA-002`).
- Audit/usage não são append-only de fato; grants permitem mutação (`AUDIT-001`).
- `Mensagem.status_history` é JSON crescente, sem tabela de eventos e sem `created_at`; falta retenção/partição (`PERF-005`).
- Soft delete existe em Contato; hard delete mantém PII em logs/inbox e precisa política jurídica (`PRIV-004`).

### Migrações, rollback, backup

- Há duas migrations (`0001_init`, `0002_enable_rls`) e runbook de recuperação detalhado.
- IaC completo prevê 35 dias geo/HA; perfil lean documentado usa 7 dias, sem HA/geo e endpoints públicos (`OPS-001`).
- Não foi validado restore real, RPO/RTO ou estado Azure. Teste de restore é critério obrigatório antes de cliente externo.
- Alteração futura de schema deve seguir integralmente `instrucoes/instrucao_recuperacao_producao.md`; esta auditoria não executou schema/migrations.

## Performance e escalabilidade

| Escala                    | Comportamento provável                                                                                     | Bloqueadores                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 10 empresas, baixo volume | Monólito modular e Container Apps podem atender piloto assistido                                           | Resolver P0, RLS do worker, outbox/idempotência, limites e restore                                                |
| 100 empresas              | Contenção Redis, jobs por destinatário, throttle incorreto, retry scans, imports N+1, inbox/analytics live | Backpressure/fairness, paginação/cursor, índices, staging import, pré-agregação                                   |
| 1.000 empresas            | Scheduler global privilegiado e blast radius único tornam desenho inadequado                               | Separar control plane/data plane, quotas, pools, particionamento, retenção e isolamento de tenants de alto volume |

### Gargalos confirmados

- Campanha carrega todos os destinatários e cria um job por pessoa (`PERF-002`).
- Importação coloca linhas/PII no Redis e executa find/update/create por contato (`PERF-003`).
- `contains` sem trigram, tags/JSON sem GIN comprovado, inbox N+1, mensagens sem paginação e analytics live (`PERF-004`).
- Throttle calcula delay por campanha, não por conexão/tenant/réplica (`PERF-001`).
- Redis e banco não têm política de retenção/partição para crescimento prolongado.

## Dependências e regressão

`pnpm audit --prod` encontrou **48 vulnerabilidades de runtime**: 1 crítica, 15 altas, 27 moderadas e 5 baixas. A versão Next.js 14.2.18 é bloqueadora (`SEC-002`); MJML/html-minifier, Multer, Nodemailer e transitivas também exigem atualização e avaliação de explorabilidade. Atualizar sem E2E é arriscado, portanto `SUPPLY-001` e `TEST-001` são dependentes.

## Critérios arquiteturais para sair da Fase 0

1. Worker com role de mínimo privilégio e teste cross-tenant.
2. Claim/outbox/idempotência para dispatch e webhooks.
3. Signup transacional.
4. Throttle agregado e cancelamento sem corrida.
5. Sender por tenant e feedback SES.
6. FKs compostas e audit/usage protegidos.
7. Testes de concorrência/falha e restore documentado.

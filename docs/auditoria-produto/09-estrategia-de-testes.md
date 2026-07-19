# 09 — Estratégia de testes

## Situação atual

| Tipo                  | Evidência                                             | Situação                                          |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| Unitário API          | `apps/api/jest.config.cjs`; nenhum `src/**/*.spec.ts` | Executado diretamente: **No tests found**, exit 1 |
| Unitário worker       | `apps/worker/jest.config.cjs`; nenhum spec            | Executado diretamente: **No tests found**, exit 1 |
| DB/RLS                | `packages/db/tests/rls.test.ts`                       | Existe; não executado nesta auditoria             |
| Tenant isolation      | `apps/api/test/tenant-isolation/entidades.spec.ts`    | Existe para 7 entidades; não executado            |
| E2E API               | Config aponta `test/e2e/**/*.spec.ts`                 | Nenhum spec localizado                            |
| Frontend              | package diz “sem testes”; script Playwright           | Sem dependência/config/spec Playwright            |
| Contrato/provedor     | Não encontrado                                        | Ausente                                           |
| Segurança             | Gitleaks CI e histórico local mascarado               | Parcial; sem SAST/DAST/container/SBOM             |
| Acessibilidade/visual | Não encontrado                                        | Ausente                                           |
| Performance/DR        | Runbooks, sem suíte/evidência                         | Ausente/não validado                              |

## Validações executadas nesta auditoria

- `tsc --noEmit` direto passou em API, web, worker, db e shared.
- ESLint direto, sem cache, passou em API, worker, db, shared e web; isso valida regras estáticas configuradas, não comportamento.
- Jest API/worker executou sem `--passWithNoTests` e confirmou “No tests found” com exit 1; ausência não foi tratada como aprovação.
- `pnpm audit --prod` retornou 48 advisories (1 crítica, 15 altas, 27 moderadas, 5 baixas).
- Gitleaks no histórico concluiu sem leaks dentro da allowlist/config; scan completo do diretório não concluiu.
- O host permaneceu em Node `24.14.0`/pnpm `11.9.0`, enquanto `.nvmrc`/`packageManager` definem Node 20/pnpm 9.12. Scripts pnpm capazes de reconciliar `node_modules` não foram repetidos.

Não executados: RLS/tenant-isolation (chamam `pnpm prisma migrate deploy` em Testcontainers e o pnpm local tentaria reconciliar dependências), build, E2E, browser, carga, DR, Meta/SES/Asaas, Azure e banco real.

## Princípios da estratégia

1. Ambientes descartáveis, fakes de provedores e dados 100% sintéticos.
2. Testar invariantes no banco e nas fronteiras DB↔Redis↔provedor.
3. Cada P0/P1 recebe teste de regressão antes de ser fechado.
4. Concorrência, replay e falha parcial são casos normais, não exceções.
5. Tenant A/B em todo teste de domínio/arquivo/cache/fila/log.
6. E2E nunca envia comunicação real; endpoints de fakes devem ser exigidos pelo env test.

## Matriz de testes críticos

| Fluxo                  | Risco                        | Tipo necessário          | Cenários principais e de erro                                             | Dados                                    | Atual        | Prioridade | Critério de aceite                                   |
| ---------------------- | ---------------------------- | ------------------------ | ------------------------------------------------------------------------- | ---------------------------------------- | ------------ | ---------- | ---------------------------------------------------- |
| Signup                 | Estado parcial/RLS/audit     | Integração+E2E           | sucesso; audit falha; email duplicado; retry                              | tenants/users fictícios                  | Ausente      | P0         | commit completo ou rollback total com `app_user`     |
| Login/refresh/logout   | brute force/replay/corrida   | Unit+integração+E2E      | senha/TOTP errado; enumeração; duas abas; refresh replay; logout          | usuários A/B/admin                       | Ausente      | P0         | genérico, limits, um sucessor e revogação            |
| MFA/admin/impersonação | tomada de conta/auditoria    | Integração+E2E segurança | setup/verify/disable/recovery; step-up; XSS/session; ator dual            | admin/superadmin                         | Ausente      | P1         | segredo cifrado e atos duplamente auditados          |
| Isolamento API         | BOLA/cross-tenant            | Integração DB+API        | CRUD A por token B em todas as tabelas                                    | 2 tenants                                | Parcial DB   | P0         | zero leitura/mutação cruzada                         |
| Isolamento worker      | BYPASSRLS/IDs cruzados       | Integração worker        | job mistura tenant/mensagem/campanha/conexão                              | 2 tenants + fake provider                | Ausente      | P0         | falha antes de chamar provedor                       |
| Contato CRUD/LGPD      | PII residual/irreversível    | Integração+E2E           | soft; hard; inbox/log/Redis/backup; papel editor                          | contato sintético em todas as estruturas | Ausente      | P0         | matriz de dados cumpre retenção/anonimização         |
| Opt-in/out             | consentimento falso/replay   | Contrato+E2E             | double opt-in; token expiry/reuse; merge identidade; crawler GET; WA stop | emails/tels fictícios                    | Ausente      | P0         | prova append-only e nenhum envio sem base            |
| CSV import/export      | DoS/fórmula/parcial          | Unit+fuzz+integração     | MIME/conteúdo; 10MB/linhas/colunas; fórmula; restart                      | corpus adversarial sintético             | Ausente      | P1         | limites previsíveis, sem fórmula, resume idempotente |
| Segmentos              | query cara/injeção lógica    | Unit+property+DB         | profundidade/50 filhos; tags/JSON; A/B                                    | contatos sintéticos                      | Ausente      | P1         | limites e resultados corretos/isolados               |
| Template MJML/WA       | parser/XSS/SSRF/path         | Unit+security+snapshot   | markup inválido; include; atributos URL; variáveis; sandbox               | templates sintéticos                     | Ausente      | P1         | sem acesso externo/arquivo e preview seguro          |
| Criar/editar campanha  | inconsistência/UX            | API+E2E                  | rascunho; editar; reestimar; papel; conexão ausente                       | tenant fake                              | Ausente      | P1         | não envia ao criar; revisão preservada               |
| Confirmar/disparar     | clique acidental/duplicidade | E2E+concorrência         | cancelar modal; confirmar; dois workers; crash windows                    | 100 contatos fake                        | Ausente      | P0         | zero envio sem confirmação; exatamente uma chamada   |
| Pause/cancel/retry     | race/perda                   | Integração concorrente   | cancelar na barreira; enqueue falha; starvation; DLQ                      | fake provider/barriers                   | Ausente      | P0         | nenhum efeito após cancel e convergência             |
| Webhook Meta           | forja/replay/ordem           | Contrato+integração      | HMAC inválido; payload grande; replay 10×; delivered→read→old             | fixtures oficiais anonimizadas           | Ausente      | P0         | só assinatura válida; um efeito monotônico           |
| Email sender/feedback  | identidade/reputação         | Contrato+integração      | A/B sender; DKIM pending; hard/soft bounce; complaint/replay              | SES fake                                 | Ausente      | P0/P1      | sender correto e supressão imediata                  |
| Billing                | dupla assinatura/status      | Contrato+concorrência    | dois POST; webhook repetido/antigo; falha Asaas                           | sandbox/fake                             | Ausente      | P1         | uma assinatura e estado monotônico                   |
| Usage/audit            | custo/PII/mutação            | DB+integração            | usage falha após provider; app update/delete audit; PII scan              | eventos sintéticos                       | Ausente      | P0/P1      | envio não muda; append-only sem PII                  |
| Frontend roles         | dead ends/403                | Playwright               | ADMIN/EDITOR/VIEWER em todas as rotas/CTAs                                | 3 usuários fake                          | Ausente      | P1         | UI e backend coerentes                               |
| Acessibilidade/mobile  | WCAG/regressão               | Playwright+axe+manual    | dialogs, drawer, forms, tables, inbox 360px, zoom, NVDA                   | dados fake                               | Ausente      | P1         | zero violação crítica; teclado completa jornadas     |
| Performance            | memória/lag/fairness         | carga local limitada     | 1k/10k campanha/import, tenants concorrentes, provider lento              | gerador sintético                        | Ausente      | P1/P2      | SLO/budgets aprovados                                |
| Backup/restore         | perda/RTO                    | DR controlado            | PITR, counts, RLS, filas e retorno                                        | backup de fixture, nunca PII real        | Não validado | P0         | RPO/RTO medidos e evidência assinada                 |

## Gates de CI recomendados

### Toda PR para `dev` e `main`

- install frozen com Node 20/pnpm 9.12 verificados;
- lint com plugin Next/React/a11y, typecheck e build;
- unitários + integração + tenant isolation;
- gitleaks sem allowlist de diretório inteiro;
- dependency audit com política de exceção expirada;
- SAST e SBOM.

### Alterações de campanha/worker/webhook

- concorrência/fault injection/replay;
- contratos dos provedores com fixtures;
- nenhum endpoint externo real permitido pelo firewall do job.

### Alterações de UI

- Playwright desktop/360 px, axe e snapshots seletivos;
- jornada crítica por papel e confirmação de envio.

### Imagens de container/release

- scan de imagem, usuário non-root/read-only, assinatura/attestation;
- smoke em staging isolado; deploy coordenado dos três componentes;
- tenant-isolation obrigatório antes de PR, conforme regra do projeto.

## Dados de teste

- Faker com domínios `example.com`, telefones reservados/sintéticos e marcas fictícias.
- Proibir seeds/templates com cliente piloto em CI.
- Nunca clonar produção; se um bug exigir formato real, criar fixture mínima anonimizada e aprovada.
- Tokens/chaves de fake devem ser reconhecivelmente inválidos e não reutilizados fora de test.

## Critério de maturidade

- **Piloto:** todos os P0 com regressão automatizada; E2E principal, tenant worker, replay, cancel e DR passam.
- **10 clientes:** P1, contratos provedor, mobile/WCAG, SLOs e alertas.
- **100 clientes:** capacidade/fairness, retenção/partição, chaos e DR recorrente.

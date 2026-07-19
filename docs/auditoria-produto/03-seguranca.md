# 03 — Auditoria de segurança

## Veredicto do subescopo

**Risco crítico.** Há controles maduros no papel e no código — Argon2id, pepper, refresh rotation, RBAC, RLS `FORCE`, pgcrypto, Helmet, rate limit e gitleaks — mas três barreiras essenciais falham: worker com `BYPASSRLS`, webhook Meta sem assinatura e envio sem claim idempotente. A versão Next.js também possui advisory crítico.

Referências: [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/), [OWASP API Security](https://owasp.org/www-project-api-security/), [OWASP Top 10](https://owasp.org/Top10/) e [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## Controles positivos confirmados

- Senha: Argon2id + pepper e mensagem genérica de login.
- Refresh: cookie HttpOnly, rotação/reuse detection em Redis e TTL declarado de 7 dias.
- Access token: 15 minutos; frontend o mantém em memória, não `localStorage`.
- RBAC explícito em controllers de domínio com `TenantRoleGuard` fail-closed sem `@Roles`.
- RLS: `ENABLE`, `FORCE`, policy com `USING`/`WITH CHECK` e teste cross-tenant parcial.
- Tokens WhatsApp cifrados com `pgcrypto`; valores não foram lidos nem reproduzidos.
- Helmet, CORS allowlist configurável, Swagger fora de PROD e Pino com redaction.
- Rate limit global Redis e sobrescrita estrita em login/signup/forgot/reset.
- Gitleaks no CI e varredura mascarada do histórico sem leaks na cobertura atual.

## Achados críticos

### ACHADO SEC-001 — Worker contorna o RLS

**Área:** Multi-tenancy/Privilégios
**Severidade:** Crítica · **Prioridade:** P0 · **Status:** Confirmado no desenho documentado; PROD não validado
**Evidência:** `infra/dev/README.md:90-94`; `apps/worker/src/common/prisma.service.ts:30-37`; dispatchers.
**Descrição:** a role `migration_user` tem `BYPASSRLS`; `SET LOCAL app.current_tenant` não restringe suas queries. Jobs aceitam IDs independentes.
**Impacto/cenário:** bug ou payload cruzado pode ler/enviar com dados/credenciais de outro tenant.
**Recomendação:** role de runtime sem BYPASSRLS; scheduler privilegiado separado; derivar relações do registro validado.
**Aceite/testes:** payload A/B nunca alcança provedor; testes do worker usam role realista.
**Esforço:** grande.

### ACHADO WA-001 — Webhook Meta pode ser forjado/reproduzido

**Área:** Webhook/WhatsApp
**Severidade:** Crítica · **Prioridade:** P0 · **Status:** Confirmado
**Evidência:** `meta-webhook.controller.ts:22-94`; segredo em URL/DTO; `@SkipThrottle`.
**Descrição:** não valida `X-Hub-Signature-256`; aceita payload bruto, autenticado apenas por segredo na URL.
**Impacto:** eventos falsos/duplicados, inbox, opt-out e métricas incorretos.
**Recomendação/aceite:** HMAC do corpo bruto, rotação/remoção do segredo da URL, limites e ledger de eventos; assinatura inválida não enfileira e replay não muda estado.
**Esforço:** médio.

### ACHADO SEC-002 — Dependência web com advisory crítico

**Área:** Supply chain
**Severidade:** Crítica · **Prioridade:** P0 · **Status:** Confirmado pelo lockfile/advisory
**Evidência:** Next.js 14.2.18; `pnpm audit --prod`.
**Impacto:** bypass de autorização em condições do advisory; outros advisories DoS/cache também afetam a release.
**Recomendação:** atualizar para versão suportada, sem `force` cego; validar auth/cache/rotas.
**Aceite:** sem advisory crítico/alto aplicável; build e E2E completos.
**Esforço:** médio, regressão alta.

## Autenticação e sessão

| Controle                  | Estado                                                      | Avaliação                                                                                |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cadastro                  | API existe; UI ausente; signup atomicamente defeituoso      | Bloqueador `ARC-002`                                                                     |
| Login/logout/forgot/reset | Implementados com respostas genéricas e rate limit          | Positivo estaticamente; sem E2E                                                          |
| Confirmação de email      | Não encontrada                                              | P1 para self-service                                                                     |
| Política/hash             | Zod mínimo + Argon2id/pepper                                | Positivo; política precisa decisão e teste                                               |
| MFA                       | TOTP existe                                                 | `SEC-003`: segredo em claro/cliente, sem step-up/recovery/desativação segura             |
| Access token              | Retornado no JSON e mantido em memória JS                   | `SEC-004`: diverge da regra de HttpOnly e fica exposto a XSS durante a sessão            |
| Refresh                   | Cookie HttpOnly/Secure configurável/SameSite; rotação Redis | Get/set/del não atômicos; família/impersonação precisam robustez                         |
| Super-admin/impersonação  | JWT com `aud` e verificação no banco                        | Tokens em `sessionStorage`; ações impersonadas não carregam ator original de forma forte |
| Revogação                 | Redis por família                                           | Testes de corrida/replay ausentes                                                        |

### ACHADO SEC-003 — MFA/sessões privilegiadas insuficientes

**Severidade:** Alta · **Prioridade:** P1 · **Status:** Confirmado
**Recomendação:** TOTP gerado/cifrado no servidor, step-up e recovery codes; cookie HttpOnly/BFF para admin; claim `act` e rotação atômica.
**Aceite:** segredo não fica em claro, corrida gera um sucessor e toda impersonação registra os dois atores.

### ACHADO SEC-004 — Auth não é global deny-by-default

**Severidade:** Média · **Prioridade:** P2 · **Status:** Confirmado
`JwtAuthGuard` é aplicado controller a controller; uma futura rota esquecida nasce pública. Recomendação: `APP_GUARD` para auth e `@Public` explícito, além de cumprir a regra do projeto para access cookie/BFF com proteção CSRF adequada.

## Autorização endpoint a endpoint

- Contatos, segmentos, templates, campanhas, conexões, inbox, analytics e billing aplicam `JwtAuthGuard + TenantRoleGuard` e `@Roles` no servidor.
- Tenants `/me` usa JWT; super-admin usa guard próprio e audiência distinta.
- Webhooks/public/auth são explicitamente públicos, mas a autenticação do Meta é insuficiente.
- **Risco:** `EDITOR_CAMPANHA` pode acionar hard delete LGPD irreversível; restringir a ADMIN + step-up.
- **Risco:** UI mostra ações incompatíveis com role, mas o backend bloqueia; é problema UX, não bypass confirmado.

## Isolamento multi-tenant

**Classificação:** **multi-tenant com riscos críticos**.

- API de domínio: RLS forte quando conecta como `app_user` e sempre usa `runInTenant`.
- Worker: desenho com BYPASSRLS anula a barreira (`SEC-001`).
- `usage_logs`: tenant-scoped sem RLS (`DATA-003`).
- Cache/filas: jobs carregam `tenantId`, mas não há prova criptográfica/derivação única e faltam testes cross-tenant do worker.
- Arquivos: importação coloca PII dentro do payload Redis; não há catálogo/imagens.
- Logs/analytics/super-admin: caminhos privilegiados precisam append-only e auditoria do ator.
- Conexões Meta/Email são por tenant no schema; email dispatcher ignora remetente tenant (`EMAIL-001`).

## Entrada, API, XSS e uploads

- DTOs Zod reduzem mass assignment; UUIDs vêm de JWT/decorators nos domínios.
- Prisma parametrizado predomina; `SET LOCAL` usa string interpolada após regex UUID.
- Preview MJML usa `iframe sandbox=""`; XSS no preview não foi confirmado.
- MJML e transitivas têm advisories; templates precisam limite/timeout e teste de `mj-include`/recursos externos.
- Filtros recursivos têm limite por grupo, não profundidade/total (`API-001`).
- CSV: 10 MB existe, mas faltam limites estruturais, sniffing e neutralização de fórmula; PII segue no job Redis (`UPLOAD-001`).
- Não existe upload de produto/imagem, portanto MIME mágico, SVG, EXIF, malware, CDN e signed URL não puderam ser auditados. Devem ser requisitos antes de `PROD-001`.
- Helmet está ativo; CSP efetiva/defaults e headers precisam teste runtime. HTTPS é responsabilidade do ingress Azure e não foi verificado.

## Webhooks e idempotência

| Webhook | Autenticação                     | Idempotência/ordem                 | Resultado                        |
| ------- | -------------------------------- | ---------------------------------- | -------------------------------- |
| Meta    | Segredo URL; sem assinatura HMAC | Ausente; inbound ignora event ID   | Crítico `WA-001`, alto `ARC-005` |
| Asaas   | Header token, comparação simples | Sem event ledger/idempotency/ordem | Alto `BILL-001`                  |
| SES     | Não implementado                 | Não implementado                   | Alto `EMAIL-002`                 |

## Segredos e infraestrutura

- `.env` existe localmente e está ignorado; valores não foram lidos.
- Tokens WhatsApp usam pgcrypto e Key Vault é previsto; rotação ainda é backlog.
- Histórico Git: gitleaks mascarado concluiu sem achados na configuração atual.
- Working tree completo: varredura gitleaks não concluiu; `.gitleaks.toml` exclui docs/instruções/prompts integralmente, uma allowlist ampla.
- IaC completo usa private endpoints/HA; perfil lean usa endpoints públicos, backup 7 dias e sem HA. Estado real Azure não foi consultado.
- Dockerfiles rodam como root e API/worker incluem toolchain/dev deps; imagens/actions não são fixadas por digest/SHA.

## Supply chain

### ACHADO SUPPLY-001 — Advisories e pipeline de segurança insuficiente

**Severidade:** Alta · **Prioridade:** P1 · **Status:** Confirmado
**Evidência:** audit 48 (1/15/27/5), sem Dependabot/CodeQL/SAST/container scan/SBOM/signing; gitleaks sem checksum e allowlist ampla.
**Recomendação:** updates controlados, gates por severidade/explorabilidade, checksum/pin, non-root/read-only, SBOM e assinatura.
**Aceite:** pipeline em `dev`/`main` bloqueia CVE crítica/segredo/imagem insegura.

## Auditoria e incidentes

### ACHADO AUDIT-001 — Audit log não é uma trilha confiável

**Severidade:** Alta · **Prioridade:** P1 · **Status:** Confirmado
Grants permitem UPDATE/DELETE, eventos de auth/export não estão completos e alguns dados pessoais entram nos eventos. Implementar append-only real, role separada, correlação, minimização e cobertura de login/logout/falhas/reset/MFA/export/impersonação/configuração.

- Alertas de API 5xx, PG CPU e Redis memória existem no IaC; filas/provedores/abuso/custo anormal ainda precisam dashboards/alertas.
- Procedimento de recuperação existe, mas restore/RPO/RTO não foram comprovados.
- Nenhum teste ofensivo, scan externo, carga ou exploração foi executado.

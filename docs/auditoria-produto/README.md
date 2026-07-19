# Auditoria de produto — Total Campanha

## Identificação

- **Objetivo:** avaliar prontidão técnica, de segurança, privacidade, UX, operação e produto antes de comercialização multiempresa.
- **Data:** 19/07/2026 (America/Sao_Paulo).
- **Branch:** `dev` acompanhando `origin/dev`.
- **Commit:** `34f7d15f98a09ee753ae43fa8e6f8ff054095193` — `docs(memoria): registra infra enxuta de lancamento, aba Manual e fix BCP178`.
- **Método:** inspeção estática multidisciplinar, validações locais não destrutivas e pesquisa normativa oficial.
- **Veredicto:** **RISCO CRÍTICO — NÃO DISPONIBILIZAR**.

## Relação entre o baseline anterior e o atual

- **Baseline anteriormente auditado:** `34f7d15f98a09ee753ae43fa8e6f8ff054095193`.
- **Baseline revalidado nesta continuação:** o mesmo commit, na mesma branch `dev`.
- `git fetch origin` concluiu e `git rev-list --left-right --count HEAD...origin/dev` retornou `0 0`; portanto `HEAD`, upstream local e remoto real estavam sincronizados em 19/07/2026.
- Não há diff de código entre os dois baselines. Os 13 documentos já existiam localmente como não rastreados e foram revisados contra o commit remoto, não presumidos como parte dele.
- A contagem abaixo foi recalculada por ID e evidência. Como não houve alteração de código, todos os 57 achados foram classificados individualmente no backlog como **continua ativo**; não houve achado corrigido, parcialmente corrigido, insuficiente ou não aplicável nesta comparação.

## Adendo de remediação local — 19/07/2026

Após o fechamento da auditoria histórica, foi criada a branch local
`fix/auditoria-prontidao-f0` e implementado um primeiro lote F0. Este adendo não
altera a contagem nem apaga a evidência do baseline auditado. Também não autoriza
go-live: não houve staging/PROD, provedores reais, E2E completo, DR ou aprovação
de segurança/jurídica/comercial.

| ID         | Estado nesta branch local          | Evidência principal                                                                                                              |
| ---------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| SEC-001    | Parcialmente mitigado              | Runtime do worker com `app_user`; control-plane separado; boot rejeita role privilegiada; RLS 37/37                              |
| WA-001     | Parcialmente mitigado              | App Secret cifrado, HMAC do corpo bruto e ledger; teste HMAC verde; falta contrato/replay E2E Meta                               |
| ARC-001    | Parcialmente mitigado              | Claim/token atômico e `ENVIO_INCERTO`; teste concorrente prova uma chamada; falta fault injection/reconciliação operacional      |
| ARC-002    | Implementado localmente            | Signup em transação única com contexto tenant; falta E2E de rollback com role real                                               |
| SEC-002    | Implementado e validado localmente | Next 15.5.18; build de 29 páginas; audit sem alta/crítica                                                                        |
| DATA-001   | Parcialmente mitigado              | Mensagem, custo e contador concluem na mesma transação; ambiguidade pausa sem retry                                              |
| ARC-005    | Parcialmente mitigado              | `webhook_eventos` único e dedupe por provider ID; falta matriz replay/out-of-order automatizada                                  |
| PRIV-001   | Implementado localmente            | Consentimento pendente, token hash single-use/expirável e rota de confirmação                                                    |
| PRIV-002   | Parcialmente mitigado              | Admin/import não concedem opt-in; revogação gera log; decisão jurídica completa ainda pendente                                   |
| EMAIL-001  | Implementado e testado             | Dispatcher exige conexão ativa e usa `remetente` do tenant                                                                       |
| UX-001     | Implementado localmente            | Dialog mostra canal, público, custo e horário antes do POST                                                                      |
| ACC-001    | Implementado localmente            | Nome/descrição, foco inicial, trap, Escape e restauração; falta axe/NVDA/Playwright                                              |
| SUPPLY-001 | Parcialmente mitigado              | Gate CI em `dev/main`; zero alta/crítica, 3 moderadas (Nest 11/file-type 21 pendentes); SBOM/assinatura/non-root ainda pendentes |
| TEST-001   | Parcialmente mitigado              | 39 testes raiz + 37 isolamento; frontend/E2E/contratos/carga/DR permanecem                                                       |

Validações deste adendo: lint, typecheck, build web, audit de runtime, testes
unitários/RLS e tenant-isolation. A migration `0003` foi aplicada apenas em dois
PostgreSQL descartáveis de Testcontainers; nenhum banco persistente foi alterado.

## Escopo analisado

- Monorepo, frontend, API, worker, Prisma/migrations/RLS, integrações, filas, auth/RBAC, CI/CD, Docker/IaC, runbooks, documentação, testes e supply chain.
- Todas as rotas/páginas/controllers e jornadas identificadas.
- Perspectivas: arquitetura, segurança, UX/UI/WCAG, SaaS B2B, QA/DevOps, usuário não técnico, administrador e prospect.

## Ambientes

- **Repositório local:** analisado.
- **Ambiente local runtime:** não iniciado. Não havia web/API em 3000/3001; `docker compose ps` resolveu containers de outro projeto/configuração, portanto não era comprovadamente isolado.
- **Test/staging/PROD/Azure:** não acessados.
- **Meta/SES/Asaas/SMTP reais:** não acessados.

## Contagem de achados

| Severidade | Quantidade |
| ---------- | ---------: |
| Crítica    |          5 |
| Alta       |         34 |
| Média      |         14 |
| Baixa      |          4 |
| **Total**  |     **57** |

## Principais bloqueadores

1. Worker documentado com `BYPASSRLS`.
2. Webhook Meta sem assinatura HMAC e sem proteção de replay.
3. Dispatch sem claim idempotente, permitindo duplicidade.
4. Signup com persistência/auditoria não atômicas.
5. Next.js com advisory crítico e 48 advisories runtime no total.
6. Consentimento email/importação sem prova suficiente.
7. Remetente por tenant ignorado e ausência de bounce/complaint/supressão.
8. Hard delete/retensão/DSAR incompletos.
9. Catálogo/produtos/promoções ausentes frente à promessa.
10. Envio sem confirmação, rascunho sem edição e cobertura de testes insuficiente.

## Documentos

1. [00-relatorio-executivo.md](./00-relatorio-executivo.md)
2. [01-inventario-funcional.md](./01-inventario-funcional.md)
3. [02-arquitetura-e-qualidade.md](./02-arquitetura-e-qualidade.md)
4. [03-seguranca.md](./03-seguranca.md)
5. [04-privacidade-email-whatsapp.md](./04-privacidade-email-whatsapp.md)
6. [05-ux-ui-acessibilidade.md](./05-ux-ui-acessibilidade.md)
7. [06-visao-do-usuario-e-cliente.md](./06-visao-do-usuario-e-cliente.md)
8. [07-preparacao-saas.md](./07-preparacao-saas.md)
9. [08-performance-e-confiabilidade.md](./08-performance-e-confiabilidade.md)
10. [09-estrategia-de-testes.md](./09-estrategia-de-testes.md)
11. [10-backlog-priorizado.md](./10-backlog-priorizado.md)
12. [11-plano-de-evolucao.md](./11-plano-de-evolucao.md)

## Limitações

- Auditoria visual/runtime, contraste, teclado, leitor de tela e responsividade não executados.
- Estado real Azure/PROD, roles PostgreSQL, DNS, templates Meta e reputação SES não validados.
- `.env` local foi apenas identificado; valores não foram lidos.
- Possível conteúdo real em template/modelo foi registrado sem copiar valores; origem depende de validação humana.
- Gitleaks concluiu o histórico dentro da configuração; scan completo do diretório não concluiu.
- RLS/Testcontainers não rodaram porque seus helpers chamam pnpm/migration e o pnpm 11 local tentou reconciliar `node_modules` criado por versão diferente. Forçar isso alteraria dependências, o que era proibido.
- Ausência encontrada por busca estática deve ser revalidada se outra branch/ambiente contiver funcionalidades não versionadas aqui.
- O arquivo solicitado `docs/working-with-Codex.md` não existe neste commit. Foi lido o documento operacional disponível `docs/working-with-claude-code.md`, e a ausência foi tratada como lacuna documental, sem criar arquivo fora do diretório autorizado.

## Comandos executados

Todos foram anunciados antes, somente leitura ou validação sem alteração funcional:

```text
Get-Item <anexo>
Get-Content -Raw -Encoding UTF8 <anexo>
git status -sb
git branch -vv
git status --short
git rev-parse HEAD
git rev-parse origin/dev
git rev-parse --abbrev-ref --symbolic-full-name '@{u}'
git rev-list --left-right --count HEAD...origin/dev
git log -1 --format=%cI%n%s
git diff --stat
git diff --cached --stat
git remote -v
git fetch origin
rg --files
rg --files -uu -g '.github/**' -g '!.git/**'
rg --files -uu -g '.env*' -g '!.git/**'
rg --files -uu -g '.githooks/**' -g '!.git/**'
rg --files -g '*.spec.ts' -g '*.test.ts' -g '*playwright*'
rg -n <buscas direcionadas de rotas, modelos, auth, RLS, filas, integrações, UX/WCAG, infra e hardcodes>
Get-Content -Raw <manifests, configs, controllers, services, testes, workflows, Dockerfiles e documentos relevantes>
gitleaks version
gitleaks dir . --redact=100 --no-banner --no-color
gitleaks git . --redact=100 --no-banner --no-color
node --version
pnpm --version
pnpm typecheck
.\node_modules\.bin\tsc.cmd -p apps/api/tsconfig.json --noEmit
.\node_modules\.bin\tsc.cmd -p apps/web/tsconfig.json --noEmit
.\node_modules\.bin\tsc.cmd -p apps/worker/tsconfig.json --noEmit
.\node_modules\.bin\tsc.cmd -p packages/db/tsconfig.json --noEmit
.\node_modules\.bin\tsc.cmd -p packages/shared/tsconfig.json --noEmit
.\node_modules\.bin\eslint.cmd apps/api/src apps/worker/src packages/db/src packages/shared/src --ext .ts --no-cache
.\node_modules\.bin\eslint.cmd apps/web/src --ext .ts,.tsx --no-cache
.\node_modules\.bin\jest.cmd --config jest.config.cjs --runInBand --no-cache  (API e worker)
pnpm audit --prod --audit-level=low
docker compose ps
netstat -ano | Select-String <portas locais 3000/3001/5432/6379>
```

Também foram consultadas páginas oficiais OWASP, W3C, ANPD, Meta WhatsApp Business e AWS SES, sem autenticação ou mutação.

## Testes e validações reexecutados

- TypeScript direto: **passou** em API, web, worker, db e shared.
- ESLint direto, sem cache: **passou** em API, worker, db, shared e web.
- Jest unitário API: **No tests found**, exit 1; não contado como aprovação.
- Jest unitário worker: **No tests found**, exit 1; não contado como aprovação.
- Dependency audit: **48 vulnerabilidades** (1 crítica, 15 altas, 27 moderadas, 5 baixas).
- Gitleaks histórico: **nenhum leak encontrado** na cobertura/config atual.
- Runtime local: Node `24.14.0` e pnpm `11.9.0`, diferentes de `.nvmrc` Node 20 e `packageManager` pnpm `9.12.0`; scripts pnpm capazes de reconciliar dependências não foram executados.
- `docker compose ps` continuou resolvendo containers `total_carteira_*`, e não uma stack isolada Total Campanha; nenhuma aplicação/browser local foi iniciado.

## Testes não executados

- RLS/tenant-isolation, E2E API/frontend, Playwright, axe/NVDA, build, carga, concorrência, replay, contratos de provedor, migrations, seed, backup/restore/failover e smoke real.
- Motivos: ambiente não isolado, suites ausentes, risco de reconciliar dependências ou necessidade de serviços/credenciais reais.

## Áreas/informações ainda necessárias

- Inventário real de Azure/PROD e qual template Bicep foi aplicado.
- Roles/strings de conexão efetivas de API/worker e prova de RLS.
- Volumes, SLOs, custos, métricas, incidentes e restore mais recente.
- Configuração Meta (App Secret/webhook/templates/quality) e SES (identidades/eventos/supressões/reputação), sem expor segredos.
- Fonte/autorização dos exemplos de cliente.
- Termos, DPA, política pública, SLA, RPO/RTO e decisão sobre catálogo/preços.
- Ambiente staging descartável com tenants/contatos fictícios para browser/E2E.

## Decisões que dependem de aprovação humana

1. Escopo comercial: campanhas/CRM versus catálogo/promoções.
2. Infra lean ou completa e RPO/RTO/SLA.
3. Preços, limites, overage e custos BYOA.
4. Bases legais, retenção, DPA/DSAR e encarregado.
5. Embedded Signup e modelo de suporte.
6. White-label/identidade e dados do piloto em templates.
7. Go/no-go do piloto após evidências da Fase 0.

## Próximos passos

Executar a Fase 0 do [plano de evolução](./11-plano-de-evolucao.md), em branch dedicada, começando por isolamento do worker, idempotência/outbox, assinatura de webhook, signup transacional e atualização de dependências. Só então preparar staging isolado e reauditar os P0 com testes.

## Confirmações finais

- Nenhuma mensagem, email, WhatsApp, notificação ou campanha real foi enviada.
- Nenhum contato/dado real foi usado ou alterado.
- Nenhum segredo foi reproduzido; `.env` não foi aberto.
- Nenhum deploy, migration, seed, `prisma generate`, commit, push, merge ou PR foi realizado.
- Nenhuma dependência, configuração, código, banco, pipeline, infraestrutura, template existente ou regra de negócio foi alterado.
- Somente documentos em `docs/auditoria-produto/` foram adicionados pela auditoria.

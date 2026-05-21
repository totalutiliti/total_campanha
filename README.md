# Total Campanha

Plataforma SaaS multi-tenant de disparo de campanhas (Email + WhatsApp BYOA).

> **Status:** Fase 0 executada (2026-05-19) — monorepo `pnpm` + Prisma + Docker Compose
> + workflow CI já criados. Próximo passo: Fase 1 (auth e multi-tenancy) conforme
> `docs/BOOTSTRAP.md`.
> **Autor da arquitetura:** João (TotalUtiliti) + Claude.
> **Última atualização:** 2026-05-19.

## Setup local (primeira vez)

```bash
# 1. Pré-requisitos: Node 20 (ver .nvmrc), pnpm 9, Docker.
npm i -g pnpm@9.12.0

# 2. Instalar dependências.
pnpm install

# 3. Copiar variáveis de ambiente e ajustar segredos locais.
cp .env.example .env

# 4. Subir Postgres + Redis + MailHog.
pnpm db:up

# 5. Gerar a primeira migration (apenas na 1ª execução do dev).
#    A migration 0002_enable_rls (RLS + roles) já está no repo e roda em sequência.
pnpm db:migrate -- --name initial

# 6. Seed DEV (admin@cardanstencar.dev / admin123).
pnpm db:seed

# 7. Testes de RLS (gate do CI — RULES 1.5).
pnpm --filter @total-campanha/db test:rls

# 8. Subir os apps.
pnpm dev:api     # localhost:3001
pnpm dev:web     # localhost:3000
pnpm dev:worker
```

---

## Estrutura deste pacote

Este pacote replica o padrão de organização que evoluiu na Total IA Contábil, já incorporando os aprendizados (incidentes, deploys, regras anti-pegadinha). Tudo que está aqui você deve copiar para a raiz do repositório `total-campanha` quando criar o projeto.

```
total-campanha/
├── README.md                       # Este arquivo (visão geral do pacote)
├── CLAUDE.md                       # Lido automaticamente pelo Claude Code
├── docs/
│   ├── PRD.md                      # Visão de produto, escopo de fases
│   ├── ARCHITECTURE.md             # Arquitetura técnica completa
│   ├── SPECS.md                    # Schema Prisma, rotas, contratos
│   ├── RULES.md                    # Regras de negócio e segurança
│   ├── SKILL.md                    # Padrões de código e exemplos
│   ├── BOOTSTRAP.md                # Sequência de prompts para construir do zero
│   └── ADR/
│       └── 001-decisions.md        # Decisões arquiteturais
├── instrucoes/
│   ├── memoria.md                  # Memória de contexto para o Antigravity
│   ├── instrucao_azure.md          # Deploy, scaling, custo, governança Azure
│   ├── instrucao_deploys.md        # Pipeline de deploy passo a passo
│   ├── instrucao_recuperacao_producao.md  # Runbook de incidentes (do incidente Prisma)
│   ├── instrucao_whatsapp_byoa.md  # Onboarding WhatsApp Cloud API por tenant
│   └── instrucao_lgpd_dpa.md       # Operação como controlador/operador LGPD
├── infra/
│   └── (Bicep templates virão aqui na Fase 1)
└── .env.example                    # Variáveis de ambiente documentadas
```

## Como o Antigravity deve consumir

1. Abrir o repo → o Claude Code lê automaticamente `CLAUDE.md`.
2. Antes de qualquer task, ele DEVE ler também: `docs/RULES.md`, `instrucoes/memoria.md`, e o documento da pasta `instrucoes/` que for relevante à task.
3. Quando for fazer alteração de schema ou deploy, ele DEVE seguir `instrucoes/instrucao_recuperacao_producao.md` (checklist pré-alteração obrigatório).
4. O `docs/BOOTSTRAP.md` é o roteiro sequencial para implementar o produto do zero.

## Aprendizados aplicados de saída (vindos da Total IA Contábil)

| Aprendizado | Onde está aplicado neste pacote |
|---|---|
| `prisma db push --accept-data-loss` apagou tabela `users` em PROD | `instrucoes/instrucao_recuperacao_producao.md` — proíbe Prisma CLI em PROD, exige `$executeRawUnsafe` |
| Senha em PROD precisa de Argon2id+pepper consistente | `docs/RULES.md` seção 4 — padrão único, seed proibido em PROD |
| API key compartilhada entre projetos causou cobrança indevida (Olicon) | `instrucoes/instrucao_azure.md` — key por projeto, naming convention, monitor de custo por tenant |
| Cold start em min-replicas=0 quebrou UX | `docs/ARCHITECTURE.md` seção 6 — min-replicas=1 em PROD desde o dia 1 |
| Auto-scaling sazonal manual (IRPF jan-abr) | `instrucoes/instrucao_azure.md` — scripts `scale-up.sh` / `scale-down.sh` desde o bootstrap |
| Domínio custom precisa de 2 fases (verifyId → DNS → setup) | `instrucoes/instrucao_deploys.md` seção 4 — pipeline em fases nomeadas |
| Antigravity executou comando destrutivo sem confirmação | `CLAUDE.md` + `docs/RULES.md` — lista de comandos proibidos, exige confirmação humana |
| Sumiu aba do Super Admin após deploys | `instrucoes/instrucao_deploys.md` — checklist pós-deploy de smoke test visual |
| Monitoramento de custo IA por tenant veio tarde | `docs/SPECS.md` — tabela `usage_log` por tenant desde o dia 1 |
| Quota Azure OpenAI TPM precisa de pedido manual | `instrucoes/instrucao_azure.md` — checklist de quotas pré-deploy |
| LGPD do lado do operador (não só do tenant) | `instrucoes/instrucao_lgpd_dpa.md` — papel duplo de operador (sobre dados do tenant) e controlador (sobre dados do tenant-cliente) |

## Próximos passos sugeridos

1. Criar repo `totalutiliti/total-campanha` no GitHub.
2. Copiar este pacote inteiro para a raiz.
3. Rodar `git init && git add . && git commit -m "chore: bootstrap docs e instruções"`.
4. Abrir o repo no Antigravity e mandar: *"Leia CLAUDE.md, docs/PRD.md, docs/ARCHITECTURE.md, docs/SPECS.md, docs/BOOTSTRAP.md e instrucoes/memoria.md. Não escreva código ainda. Confirme o entendimento e me proponha a Fase 0 do BOOTSTRAP."*
5. A partir daí, seguir BOOTSTRAP.md fase por fase.

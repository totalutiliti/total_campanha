# Runbook — Deploy PROD (Total Campanha)

> **Versionado de propósito.** Este arquivo NUNCA vai para `.gitignore`.
> Toda mudança no processo de deploy entra aqui via PR.
>
> Escopo: este runbook é o procedimento **focado em blindagem contra
> regressão**. O detalhamento de infra Azure (Bicep, custom domain, Key Vault)
> está em `instrucoes/instrucao_deploys.md` — os dois se complementam.
>
> Convenção: cada passo é `[BLOQUEANTE]` (se falhar, PARE) ou `[INFORMATIVO]`.

Constantes do projeto:

```
RESOURCE_GROUP = rg-totalcampanha-prod
ACR            = acrtotalcampanha01
APPS           = tc-api-prod | tc-web-prod | tc-worker-prod
IMAGENS        = tc-api | tc-web | tc-worker
```

---

## §0 — Política `[BLOQUEANTE]`

- Deploy de PROD **só sai da `main`**, sem exceção rotineira.
- O deploy acontece pelo **pipeline GitHub Actions** (`deploy-api.yml`,
  `deploy-web.yml`, `deploy-worker.yml`) ao mergear PR na `main`.
- `docker push` de imagem `:prod` **manual** é proibido.
- A única exceção é o **hotfix urgente** (ver `CLAUDE.md` → "Protocolo de
  hotfix"). Mesmo nele, abrir PR pra `main` e `dev` antes de fechar a sessão.
- Os passos §1–§3 deste runbook são executados **automaticamente** pelo
  `anti-regression.yml` na PR. Rodá-los à mão (abaixo) serve para diagnosticar
  antes de abrir a PR.

---

## §1 — Pré-flight: estado limpo `[BLOQUEANTE]`

```bash
git fetch origin --tags --prune
git status --short            # deve estar vazio (sem mudança não commitada)
git rev-parse --abbrev-ref HEAD   # branch atual
```

Confirme: working tree limpo, branch é a que vai virar PR, `origin` atualizado.

---

## §2 — Gate 1: HEAD contém o tip de PROD `[BLOQUEANTE]`

Garante que o deploy não vai apagar trabalho que **já está em produção**.

```bash
PROD_TAG=$(git tag --list 'prod-*' --sort=-creatordate | head -1)
echo "PROD atual: ${PROD_TAG:-<nenhuma — primeiro deploy>}"

if [ -n "$PROD_TAG" ]; then
  PROD_TIP=$(git rev-list -n1 "$PROD_TAG")
  git merge-base --is-ancestor "$PROD_TIP" HEAD \
    && echo "OK — HEAD contém PROD." \
    || { echo "ABORTAR — HEAD não contém PROD. Faça merge de main nesta branch."; exit 1; }
fi
```

Se `ABORTAR`: faça `git merge origin/main` (ou rebase) e re-rode. **Não prossiga.**

---

## §3 — Gate 2: arquivos deletados `[BLOQUEANTE]`

```bash
PROD_TAG=$(git tag --list 'prod-*' --sort=-creatordate | head -1)
BASE=${PROD_TAG:-origin/main}
git diff --name-status "$BASE"..HEAD | grep '^D' || echo "(nenhuma deleção)"
```

Qualquer `D` em `apps/`, `packages/`, `infra/`, `.github/` exige:
- confirmação humana explícita do João (responda `yes`), **e**
- label `approved-deletion` na PR (o `anti-regression.yml` exige a label).

---

## §4 — Backup da imagem atual `[INFORMATIVO]`

Cada deploy do pipeline já publica `tc-*:prod-<sha>` no ACR — esses são os
backups naturais (rollback = apontar para uma tag anterior). Para fixar um
ponto de restauração explícito antes de um deploy de risco:

```bash
DATA=$(date -u +%Y%m%d-%H%M)
for IMG in tc-api tc-web tc-worker; do
  az acr import \
    --name $ACR \
    --source $ACR.azurecr.io/$IMG:prod \
    --image  $IMG:prod-backup-pre-$DATA
done
```

---

## §5 — Build + push `[INFORMATIVO]` (feito pelo pipeline)

Ao mergear a PR na `main`, os workflows `deploy-*.yml` rodam:
CI (lint, typecheck, test, tenant-isolation) → `docker build` →
`docker push $ACR.azurecr.io/tc-<app>:prod-<sha>`.

Disparo manual (deploy de um ref específico):

```bash
gh workflow run deploy-api.yml --ref main
gh workflow run deploy-web.yml --ref main
gh workflow run deploy-worker.yml --ref main
```

---

## §6 — Deploy `[INFORMATIVO]` (feito pelo pipeline)

Cada workflow roda, após o push da imagem:

```bash
az containerapp update -g $RESOURCE_GROUP -n tc-api-prod \
  --image $ACR.azurecr.io/tc-api:prod-<sha>
```

Container Apps cria uma **revisão nova**; o tráfego só migra após o health
check (`/api/v1/health/ready`) passar.

---

## §7 — Validação real `[BLOQUEANTE]`

Em **janela anônima** do navegador (sem cache/sessão):

1. `https://app.totalcampanha.com.br` — carrega e login real funciona.
2. **A feature afetada por este deploy** — testar o caminho completo.
3. **Features dos últimos 7 dias** — pegar a lista e testar cada uma:
   ```bash
   git log --since="7 days ago" --oneline
   ```
4. Conferir as abas críticas do Super Admin (lição L08 — não podem sumir):
   `/admin/tenants`, `/admin/usage`, `/admin/usage/por-tenant`, `/admin/audit`.
5. `bash scripts/smoke-test-prod.sh` deve passar.

Qualquer falha → §11 (rollback) imediatamente.

---

## §8 — Criar tag `prod-*` no git `[INFORMATIVO]` (automático)

O `tag-prod.yml` cria `prod-AAAAMMDD-HHmm` no commit deployado após o sucesso
do pipeline. Para criar manualmente (ex.: após hotfix manual):

```bash
TAG="prod-$(date -u +%Y%m%d-%H%M)"
git tag -a "$TAG" -m "Deploy PROD — $TAG" <commit-sha>
git push origin "$TAG"
```

---

## §9 — Manter revisão antiga ativa 48h `[BLOQUEANTE]`

NÃO desative a revisão anterior por 48h após o deploy — é o rollback instantâneo.

```bash
az containerapp revision list -g $RESOURCE_GROUP -n tc-api-prod \
  --query "[].{nome:name, ativa:properties.active, criada:properties.createdTime, trafego:properties.trafficWeight}" -o table
```

---

## §10 — Histórico de deploys (append-only)

Toda linha é adicionada após um deploy. Nunca editar linhas antigas.

| Data (UTC) | Tag prod-* | Commit | Apps | Responsável | Observação |
|---|---|---|---|---|---|
| _(o primeiro deploy preenche esta linha)_ | | | | | |

---

## §11 — Rollback `[BLOQUEANTE]` (~30s)

Trocar o tráfego para a revisão anterior (não precisa rebuildar):

```bash
APP=tc-api-prod   # ou tc-web-prod / tc-worker-prod

# 1. Listar revisões e achar a anterior estável.
az containerapp revision list -g $RESOURCE_GROUP -n $APP \
  --query "sort_by(@,&properties.createdTime)[].{nome:name,ativa:properties.active}" -o table

# 2. Mandar 100% do tráfego para a revisão anterior.
az containerapp ingress traffic set -g $RESOURCE_GROUP -n $APP \
  --revision-weight <revisao-anterior>=100

# 3. Confirmar.
curl -s https://api.totalcampanha.com.br/api/v1/health/ready
```

Depois do rollback: registrar no §10, abrir entrada no "Histórico de
incidentes" do `CLAUDE.md`, e investigar a revisão ruim **antes** de tentar de
novo (lição L08 — não recriar do zero; ver `git log`/`git diff` da janela).

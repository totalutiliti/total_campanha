# Trabalhando com o Claude Code neste projeto

> Como conduzir sessões do Claude Code (Antigravity) no Total Campanha sem
> deixar regressão, branch órfã ou trabalho não-mergeado para trás.
> Leitura complementar obrigatória: `CLAUDE.md` (raiz).

---

## (a) Prompt de abertura de sessão

Cole isto no início de **toda** sessão do Claude Code:

```
Leia o CLAUDE.md na raiz antes de qualquer coisa e siga-o à risca —
especialmente a seção "Blindagem contra regressão (Git)". Branch de
trabalho parte de `dev` atualizado, nunca de `main`. Não rode comando
destrutivo nem toque em PROD sem confirmação explícita minha. Antes de
executar qualquer comando, me diga qual é e por quê.
```

Se a sessão for sobre deploy, acrescente: *"Antes de qualquer passo de
deploy, leia `docs/runbooks/deploy-prod.md` e `instrucoes/instrucao_deploys.md`."*

---

## (b) O que o Claude Code NÃO faz sem aprovação explícita

O Claude **para e pede confirmação** (em mensagem separada, esperando seu
"sim"/"yes") antes de:

- Push direto na `main` — proibido sempre; só via PR.
- `docker push` de imagem `:prod` manual — proibido; deploy é via pipeline.
- Qualquer comando destrutivo em PROD: `DROP`, `TRUNCATE`, `DELETE` sem
  `WHERE`, `prisma db push`, `prisma migrate reset`, `prisma db seed`.
- Alteração de schema em PROD (mesmo via `ALTER TABLE`) — exige backup antes.
- `git push --force` / `git rebase` em branch compartilhada.
- Deletar arquivos em `apps/`, `packages/`, `infra/`, `.github/`.
- `--no-verify` em commit/push (burlar hook) — proibido salvo sua ordem.
- Rodar mais de 3 comandos com rate limit (`az containerapp exec` etc) por
  sessão.
- Mexer em segredos: criar/rotacionar chave, alterar Key Vault, editar `.env`.

Se uma guarda (hook ou CI) abortar, o Claude **não contorna** — avisa e espera.

---

## (c) Verificar branches órfãs / trabalho não-mergeado

Rode ao fim da sessão (ou a qualquer momento):

```bash
# Branch atual e se há mudança não commitada
git status --short
git rev-parse --abbrev-ref HEAD

# A branch atual já foi mergeada em dev? (vazio = NÃO mergeada)
git branch --merged dev | grep "$(git rev-parse --abbrev-ref HEAD)" || echo "NAO mergeada em dev"

# Commits locais ainda não enviados para o remoto
git log --branches --not --remotes --oneline

# Branches stale (>14 dias sem commit) — triagem de sexta
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/); do
  last=$(git log -1 --format=%ct "$b")
  dias=$(( ( $(date +%s) - last ) / 86400 ))
  [ "$dias" -gt 14 ] && echo "STALE ($dias d): $b"
done

# dev e main divergiram? (>5 commits → abrir PR de sync)
git rev-list --left-right --count origin/main...origin/dev
```

Se algo aparecer: a branch precisa virar PR (ou ser deletada se já mergeada),
ou os commits precisam de push. **Nada de trabalho fica só na máquina.**

---

## (d) Protocolo de fim de sessão (checklist)

Antes de fechar **qualquer** sessão, o Claude roda e reporta:

```
[ ] git status limpo (nada não commitado, ou commitado de propósito)
[ ] Todos os commits da sessão foram pushados (git log --branches --not --remotes vazio)
[ ] A branch de trabalho está mergeada em dev OU tem PR aberto apontando para dev
[ ] Se foi hotfix direto pra PROD: PR aberto para main E para dev (CLAUDE.md)
[ ] Nenhuma branch órfã criada (ver seção c)
[ ] CLAUDE.md atualizado se a sessão descobriu nova armadilha/decisão
[ ] instrucoes/memoria.md atualizado com data + resumo do que foi feito
[ ] Se houve incidente/regressão: entrada nova no "Histórico de incidentes" do CLAUDE.md
```

Qualquer item desmarcado → a sessão **não está pronta para fechar**. Resolva
ou registre explicitamente por que ficou pendente.

---

## Fluxo de trabalho normal (resumo)

```
git checkout dev && git pull origin dev
git checkout -b feat/minha-feature        # parte de dev atualizado
# ... trabalho, commits ...
git push -u origin feat/minha-feature
# abrir PR feat/minha-feature -> dev (anti-regression + ci rodam)
# após merge: branch deletada automaticamente
# promoção: PR dev -> main quando o lote está pronto
```

Deploy de PROD sai **só** de `main`, pelo pipeline. Ver `docs/runbooks/deploy-prod.md`.

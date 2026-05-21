# Proteção de branch — `main`

> Configuração **manual** no GitHub (precisa da UI). Faça isto **uma vez**,
> logo após o primeiro push do repositório. Sem isto, os workflows de
> anti-regressão existem mas não bloqueiam merge de verdade.

Repositório: `github.com/totalutiliti/total_campanha`

## Passo a passo (Settings → Branches → Add branch ruleset, ou Branch protection rules)

1. **Settings → Branches → Add rule** (ou *Rulesets → New ruleset*).
2. **Branch name pattern:** `main`
3. Marque:
   - ☑ **Require a pull request before merging**
     - ☑ Require approvals → **1**
     - ☑ Dismiss stale pull request approvals when new commits are pushed
   - ☑ **Require status checks to pass before merging**
     - ☑ **Require branches to be up to date before merging**
     - Status checks obrigatórios (busque e marque cada um):
       - `no-prod-regression`
       - `deleted-files-review`
       - `branch-source`
       - `lint-typecheck-test` *(do `ci.yml`)*
   - ☑ **Restrict who can push to matching branches** — deixe a lista vazia
     (ninguém faz push direto; só via PR).
   - ☑ **Do not allow bypassing the above settings** (inclui admins).
4. **Create / Save**.

## Repita (mais brando) para `dev`

Pattern `dev`: exija PR + status check `lint-typecheck-test`. Não precisa de
`no-prod-regression` (essa é só para `main`).

## Verificação

Depois de configurado, abra uma PR de teste de uma branch `chore/*` para `main`
e confirme que os 4 checks aparecem como obrigatórios e que o botão de merge
fica bloqueado até todos passarem.

## Observação sobre os status checks

Os checks só aparecem na lista do GitHub **depois** de terem rodado pelo menos
uma vez. Se não encontrar `no-prod-regression` etc. na busca, abra uma PR
qualquer para `main` primeiro (os workflows rodam), depois volte aqui e marque.

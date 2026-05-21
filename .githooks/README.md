# .githooks/

Hooks de Git versionados — blindagem contra regressão (ver `CLAUDE.md`).

## Instalação (1 comando após clone)

```bash
git config core.hooksPath .githooks
```

Isso é feito **automaticamente** após `pnpm install` (script `prepare` no
`package.json` da raiz). O comando acima só é necessário se você clonar e não
rodar `pnpm install`.

Para confirmar que está ativo:

```bash
git config core.hooksPath        # deve imprimir: .githooks
```

## O que cada hook faz

| Hook | Verifica |
|---|---|
| `pre-commit` | (1) bloqueia `.env`/segredos staged; (2) detecta AWS key / private key / JWT no conteúdo; (3) bloqueia `prisma db push` / `migrate reset` / `TRUNCATE TABLE` / `DROP TABLE` em código sem `/* SAFE */`. |
| `pre-push` | (A) deleções de código vs `origin/main` pedem confirmação; (B1) push direto na `main` é bloqueado; (B2) push de tag `prod-*` roda os 2 gates de deploy. |

## Marcação `/* SAFE */`

Operação destrutiva legítima (ex.: `TRUNCATE` no seed dev-only) deve ter
`/* SAFE: motivo */` na **mesma linha** do comando. Sem isso o `pre-commit`
bloqueia.

## Emergência

`git commit --no-verify` / `git push --no-verify` burlam os hooks — **proibido
salvo ordem explícita do João** (`CLAUDE.md` → "Regras de comunicação"). Se um
hook abortar, corrija a causa; não contorne.

## Por que `.githooks/` e não Husky

Hooks puros versionados em `.githooks/` + `core.hooksPath`: zero dependência
extra, funcionam igual em qualquer máquina, e o próprio repo é a fonte da
verdade. Husky exigiria um pacote a mais e um passo de build.

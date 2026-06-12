Estou iniciando um novo projeto e quero que ele já nasça blindado contra
os problemas que vivi no projeto anterior (regressões por deploy de
feature branch direto, branches órfãs nunca mergeadas, divergência
crônica dev↔main, runbooks não-versionados, perda de dados por comandos
Prisma destrutivos).

ANTES DE QUALQUER COISA, leia este prompt inteiro e me confirme que
entendeu cada uma das 5 entregas. Não comece a executar até eu dizer
"pode começar". Se algo aqui contradiz uma boa prática que você
conhece, me avise — não decida sozinho.

CONTEXTO DO PROJETO:
- Stack: [PREENCHER — ex: NestJS + Next.js + PostgreSQL/Prisma + Azure
  Container Apps + Azure OpenAI]
- Repositório: [PREENCHER — ex: github.com/joao/novo-projeto]
- Branches: main (produção), dev (staging/integração)
- Deploy: [PREENCHER — ex: Azure Container Registry + Container Apps,
  via docker push da tag :prod]
- Banco em PROD: [PREENCHER — ex: Azure PostgreSQL Flexible Server]

═══════════════════════════════════════════════════════════════
ENTREGAS (nesta ordem, uma por vez, me pedindo OK entre cada)
═══════════════════════════════════════════════════════════════

ENTREGA 1 — CLAUDE.md na raiz do repo
Crie um arquivo CLAUDE.md que toda sessão futura do Claude Code vai
ler automaticamente. Ele deve conter:

(a) Visão geral do projeto em 3-5 linhas (stack + propósito).

(b) Estrutura de branches:
    - main = produção, protegida, deploy sai daqui
    - dev = integração, recebe PRs primeiro
    - feature branches = curtas, partem de dev atualizado, voltam pra
      dev via PR, NUNCA são deployadas direto

(c) Regras inegociáveis de deploy (texto literal, sem flexibilizar):
    - `docker push` com tag :prod SÓ a partir de commit que está em
      origin/main
    - Antes de qualquer build pra PROD, rodar e mostrar:
        git fetch origin
        git merge-base --is-ancestor HEAD origin/main
      Se false → ABORTAR, abrir PR pra main primeiro
    - Antes de buildar, comparar HEAD com o tip atual de PROD:
        PROD_TIP=$(git rev-list -n1 $(git tag --list "prod-*" \
          --sort=-creatordate | head -1))
        git merge-base --is-ancestor $PROD_TIP HEAD
      Se false → ABORTAR (significa que tem trabalho em PROD que vai
      ser apagado)
    - Antes de buildar, listar arquivos deletados:
        git diff --name-status <PROD_TAG>..HEAD | grep '^D'
      Qualquer D em diretório de código pede confirmação humana
      explícita ("yes")

(d) Regras inegociáveis de dados (se houver banco):
    - NUNCA em PROD: prisma db push, prisma migrate reset,
      prisma db seed, DROP TABLE, TRUNCATE TABLE
    - Mudança de schema em PROD só via $executeRawUnsafe('ALTER TABLE…')
      PRECEDIDA de backup
    - prisma generate também pode ter efeito colateral, anunciar antes

(e) Regras de comunicação:
    - SEMPRE logar o comando que vai rodar e por quê ANTES de executar
    - Se uma guarda abortar, NÃO contornar — me avisar e esperar
    - Limitar comandos com rate limit (ex: az containerapp exec) a 3
      por sessão, espera de 60s

(f) Protocolo de hotfix urgente (exceção controlada):
    - Saiu de feature branch direto pra PROD? OK, mas o PRÓXIMO passo
      obrigatório, antes de fechar a sessão, é abrir PR dessa branch
      pra main E pra dev. Sem isso, branch vira órfã.

(g) Higiene de branches:
    - Toda branch feature é deletada após merge
    - Toda sexta: rodar triagem de branches stale (>14 dias sem commit)
    - dev e main devem estar sincronizadas; se divergirem mais de 5
      commits, abrir PR de sync

(h) Histórico de incidentes (vazio por enquanto, será preenchido
    quando algo acontecer; toda regressão futura vira entrada aqui)

ENTREGA 2 — Hooks locais do Git
Crie a infraestrutura pra hooks de pré-commit e pré-push, usando uma
ferramenta versionada (sugiro Husky se for Node, pre-commit do Python
se for Python, ou hooks puros em .githooks/ com `git config
core.hooksPath`).

Pré-commit:
- Bloquear commit se contiver: "prisma db push", "migrate reset",
  "TRUNCATE TABLE", "DROP TABLE" sem comentário /* SAFE */ adjacente
- Bloquear commit de arquivo .env, .env.prod, credenciais (regex de
  AKIA…, eyJhbGciOi… etc)

Pré-push:
- Se branch local = main e remote = origin: bloquear push direto
  (force PR)
- Se está fazendo push de tag prod-*: rodar os dois gates da §2.5
  (descritos no CLAUDE.md item c) e abortar se falhar
- Se há arquivos deletados em diretório de código vs origin/main:
  pedir confirmação

Documente como instalar (1 comando após clone).

ENTREGA 3 — GitHub Actions
Crie .github/workflows/anti-regression.yml com checks que rodam em
toda PR pra main e bloqueiam merge se falhar:

(a) Check "no-prod-regression": HEAD da PR contém o commit atualmente
    em PROD? (lê a última tag prod-*)
(b) Check "deleted-files-review": se há arquivos deletados em
    diretórios sensíveis (configurável), exige label
    "approved-deletion" na PR
(c) Check "branch-source": branch fonte é uma feature branch, não
    main, não tag

E .github/workflows/deploy.yml (ou nome equivalente):
- Trigger: push em main OU tag prod-*
- NÃO trigger em push de feature branch (fecha a porta do incidente)
- Roda build + docker push :prod
- Cria tag prod-YYYYMMDD-HHmm automaticamente após sucesso

Configure proteção de branch na main via repo settings (descreva como
fazer manualmente, já que precisa de UI):
- Require PR before merging
- Require status checks (os 3 acima)
- Require branches to be up to date before merging
- Restrict who can push to main (só via PR)

ENTREGA 4 — Runbook de deploy versionado
Crie docs/runbooks/deploy-prod.md (não em pasta com .gitignore — ESTE
arquivo precisa ser versionado, sem exceção). Conteúdo:

§0 — Política: deploy só sai de main, sem exceção rotineira
§1 — Pré-flight: comandos pra confirmar estado limpo
§2 — Gate 1 (HEAD contém PROD_TIP)
§3 — Gate 2 (diff de arquivos deletados)
§4 — Backup da imagem atual no ACR (tag prod-backup-pre-DATA)
§5 — Build + push
§6 — Deploy (az containerapp update ou equivalente)
§7 — Validação real (janela anônima, testar feature afetada E features
     recentes dos últimos 7 dias)
§8 — Criar tag prod-* no git apontando pro commit
§9 — Manter revisão antiga ativa 48h
§10 — Histórico de deploys (append-only, data + commit + responsável)
§11 — Rollback (~30s via traffic switch, comando pronto)

Cada passo numerado, cada comando completo (não "execute o build"
mas o comando literal), e marcações claras de [BLOQUEANTE] vs
[INFORMATIVO].

ENTREGA 5 — Documento de "como usar Claude Code neste projeto"
Crie docs/working-with-claude-code.md com:

(a) Prompt de abertura sugerido pra colar no início de toda sessão
    (curto, manda ler o CLAUDE.md)
(b) Lista de coisas que Claude Code NÃO faz sem aprovação explícita
(c) Como verificar, ao fim de cada sessão, se ela deixou branches
    órfãs ou trabalho não-mergeado
(d) Protocolo de "fim de sessão": antes de fechar, rodar checklist
    (commits pushed? branch mergeada ou em PR aberto? CLAUDE.md
    atualizado se descobriu nova armadilha?)

═══════════════════════════════════════════════════════════════
ORDEM E APROVAÇÕES
═══════════════════════════════════════════════════════════════

1. Confirma que entendeu as 5 entregas e me lista cada uma em 1 linha
2. Espera meu "pode começar"
3. Faz Entrega 1, me mostra o CLAUDE.md inteiro, espera OK
4. Faz Entrega 2, me mostra os hooks, espera OK
5. (mesmo padrão pras 3, 4, 5)
6. No final, faz um commit único "chore: bootstrap de segurança do
   projeto (CLAUDE.md, hooks, CI, runbook)" e abre PR pra main mesmo
   estando vazio — pra exercitar o fluxo de PR desde o primeiro dia

NÃO presuma stack ou ferramenta sem perguntar. Se eu não preenchi o
contexto do projeto no topo, pergunte antes de começar.
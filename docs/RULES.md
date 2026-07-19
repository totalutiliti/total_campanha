# RULES — Total Campanha

> Regras imperativas de negócio, segurança e implementação. Toda PR que violar uma dessas regras é rejeitada.

## 1. Multi-tenancy

1.1. **TODA tabela de domínio tem `tenant_id UUID NOT NULL`** com índice. Exceções (tabelas globais) estão explicitamente listadas em `SPECS.md`.

1.2. **RLS ativo em toda tabela tenant-scoped.** Policy padrão:
```sql
USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
```

1.3. **`tenant_id` SEMPRE vem do JWT**, nunca do body/query/header da request.

1.4. **Middleware `TenantInterceptor`** executa `SET LOCAL app.current_tenant` em toda transação Prisma. Nenhuma query escapa.

1.5. **Suíte `test/tenant-isolation/`** cobre as 5 violações clássicas: leitura cross-tenant, escrita cross-tenant, list sem filtro, update via id de outro tenant, delete via id de outro tenant. **Obrigatória no CI antes de merge.**

1.6. **Super Admin** usa role separado com `BYPASSRLS`, com audit log em toda ação.

1.7. **Worker operacional usa `app_user`**, nunca `migration_user`. Descobertas
cross-tenant de jobs recorrentes usam cliente de control-plane separado e de
somente leitura; cada acesso de domínio volta a `runInTenant`. O processo deve
abortar no boot se `DATABASE_URL` contiver a role privilegiada.

## 2. Banco de dados em produção

2.1. **PROIBIDO** em PROD (nunca, sem exceção):
- `prisma db push` (com ou sem `--accept-data-loss`)
- `prisma migrate reset`
- `prisma migrate dev`
- Qualquer comando que inclua flag `--accept-data-loss`, `--force-reset`, `--skip-seed`
- `DROP TABLE`, `DROP DATABASE`
- `TRUNCATE` em tabelas de domínio
- `DELETE FROM tabela` sem `WHERE`
- Seed que apague dados

2.2. **PERMITIDO** em PROD:
- `prisma migrate deploy` (somente após review e backup)
- `$executeRawUnsafe()` com `ALTER TABLE`, `CREATE INDEX CONCURRENTLY`, `CREATE TABLE`
- Inserts e updates pontuais via SQL revisado

2.3. **Antes de qualquer alteração de schema em PROD**, executar checklist da seção 3 de `instrucoes/instrucao_recuperacao_producao.md`:
- Snapshot lógico do schema atual
- Contagem de registros das tabelas críticas
- Plano de rollback documentado
- PITR habilitado e janela conhecida
- Confirmação humana explícita do João

2.4. **Toda alteração destrutiva** (DROP, TRUNCATE, ou redução de coluna) só com confirmação humana **em mensagem separada** após apresentação do plano.

## 3. Autenticação

3.1. **Senhas:** Argon2id, time cost 3, memory 64 MB, parallelism 4. **Pepper** obrigatório (env `AUTH_PEPPER` em Key Vault). Bcrypt e SHA família são proibidos.

3.2. **Email é guardado em duas colunas:**
- `email_hash` (sha256 do email lowercased + pepper) — usado para login e unique constraint.
- `email` (cleartext) — exibido no painel.

3.3. **Login:** mensagem de erro sempre genérica: `"Email ou senha incorretos."`. Nunca diferenciar "email não existe" de "senha errada".

3.4. **Rate limit:** 5 tentativas de login por IP+email em 15min. Após 5, bloqueio de 30min.

3.5. **JWT:** access token 15 min, refresh token 7 dias. Refresh rotation obrigatória (token anterior invalidado ao gerar novo). Se refresh token reutilizado → invalida toda a sessão do usuário.

3.6. **Cookies:** access em memória (Next.js) ou HttpOnly; refresh sempre HttpOnly + Secure + SameSite=Lax + Path=/api/v1/auth/refresh.

3.7. **2FA opcional** via TOTP (`otplib`). Quando ativo, obrigatório no login.

3.8. **Reset de senha:** token aleatório (32 bytes), 1h validade, single-use. Ao resetar, invalida todas as sessões.

## 4. Tokens BYOA (WhatsApp Cloud API)

4.1. **Token nunca em texto puro no banco.** Coluna `token_encrypted BYTEA` recebe resultado de `pgcrypto.pgp_sym_encrypt(token, chave_kms)`.

4.2. **Chave de criptografia** em Key Vault, referenciada via env. Rotação anual obrigatória.

4.3. **Antes de salvar** uma conexão, chamar `GET /v22.0/{phone_number_id}` na Meta com o token. Se retornar 200 e o `display_phone_number` bater, salva. Se não, rejeita.

4.4. **Logs de chamadas à Meta** nunca incluem o token. Mascarar como `Bearer ...{ultimos_4_chars}`.

4.5. **Webhook secret** gerado pela plataforma (`crypto.randomBytes(32).toString('hex')`), único por tenant.

## 5. LGPD

5.1. **Opt-in obrigatório antes de incluir contato em campanha.** Sem registro em `opt_in_log` com `acao = OPT_IN` para o canal específico, o contato é ignorado pelo segmento.

5.2. **Opt-out one-click** em todo email (`{{unsubscribe_url}}`). Em WhatsApp, instrução no rodapé do template + processamento da palavra `SAIR` / `STOP` / `CANCELAR` no inbox que aciona opt-out automático.

5.3. **Direito ao esquecimento:** endpoint `DELETE /contatos/:id?lgpd=true` faz:
- Hard delete em `contatos`
- Anonimização em `mensagens` (substitui `contato_id` por `NULL` e adiciona `destinatario_hash`)
- Registro em `opt_in_log` da ação como `OPT_OUT` com origem `lgpd-direito-esquecimento`
- Audit log

5.4. **`opt_in_log` é imutável.** Sem UPDATE nem DELETE permitidos (revoke + revoke role + auditoria pg).

5.5. **DPA (Data Processing Agreement)** anexo ao termo de uso, aceito no signup. Versão controlada.

5.6. **Retenção de dados:** mensagens completas por 12 meses; depois, agregados estatísticos apenas. Definido em `instrucoes/instrucao_lgpd_dpa.md`.

## 6. Custo e instrumentação

6.1. **Toda chamada paga é instrumentada na hora**, em `usage_log`. Padrão:
```typescript
await this.usageService.log({
  tenantId,
  servico: 'meta.whatsapp.marketing.br',
  custoEstimadoBrl: 0.25,
  metadados: { campanhaId, contatoId, providerMessageId }
});
```

6.2. **Custo estimado vs real:** o `usage_log` guarda a estimativa no momento do envio. Webhook de status pode atualizar com valor real se Meta retornar custo (alguns endpoints retornam, outros não).

6.3. **Painel de custos por tenant existe desde o dia 1.** Não pode ser "implementado depois".

6.4. **Budget Azure:** alerta em 80% do mensal estipulado por João. Em 100%, **não suspende** — só notifica e freezing automático de novos tenants.

## 7. Disparos

7.1. **Throttling por tenant respeitando tier Meta.** Tabela:

| Tier Meta | Mensagens marketing/dia | Throttle BullMQ |
|---|---|---|
| 250 | 250 | 10/min |
| 1k | 1.000 | 40/min |
| 10k | 10.000 | 400/min |
| 100k | 100.000 | 4.000/min |
| unlimited | ∞ | 10.000/min (rate limit nosso por sanidade) |

7.2. **Janela de envio padrão:** 9h–20h horário do tenant (UTC-3). Configurável.

7.3. **Retry:** falhas transientes (5xx, rate limit Meta) → backoff exponencial 1min, 5min, 30min, 2h, 12h. Após 5 tentativas, marca `FALHOU` permanentemente.

7.4. **Falha em massa** (>10% das mensagens de uma campanha em 5 min) → pausa automática da campanha + alerta.

7.5. **Estimativa antes do disparo:** mostrar para o tenant o custo estimado antes de confirmar. Cancelar é gratuito até `iniciadaEm`.

## 8. Padrões de código

8.1. **Português brasileiro** para nomes de tabelas, colunas, módulos de domínio e mensagens de UI. Inglês permitido só em padrões da indústria (`createdAt`, `tenantId`, `status`). Em caso de conflito, optar pelo inglês para campos universais e pt-BR para entidades de domínio (`Contato`, `Campanha`, `Mensagem`).

8.2. **Sem `any`** em TypeScript. Usar `unknown` + narrowing ou Zod schemas.

8.3. **Validação de entrada:** Zod em TODO DTO. Nenhum `req.body` consumido sem validação.

8.4. **Erros:** lançar exceções tipadas (`BadRequestException`, `ForbiddenException`, etc.). Nunca retornar erro como `{ error: '...' }` em endpoint REST padrão.

8.5. **Logs:** `pino` ou logger NestJS, **nunca** `console.log` em código que vai para PROD. Logs estruturados (JSON), incluem sempre `tenantId` e `userId` quando aplicável, NUNCA tokens/senhas/PII bruta.

8.6. **Monetário:** sempre `Decimal` no banco e `decimal.js` na aplicação. Centavos em `Int` proibido para custos R$ (pode ter frações).

8.7. **Telefones:** sempre E.164 (`+5511999999999`). Conversão na entrada via `libphonenumber-js`.

8.8. **Emails:** lowercase no banco; validação RFC 5322 + lib `email-validator`.

8.9. **Testes:**
- Unitários com Jest para domain logic.
- Integração com `pg-mem` ou testcontainers + supertest para rotas.
- e2e (Playwright) para fluxos críticos (signup, criar campanha, disparar, ver analytics).
- **Tenant isolation** sempre.

## 9. Antigravity (Claude Code) — regras de execução

9.1. **Antes de QUALQUER comando destrutivo em PROD** (DROP, DELETE em massa, TRUNCATE, alterações destrutivas em Container Apps): **confirmação humana explícita por mensagem separada do João**.

9.2. **Antes de alterar schema:** ler `instrucoes/instrucao_recuperacao_producao.md`. Executar checklist pré-alteração.

9.3. **Antes de deploy:** ler `instrucoes/instrucao_deploys.md`. Executar smoke test pós-deploy.

9.4. **Antes de tocar em infra Azure:** ler `instrucoes/instrucao_azure.md`.

9.5. **Antes de mexer em integração WhatsApp:** ler `instrucoes/instrucao_whatsapp_byoa.md`.

9.6. **Antes de mexer em LGPD/dados pessoais:** ler `instrucoes/instrucao_lgpd_dpa.md`.

9.7. **Nunca commitar segredo.** `.env` está em `.gitignore`. Variáveis sensíveis em Key Vault.

9.8. **Atualizar `instrucoes/memoria.md`** quando:
- Criar novo arquivo de instrução
- Tomar decisão arquitetural relevante
- Resolver um incidente que vai virar lição

9.9. **Sumiu funcionalidade após deploy:** NÃO recriar do zero. Primeiro verificar `git log` + `git diff` da janela de tempo do deploy. Lição da Total IA Contábil — aba de Custos IA sumiu após merges; recriar sem investigar é desperdício.

9.10. **Compartilhamento de chave entre projetos:** PROIBIDO. Cada projeto (Total Campanha, Total IA Contábil, etc.) usa keys próprias com naming `{projeto}-{recurso}-{ambiente}`. Lição do incidente Olicon: R$ 237 foram cobrados no Total IA Contábil porque o sócio usou a key errada.

## 10. Versionamento e branches

10.1. Branch padrão: `main` (protegida, requer 1 review).
10.2. Feature branches: `feat/{descricao-curta}`.
10.3. Hotfix: `hotfix/{descricao}` direto da `main`.
10.4. Commits seguindo Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
10.5. Tag de release semver: `v1.2.3`. Cada tag gera artefato de imagem versionado no ACR.

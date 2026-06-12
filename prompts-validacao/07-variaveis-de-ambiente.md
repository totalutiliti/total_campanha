# ⚙️ 07 — Variáveis de Ambiente

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
Este prompt se aplica a TODO projeto que usa variáveis de ambiente.
Ou seja: TODOS os projetos. Não há classificação por nível.
Aplicar INTEGRALMENTE.
```

---

## 📋 CONTEÚDO

### 1. Estrutura de arquivos `[UNIVERSAL]`

```
projeto/
├── .env.example       ✅ Vai pro Git (placeholders descritivos)
├── .env               ❌ .gitignore (valores reais locais)
├── .env.dev           ❌ .gitignore
├── .env.prod          ❌ .gitignore
└── .gitignore         → Contém: .env* !.env.example
```

### 2. Validação no boot da aplicação `[UNIVERSAL]`

```typescript
// A aplicação NÃO PODE subir sem variáveis críticas.
// Validar com Zod ou Joi no bootstrap.

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  AUTH_PEPPER: z.string().min(32, 'AUTH_PEPPER deve ter no mínimo 32 caracteres'),
  JWT_SECRET: z.string().min(32),
  // Adicionar todas as variáveis OBRIGATÓRIAS do projeto
});

// No main.ts ou config module:
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', parsed.error.format());
  process.exit(1); // NÃO subir a aplicação
}
```

### 3. Hierarquia de configuração `[UNIVERSAL]`

```
PRIORIDADE (maior → menor):
  1. Variável de ambiente do sistema (Container Apps, CI)
  2. Key Vault reference (via Container Apps secrets)
  3. .env file (desenvolvimento local)
  4. Valor default no código (APENAS para configs não-sensíveis)

REGRA: Segredos NUNCA têm valor default no código.
```

### 4. Template .env.example `[UNIVERSAL]`

```bash
# Cada variável deve ter:
# - Comentário explicando o propósito
# - Placeholder descritivo (não valor real)
# - Indicação se é obrigatória ou opcional

# ---- Obrigatórias ----
NODE_ENV="development"
PORT=3000
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DBNAME"
AUTH_PEPPER="GERAR_COM_openssl_rand_-base64_48"
JWT_SECRET="GERAR_COM_openssl_rand_-base64_64"

# ---- Opcionais ----
# REDIS_URL="redis://localhost:6379"
# AZURE_OPENAI_ENDPOINT="https://RECURSO.openai.azure.com/"
```

### 5. Checklist

```
  □ .env.example existe com todas as variáveis documentadas
  □ .env está no .gitignore
  □ Validação com Zod/Joi no bootstrap (app não sobe sem vars críticas)
  □ Nenhum segredo tem valor default no código
  □ Variáveis sensíveis vêm do Key Vault em produção
  □ Cada variável tem comentário explicando propósito
```

````markdown
## Env Vars — Regras para Antigravity

- Ao criar nova variável de ambiente: ADICIONAR ao .env.example com placeholder
- NUNCA colocar valor real no .env.example
- Se a variável é um segredo: documentar que vem do Key Vault
- Se a variável é obrigatória: adicionar ao schema de validação Zod/Joi
- Ao remover uma variável: remover do .env.example também
````

---

> **Próximo prompt:** `08-docker-seguro.md`

# 📚 21 — Documentação e Onboarding

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
Todo projeto que vai para produção precisa de documentação mínima.
Aplicar INTEGRALMENTE.
```

---

## 📋 CONTEÚDO

### 1. README.md `[UNIVERSAL]`

```markdown
Todo repo DEVE ter um README com:

  □ Nome do projeto e descrição (1-2 linhas)
  □ Stack tecnológico (NestJS, Next.js, PostgreSQL, Azure)
  □ Pré-requisitos (Node version, Docker, Azure CLI)
  □ Como rodar localmente (passo a passo)
  □ Variáveis de ambiente necessárias (referência ao .env.example)
  □ Como rodar testes
  □ Como fazer deploy
  □ Estrutura de pastas (resumida)
  □ Links para documentação adicional
```

### 2. CLAUDE.md (Contexto para Antigravity) `[UNIVERSAL]`

```markdown
Cada repo DEVE ter um CLAUDE.md na raiz com:

  □ Contexto do projeto (o que é, para quem)
  □ Arquitetura resumida
  □ Padrões do projeto (naming, estrutura, convenções)
  □ Referência à pasta prompts-validacao/
  □ Decisões arquiteturais importantes
  □ Problemas conhecidos e workarounds
  □ Comandos úteis (build, test, deploy, migrate)
```

### 3. Documentação de API `[UNIVERSAL]`

```
  □ Swagger/OpenAPI habilitado no NestJS (@nestjs/swagger)
  □ Acessível em /api/docs (dev) ou exportado como JSON
  □ Cada endpoint documentado com: descrição, parâmetros, responses
  □ Exemplos de request/response
  □ Autenticação documentada (como obter token)
```

### 4. Runbook de Operações `[UNIVERSAL]`

```
Documento com procedimentos para:
  □ Como fazer deploy manual (se CI falhar)
  □ Como fazer rollback
  □ Como verificar health/logs
  □ Como reiniciar serviços (LIGAR/DESLIGAR scripts)
  □ Como restaurar backup
  □ Como rotacionar segredos
  □ Contatos de emergência
```

### 5. Checklist

```
  □ README.md completo e atualizado
  □ CLAUDE.md com contexto para Antigravity
  □ .env.example com todas as variáveis documentadas
  □ Swagger/OpenAPI habilitado
  □ Runbook de operações documentado
  □ Changelog mantido (ou gerado automaticamente)
  □ Referência aos prompts-validacao/ no CLAUDE.md
```

````markdown
## Documentação — Regras para Antigravity

- Ao iniciar trabalho em projeto: LER o CLAUDE.md e README.md primeiro
- Ao criar funcionalidade nova: atualizar Swagger decorators
- Ao mudar variável de ambiente: atualizar .env.example
- Ao descobrir workaround/decisão importante: adicionar ao CLAUDE.md
- Se README está desatualizado: atualizar ANTES de commitar
````

---

> **Próximo prompt:** `22-contrato-e-sla.md`

# 📊 15 — Logging e Auditoria

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
Todo projeto precisa de logging. Aplicar INTEGRALMENTE.

O projeto processa dados pessoais?
  → SIM → Aplicar também seções [LGPD-LOG].
```

---

## 📋 CONTEÚDO

### 1. O que logar `[UNIVERSAL]`

```
SEMPRE LOGAR:
  ✅ Requests (method, path, status, duration, requestId)
  ✅ Erros com stack trace (nível error)
  ✅ Login, logout, falhas de autenticação
  ✅ Ações de criação, edição, exclusão de recursos
  ✅ Chamadas a serviços externos (OpenAI, APIs) com latência
  ✅ Eventos de negócio significativos
  ✅ Health check failures
```

### 2. O que NUNCA logar `[UNIVERSAL]`

```
NUNCA LOGAR:
  ❌ Senhas (nem hasheadas)
  ❌ Tokens JWT completos
  ❌ API keys / secrets
  ❌ Chaves de criptografia
  ❌ Request body de endpoints de auth (contém senha)
  ❌ CPF completo (mascarar: ***.***.789-00) [LGPD-LOG]
  ❌ Nome completo [LGPD-LOG]
  ❌ Dados financeiros (renda, patrimônio) [LGPD-LOG]
  ❌ Dados de saúde [LGPD-LOG]
  ❌ Conteúdo de documentos pessoais [LGPD-LOG]
```

### 3. Formato Estruturado `[UNIVERSAL]`

```typescript
// SEMPRE JSON estruturado (facilita busca e análise)
// NUNCA texto livre sem estrutura

// ✅ CORRETO
logger.info({
  requestId: 'req-abc123',
  method: 'POST',
  path: '/api/contribuintes',
  userId: 'user-uuid',
  tenantId: 'tenant-uuid',
  status: 201,
  duration: 45,
  message: 'Contribuinte criado',
});

// ❌ ERRADO
logger.info('User joao@email.com created contribuinte CPF 123.456.789-00');
```

### 4. Níveis de Log `[UNIVERSAL]`

```
ERROR  → Algo quebrou, precisa de ação (alertar)
WARN   → Algo suspeito, pode precisar de ação (monitorar)
INFO   → Evento de negócio normal (auditar)
DEBUG  → Detalhe técnico (apenas dev, NUNCA produção)

PRODUÇÃO: INFO + WARN + ERROR
DEV: DEBUG + INFO + WARN + ERROR
```

### 5. Audit Trail `[LGPD-LOG]`

```typescript
// Tabela separada, IMUTÁVEL (append-only)
// Quem fez o quê, quando, em qual dado

interface AuditLog {
  id: string;
  user_id: string;
  tenant_id: string;
  acao: string;          // CREATE, READ, UPDATE, DELETE, EXPORT, LOGIN
  entidade: string;      // contribuinte, declaracao, documento
  entidade_id: string;
  ip: string;
  user_agent: string;
  created_at: Date;
  // SEM updated_at, SEM deleted_at → IMUTÁVEL
}

// Retenção: mínimo 1 ano (logs), 5 anos (audit trail LGPD)
```

### 6. Correlação de Requests `[UNIVERSAL]`

```typescript
// requestId gerado no início de cada request
// Propagado para todos os logs, erros e chamadas externas
// Permite rastrear um request do início ao fim

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    req['requestId'] = req.headers['x-request-id'] || uuid();
    res.setHeader('x-request-id', req['requestId']);
    next();
  }
}
```

### 7. Checklist

```
  □ Logs em formato JSON estruturado
  □ requestId em cada log entry
  □ Dados pessoais mascarados nos logs [LGPD-LOG]
  □ Senhas, tokens, keys NUNCA logados
  □ Audit trail imutável para ações em dados pessoais [LGPD-LOG]
  □ Nível de log: INFO em produção, DEBUG apenas em dev
  □ Retenção: logs 1 ano, audit trail 5 anos [LGPD-LOG]
  □ Correlação de requests (requestId em toda a cadeia)
```

````markdown
## Logging — Regras para Antigravity

- TODOS os logs devem ser JSON estruturado com requestId
- NUNCA logar senhas, tokens, keys, CPF completo, dados financeiros
- Para dados pessoais: usar ID interno, nunca valor real
- Mascarar CPF (***.***.789-00), email (j***@domain.com)
- Audit log em tabela imutável para CRUD de dados pessoais
````

---

> **Próximo prompt:** `16-monitoramento-e-alertas.md`

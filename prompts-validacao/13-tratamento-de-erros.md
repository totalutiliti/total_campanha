# ⚠️ 13 — Tratamento de Erros

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
Todo projeto com backend ou frontend precisa de tratamento de erros.
Aplicar INTEGRALMENTE a qualquer projeto.
```

---

## 📋 CONTEÚDO

### 1. Separação: Usuário vs Logs `[UNIVERSAL]`

```
PARA O USUÁRIO:             PARA OS LOGS:
  Mensagem amigável          Stack trace completo
  Código de erro padronizado  Request body (sem dados sensíveis)
  requestId para suporte     User ID, tenant ID, IP
  Sem detalhes técnicos      Detalhes técnicos completos
```

### 2. Exception Filter Global (NestJS) `[UNIVERSAL]`

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const requestId = uuid();
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    
    const status = exception instanceof HttpException
      ? exception.getStatus() : 500;

    // Log COMPLETO (interno)
    this.logger.error({
      requestId,
      status,
      path: request.url,
      method: request.method,
      userId: request.user?.sub,
      error: exception instanceof Error ? exception.message : 'Unknown',
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Response LIMPA (para o usuário)
    response.status(status).json({
      statusCode: status,
      message: status >= 500
        ? 'Erro interno. Tente novamente.'
        : (exception as HttpException).message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 3. Retry com Backoff para Serviços Externos `[UNIVERSAL]`

```typescript
// Para chamadas a OpenAI, Document Intelligence, APIs externas
async function comRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 4. Graceful Shutdown `[UNIVERSAL]`

```typescript
// NestJS — fechar conexões antes de encerrar
app.enableShutdownHooks();

// Lidar com SIGTERM (Container Apps envia antes de kill)
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido, iniciando shutdown...');
  await app.close(); // Fecha conexões DB, Redis, etc.
  process.exit(0);
});
```

### 5. Frontend — Error Boundaries (Next.js) `[UNIVERSAL]`

```
  □ Error boundary global (captura erros React)
  □ Página 500 customizada (não mostrar stack trace)
  □ Página 404 customizada
  □ Toast/notification para erros de API
  □ Loading states em todas as operações async
```

### 6. Checklist

```
  □ Exception filter global no NestJS
  □ Stack trace NUNCA retornado ao usuário em produção
  □ requestId em toda response de erro
  □ Retry com backoff para chamadas a serviços externos
  □ Graceful shutdown (SIGTERM handler)
  □ Error boundaries no Next.js
  □ Páginas 404 e 500 customizadas
  □ Erros de validação com mensagens claras para o usuário
```

````markdown
## Erros — Regras para Antigravity

- TODA response de erro deve ter requestId
- NUNCA retornar stack trace em produção (NODE_ENV=production)
- Chamadas a APIs externas (OpenAI, etc.) DEVEM ter retry com backoff
- Graceful shutdown OBRIGATÓRIO em todo projeto
- Error boundaries no frontend para evitar tela branca
````

---

> **Próximo prompt:** `14-upload-e-processamento-arquivos.md`

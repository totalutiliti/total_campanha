# 🛡️ 12 — API Security

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto expõe uma API (REST, GraphQL, WebSocket)?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO → Pular.
```

---

## 📋 CONTEÚDO

### 1. Helmet (Headers de Segurança) `[UNIVERSAL]`

```typescript
import helmet from 'helmet';
app.use(helmet()); // Habilita: HSTS, X-Frame-Options, X-Content-Type-Options,
                   // CSP, Referrer-Policy, etc.
```

### 2. CORS Restrito `[UNIVERSAL]`

```typescript
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true,
  maxAge: 3600,
});
// ❌ NUNCA: origin: '*' em produção
```

### 3. Input Validation `[UNIVERSAL]`

```typescript
// TODA entrada do usuário DEVE ser validada
// NestJS: class-validator + class-transformer ou Zod

app.useGlobalPipes(new ValidationPipe({
  whitelist: true,       // Remove campos não declarados no DTO
  forbidNonWhitelisted: true, // Rejeita campos extras
  transform: true,       // Transforma tipos automaticamente
}));

// Exemplo DTO:
class CreateContribuinteDto {
  @IsString() @Length(11, 14) cpf: string;
  @IsString() @MinLength(2) @MaxLength(200) nome: string;
  @IsEmail() email: string;
  // Campos não declarados aqui → rejeitados automaticamente
}
```

### 4. Rate Limiting `[UNIVERSAL]`

```typescript
// Global: 60 req/min
// Auth endpoints: 5 req/min (ver prompt 05)
// Upload endpoints: 10 req/min
// API pública: 30 req/min por IP
```

### 5. Request Size Limits `[UNIVERSAL]`

```typescript
// Evitar ataques de payload gigante
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Para upload de arquivos: limite específico por rota
@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB
```

### 6. Error Handling — NUNCA expor stack trace `[UNIVERSAL]`

```typescript
// ❌ ERRADO — Produção retornando stack trace
{
  "statusCode": 500,
  "message": "Cannot read property 'id' of undefined",
  "stack": "TypeError: Cannot read property...\n    at UserService.find (/app/src/...)"
}

// ✅ CORRETO — Mensagem genérica + log interno
{
  "statusCode": 500,
  "message": "Erro interno. Tente novamente.",
  "errorCode": "INTERNAL_ERROR",
  "requestId": "req-abc123"
}
// Stack trace completo vai APENAS para os logs internos
```

### 7. SQL Injection `[UNIVERSAL]`

```
TypeORM e Prisma usam parameterized queries por padrão.
MAS CUIDADO com:
  ❌ Query builder com interpolação: .where(`name = '${input}'`)
  ❌ Raw queries com template strings: query(`SELECT * WHERE id = ${id}`)
  ✅ Parameterized: .where('name = :name', { name: input })
  ✅ Raw com params: query('SELECT * WHERE id = $1', [id])
```

### 8. Timeout `[UNIVERSAL]`

```typescript
// Timeout global para evitar requests pendurados
app.use(timeout('30s'));

// Para endpoints lentos (OCR, processamento):
@Timeout(120000) // 2 minutos
@Post('processar-documento')
async processar() { ... }
```

### 9. Checklist

```
  □ Helmet habilitado
  □ CORS com origens explícitas (nunca *)
  □ ValidationPipe global (whitelist + forbidNonWhitelisted)
  □ Rate limiting global + por rota sensível
  □ Request size limit (1MB padrão, ajustar para uploads)
  □ Error handler global (nunca expor stack trace em produção)
  □ Parameterized queries (nunca interpolação SQL)
  □ Timeout global (30s) + timeout específico para rotas lentas
  □ requestId em toda response para rastreamento
```

````markdown
## API Security — Regras para Antigravity

- TODA entrada de usuário deve passar por DTO validado
- NUNCA interpolar variáveis em SQL (usar parametrized queries)
- NUNCA retornar stack trace em produção
- Helmet + CORS + ValidationPipe + Rate Limiting = obrigatório
- Cada error response deve ter requestId para rastreamento
````

---

> **Próximo prompt:** `13-tratamento-de-erros.md`

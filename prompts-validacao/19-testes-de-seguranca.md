# 🧪 19 — Testes de Segurança

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto tem testes automatizados?
  → SIM → Adicionar testes de segurança ao suite existente.
  → NÃO → Criar ao menos os testes CRÍTICOS listados abaixo.

O projeto é multi-tenant?
  → SIM → Testes de isolamento RLS são OBRIGATÓRIOS [MULTI-TENANT].
```

---

## 📋 CONTEÚDO

### 1. Testes de Autenticação `[UNIVERSAL]`

```typescript
describe('Auth Security', () => {
  it('rejeita acesso sem token', async () => {
    const res = await request(app).get('/api/dados-protegidos');
    expect(res.status).toBe(401);
  });

  it('rejeita token expirado', async () => {
    const expiredToken = generateToken({ exp: Math.floor(Date.now()/1000) - 60 });
    const res = await request(app).get('/api/dados')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('não revela se email existe no sistema', async () => {
    const res1 = await request(app).post('/api/auth/login')
      .send({ email: 'existe@test.com', senha: 'errada' });
    const res2 = await request(app).post('/api/auth/login')
      .send({ email: 'naoexiste@test.com', senha: 'errada' });
    expect(res1.body.message).toBe(res2.body.message); // Mesma mensagem
  });

  it('bloqueia após 5 tentativas falhadas', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login')
        .send({ email: 'user@test.com', senha: 'errada' });
    }
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'user@test.com', senha: 'errada' });
    expect(res.status).toBe(429);
  });
});
```

### 2. Testes de Autorização (RBAC) `[UNIVERSAL]`

```typescript
describe('RBAC', () => {
  it('VIEWER não pode criar recursos', async () => {
    const token = await loginAs('VIEWER');
    const res = await request(app).post('/api/contribuintes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Test', cpf: '12345678900' });
    expect(res.status).toBe(403);
  });

  it('endpoint sem @Roles é bloqueado por padrão', async () => {
    // Testar que deny-by-default funciona
    const token = await loginAs('ADMIN');
    const res = await request(app).get('/api/endpoint-novo-sem-roles')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

### 3. Testes de Isolamento RLS `[MULTI-TENANT]`

```typescript
describe('Isolamento Cross-Tenant', () => {
  it('Tenant A não vê dados do Tenant B', async () => {
    // Criar dado no Tenant A
    const tokenA = await loginAsTenant('tenant-a');
    await request(app).post('/api/dados').set('Authorization', `Bearer ${tokenA}`)
      .send({ valor: 'segredo-do-A' });

    // Acessar como Tenant B
    const tokenB = await loginAsTenant('tenant-b');
    const res = await request(app).get('/api/dados')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.body.find(d => d.valor === 'segredo-do-A')).toBeUndefined();
  });

  it('Tenant B não edita dados do Tenant A', async () => {
    const dadoA = await criarDadoNoTenant('tenant-a');
    const tokenB = await loginAsTenant('tenant-b');
    const res = await request(app).put(`/api/dados/${dadoA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ valor: 'hackeado' });
    expect([403, 404]).toContain(res.status);
  });

  it('Tenant B não deleta dados do Tenant A', async () => {
    const dadoA = await criarDadoNoTenant('tenant-a');
    const tokenB = await loginAsTenant('tenant-b');
    const res = await request(app).delete(`/api/dados/${dadoA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect([403, 404]).toContain(res.status);
  });
});
```

### 4. Testes de Validação de Input `[UNIVERSAL]`

```typescript
describe('Input Validation', () => {
  it('rejeita campos extras não declarados', async () => {
    const res = await request(app).post('/api/contribuintes')
      .send({ nome: 'Test', cpf: '12345678900', campoMalicioso: 'xss' });
    expect(res.status).toBe(400); // forbidNonWhitelisted
  });

  it('rejeita SQL injection em parâmetros', async () => {
    const res = await request(app).get("/api/contribuintes?search=' OR 1=1 --");
    expect(res.status).not.toBe(200);
  });
});
```

### 5. Testes que Erros Não Expõem Dados `[UNIVERSAL]`

```typescript
describe('Error Handling Security', () => {
  it('não expõe stack trace em produção', async () => {
    const res = await request(app).get('/api/endpoint-que-causa-500');
    expect(res.body.stack).toBeUndefined();
    expect(res.body.message).not.toContain('/app/src/');
  });

  it('retorna requestId em erros', async () => {
    const res = await request(app).get('/api/endpoint-invalido');
    expect(res.body.requestId).toBeDefined();
  });
});
```

### 6. Checklist

```
  □ Testes de auth: sem token, token expirado, mensagem genérica
  □ Teste de lockout após tentativas falhadas
  □ Testes de RBAC: cada role só acessa o que deve
  □ Teste deny-by-default (endpoint sem @Roles = bloqueado)
  □ Testes de isolamento cross-tenant (CRUD) [MULTI-TENANT]
  □ Testes de validação de input (campos extras, SQL injection)
  □ Teste que erros não expõem stack trace
  □ Testes rodando no CI pipeline
```

````markdown
## Testes de Segurança — Regras para Antigravity

- Ao criar novo endpoint: criar teste de auth e RBAC correspondente
- Ao criar nova tabela com RLS: criar teste de isolamento cross-tenant
- Testes de segurança são TÃO importantes quanto testes de funcionalidade
- Se não sabe qual teste escrever: teste que Tenant A não vê dados de Tenant B
````

---

> **Próximo prompt:** `20-frontend-seguro.md`

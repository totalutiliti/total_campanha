# 🏢 06 — RBAC e Multi-Tenancy

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
NÍVEL 1 — CONTROLE DE ACESSO (RBAC)
  O projeto tem diferentes tipos de usuários com diferentes permissões?
    → SIM → Aplicar seções [UNIVERSAL].
    → NÃO → Se TODOS os usuários podem fazer TUDO, pular. (Raro em produção.)

NÍVEL 2 — MULTI-TENANCY
  O projeto é SaaS onde múltiplos clientes/organizações usam a mesma instância?
    → SIM → Aplicar seções [MULTI-TENANT].

NÍVEL 3 — SUPER ADMIN / PLATAFORMA
  Existe um admin da plataforma (TotalUtiliti) que gerencia todos os tenants?
    → SIM → Aplicar seções [SUPER-ADMIN].
```

---

## 📋 ÍNDICE

1. [RBAC Deny-by-Default](#1-rbac) `[UNIVERSAL]`
2. [Definição de Roles por Projeto](#2-roles) `[UNIVERSAL]`
3. [Guards NestJS](#3-guards) `[UNIVERSAL]`
4. [PostgreSQL RLS — Row Level Security](#4-rls) `[MULTI-TENANT]`
5. [Testes de Isolamento Cross-Tenant](#5-testes) `[MULTI-TENANT]`
6. [Super Admin e Tenant Interno](#6-super-admin) `[SUPER-ADMIN]`
7. [Audit Log de Acessos](#7-audit-log) `[UNIVERSAL]`
8. [Checklist e Instruções Claude Code](#8-checklist) `[UNIVERSAL]`

---

## 1. RBAC Deny-by-Default `[UNIVERSAL]`

```
PRINCÍPIO: Negar tudo, liberar explicitamente.

  ❌ ERRADO (allow-by-default):
    → Endpoint novo é acessível por qualquer usuário logado
    → Dev esquece de adicionar guard → brecha

  ✅ CORRETO (deny-by-default):
    → Todo endpoint é bloqueado por padrão
    → Guard global exige autenticação
    → @Roles() decorator define QUEM pode acessar
    → Endpoint sem @Roles() = ninguém acessa (ou só admin)
```

### Implementação NestJS

```typescript
// Guard GLOBAL — todo endpoint exige auth
app.useGlobalGuards(new AuthGuard(), new RolesGuard());

// Cada endpoint declara quem pode acessar
@Get('contribuintes')
@Roles('ADMIN_ESCRITORIO', 'CONTADOR')
async listar() { ... }

// Endpoint público (exceção explícita)
@Public() // Decorator que bypassa os guards
@Post('auth/login')
async login() { ... }
```

---

## 2. Definição de Roles `[UNIVERSAL]`

```
COMO DEFINIR ROLES PARA QUALQUER PROJETO:

1. Liste os TIPOS de usuário
2. Para cada tipo, liste O QUE pode fazer
3. Crie a menor quantidade de roles necessárias
4. Documente na migration ou em arquivo de referência

EXEMPLO GENÉRICO:
  ADMIN     → Gerencia tudo dentro do tenant
  OPERATOR  → Opera o sistema (CRUD principal)
  VIEWER    → Apenas visualiza
  
PRINCÍPIOS:
  → Menor privilégio: dar o mínimo necessário
  → Separação de funções: quem cria ≠ quem aprova
  → Roles são por TENANT (em SaaS multi-tenant)
```

---

## 3. Guards NestJS `[UNIVERSAL]`

```typescript
// RolesGuard — verifica se o usuário tem a role necessária
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return false; // Deny-by-default
    
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Extraído do JWT pelo AuthGuard
    
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}
```

---

## 4. PostgreSQL RLS `[MULTI-TENANT]`

```sql
-- RLS garante que tenant A NUNCA vê dados de tenant B,
-- mesmo se a aplicação tiver bug

-- 1. Habilitar RLS na tabela
ALTER TABLE contribuintes ENABLE ROW LEVEL SECURITY;

-- 2. Criar política
CREATE POLICY tenant_isolation ON contribuintes
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- 3. Forçar RLS mesmo para o owner da tabela
ALTER TABLE contribuintes FORCE ROW LEVEL SECURITY;

-- 4. No backend, ANTES de cada query:
-- SET app.tenant_id = 'uuid-do-tenant-do-jwt';
```

### NestJS — Setar tenant no início de cada request

```typescript
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.user?.tid; // Do JWT
    if (tenantId) {
      // Setar no PostgreSQL para RLS
      this.dataSource.query(`SET app.tenant_id = '${tenantId}'`);
    }
    next();
  }
}
```

---

## 5. Testes de Isolamento Cross-Tenant `[MULTI-TENANT]`

```typescript
// TESTE OBRIGATÓRIO antes de cada deploy
describe('Isolamento RLS', () => {
  it('Tenant A não vê dados do Tenant B', async () => {
    // Criar dado no Tenant A
    await setTenant('tenant-a');
    await repo.save({ nome: 'Dado do A', tenant_id: 'tenant-a' });

    // Tentar acessar como Tenant B
    await setTenant('tenant-b');
    const resultados = await repo.find();

    // DEVE retornar vazio
    expect(resultados).toHaveLength(0);
  });

  it('Tenant B não consegue atualizar dados do Tenant A', async () => {
    await setTenant('tenant-b');
    const affected = await repo.update(
      { tenant_id: 'tenant-a' },
      { nome: 'HACKEADO' },
    );
    expect(affected).toBe(0);
  });
});
```

---

## 6. Super Admin `[SUPER-ADMIN]`

```
SUPER ADMIN = Admin da plataforma TotalUtiliti
  → Gerencia todos os tenants
  → Usa tenant interno ("sistema" ou "totalutiliti-internal")
  → NUNCA usa o mesmo login de um tenant cliente
  → Acesso separado, auditado de forma especial

IMPLEMENTAÇÃO:
  → Tenant especial: is_system = true
  → Role: SUPER_ADMIN (não existe em tenants normais)
  → RLS: SUPER_ADMIN bypassa RLS (com cuidado e audit log)
  → Ações de SUPER_ADMIN são logadas com nível de detalhe maior
```

---

## 7. Audit Log `[UNIVERSAL]`

```typescript
// Log imutável de QUEM fez O QUÊ, QUANDO
// Tabela: audit_logs (append-only, sem UPDATE nem DELETE)
interface AuditLog {
  id: string;
  user_id: string;
  tenant_id: string;
  acao: string;          // 'CREATE', 'UPDATE', 'DELETE', 'VIEW'
  entidade: string;      // 'contribuinte', 'declaracao'
  entidade_id: string;
  dados_anteriores?: object; // Para updates — o que era antes
  ip: string;
  user_agent: string;
  created_at: Date;
  // SEM updated_at, SEM deleted_at — imutável
}
```

---

## 8. Checklist e Instruções Claude Code `[UNIVERSAL]`

```
RBAC:
  □ Guard global AuthGuard + RolesGuard
  □ Deny-by-default (endpoint sem @Roles = bloqueado)
  □ Roles documentadas
  □ @Public() apenas em endpoints de auth e health

MULTI-TENANT [MULTI-TENANT]:
  □ RLS habilitado em TODAS as tabelas com dados de tenant
  □ FORCE ROW LEVEL SECURITY em todas
  □ tenant_id setado via middleware a cada request
  □ tenant_id vem do JWT, NUNCA do request body
  □ Testes de isolamento cross-tenant escritos e passando
  □ Teste: tenant A não vê/edita/deleta dados de tenant B

AUDIT [UNIVERSAL]:
  □ Tabela audit_logs criada (append-only)
  □ Login/logout/falhas logados
  □ CRUD em dados pessoais logado
  □ Ações de SUPER_ADMIN logadas com detalhe extra
```

````markdown
## RBAC — Regras para Antigravity

- TODO endpoint novo DEVE ter @Roles() decorator
- Se não souber qual role, use @Roles('ADMIN') e PERGUNTE ao João
- NUNCA criar endpoint acessível sem autenticação (exceto login, health)
- Em projetos multi-tenant: SEMPRE verificar que RLS está ativo na tabela
- tenant_id SEMPRE vem do JWT, NUNCA aceitar do body/query/params
- Ao criar nova tabela com dados de tenant: RLS + policy + FORCE
````

---

> **Próximo prompt:** `07-variaveis-de-ambiente.md`

# 🔐 05 — Autenticação e Login

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
NÍVEL 1 — AUTENTICAÇÃO BÁSICA
  O projeto tem login de usuários (email/senha, SSO, ou qualquer forma)?
    → SIM → Aplicar seções marcadas [UNIVERSAL].
    → NÃO → PULAR este prompt (ex: API pública sem auth, script batch).

NÍVEL 2 — MULTI-FATOR (MFA)
  O projeto lida com dados financeiros, fiscais, saúde, ou
  qualquer dado cuja exposição cause dano significativo?
    → SIM → Aplicar seções marcadas [MFA].

NÍVEL 3 — MULTI-TENANT
  O projeto é SaaS onde múltiplos clientes compartilham a mesma
  instância (mesmo banco, mesma API)?
    → SIM → Aplicar seções marcadas [MULTI-TENANT].

NÍVEL 4 — API EXTERNA / MACHINE-TO-MACHINE
  O projeto expõe API para consumo por sistemas externos
  (webhooks, integrações, mobile apps)?
    → SIM → Aplicar seções marcadas [API-AUTH].
```

---

## 📋 ÍNDICE

1. [Fluxo de Login Seguro](#1-fluxo-de-login) `[UNIVERSAL]`
2. [JWT — Access Token + Refresh Token](#2-jwt) `[UNIVERSAL]`
3. [Rate Limiting e Proteção contra Brute Force](#3-rate-limiting) `[UNIVERSAL]`
4. [Recuperação de Senha](#4-recuperação-de-senha) `[UNIVERSAL]`
5. [Logout e Invalidação de Sessão](#5-logout) `[UNIVERSAL]`
6. [Multi-Factor Authentication (MFA/2FA)](#6-mfa) `[MFA]`
7. [Login Multi-Tenant](#7-multi-tenant) `[MULTI-TENANT]`
8. [Autenticação Machine-to-Machine](#8-api-auth) `[API-AUTH]`
9. [Frontend — Tela de Login Segura](#9-frontend) `[UNIVERSAL]`
10. [Checklist de Validação](#10-checklist) `[UNIVERSAL]`
11. [Instruções para Claude Code](#11-instruções-claude-code) `[UNIVERSAL]`

---

## 1. Fluxo de Login Seguro `[UNIVERSAL]`

```
FLUXO CORRETO:

  1. Usuário envia email + senha via HTTPS
  2. Backend busca usuário por email
  3. Se não encontrar → retornar ERRO GENÉRICO (não revelar se email existe)
  4. Verificar senha com Argon2id+pepper (ver prompt 01)
  5. Se inválida → incrementar contador de tentativas
  6. Se 5+ tentativas falhadas → lockout temporário (15min)
  7. Se válida → gerar access_token (JWT curto) + refresh_token (JWT longo)
  8. Registrar login no audit log (IP, user-agent, timestamp)
  9. Retornar tokens ao frontend

REGRAS ABSOLUTAS:
  ❌ NUNCA revelar se o email existe ("Email ou senha incorretos")
  ❌ NUNCA enviar senha em query string (GET /login?senha=abc)
  ❌ NUNCA armazenar senha em texto plano, log ou cookie
  ❌ NUNCA confiar no frontend para validação de auth
  ✅ SEMPRE usar HTTPS
  ✅ SEMPRE hash com Argon2id+pepper
  ✅ SEMPRE rate limiting em endpoints de auth
  ✅ SEMPRE audit log de login/logout/falhas
```

### Código NestJS — AuthService

```typescript
@Injectable()
export class AuthService {
  async login(email: string, senha: string, ip: string, userAgent: string) {
    // 1. Verificar rate limit / lockout
    const tentativas = await this.rateLimitService.getTentativas(email);
    if (tentativas >= 5) {
      await this.auditService.registrar({
        acao: 'LOGIN_BLOQUEADO', email, ip, userAgent,
      });
      throw new TooManyRequestsException(
        'Muitas tentativas. Tente novamente em 15 minutos.',
      );
    }

    // 2. Buscar usuário
    const usuario = await this.userService.findByEmail(email);

    // 3. Mensagem genérica (não revelar se email existe)
    if (!usuario) {
      await this.rateLimitService.incrementar(email);
      throw new UnauthorizedException('Email ou senha incorretos');
    }

    // 4. Verificar se conta está ativa
    if (usuario.deleted_at || !usuario.is_active) {
      throw new UnauthorizedException('Email ou senha incorretos');
    }

    // 5. Verificar senha (Argon2id+pepper — ver prompt 01)
    const senhaValida = await this.hashService.verify(senha, usuario.password_hash);
    if (!senhaValida) {
      await this.rateLimitService.incrementar(email);
      await this.auditService.registrar({
        acao: 'LOGIN_FALHOU', userId: usuario.id, ip, userAgent,
      });
      throw new UnauthorizedException('Email ou senha incorretos');
    }

    // 6. Limpar tentativas e gerar tokens
    await this.rateLimitService.limpar(email);
    const tokens = await this.tokenService.gerarPar(usuario);

    // 7. Audit log
    await this.auditService.registrar({
      acao: 'LOGIN_SUCESSO', userId: usuario.id, ip, userAgent,
    });

    return tokens;
  }
}
```

---

## 2. JWT — Access Token + Refresh Token `[UNIVERSAL]`

```
ARQUITETURA DE TOKENS:

  ACCESS TOKEN (curta duração):
    → Expira em 15 minutos
    → Contém: userId, tenantId, roles
    → Enviado em Authorization header: Bearer <token>
    → NÃO armazenar em localStorage (vulnerável a XSS)
    → Armazenar em memória (variável JS) ou HttpOnly cookie

  REFRESH TOKEN (longa duração):
    → Expira em 7 dias
    → Armazenado como HttpOnly + Secure + SameSite cookie
    → Usado APENAS para obter novo access token
    → Rotacionado a cada uso (refresh token rotation)
    → Salvo no banco com hash (para invalidação)
```

### Configuração de cookies

```typescript
// Refresh token como HttpOnly cookie
response.cookie('refresh_token', refreshToken, {
  httpOnly: true,      // JS não pode acessar
  secure: true,        // Apenas HTTPS
  sameSite: 'strict',  // Proteção CSRF
  path: '/api/auth/refresh', // Só enviado neste endpoint
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
});
```

### Refresh Token Rotation

```typescript
async refresh(refreshTokenAntigo: string) {
  // 1. Verificar e decodificar
  const payload = this.jwtService.verify(refreshTokenAntigo);
  
  // 2. Verificar hash no banco (detectar reuso)
  const tokenSalvo = await this.tokenRepo.findByHash(
    hashForLookup(refreshTokenAntigo),
  );
  
  if (!tokenSalvo) {
    // Token já foi usado ou não existe → possível roubo
    // Invalidar TODOS os refresh tokens do usuário
    await this.tokenRepo.invalidarTodos(payload.userId);
    throw new UnauthorizedException('Sessão inválida. Faça login novamente.');
  }
  
  // 3. Invalidar token antigo
  await this.tokenRepo.invalidar(tokenSalvo.id);
  
  // 4. Gerar novo par
  return this.tokenService.gerarPar(payload.userId);
}
```

---

## 3. Rate Limiting e Proteção contra Brute Force `[UNIVERSAL]`

```typescript
// NestJS ThrottlerModule — configuração global + por rota
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,   // 1 minuto
        limit: 60,    // 60 requests por minuto (geral)
      },
    ]),
  ],
})

// Endpoints de auth — rate limit MAIS restritivo
@Controller('api/auth')
export class AuthController {

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 tentativas/minuto
  async login(@Body() dto: LoginDto, @Req() req) {
    return this.authService.login(dto.email, dto.senha, req.ip, req.headers['user-agent']);
  }

  @Post('forgot-password')
  @Throttle({ default: { ttl: 300000, limit: 3 } }) // 3 por 5 minutos
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }
}
```

### Lockout progressivo

```
Tentativa 1-4:  Resposta normal ("Email ou senha incorretos")
Tentativa 5:    Lockout 15 minutos
Tentativa 10:   Lockout 1 hora
Tentativa 20:   Lockout 24 horas + alerta ao admin
Tentativa 50+:  Conta bloqueada → requer admin para desbloquear

IMPLEMENTAR VIA REDIS:
  Chave: auth:lockout:{email}
  Valor: { tentativas: N, bloqueado_ate: timestamp }
  TTL: 24 horas
```

---

## 4. Recuperação de Senha `[UNIVERSAL]`

```
FLUXO SEGURO:

  1. Usuário solicita recuperação informando email
  2. Backend SEMPRE responde "Se o email existir, enviaremos instruções"
     (não revelar se email existe)
  3. Se email existe → gerar token aleatório (64 bytes, crypto.randomBytes)
  4. Salvar hash do token no banco com expiração (1 hora)
  5. Enviar email com link: https://app/reset-password?token=xxx
  6. Usuário clica, informa nova senha
  7. Backend verifica token (hash match + não expirado + não usado)
  8. Atualiza senha (Argon2id+pepper)
  9. Invalida token (single-use)
  10. Invalida TODAS as sessões ativas do usuário
  11. Enviar email confirmando a alteração

REGRAS:
  ❌ NUNCA enviar senha por email (nem temporária)
  ❌ NUNCA enviar token no corpo do email sem link HTTPS
  ❌ NUNCA reutilizar tokens
  ❌ NUNCA permitir token sem expiração
  ✅ Token expira em 1 hora
  ✅ Token é single-use (invalidar após uso)
  ✅ Invalidar todas as sessões ao resetar senha
```

---

## 5. Logout e Invalidação de Sessão `[UNIVERSAL]`

```
LOGOUT:
  1. Frontend envia POST /api/auth/logout
  2. Backend invalida refresh token no banco (marcar como revogado)
  3. Backend limpa cookie de refresh token
  4. Frontend limpa access token da memória
  5. Audit log: LOGOUT

INVALIDAÇÃO FORÇADA (admin, troca de senha, suspeita de comprometimento):
  → Invalidar TODOS os refresh tokens do usuário
  → Access tokens expiram naturalmente (máx 15 min)
  → Para invalidação IMEDIATA: blacklist de access tokens no Redis
    (TTL = tempo restante de expiração do token)
```

---

## 6. Multi-Factor Authentication (MFA/2FA) `[MFA]`

```
QUANDO IMPLEMENTAR MFA:
  → Projetos com dados financeiros / fiscais → OBRIGATÓRIO
  → Projetos com dados de saúde → OBRIGATÓRIO
  → Projetos com dados pessoais em larga escala → RECOMENDADO
  → CRM com dados de clientes → RECOMENDADO
  → Ferramentas internas → Opcional

MÉTODO RECOMENDADO: TOTP (Time-based One-Time Password)
  → Compatível com Google Authenticator, Authy, 1Password
  → Padrão aberto (RFC 6238)
  → Não requer infraestrutura adicional (SMS tem custo + é menos seguro)
```

### Fluxo de ativação

```
1. Usuário habilita 2FA nas configurações
2. Backend gera TOTP secret (otpauth://totp/...)
3. Exibir QR code para o usuário escanear
4. Usuário informa código TOTP para confirmar
5. Se válido → salvar TOTP secret criptografado no banco
6. Gerar códigos de recuperação (8 códigos single-use)
7. Exibir códigos de recuperação UMA VEZ para o usuário salvar

Login com MFA:
1. Email + senha válidos
2. Backend retorna { requiresMfa: true, mfaToken: 'temp-xxx' }
3. Frontend exibe tela de código TOTP
4. Usuário informa código de 6 dígitos
5. Backend valida TOTP (aceitar janela de ±1 intervalo = 90 segundos)
6. Se válido → gerar access + refresh tokens normalmente
```

---

## 7. Login Multi-Tenant `[MULTI-TENANT]`

```
EM SaaS MULTI-TENANT, O LOGIN DEVE:
  1. Autenticar o USUÁRIO (email + senha)
  2. Identificar o TENANT (escritório, empresa)
  3. Carregar as ROLES do usuário NAQUELE tenant
  4. Setar o tenant_id no token JWT

ABORDAGENS:

  A) Tenant pelo domínio/subdomain:
     escritorio-a.app.totalledger.com.br → tenant_id = 'escritorio-a'
     
  B) Tenant pelo email:
     joao@escritorio-a.com.br → buscar tenant vinculado ao domínio
     
  C) Tenant explícito (seleção pós-login):
     Login → Lista de tenants do usuário → Seleciona → Token com tenant_id

RECOMENDAÇÃO TOTALUTILITI: Opção C (mais flexível — usuário pode pertencer
a múltiplos tenants, ex: contador que atende 2 escritórios)
```

### JWT payload multi-tenant

```typescript
// Access token payload
{
  sub: 'user-uuid',         // ID do usuário
  tid: 'tenant-uuid',       // ID do tenant ativo
  roles: ['CONTADOR'],       // Roles no tenant
  iat: 1710500000,
  exp: 1710500900,           // +15 min
}

// O backend SEMPRE extrai tid do token para filtrar dados
// O RLS do PostgreSQL usa tid para isolamento
// NUNCA confiar em tenant_id vindo do body/query — sempre do JWT
```

---

## 8. Autenticação Machine-to-Machine `[API-AUTH]`

```
PARA APIs CONSUMIDAS POR SISTEMAS EXTERNOS:

  OPÇÃO A — API Key (simples, para integrações básicas):
    → Chave única por cliente, armazenada hasheada no banco
    → Enviada via header: X-API-Key: <chave>
    → Rate limiting por chave
    → Rotação periódica (90 dias)
    
  OPÇÃO B — OAuth2 Client Credentials (recomendado para integrações robustas):
    → Client ID + Client Secret
    → Exchange por access token de curta duração
    → Mais seguro (secret nunca trafega após troca inicial)

  OPÇÃO C — Webhook Secret (para notificações outbound):
    → HMAC-SHA256 do payload com shared secret
    → Verificar assinatura em cada request recebido

REGRA: API keys/secrets são SEGREDOS — mesmas regras de Key Vault,
       rotação e proteção do prompt 01.
```

---

## 9. Frontend — Tela de Login Segura `[UNIVERSAL]`

```
REGRAS PARA A TELA DE LOGIN:

  □ Formulário via HTTPS (nunca HTTP)
  □ Input type="password" (browser mascara)
  □ Autocomplete="current-password" (permite password manager)
  □ NÃO mostrar "Usuário não encontrado" vs "Senha incorreta"
    → Sempre: "Email ou senha incorretos"
  □ Link "Esqueci minha senha" visível
  □ Indicador de loading durante request (evitar duplo submit)
  □ Limitar tentativas no frontend (UX) + backend (segurança real)
  □ NÃO armazenar senha/token em localStorage (XSS)
  □ NÃO logar dados do formulário no console do browser

ACESSIBILIDADE:
  □ Labels nos inputs (não apenas placeholder)
  □ Mensagens de erro acessíveis (aria-live)
  □ Tab order correto
  □ Funcionar sem JavaScript (progressive enhancement)
```

---

## 10. Checklist de Validação `[UNIVERSAL]`

```
AUTENTICAÇÃO BÁSICA:
  □ Login com email + senha via HTTPS
  □ Hash com Argon2id+pepper (prompt 01)
  □ Mensagem genérica em falha ("Email ou senha incorretos")
  □ JWT access token (15 min) + refresh token (7 dias)
  □ Refresh token como HttpOnly + Secure + SameSite cookie
  □ Refresh token rotation implementado
  □ Rate limiting em POST /auth/login (5/min)
  □ Rate limiting em POST /auth/forgot-password (3/5min)
  □ Lockout progressivo após tentativas falhadas
  □ Recuperação de senha com token temporário (1h, single-use)
  □ Logout invalida refresh token no banco
  □ Audit log: login, logout, falhas, reset de senha
```

```
MFA [MFA]:
  □ TOTP implementado (Google Authenticator compatível)
  □ Secret TOTP criptografado no banco
  □ Códigos de recuperação gerados e exibidos uma vez
  □ Janela de tolerância ±1 intervalo (90s)
```

```
MULTI-TENANT [MULTI-TENANT]:
  □ tenant_id no JWT (extraído do token, nunca do body/query)
  □ RLS usa tenant_id do JWT para filtrar dados
  □ Usuário pode pertencer a múltiplos tenants
  □ Troca de tenant gera novo token
```

---

## 11. Instruções para Claude Code `[UNIVERSAL]`

````markdown
## Autenticação — Regras para Antigravity

### Login
- Mensagem de erro SEMPRE genérica ("Email ou senha incorretos")
- NUNCA revelar se email existe no sistema
- Rate limiting em TODOS os endpoints de auth
- Audit log em TODOS os eventos de autenticação

### Tokens
- Access token: 15 min, em memória ou HttpOnly cookie
- Refresh token: 7 dias, HttpOnly + Secure + SameSite cookie
- NUNCA localStorage para tokens
- Refresh token rotation: token antigo invalidado ao gerar novo
- Se refresh token reusado → invalidar TODAS as sessões (possível roubo)

### Senha
- Hash com Argon2id+pepper (ver prompt 01)
- Recuperação: token aleatório, 1h expiração, single-use
- NUNCA enviar senha por email
- Ao resetar senha: invalidar todas as sessões

### Multi-tenant
- tenant_id SEMPRE vem do JWT, NUNCA do request body/query
- Verificar que RLS está ativo antes de qualquer query
````

---

> **Próximo prompt:** `06-rbac-e-multitenancy.md`

# 🖥️ 20 — Frontend Seguro

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto tem frontend web (Next.js, React, HTML)?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO (apenas API/backend) → Pular.
```

---

## 📋 CONTEÚDO

### 1. Armazenamento de Tokens `[UNIVERSAL]`

```
  ❌ NUNCA: localStorage para tokens (vulnerável a XSS)
  ❌ NUNCA: sessionStorage para tokens (vulnerável a XSS)
  ✅ Access token em memória (variável JS, perdido ao fechar aba)
  ✅ Refresh token em HttpOnly + Secure + SameSite cookie
```

### 2. CSP (Content Security Policy) `[UNIVERSAL]`

```typescript
// next.config.js — Headers de segurança
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self'", // Sem 'unsafe-inline' se possível
      "style-src 'self' 'unsafe-inline'", // Inline CSS necessário para UI libs
      "img-src 'self' data: blob:",
      "connect-src 'self' https://api.dominio.com.br",
      "frame-ancestors 'none'", // Prevenir clickjacking
    ].join('; '),
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];
```

### 3. Proteção contra XSS `[UNIVERSAL]`

```
React/Next.js escapam HTML por padrão, MAS CUIDADO COM:
  ❌ dangerouslySetInnerHTML (nunca com dados do usuário)
  ❌ href={userInput} (pode ser javascript:alert())
  ❌ eval() e new Function() com input do usuário
  
  ✅ Sanitizar com DOMPurify se precisar renderizar HTML externo
  ✅ Validar URLs antes de usar em href (deve começar com https://)
```

### 4. Dados Sensíveis no Client-Side `[UNIVERSAL]`

```
  ❌ NUNCA armazenar dados pessoais em localStorage
  ❌ NUNCA logar dados sensíveis no console.log (remove em prod)
  ❌ NUNCA expor dados desnecessários no state (React DevTools é acessível)
  ❌ NUNCA incluir API keys no código frontend (são públicas)
  
  ✅ Buscar dados sob demanda (não pré-carregar tudo)
  ✅ Limpar dados sensíveis da memória ao sair da tela
  ✅ Desabilitar console.log em produção
```

### 5. Cookies Seguros `[UNIVERSAL]`

```
TODOS os cookies devem ter:
  □ HttpOnly (JS não acessa — para tokens/sessão)
  □ Secure (apenas HTTPS)
  □ SameSite=Strict ou Lax (proteção CSRF)
  □ Path específico (não / genérico)
  □ Expiration definida
```

### 6. Checklist

```
  □ Tokens NUNCA em localStorage/sessionStorage
  □ Access token em memória, refresh token em HttpOnly cookie
  □ CSP headers configurados
  □ X-Frame-Options: DENY (prevenir clickjacking)
  □ dangerouslySetInnerHTML NUNCA com dados do usuário
  □ console.log desabilitado em produção
  □ Nenhuma API key no código frontend
  □ URLs validadas antes de usar em href/redirect
  □ Cookies com HttpOnly + Secure + SameSite
  □ Páginas de erro customizadas (404, 500)
```

````markdown
## Frontend — Regras para Antigravity

- NUNCA usar localStorage para tokens ou dados pessoais
- NUNCA usar dangerouslySetInnerHTML com dados do usuário
- NUNCA incluir API keys/secrets no código frontend
- Access token em memória, refresh token em HttpOnly cookie
- console.log com dados sensíveis DEVE ser removido antes de prod
````

---

> **Próximo prompt:** `21-documentacao-e-onboarding.md`

# 📡 16 — Monitoramento e Alertas

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto vai rodar em produção com usuários reais?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO (protótipo, POC) → Aplicar apenas health check básico.
```

---

## 📋 CONTEÚDO

### 1. Health Check Endpoint `[UNIVERSAL]`

```typescript
// OBRIGATÓRIO em todo projeto
@Get('health')
@Public()
async health() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: await this.checkDb(),    // Testar conexão
      redis: await this.checkRedis(),     // Se usar Redis
    },
  };
}
```

### 2. Alertas Críticos `[UNIVERSAL]`

```
CONFIGURAR ALERTAS PARA:
  □ Erros 5xx > 5/minuto → Alerta imediato
  □ Health check falhando → Alerta imediato
  □ CPU > 80% por 5 minutos → Alerta warning
  □ Memória > 85% → Alerta warning
  □ Tentativas de login falhadas em massa (>20/minuto) → Alerta segurança
  □ Container App reiniciando repetidamente → Alerta imediato
  □ PostgreSQL conexões > 80% do limit → Alerta warning
  □ Custo Azure acima do budget → Alerta FinOps
```

### 3. Métricas de Negócio `[UNIVERSAL]`

```
MONITORAR (ajustar por projeto):
  → Tempo de resposta P50, P95, P99
  → Taxa de erros (erros/total requests)
  → Uptime (target: 99.5% ou SLA definido com cliente)
  → Chamadas a serviços externos (latência, taxa de erro)
  → Custo de AI por request (OpenAI, Document Intelligence)
```

### 4. FinOps — Monitoramento de Custos Azure `[UNIVERSAL]`

```bash
# Configurar budget e alertas
az consumption budget create \
  --budget-name "budget-PROJETO" \
  --amount 500 \
  --time-grain Monthly \
  --category Cost \
  --resource-group RG

# Alertas: 50%, 80%, 100% do budget
```

### 5. Checklist

```
  □ Health check endpoint implementado (/health)
  □ Alertas para erros 5xx configurados
  □ Alertas para health check failure configurados
  □ Alertas para tentativas de login em massa
  □ Monitoramento de custos Azure (budget + alertas)
  □ Dashboard de métricas básicas (Azure Monitor ou similar)
  □ Uptime monitoring externo (UptimeRobot, Pingdom, ou similar)
  □ SLA/SLO definido e documentado para o cliente
```

---

> **Próximo prompt:** `17-backup-e-disaster-recovery.md`

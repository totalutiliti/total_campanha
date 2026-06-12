# 💾 17 — Backup e Disaster Recovery

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto armazena dados que não podem ser perdidos?
  → SIM → Aplicar INTEGRALMENTE. (Quase todo projeto em produção.)
  → NÃO → Pular (ex: cache puro, projeto efêmero).

O projeto processa dados financeiros ou fiscais?
  → SIM → Aplicar também seções [FINANCEIRO] (retenção estendida).
```

---

## 📋 CONTEÚDO

### 1. Backup PostgreSQL (Azure) `[UNIVERSAL]`

```bash
# Verificar configuração de backup
az postgres flexible-server show --name PG-NAME --resource-group RG \
  --query '{retention:backup.backupRetentionDays, geo:backup.geoRedundantBackup}'

# Recomendações:
#   Dev: 7 dias de retenção
#   Prod: 14-35 dias de retenção
#   Financeiro: 35 dias + exportação manual mensal [FINANCEIRO]

# Alterar retenção
az postgres flexible-server update --name PG-NAME --resource-group RG \
  --backup-retention 35
```

### 2. Backup Blob Storage `[UNIVERSAL]`

```
Azure Blob Storage oferece:
  → Soft delete (recuperar blobs deletados): habilitar com 30 dias
  → Versioning: manter versões anteriores de blobs
  → Point-in-time restore: restaurar container inteiro para um momento

CONFIGURAR:
  □ Soft delete habilitado (30 dias)
  □ Versioning habilitado
  □ Lifecycle management para arquivar blobs antigos (Hot → Cool → Archive)
```

### 3. RPO e RTO `[UNIVERSAL]`

```
DEFINIR PARA CADA PROJETO:

  RPO (Recovery Point Objective):
    "Quanto dado posso PERDER?"
    → Azure PostgreSQL backup: a cada hora (RPO ≤ 1h)
    → Com WAL archiving: RPO de minutos
    → Definir com o cliente no SLA

  RTO (Recovery Time Objective):
    "Quanto tempo leva para VOLTAR?"
    → Restore de backup: 15-60 minutos
    → Failover geo-redundante: 1-2 horas
    → Definir com o cliente no SLA
```

### 4. Teste de Restore `[UNIVERSAL]`

```
REGRA: Backup sem teste de restore NÃO é backup.

PROCEDIMENTO (mensal):
  1. Restaurar backup em servidor temporário
  2. Verificar integridade dos dados
  3. Rodar queries de validação
  4. Documentar resultado e tempo
  5. Deletar servidor temporário

az postgres flexible-server restore \
  --name pg-PROJETO-restore-test \
  --resource-group RG \
  --source-server pg-PROJETO-prod \
  --restore-time "2026-03-14T10:00:00Z"
```

### 5. Plano de DR Documentado `[UNIVERSAL]`

```
DOCUMENTAR:
  □ RPO e RTO definidos
  □ Procedimento de restore passo-a-passo
  □ Quem é responsável por executar
  □ Contatos de emergência
  □ Último teste de restore (data + resultado)
  □ Dependências externas (Azure OpenAI, APIs) — fallback?
```

### 6. Checklist

```
  □ Backup automático PostgreSQL habilitado
  □ Retenção: 7 dias (dev), 14-35 dias (prod)
  □ Blob Storage: soft delete + versioning habilitados
  □ RPO e RTO definidos e documentados
  □ Teste de restore realizado e documentado (mensal)
  □ Plano de DR documentado
  □ Exportação manual mensal para dados fiscais [FINANCEIRO]
```

---

> **Próximo prompt:** `18-plano-de-resposta-a-incidentes.md`

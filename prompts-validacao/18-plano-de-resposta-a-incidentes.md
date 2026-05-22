# 🚨 18 — Plano de Resposta a Incidentes

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto roda em produção com dados reais?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO → Aplicar como referência futura.

O projeto processa dados pessoais?
  → SIM → Aplicar seções [LGPD-INCIDENTE] (notificação ANPD obrigatória).
```

---

## 📋 CONTEÚDO

### 1. Playbooks de Incidente `[UNIVERSAL]`

```
PLAYBOOK 1: "SEGREDO VAZOU NO GIT"
  1. Rotacionar o segredo IMEDIATAMENTE
  2. Gerar novo valor → atualizar no Key Vault → deploy
  3. Invalidar/revogar valor antigo
  4. Limpar histórico Git (BFG ou filter-repo — ver prompt 02)
  5. Verificar logs de uso indevido do segredo antigo
  6. Documentar incidente

PLAYBOOK 2: "SUSPEITA DE ACESSO INDEVIDO AO BANCO"
  1. Verificar logs de conexão do PostgreSQL
  2. Rotacionar credenciais do banco
  3. Verificar se dados foram exfiltrados (audit logs)
  4. Se dados pessoais afetados → Playbook LGPD [LGPD-INCIDENTE]
  5. Fortalecer firewall/acesso
  6. Documentar incidente

PLAYBOOK 3: "CLIENTE REPORTOU ACESSO INDEVIDO"
  1. Verificar audit log do usuário reportado
  2. Invalidar todas as sessões do usuário afetado
  3. Forçar reset de senha
  4. Verificar se outros usuários do mesmo tenant foram afetados
  5. Se dados pessoais expostos → Playbook LGPD [LGPD-INCIDENTE]
  6. Comunicar o cliente (escritório)

PLAYBOOK 4: "SERVIÇO FORA DO AR"
  1. Verificar health check e logs
  2. Verificar status dos serviços Azure (status.azure.com)
  3. Se Container App: verificar revisões, rollback se necessário
  4. Se PostgreSQL: verificar conexões, restart se necessário
  5. Comunicar clientes afetados
  6. Post-mortem após resolução
```

### 2. Notificação LGPD `[LGPD-INCIDENTE]`

```
SE O INCIDENTE ENVOLVE DADOS PESSOAIS:

  PRAZO: 3 dias úteis para comunicar ANPD e titulares
  (ver prompt 03 seção 8 para detalhes completos)

  1. Avaliar: risco relevante aos titulares?
  2. SE TotalUtiliti = operador → notificar controlador (cliente)
  3. Controlador comunica ANPD + titulares
  4. Registrar incidente (manter por 5 anos)
```

### 3. Post-Mortem Template `[UNIVERSAL]`

```
# Post-Mortem — [Título do Incidente]

**Data:** [data]
**Duração:** [tempo de início a resolução]
**Severidade:** [Crítica / Alta / Média / Baixa]
**Impacto:** [quantos usuários/tenants afetados]

## O que aconteceu
[Descrição factual e cronológica]

## Causa raiz
[Por que aconteceu]

## O que foi feito
[Ações de contenção e remediação]

## O que vamos fazer para não acontecer de novo
[Ações preventivas com responsável e prazo]

## Lições aprendidas
[O que funcionou, o que não funcionou]
```

### 4. Contatos de Emergência `[UNIVERSAL]`

```
MANTER ATUALIZADO:
  □ João (TotalUtiliti) — [telefone]
  □ DPO — [email, telefone]
  □ Suporte Azure — [link do portal]
  □ Cliente principal — [contato de emergência do escritório]
  □ ANPD (se incidente LGPD) — formulário CIS online
```

### 5. Checklist

```
  □ Playbooks documentados para cenários principais
  □ Fluxo de notificação LGPD documentado [LGPD-INCIDENTE]
  □ Template de post-mortem pronto
  □ Contatos de emergência atualizados
  □ Equipe sabe onde encontrar os playbooks
  □ Simulação de incidente realizada (tabletop exercise)
```

---

> **Próximo prompt:** `19-testes-de-seguranca.md`

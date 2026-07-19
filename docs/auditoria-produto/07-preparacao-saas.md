# 07 — Preparação para comercialização SaaS

## Estado atual

O repositório já contém Tenant, UserTenant, três papéis, RLS, credenciais WhatsApp/email por tenant, trial/billing, usage log e Super Admin. Isso é uma fundação melhor que adaptar um sistema single-tenant. Porém, a classificação atual é **multi-tenant com riscos críticos**, não SaaS comercial pronto.

## Multiempresa

| Capacidade               | Estado                               | Antes de comercializar                                                          |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------- |
| Organizações/tenant      | Existe                               | Corrigir signup, edição/cancelamento/export e lifecycle                         |
| Usuários por organização | Relação existe                       | Convites, gestão, desativação, step-up e auditoria (`PROD-003`)                 |
| Papéis                   | ADMIN/EDITOR/VISUALIZADOR no backend | Matriz compartilhada e UI coerente (`UX-006`)                                   |
| Admin plataforma         | Núcleo existe                        | Reativar/editar, filas/saúde, incidentes, suporte, limites/feature flags        |
| Isolamento DB            | RLS forte na API                     | Remover BYPASSRLS worker e proteger usage (`SEC-001`, `DATA-003`)               |
| Arquivos                 | Blob no IaC, sem produto             | Namespace/ACL por tenant, signed URLs, retenção, malware/EXIF antes do catálogo |
| Configuração/branding    | Conexões por tenant                  | Empresa, logo/cor/domínio, remetente/número/template e decisão white-label      |
| Credenciais              | Meta cifrada por tenant              | Rotação, assinatura webhook e teste A/B                                         |
| Uso/limites              | UsageLog existe                      | Entitlements/quota/consumo server-side (`PROD-004`)                             |
| Suspensão/cancelamento   | Parcial                              | Data export, grace period, purge/retention e billing monotônico                 |

## Planos e cobrança

### Decisão recomendada

Manter cobrança híbrida: assinatura por faixa + limites/overage transparentes. O custo real de Meta/SES deve continuar BYOA/repasse conforme contrato, mas a plataforma precisa registrar toda chamada paga.

| Métrica                           | Arquitetura necessária                                      |
| --------------------------------- | ----------------------------------------------------------- |
| Usuários                          | entitlement por tenant e papel; convite bloqueado no limite |
| Produtos/armazenamento            | só após decisão de catálogo; quota em DB + Blob             |
| Contatos                          | contagem ativa por tenant, validação em CRUD/import         |
| Campanhas                         | quota mensal e concorrência                                 |
| Email/WhatsApp                    | ledger idempotente de tentativa/aceitação/custo por conexão |
| Recursos avançados                | feature flags/entitlements server-side, nunca só UI         |
| Personalização/suporte/relatórios | entitlement auditable e SLA contratual                      |

**Bloqueador:** UI, PRD e Asaas devem compartilhar catálogo de planos versionado; preços atuais divergem e limites não são aplicados.

## Administração da plataforma

### Existe

- Lista/detalhe/criação/suspensão/impersonação de tenants.
- Custos agregados e audit log.
- Visão geral básica.

### Falta antes de escala

- Saúde API/web/worker, filas, DLQ/retry e lag.
- Estado Meta/SES/Asaas, bounce/complaint/quality e erros por tenant.
- Limites/consumo, bloqueio seguro e abuso.
- Reativação, edição, offboarding/export/purge.
- Impersonação com claim do ator, justificativa, tempo curto, banner e auditoria dual.
- Incidentes, feature flags, notas de suporte e comunicação sem PII.

## Onboarding e operação

| Etapa             | Estado            | Recomendação                                             |
| ----------------- | ----------------- | -------------------------------------------------------- |
| Cadastro/trial    | API, sem UI       | Signup + confirm email + termos/empresa/plano            |
| Catálogo          | Ausente           | Decidir promessa antes de construir                      |
| Contatos          | Importação madura | Sintéticos, consentimento forte, streaming/checkpoint    |
| Email             | Wizard DNS        | Sender tenant real, verificação/feedback/supressão       |
| WhatsApp          | Wizard manual     | Embedded Signup ou setup assistido retomável             |
| Primeira campanha | Checklist existe  | Modo demo, envio teste, confirmação e edição             |
| Ajuda             | Manual contextual | Remover placeholders, busca, FAQ e suporte               |
| Contrato/legal    | Docs internas     | Publicar termos, privacidade, DPA, SLA e versões aceitas |
| Cancelamento      | Billing parcial   | Export, grace, retenção/purge e confirmação step-up      |

## Observabilidade e suporte

### Existente

- Pino estruturado e redaction parcial.
- Log Analytics/App Insights no IaC.
- Alertas de 5xx, CPU PG, memória Redis e budget.
- UsageLog por chamada nos dispatchers principais.

### Necessário

- Correlation ID do request ao job/provedor/evento.
- Métricas de fila (lag, retries, DLQ), envio, webhooks, bounce, complaint, quality e opt-out spike.
- SLOs/SLIs por jornada e tenant; status page.
- Custos anormais e abuso por tenant/conexão.
- Usage idempotente para **todas** as chamadas pagas, inclusive inbox/testes/transacionais.
- Runbooks acionáveis e suporte com acesso mínimo/mascarado.
- Restore/failover medidos e incident log append-only.

## Prontidão por número de clientes

| Marco             | Condições mínimas                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Piloto controlado | Todos os P0 fechados; ambiente isolado; limites baixos; um tenant; destinatários internos; supervisão humana; rollback/restore |
| 10 clientes       | P1 fechado; signup/usuários/legal/suporte; quota/fairness; E2E; feedback SES; dashboards/alertas                               |
| 100 clientes      | Performance P2, particionamento/retensão, HA/DR, pré-agregação, capacidade testada e on-call                                   |
| 1.000 clientes    | Control plane separado, isolamento por perfil de tenant, pools/partições, operação 24×7 e engenharia de custo                  |

## Decisões humanas necessárias

1. Produto “campanhas/CRM” ou “catálogo + promoções + campanhas”.
2. Preços/limites/overage e quem paga custos Meta/SES.
3. Infra lean aceitável apenas para piloto ou migração imediata ao perfil completo.
4. Embedded Signup/Tech Provider e modelo de suporte BYOA.
5. White-label, domínio custom e identidade comercial.
6. SLA, RPO/RTO, DPA, retenção e exclusão.

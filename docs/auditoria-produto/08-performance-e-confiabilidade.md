# 08 — Performance e confiabilidade

## Resumo

Não foram executados testes de carga. A análise estática confirma gargalos que aparecem antes de 100 clientes: materialização integral de campanhas, um job Redis por destinatário, importação com PII e N queries, throttle por campanha, retry sem cursor, inbox N+1 e analytics live. A confiabilidade é mais urgente que otimização: faltam idempotência, outbox, deadlines e DR comprovado.

## Frontend

| Tema        | Fato observado                                                              | Risco/recomendação                                                                  |
| ----------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Bundle      | Next 14; build não executado                                                | Medir bundle/Lighthouse após upgrade; budgets por rota                              |
| Imagens     | Catálogo/upload não existem; logo é componente                              | Definir pipeline seguro/otimizado antes de catálogo                                 |
| Listas      | Contatos 200 sem paginação UI; inbox/campanhas/templates densos             | Cursor/virtualização/paginação; 10k sintéticos                                      |
| Requisições | Dashboard paralelo com fallback silencioso; polling inbox 30s e campanha 5s | Cache/revalidate/SSE onde justificado; backoff e visibilidade de falha              |
| Mobile      | Inbox empilha lista e conversa; tabelas podem cortar                        | Master-detail/reflow testado em 360 px                                              |
| Cache       | `no-store` generalizado no client autenticado                               | Definir cache seguro por tenant e invalidação; nunca compartilhar chaves sem tenant |

## API e banco

### ACHADO PERF-004 — Queries/índices/paginação

**Severidade:** Média · **P2 · Status:** Confirmado estaticamente
Busca usa `%contains%`; filtros consultam arrays/JSON; faltam GIN/trigram comprovados; inbox faz N+1 e traz thread inteira; analytics agrega ao vivo; offset pagination degrada. Implementar índices com `EXPLAIN ANALYZE` em dataset sintético, cursor/keyset e query agregada. Não criar índice sem medição.

### Integridade que afeta performance

- FKs ausentes dificultam planner/limpeza e permitem órfãos.
- `status_history` JSON reescreve array crescente.
- Falta `created_at` em Mensagem e política de retenção/particionamento.
- Usage/audit/inbox/mensagens crescem indefinidamente.
- Pool/PgBouncer: perfil completo habilita; lean/Burstable documenta ausência. Configuração real não validada.

## Campanhas e filas

### ACHADO PERF-002 — Fan-out integral

A API carrega todos os destinatários, cria todas as Mensagens e envia `addBulk` com um job por pessoa. Para volume alto, mover fan-out para produtor assíncrono paginado e durável, com backpressure e fairness. Aceite: após restart o produtor retoma sem duplicar e mantém memória/Redis dentro de budget.

### ACHADO PERF-001 — Limite agregado incorreto

Delay é calculado por campanha. Campanhas e réplicas do mesmo número/conta somam taxas. Usar limiter Redis por tenant+conexão+canal, quota diária e prioridade justa. Teste local com relógio/fake e limites baixos.

### ACHADOS ARC-001/003/004/005/006

- Claim de mensagem não é atômico: duplicidade.
- DB/outbox/fila não são uma unidade: perda/estado parcial.
- Retry sem cursor/DLQ: starvation e órfãos.
- Webhook sem event ledger: efeitos duplicados.
- Cancel/pause: corrida antes do provedor.

Confiabilidade exige outbox/inbox, leases, DLQ, reconciliação e máquinas de estado monotônicas antes de aumentar concorrência.

## Importação

### ACHADO PERF-003 / UPLOAD-001

- 10 MB limita bytes, não linhas/colunas/células/profundidade.
- Dataset inteiro com PII é serializado no job Redis.
- Worker faz find + update/create por linha e commits parciais.
- Exportação não neutraliza fórmulas.

Arquitetura recomendada: upload privado temporário no Blob, antivirus/sniffing quando houver binário, streaming CSV, staging/COPY, upsert set-based, entidade Importacao com progresso/checkpoint, TTL e purge. Aceite: 10k/100k fictícios conforme plano sem pico, recomeço idempotente e Redis contém só referência.

## Integrações externas

| Risco           | Estado                                   | Critério                                                             |
| --------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Timeout         | Ausente explícito em Meta/Asaas/SMTP/SES | Toda chamada termina dentro do deadline e registra categoria do erro |
| Retry           | Parcial e misturado a estado de negócio  | Política por erro, jitter, limite e DLQ                              |
| Circuit breaker | Não encontrado                           | Isolado por tenant/provedor; recuperação automática observável       |
| Idempotência    | Insuficiente                             | Chave/ledger/reconciliação por chamada                               |
| Falha parcial   | Pode marcar sucesso como falha por usage | Telemetria separada e reconciliável                                  |
| Provider down   | Jobs podem acumular                      | Backpressure, pausa por conexão e comunicação ao tenant              |

## Disponibilidade, backup e DR

| Perfil   | Fato documental                                                                      | Avaliação                                                                                           |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Completo | PG HA zone-redundant, 35d geo, private endpoints, CAE zone redundant, min replicas 1 | Adequado como alvo, ainda sem restore/failover comprovado                                           |
| Lean     | PG B1ms sem HA, 7d local, endpoints públicos; API/web scale-to-zero; Redis Basic     | Inadequado para comercial amplo; aceitável apenas para piloto explícito com RPO/RTO e risco aceitos |

RPO/RTO não estão fixados como decisão comercial nem medidos. Antes do piloto: restore PITR em ambiente temporário, validação de counts/isolamento, tempo total e runbook atualizado. Antes de clientes externos: failover e recuperação de Redis/filas/provedores ensaiados.

## Cenários de escala

### 10 empresas

- Depois dos P0/P1, suporta piloto/primeiros clientes de baixo volume.
- Limites por campanha/tenant e monitoramento humano são obrigatórios.
- Evitar campanhas concorrentes grandes até limiter/outbox.

### 100 empresas

- Implementar cursor em tudo, staging import, fairness, pré-agregação, índices medidos, retenção, DLQ e dashboards de fila/provedor.
- Planejar pool de conexões e capacity test por componente.

### 1.000 empresas

- Separar scheduler/control plane privilegiado dos workers tenant-scoped.
- Particionar eventos/mensagens/audit/usage, pré-agregar analytics e considerar isolamento dedicado para heavy tenants.
- Operação 24×7, SLOs, on-call, chaos/DR regular e engenharia de custo.

## SLOs propostos para decisão

Não são compromissos; precisam aprovação humana:

- API p95 leitura <500 ms e mutação comum <1 s sob carga-alvo.
- Enfileiramento de campanha p95 <5 s; lag de início conforme agenda <60 s.
- Zero envio duplicado observável; reconciliação de estado de provedor <5 min.
- RPO ≤15 min e RTO ≤2 h para piloto; revisar para comercial.
- Disponibilidade mensal alvo ≥99,5% no piloto e ≥99,9% comercial, condicionada a HA.

## Testes locais seguros futuros

1. Fakes de Meta/SES/Asaas com latência/erro/replay.
2. PostgreSQL/Redis descartáveis e dados sintéticos.
3. Concorrência 2–10 workers, limites pequenos, sem rede externa.
4. Campanhas de 1k/10k e import 10k; só aumentar após budgets.
5. Fault injection após claim, provider accept, DB commit e enqueue.
6. Restore cronometrado em servidor/DB temporário autorizado.

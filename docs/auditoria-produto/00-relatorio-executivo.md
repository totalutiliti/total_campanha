# 00 — Relatório executivo

## 1. Resumo executivo

O Total Campanha já tem uma base técnica relevante para campanhas B2B por email e WhatsApp: contatos, grupos, mensagens, campanhas, inbox, opt-in/out, custos, billing e administração multiempresa. Entretanto, **não deve ser oferecido a novos clientes agora**. Foram revalidados **57 achados: 5 críticos, 34 altos, 14 médios e 4 baixos**.

Esta continuação consultou o remoto e confirmou `HEAD = origin/dev = 34f7d15f98a09ee753ae43fa8e6f8ff054095193`, o mesmo commit do baseline anterior, com divergência `0/0`. A contagem não foi apenas herdada: os IDs foram reconciliados e os mecanismos P0 foram novamente inspecionados; sem mudança de código, todos permanecem ativos.

Os riscos mais graves não são cosméticos: um worker documentado com privilégio que ignora isolamento, possibilidade de envio duplicado, webhook WhatsApp sem assinatura, cadastro que pode deixar conta parcial e dependência web com advisory crítico.

## 2. Produto encontrado

Plataforma SaaS B2B multi-tenant para gerir contatos, segmentar públicos, criar templates e enviar campanhas via Meta WhatsApp Cloud API oficial e email SMTP/SES, com respostas WhatsApp, opt-in/out, analytics por campanha, trial/billing e Super Admin.

## 3. Funcionalidades principais

- Login, recuperação de senha, multiempresa e TOTP.
- Contatos, importação, tags, opt-in/out e exclusão.
- Grupos/segmentos por filtros.
- Templates email/WhatsApp e preview.
- Campanhas, estimativa de público/custo, agenda, envio, pausa/cancel e métricas.
- Conexões BYOA Meta e domínio/remetente SES.
- Inbox WhatsApp com janela de 24 horas.
- Plano/Asaas, custos, audit e Super Admin.
- Páginas públicas de consentimento.

**Não encontrado:** catálogo de produtos, imagens de catálogo ou composição de promoções, embora isso conste na proposta fornecida para a auditoria.

## 4. Pontos fortes

1. Arquitetura modular TypeScript/Nest/Next com worker e IaC bem organizados.
2. RLS forte na API, RBAC explícito, Argon2id+pepper e tokens Meta cifrados.
3. UX em português claro, checklist de onboarding e importação em quatro passos.
4. Estimativa de público/custo, pausa/cancel, inbox e métricas por campanha.
5. Fundação SaaS: tenants, papéis, trial/billing, usage, Super Admin e auditoria.

## 5. Pontos fracos

- Confiabilidade de dispatch/webhook insuficiente.
- Isolamento do worker contradiz o RLS.
- Consentimento, supressão e direito ao esquecimento incompletos.
- Testes quase inexistentes fora de RLS parcial.
- Onboarding técnico/manual e sem signup/convites.
- Produto anunciado e produto implementado não coincidem.

## 6. Riscos críticos

1. Worker com `BYPASSRLS` pode misturar tenants.
2. Webhook Meta sem HMAC pode aceitar evento forjado/repetido.
3. Dois workers/crash podem enviar a mesma mensagem mais de uma vez.
4. Signup pode persistir conta e falhar ao auditar.
5. Next.js 14.2.18 possui advisory crítico no lockfile.

## 7. Segurança

Há bons controles, mas eles não compensam os cinco P0. Sessões privilegiadas/TOTP, audit imutável, uploads CSV, webhooks Asaas, supply chain e auth global também precisam correção. Classificação multi-tenant: **multi-tenant com riscos críticos**.

## 8. Experiência

A interface parece coerente estaticamente, mas o usuário não consegue corrigir rascunho e um clique dispara comunicação paga sem confirmação. BYOA Meta/DNS é técnico para PME, papéis não são refletidos na UI e dialogs/drawer têm falhas de acessibilidade.

## 9. Problemas técnicos

- Sem outbox/claim/ledger exatamente-uma-vez.
- DB e Redis podem divergir.
- Retry sem cursor/DLQ e cancelamento com race.
- FKs compostas ausentes e logs mutáveis.
- Campanhas/importações não escalam por streaming/paginação.
- Integrações sem deadline/breaker.

## 10. Riscos jurídicos e de privacidade aparentes

- Email ativado sem confirmação de posse.
- Admin/importação marca consentimento sem prova obrigatória.
- Opt-in pode mesclar identificadores não verificados.
- Hard delete conserva/cria PII em log e não trata inbox/backups integralmente.
- Possível dado real em modelo baixável precisa validação imediata.
- Páginas públicas de termos/privacidade/DPA/canal DPO não foram encontradas.

## 11. Situação do email

SMTP/SES e verificação DNS existem, mas o dispatcher ignora o remetente por tenant e usa fallback global. Não há bounce, complaint, provider ID nem supressão. Isso impede operação comercial com reputação controlada.

## 12. Situação do WhatsApp

É Cloud API oficial BYOA, com templates, opt-in flag, palavras de opt-out e janela 24h. Porém webhook não é assinado/idempotente, throttle não agrega por número/tenant, envio pode duplicar e onboarding exige conhecimento técnico. Risco de bloqueio/reputação é alto.

## 13. Isolamento entre clientes

RLS da API é um ponto forte. O worker privilegiado e `usage_logs` sem RLS quebram a garantia sistêmica. Até corrigir e testar API+worker+fila+logs, não há evidência suficiente de isolamento adequado.

## 14. Escalabilidade

- **10 empresas:** viável após Fases 0–1 com volumes/limites baixos e suporte.
- **100:** exige fan-out paginado, import staging, fairness, índices, retenção e HA/DR.
- **1.000:** exige control plane separado, particionamento, pré-agregação, pool e isolamento de heavy tenants.

## 15. Testes

TypeScript e ESLint direto passaram nos cinco projetos/áreas. API/worker retornaram “No tests found” com exit 1. Só existem suítes RLS/isolamento parcial; não foram executadas porque os helpers chamam pnpm/migrations e o runtime local é Node 24/pnpm 11, diferente do esperado Node 20/pnpm 9.12. Não há frontend/E2E/contrato/concorrência/a11y/performance/DR automatizados.

## 16. O que impede comercialização hoje

- Cinco riscos críticos.
- Ausência de catálogo prometido.
- Consentimento/email/WhatsApp ainda não operáveis com segurança.
- UX de envio acidental e rascunho.
- Sem testes e DR comprovado.
- Onboarding/usuários/legal/suporte/planos incompletos.

## 17. O que pode ser mantido

Monorepo e módulos, stack TypeScript/Nest/Next, schema base de tenant/contato/template/campanha, RLS `FORCE` na API, Argon2id/pgcrypto, BullMQ como mecanismo assíncrono, dashboard/importação, BYOA oficial, Super Admin/custos e IaC completo como alvo.

## 18. O que precisa ser corrigido

Isolamento do worker, idempotência/outbox, assinatura/replay de webhooks, signup, dependências, consentimento/supressão, sender tenant, hard delete, confirmação/edição de campanha, audit/usage, testes e CI/release.

## 19. O que precisa ser reconstruído

Não é necessário reescrever tudo. Precisam redesign substancial: pipeline de dispatch/retry/webhook, modelo de consentimento/supressão, sessão privilegiada/impersonação e importação em escala. Catálogo será construção nova se permanecer na promessa.

## 20. Decisões de negócio

- Posicionamento campanhas/CRM versus catálogo/promoções.
- Preço, limites, overage e custos Meta/SES.
- Infra lean versus perfil completo e RPO/RTO/SLA.
- Base legal/retenção/DPA/DSAR.
- Embedded Signup/suporte BYOA.
- White-label e arquitetura da marca.

## 21. Esforço qualitativo

- Fase 0: alto/grande, por tocar filas, schema, auth e integrações.
- Piloto confiável: alto/grande, especialmente testes, feedback SES e LGPD.
- Multiempresa/comercial: alto, com trabalho de produto/operação/jurídico.
- Escala: progressivo, orientado por métricas; não antecipar microserviços.

## 22. Ordem recomendada

1. Isolamento/idempotência/webhook/signup/dependências.
2. Consentimento/sender/supressão/DR/testes.
3. UX segura, retry, integridade e operação do piloto.
4. Onboarding/usuários/planos/legal/suporte.
5. Catálogo decidido e escala por evidência.

## 23. Piloto controlado recomendado

Somente após Fase 0: um tenant por vez, escopo “contatos + campanhas” (sem prometer catálogo), destinatários internos no primeiro ciclo, limites pequenos, aprovação humana antes do envio, canais BYOA verificados, monitor de fila/custo/reputação, suporte presente, backup/restore testado e critérios de go/no-go para import, consentimento, envio, pause/cancel, webhook e reconciliação.

## 24. Recomendação final

# RISCO CRÍTICO — NÃO DISPONIBILIZAR

Não disponibilizar a novos clientes nem ampliar volume do piloto atual até fechar a Fase 0 e comprovar os testes. A base é aproveitável; o caminho recomendado é endurecer isolamento/confiabilidade/consentimento antes de novas funcionalidades.

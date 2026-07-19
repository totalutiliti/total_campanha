# 06 — Visão do usuário e do cliente

## Respostas diretas

| Pergunta                                           | Resposta baseada na auditoria                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Eu entenderia como começar?                        | **Depois de receber acesso, provavelmente sim:** dashboard em quatro passos. **Antes, não:** sem signup self-service |
| Cadastraria o primeiro produto?                    | **Não.** Produto/catálogo não existem                                                                                |
| Entenderia produto, catálogo, promoção e campanha? | **Não**, porque os três primeiros não existem. A sequência Contatos→Grupos→Mensagens→Campanhas é bem explicada       |
| Saber quais clientes receberão?                    | **Razoavelmente.** Grupo, elegíveis e opt-in aparecem; falta inspecionar/exportar a lista final                      |
| Perceber custo?                                    | **Sim por campanha**, imediatamente antes do envio; falta consumo/saldo global                                       |
| Ter segurança para enviar?                         | **Não.** Um clique dispara, sem confirmação final/teste                                                              |
| Corrigir antes do envio?                           | **Não.** Rascunho não tem edição                                                                                     |
| Cancelar?                                          | **Sim**, para estados previstos, mas existe race técnica com worker                                                  |
| Saber entregas?                                    | **Sim por campanha**; falta visão global/comparação/export                                                           |
| Entender erros?                                    | **Parcial.** Copy PT-BR ajuda; integrações e falhas silenciosas continuam técnicas                                   |
| Remover contato?                                   | **Sim**, soft/hard; hard delete não é integral tecnicamente                                                          |
| Atender descadastramento?                          | **Parcialmente.** Link e palavras WA existem; falta central de supressão/prova forte                                 |
| Confiar dados e catálogo?                          | **Ainda não.** Catálogo ausente, testes escassos, risco de PII em exemplo e P0 técnicos                              |
| Contrataria hoje?                                  | **Não como SaaS autônomo.** No máximo piloto muito assistido após Fase 0                                             |
| Aparência profissional?                            | **Razoável por inspeção estática**, com boa consistência; marca mista e lacunas reduzem credibilidade                |
| Parece completo?                                   | **Não.** Faltam catálogo, onboarding, usuários, legal/suporte e operação madura                                      |
| Exige conhecimento técnico?                        | **Sim**, principalmente Meta/WABA/token/webhook, DNS, MJML e `extras.*`                                              |

## Etapas com maior abandono provável

1. Conseguir acesso/receber senha temporária.
2. Descobrir que catálogo/produtos não existem.
3. Obter token permanente, WABA ID, Phone Number ID e configurar webhook.
4. Configurar DNS/SES.
5. Criar segmento com paths técnicos.
6. Criar/validar template Meta.
7. Clicar em enviar sem confirmação/teste.

## Dúvidas que chegarão ao suporte

- Onde obtenho token/IDs e como sei que webhook/DNS funcionou?
- Quem exatamente vai receber e qual prova de opt-in tenho?
- Quanto custa agora, por mês e por mensagem? Qual limite do meu plano?
- Como envio teste, edito rascunho, cancelo ou reenvio com segurança?
- Por que minha ação deu 403 se o botão aparecia?
- Como convido/desativo um colega?
- Como trato bounce, complaint, opt-out ou exclusão LGPD?
- Onde estão catálogo, imagens e promoções?

## O que falta

- Catálogo/produto/imagem/promoção.
- Signup/onboarding/confirm email/termos.
- Usuários, convites, perfil/empresa, sessões e 2FA UI.
- Edição de rascunho/grupo, envio teste e confirmação final.
- Analytics global, exportações e centro de supressão.
- Entitlements/consumo por plano.
- Operação super-admin de fila, saúde, incidentes, suporte e feature flags.
- Legal/DPA/privacidade/SLA/status page.

## O que parece desnecessário

Nenhuma funcionalidade central é claramente inútil. Campos Meta/DNS/MJML são tecnicamente necessários no modelo atual, mas não deveriam ser a experiência primária do usuário comum; devem ficar num modo guiado/avançado ou no suporte assistido.

## Motivo principal para não contratar

**A promessa central não está completa e o mecanismo de envio ainda pode causar erro irreversível, duplicidade e risco multi-tenant.**

## Motivo principal para contratar

**Boa combinação de contatos, segmentação, email + WhatsApp oficial BYOA, inbox, opt-in/out, custo por campanha e fundação multiempresa/super-admin.**

## Cinco pontos fortes do ponto de vista do cliente

1. Copy em PT-BR e vocabulário simplificado: “Grupos”, “Mensagens”, “Respostas”.
2. Importação de contatos em quatro passos, com mapeamento, preview e deduplicação.
3. Campanha mostra público elegível, conexão, custo e métricas detalhadas.
4. Opt-in/out por canal, pausa/cancelamento e preocupação explícita com LGPD.
5. Fundamentos SaaS já presentes: multiempresa, três papéis, trial/billing, super-admin, custos e auditoria.

## Decisão de compra

**Hoje:** não contratar para operação comercial.
**Após Fase 0:** considerar piloto controlado com escopo apenas de contatos/campanhas, um tenant por vez, limites baixos, destinatários internos e operação assistida.
**Para venda ampla:** completar Fases 1–3 e validar a experiência com usuários reais do ICP.

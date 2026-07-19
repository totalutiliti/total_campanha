# 05 — UX, UI e acessibilidade

## Método e limitação

Auditoria estática de todas as páginas e componentes do frontend, sob quatro perspectivas: iniciante, usuário frequente, administrador do tenant e prospect. Não houve browser porque web/API não estavam ativos e `docker compose ps` resolveu containers de outro projeto/configuração local, tornando inseguro iniciar o stack. Contraste computado, reflow real, foco, leitor de tela e tempo percebido estão **não validados**.

Referência: [WCAG 2.2, W3C Recommendation](https://www.w3.org/TR/WCAG22/), alvo recomendado para piloto: A/AA aplicável.

## Síntese

**Pontos positivos:** português claro, estados vazios acionáveis, componentes consistentes, foco visível nos controles-base, formulários majoritariamente rotulados, dashboard em quatro passos, importação em etapas, estimativa/custo antes do disparo e explicação da janela WhatsApp.

**Bloqueadores:** envio sem confirmação, rascunho sem edição, onboarding BYOA técnico, dialogs inacessíveis, ausência de testes frontend, falta de catálogo e inconsistência de papéis/marca.

## Jornada por tela

| Tela                 | Objetivo                          | Problema/evidência                                                                 | Impacto/severidade/prioridade                | Recomendação e critério de aceite                                         |
| -------------------- | --------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `/login`             | Entrar, TOTP e selecionar empresa | Sem signup, links legais ou `h1`; `login/page.tsx`                                 | Aquisição/acessibilidade; média/baixa, P1-P2 | Signup/suporte/legal; heading por estado; axe/teclado                     |
| Forgot/reset         | Recuperar acesso                  | Fluxo existe; foco/mensagens runtime NV                                            | Abandono; média P2                           | E2E com token inválido/expirado e anúncio de erro                         |
| `/`                  | Checklist de ativação             | Erros viram zero/vazio; `page.tsx:26-40`                                           | Estado enganoso; média P2                    | Estado parcial/retry/último valor; falha simulada                         |
| `/contatos`          | Buscar/selecionar base            | Fixa 200 sem paginação; busca sem label; prompt nativo                             | Escala/a11y; média P1-P2                     | Cursor/páginas, label, seleção todos do filtro; 10k/360px                 |
| Contato novo/detalhe | CRUD/opt-in/LGPD                  | Erros globais sem vínculo; hard delete por confirm e disponível a editor           | Correção/irreversibilidade; alta/média P1    | Erro por campo; modal step-up ADMIN; E2E                                  |
| Importar             | Mapear/preview/upsert             | Excelente fluxo; possível dado real, PII Redis e limites                           | Privacidade/escala; alta P0/P1               | Sintéticos, streaming, progresso/recomeço; 10k fictícios                  |
| `/segmentos`         | Listar/criar grupo                | Sem edição; exclusão apenas; builder pede `extras.regiao`                          | Usuário não técnico; média P1                | Campos humanos, resumo natural e edição; teste moderado                   |
| `/templates`         | Criar mensagem                    | Biblioteca/teste Meta sem UI; editor email expõe MJML                              | Complexidade; média P1-P2                    | Templates guiados, biblioteca e envio teste seguro                        |
| `/campanhas`         | Histórico/lista                   | Sem busca/filtro/paginação/comparação                                              | Operação; média P2                           | Filtros, cursor, export e comparação                                      |
| Campanha nova        | Criar rascunho                    | Fluxo simples e informa que não envia; custo só no detalhe                         | Positivo; custo percebido tardio             | Wizard/revisão antes de concluir rascunho                                 |
| Campanha detalhe     | Revisar/agir/medir                | Envio direto; rascunho não edita; público final não é inspecionável                | **Alta P0/P1** (`UX-001/002`)                | Confirmação final + teste; editar/reestimar; cancel do modal = zero envio |
| `/respostas`         | Inbox WhatsApp                    | Mobile empilha lista 70vh antes da thread; input sem label; mensagens sem live log | Mobile/a11y; média P1-P3                     | Master-detail, label e `role=log`; 360×640/NVDA                           |
| `/conexoes`          | Configurar canais                 | UI não oferece editar/testar/desconectar/diagnóstico                               | Suporte; média P1                            | Ações operacionais e mensagens acionáveis                                 |
| WhatsApp novo        | BYOA                              | Token permanente, IDs e webhook manuais                                            | **Alta P1** (`UX-003`)                       | Embedded/assistência/retomada; taxa de conclusão definida                 |
| Email novo           | DNS/remetente                     | Tabela sem caption/scope e risco de corte mobile                                   | A11y/mobile; média P2                        | Semântica e reflow; leitor/360px                                          |
| `/plano`             | Assinar/mudar/cancelar            | Preços divergentes e limites sem enforcement                                       | **Alta P1**                                  | Fonte única/entitlements; contrato E2E                                    |
| `/minha-conta`       | Perfil/senha                      | Sem perfil/empresa, sessões, 2FA, privacy/export/delete                            | Confiança/admin; média P1-P2                 | Centro de segurança e direitos                                            |
| `/manual`            | Ajuda contextual                  | “Captura de tela em breve”                                                         | Baixa P3                                     | Conteúdo versionado, busca e deep link                                    |
| Opt-in/out público   | Consentimento                     | Visual/runtime NV; lógica tem riscos de identidade/GET                             | Alta P0/P1                                   | Jornada acessível e consentimento verificável                             |
| `/admin/*`           | Operar plataforma                 | Núcleo existe; tabelas/confirm, sessões e ações operacionais incompletas           | Alta/média P1                                | Centro operacional, a11y e sessão privilegiada                            |

## Achados UX/UI principais

### ACHADO UX-001 — Envio sem confirmação inequívoca

**Severidade:** Alta · **Prioridade:** P0 · **Status:** Confirmado
**Evidência:** custo/público em `campanhas/[id]:304-327`; botão chama disparo direto em `:339-360`.
**Impacto:** clique acidental causa custo, spam e dano reputacional.
**Recomendação:** modal final com canal, público, custo, horário, irreversibilidade e envio teste.
**Aceite:** cancelar/fechar modal não chama API; confirmação exige ação explícita e é auditada.

### ACHADO UX-002 — Rascunho não pode ser corrigido

API tem PATCH, mas UI não edita nome/template/grupo/canal/agenda. Aceite: edição preserva dados e invalida/recalcula estimativa antes de nova confirmação.

### ACHADO UX-003 — Onboarding BYOA não serve ao ICP sem assistência

Complexidade é fato; taxa de abandono é hipótese. Implementar Embedded Signup quando viável, progresso retomável, diagnóstico e agenda de suporte. Aceite: meta de sucesso definida em teste moderado com PME real.

### ACHADOS UX-004 a UX-007

- **UX-004:** contatos além de 200 ficam inacessíveis; paginação/seleção do filtro.
- **UX-005:** segmentos técnicos e inbox móvel; campos humanos/master-detail.
- **UX-006:** UI não reflete RBAC; matriz de capacidades e E2E por papel.
- **UX-007:** erros silenciosos parecem dados ausentes; estado parcial e retry.

### Identidade e credibilidade

- “Total Utiliti” no logo e “Total Campanha” em título/footer; decidir arquitetura da marca.
- Tenant não tem logo/cor/domínio; white-label é decisão, não requisito técnico automático.
- Exemplos do piloto precisam ser neutralizados.
- Páginas legais/suporte/canal de privacidade não são descobríveis.

## Acessibilidade

### ACHADO ACC-001 — Dialog sem nome/foco

**Severidade:** Alta · **Prioridade:** P1 · **Status:** Confirmado
`role=dialog` e `aria-modal` existem, mas sem `aria-labelledby/describedby`, foco inicial, trap, fundo inert ou retorno. Afeta cancelar/excluir campanha e plano. Aceite: padrão WAI-ARIA, teclado completo e NVDA.

### ACHADO ACC-002 — Drawer móvel sem estado/foco

**Severidade:** Média · **P1.** Falta `aria-expanded/controls`, Escape, trap e restauração. Aceite: leitor anuncia estado e Tab não alcança fundo.

### ACHADO ACC-003 — Lacunas semânticas

**Severidade:** Média · **P2.** Busca/resposta dependem de placeholder; erros não usam `aria-invalid/describedby`; navegação ativa só muda cor; tabelas sem caption/scope e reflow. Aceite: labels/erros associados, `aria-current`, tabela responsiva e axe sem violações críticas.

### Achados baixos

- **ACC-004:** alguns avisos e atualizações da conversa não têm live role/log.
- **ACC-005:** login não tem heading principal.
- Alvos principais parecem ≥24 px estaticamente, mas geometria runtime continua não validada.
- `prefers-reduced-motion`, zoom 200/400%, contraste e ordem de foco precisam teste browser.

## Critério de saída UX para piloto

1. Jornada principal E2E em desktop e 360×640 com dados fictícios.
2. Confirmação/teste de envio e edição do rascunho.
3. Nenhum dead end por papel.
4. Dialog/drawer/labels/tabelas aprovados em teclado, axe e leitor de tela.
5. Termos/privacidade/suporte presentes e marca consistente.
6. Teste moderado com ao menos usuários do ICP e registro das dúvidas/abandono.

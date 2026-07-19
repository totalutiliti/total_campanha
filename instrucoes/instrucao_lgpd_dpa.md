# instrucao_lgpd_dpa.md — Total Campanha

> Operação LGPD para o Total Campanha. Define os papéis da TotalUtiliti, obrigações,
> procedimentos e templates de documentos.
> Aplicável também por analogia ao GDPR (clientes europeus, se houver).

## 1. Visão geral dos papéis

TotalUtiliti, ao operar o Total Campanha, tem **papel duplo**:

### 1.1. Operador (Art. 5, VII, LGPD)

Em relação aos **dados pessoais dos contatos do tenant** (lista de destinatários de campanhas):
- TotalUtiliti é **operador** — só trata os dados conforme instrução do tenant (controlador).
- Tenant decide *o que* fazer com os contatos, *para quem* enviar, *quando*.
- TotalUtiliti só processa o que foi pedido, com segurança adequada.

### 1.2. Controlador (Art. 5, VI, LGPD)

Em relação aos **dados pessoais dos próprios usuários do Total Campanha** (admins, editores do tenant, super admins TotalUtiliti):
- TotalUtiliti é **controlador** — decide finalidade e meios do tratamento.
- Cadastro, autenticação, audit log, comunicação comercial — tudo decidido pela TotalUtiliti.

### 1.3. Implicações práticas

| Aspecto | Como operador (contatos do tenant) | Como controlador (usuários da plataforma) |
|---|---|---|
| Base legal | Tenant define (consentimento, legítimo interesse) | TotalUtiliti define (execução de contrato) |
| Quem responde a titulares | Tenant primeiro, TotalUtiliti dá suporte | TotalUtiliti direto |
| Direito ao esquecimento | Tenant solicita → TotalUtiliti executa em <24h | TotalUtiliti executa direto, em <24h |
| Compartilhamento | Só conforme DPA | Conforme política da TotalUtiliti |
| Notificação de incidente | Tenant + ANPD | ANPD direto |

## 2. DPA (Data Processing Agreement) — template

Anexo ao termo de uso, aceito pelo tenant no signup. Versão controlada (`{currentVersion}`).

### Estrutura sugerida (resumo executivo)

```
ACORDO DE TRATAMENTO DE DADOS (DPA)
Total Campanha v{N}

1. PARTES
   Controlador: {Razão Social do Tenant} / CNPJ {x}
   Operador:    TotalUtiliti Management Consultoria Ltda / CNPJ 55.249.293/0001-37

2. OBJETO
   O Operador trata dados pessoais dos contatos do Controlador exclusivamente
   para fins de execução das campanhas instruídas pelo Controlador na plataforma
   Total Campanha.

3. NATUREZA DOS DADOS TRATADOS
   Dados de identificação: nome, email, telefone (E.164)
   Dados de contato/segmentação: tags, campos personalizados
   Dados de engajamento: status de envio/leitura/resposta de mensagens, opt-in/out
   Dados de comportamento: IP, user-agent, origem de opt-in (para evidência de consentimento)

4. CATEGORIAS DE TITULARES
   Contatos comerciais (B2B ou B2C) do Controlador.

5. DURAÇÃO
   Enquanto vigente o contrato de uso da plataforma. Após o término, dados são
   exportados sob solicitação e excluídos em até 30 dias.

6. OBRIGAÇÕES DO OPERADOR
   a) Tratar dados conforme instruções documentadas do Controlador (campanhas, segmentos).
   b) Garantir confidencialidade.
   c) Adotar medidas técnicas: criptografia em repouso, RLS, controle de acesso,
      audit log, monitoramento.
   d) Notificar o Controlador em até 24h sobre qualquer incidente de segurança.
   e) Auxiliar o Controlador no atendimento a titulares (direito de acesso, correção, exclusão).
   f) Devolver/eliminar dados ao fim do contrato.
   g) Não subcontratar tratamento sem autorização prévia (lista de subcontratados anexada).

7. SUBCONTRATADOS AUTORIZADOS
   - Microsoft Azure (hospedagem, Brazil South)
   - Amazon Web Services (email transacional SES, na região configurada pelo Controlador)
   - Meta Platforms (uso BYOA — Controlador é cliente direto da Meta)
   - Asaas / Stripe (cobrança da assinatura — não trata dados de contatos)

8. TRANSFERÊNCIA INTERNACIONAL
   Dados são armazenados em Brazil South (Azure) por padrão. Email pode trair
   regiões AWS conforme escolha do Controlador. Meta opera nos termos próprios.

9. DPO
   TotalUtiliti: dpo@totalcampanha.com.br
   Controlador: {email DPO do tenant}

10. INCIDENTES
    Procedimento em totalcampanha.com.br/seguranca/incidentes.

11. RESPONSABILIDADE
    Cada parte responde pelas obrigações sob seu controle. Operador responde
    objetivamente apenas quando não cumprir suas obrigações ou agir fora das
    instruções do Controlador.

Assinado eletronicamente no signup. Versão: v{N}, em {data}.
```

> ⚠️ **Disclaimer:** este é um esqueleto técnico. Antes de publicar, **revisar com advogado especialista em LGPD/contratos** (1-2h de consultoria, custo R$ 500-2.000).

## 3. Política de Privacidade pública

Disponível em `totalcampanha.com.br/privacidade`. Conteúdo mínimo:

1. Quem somos (TotalUtiliti, CNPJ)
2. Quais dados coletamos e por quê (separar: visitantes do site, usuários da plataforma, contatos dos tenants)
3. Base legal de cada tratamento
4. Compartilhamento (lista de operadores nossos)
5. Cookies e similares
6. Direitos do titular (Art. 18 LGPD)
7. Como exercer direitos: dpo@totalcampanha.com.br + formulário web
8. Retenção
9. Segurança
10. Transferência internacional
11. Encarregado (DPO)
12. Alterações da política (versão + data)

Versão controlada. Toda mudança gera nova versão e aviso no painel para usuários ativos.

## 4. Opt-in — registro imutável

Todo opt-in (e opt-out) gera registro em `opt_in_log`:

```sql
INSERT INTO opt_in_log (
  tenant_id, contato_id, canal, acao,
  ip, user_agent, origem, versao_termo
) VALUES (...);
```

Campos críticos:
- **`ip`**: IP do dispositivo que aceitou (evidência)
- **`user_agent`**: navegador/dispositivo
- **`origem`**: 'landing-tenant', 'qr-balcao-loja-x', 'webhook-import-erp', 'whatsapp-stop'
- **`versao_termo`**: snapshot do texto aceito (não só version label — guardar URL canônica)

### 4.1. Confirmação por canal

- **Email:** o POST público cria/atualiza o contato com `opt_in_email=false` e
  grava `consentimentos_pendentes` com hash do token, expiração, IP, user-agent,
  origem e versão. Apenas `GET /p/opt-in/confirmar/:token`, uma única vez e antes
  da expiração, ativa o canal e cria `opt_in_logs`.
- **WhatsApp:** a ação afirmativa na landing, vinculada ao telefone informado,
  registra imediatamente o evento do canal.
- Criação/edição administrativa e importação não podem conceder opt-in; podem
  apenas revogar um consentimento já ativo. A revogação também gera log.

**Imutabilidade com exceção de anonimização:**

```sql
REVOKE UPDATE, DELETE ON opt_in_logs FROM app_user;

-- Única exceção: função SECURITY DEFINER que exige
-- p_tenant_id = current_setting('app.current_tenant')::uuid e apenas zera PII.
GRANT EXECUTE ON FUNCTION tc_lgpd_anonimizar_opt_in(UUID, UUID) TO app_user;
```

Backup: opt_in_log é parte do backup PostgreSQL diário (35 dias geo-redundante).

## 5. Direito ao esquecimento (Art. 18, IV, LGPD)

### 5.1. Fluxo

1. **Solicitação chega** via:
   - Endpoint público `POST /p/direitos/exclusao` (qualquer pessoa) com email/telefone + email para confirmação
   - Tenant solicita pelo painel `/contatos/:id/lgpd-excluir`
   - WhatsApp inbox detectou `SAIR` (já vira opt-out automático)

2. **Verificação de identidade** (para solicitação pública):
   - Sistema envia email/SMS de confirmação com link
   - Titular clica → confirma

3. **Execução em até 24h** (lei diz "prazo razoável"; comprometemos com <24h):
   - Hard delete em `contatos` (linha some)
   - Em `mensagens`, substitui `contato_id` por NULL, adiciona `destinatario_hash = sha256(email_or_phone)` para manter estatísticas agregadas
   - Exclui `inbox_mensagens`, `inbox_conversas` e consentimentos pendentes do contato
   - Mantém `opt_in_logs` como evidência, mas zera `contato_id`, email e telefone pela função restrita de anonimização
   - Cria um OPT_OUT final sem PII para cada canal presente
   - Audit log com a ação

4. **Confirmação ao titular** por email/SMS: "Dados removidos em {data}. Eventuais registros de log mantidos por obrigação legal."

### 5.2. Implementação

```typescript
await prisma.runInTenant(tenantId, async (tx) => {
  // 1. Mensagens: contato_id -> NULL + hash por canal com pepper.
  // 2. Inbox e consentimentos pendentes: DELETE.
  // 3. opt_in_logs: tc_lgpd_anonimizar_opt_in(tenantId, contatoId).
  // 4. OPT_OUT sem PII para cada canal presente.
  // 5. Contato: hard DELETE.
});

// Audit sem PII é gravado após a transação.
```

## 6. Retenção de dados

| Tipo | Retenção | Justificativa |
|---|---|---|
| Conta de usuário ativa | Enquanto vigente o contrato | Execução do contrato |
| Conta de usuário inativa | 90 dias após cancelamento, depois delete | Período de reativação |
| Contatos do tenant | Enquanto o tenant manter | Decisão do tenant (controlador) |
| Mensagens (conteúdo completo) | 12 meses após envio | Operação + analytics |
| Mensagens (agregados estatísticos sem PII) | 5 anos | Análise histórica |
| opt_in_log | 5 anos após o último contato | Evidência de consentimento (Art. 8 §2) |
| audit_log | 5 anos | Compliance |
| Backup PostgreSQL | 35 dias | DR |
| Logs Application Insights | 30 dias | Operacional |

Job recorrente `lgpd-retencao`, executa diariamente às 4h:
- Identifica mensagens > 12 meses → anonimiza conteúdo, mantém contadores
- Identifica contas inativas > 90 dias → email lembrete; >120 dias → delete

## 7. Procedimento de incidente

### 7.1. Detecção

- Application Insights alerta para padrões anômalos (queries cross-tenant, acessos não usuais, vazamento por export)
- Tentativa de SQL injection bloqueada pelo Prisma → ainda assim audit
- Vazamento de credencial (gitleaks no CI, alertas Azure)

### 7.2. Resposta (RFC interno)

**Hora 0:**
- Equipe técnica identifica e contém (rotacionar segredos, isolar recurso)
- DPO (João) notificado em < 1h

**Hora 1-12:**
- Avaliação de impacto: que dados, quantos titulares, qual o risco real
- Decisão: incidente material? Critérios — dado sensível, escopo, exposição efetiva

**Hora 12-48:**
- Se material: notificar ANPD via [comunica.anpd.gov.br](https://www.gov.br/anpd) em até 72h
- Notificar tenants afetados (que repassarão aos titulares)
- Plano de remediação documentado

**Pós-incidente:**
- RCA (root cause analysis) público no nosso status page
- Atualização de procedimentos
- Update em `instrucoes/memoria.md` com lição

## 8. Direitos dos titulares

Endpoints públicos para exercício de direitos (Art. 18):

```
POST /p/direitos/acesso       - dados que temos sobre você
POST /p/direitos/correcao     - correção
POST /p/direitos/exclusao     - direito ao esquecimento
POST /p/direitos/portabilidade - export estruturado
POST /p/direitos/anonimizacao
POST /p/direitos/revogacao    - revogar consentimento
POST /p/direitos/info         - com quem compartilhamos
```

Cada um:
- Verifica identidade via email/SMS
- SLA 15 dias úteis (lei dá até 15 dias)
- Resposta por email com PDF assinado
- Audit log

## 9. DPO

**Encarregado pelo Tratamento de Dados Pessoais:** João (TotalUtiliti) ou pessoa designada quando o time crescer.

Email: `dpo@totalcampanha.com.br`
Página: `totalcampanha.com.br/privacidade#dpo`

Atribuições (Art. 41 LGPD):
- Receber reclamações de titulares
- Receber comunicações da ANPD
- Orientar funcionários sobre práticas
- Executar atribuições determinadas pela TotalUtiliti

## 10. Treinamento da equipe

Antes de qualquer pessoa (incluindo Antigravity em iniciativas autônomas) acessar dados PROD:
- Leu este documento na íntegra
- Aceitou termo de confidencialidade
- Tem acesso baseado em least-privilege (RBAC + role super_admin separado)

## 11. Checklist mensal LGPD

- [ ] Política de privacidade no ar e atualizada?
- [ ] DPA do termo de uso na versão correta?
- [ ] Endpoints de direitos do titular funcionando? (smoke test mensal)
- [ ] Algum incidente registrado? RCA feito?
- [ ] Algum acesso anômalo no audit_log?
- [ ] Retenção: o job `lgpd-retencao` rodou todos os dias?
- [ ] Backups testados (restore em DEV)?
- [ ] Lista de subcontratados (Azure, AWS SES, Meta, Asaas) está correta no DPA?
- [ ] Há tenant pedindo exclusão de base completa pendente?

## 12. Checklist anual LGPD

- [ ] Revisão da política de privacidade com advogado
- [ ] Auditoria interna de RLS (suíte tenant-isolation passa 100%)
- [ ] Auditoria de acesso (quem tem super_admin?)
- [ ] Pentest externo (custo R$ 5-15k, recomendado anual)
- [ ] Revisão do DPA — mudança de operadores subcontratados?
- [ ] Treinamento de equipe atualizado
- [ ] Plano de continuidade testado (PITR + DR)

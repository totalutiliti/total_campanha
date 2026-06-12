# ⚖️ 03 — LGPD e Proteção de Dados Pessoais

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
Antes de aplicar este prompt, analise o projeto atual e responda:

NÍVEL 1 — APLICABILIDADE BÁSICA
  O projeto coleta, armazena ou processa dados de pessoas físicas
  (nome, CPF, email, telefone, endereço, ou qualquer informação
  que identifique ou possa identificar uma pessoa)?
    → NÃO → PULAR este prompt inteiro. Não se aplica.
    → SIM → Aplicar TODAS as seções marcadas [UNIVERSAL].

NÍVEL 2 — DADOS FINANCEIROS / FISCAIS
  O projeto processa rendimentos, patrimônio, dados bancários,
  declarações de imposto, folha de pagamento, cartões de ponto?
    → SIM → Aplicar também seções marcadas [FINANCEIRO].

NÍVEL 3 — DADOS SENSÍVEIS (LGPD Art. 11)
  O projeto processa dados de saúde, biometria, religião,
  orientação sexual, filiação sindical, opinião política?
    → SIM → Aplicar também seções marcadas [SENSÍVEL].

NÍVEL 4 — DADOS DE MENORES
  O projeto armazena dados de crianças ou adolescentes
  (< 18 anos), mesmo como dependentes ou beneficiários?
    → SIM → Aplicar também seções marcadas [MENORES].

NÍVEL 5 — IA / PROCESSAMENTO EXTERNO
  O projeto envia dados pessoais para APIs externas
  (OpenAI, Document Intelligence, serviços fora do Brasil)?
    → SIM → Aplicar também seções marcadas [TRANSFERÊNCIA].

RESUMO RÁPIDO:
  Projeto SaaS contábil (Total Ledger)    → TODOS os níveis
  Projeto CRM vidraçaria (VidroSaaS)      → Nível 1 + 5
  Projeto rastreamento de barris (KegSafe) → Nível 1 (se tiver login de PF)
  Projeto recrutamento (Total Talent)      → Nível 1 + 3 (dados sensíveis de candidatos) + 5
  Projeto chatbot (Lello Bella)            → Nível 1 + 5
```

---

## 📋 ÍNDICE

1. [Papéis LGPD — Quem é quem](#1-papéis-lgpd) `[UNIVERSAL]`
2. [Bases Legais para Tratamento de Dados](#2-bases-legais) `[UNIVERSAL]`
3. [Princípios LGPD no Código](#3-princípios-lgpd) `[UNIVERSAL]`
4. [Mapeamento de Dados — Como fazer](#4-mapeamento-de-dados) `[UNIVERSAL]`
5. [Direitos dos Titulares — Implementação](#5-direitos-dos-titulares) `[UNIVERSAL]`
6. [Retenção e Exclusão de Dados](#6-retenção-e-exclusão) `[UNIVERSAL]`
7. [Pseudonimização em Logs](#7-pseudonimização) `[UNIVERSAL]`
8. [Comunicação de Incidentes](#8-comunicação-de-incidentes) `[UNIVERSAL]`
9. [Dados Financeiros e Fiscais](#9-dados-financeiros) `[FINANCEIRO]`
10. [Dados Sensíveis](#10-dados-sensíveis) `[SENSÍVEL]`
11. [Dados de Menores](#11-dados-de-menores) `[MENORES]`
12. [Transferência Internacional e IA](#12-transferência-internacional) `[TRANSFERÊNCIA]`
13. [Documentação Obrigatória (ROPA, DPA, Política)](#13-documentação) `[UNIVERSAL]`
14. [Checklist de Validação](#14-checklist) `[UNIVERSAL]`
15. [Instruções para Claude Code](#15-instruções-claude-code) `[UNIVERSAL]`

---

## 1. Papéis LGPD `[UNIVERSAL]`

Antes de implementar qualquer coisa, identifique quem é quem no projeto:

```
TITULAR
  = Pessoa física cujos dados são processados
  = Identificar olhando as entidades do banco:
    Quem é a "pessoa" cujos dados estão nas tabelas?

CONTROLADOR
  = Quem DECIDE por que e como os dados são tratados
  = Geralmente: o cliente que contrata o SaaS
  = Em projetos internos: a própria TotalUtiliti

OPERADOR
  = Quem PROCESSA os dados em nome do controlador
  = Geralmente: TotalUtiliti (nós, como fornecedor SaaS)
  = Se usamos Azure OpenAI, a Microsoft também é subprocessador

COMO IDENTIFICAR NO PROJETO:
  1. Olhe as tabelas do banco
  2. Encontre as que contêm CPF, nome, email de pessoas físicas
  3. Pergunte: "Quem é o dono dessa pessoa?" → Controlador
  4. Pergunte: "Quem construiu o sistema?" → Operador
  5. Pergunte: "De quem são esses dados?" → Titular
```

### Obrigações por papel

```
SE TotalUtiliti = OPERADOR (SaaS para clientes):
  □ Processar dados APENAS conforme instruções do controlador
  □ Implementar medidas de segurança técnicas
  □ Auxiliar o controlador no atendimento a titulares
  □ Manter registro das atividades de tratamento (ROPA)
  □ Notificar o controlador sobre incidentes
  □ NÃO compartilhar dados com terceiros sem autorização
  □ Contrato de processamento (DPA) obrigatório com cada cliente

SE TotalUtiliti = CONTROLADOR (projeto interno ou próprio):
  □ Tudo acima + definir finalidade e base legal
  □ Obter consentimento quando necessário
  □ Comunicar incidentes à ANPD (3 dias úteis)
  □ Responder diretamente às solicitações dos titulares
  □ Indicar DPO/Encarregado com dados públicos
```

---

## 2. Bases Legais `[UNIVERSAL]`

A LGPD (Art. 7º) exige que todo tratamento de dados tenha uma base legal.

### Árvore de decisão (usar para CADA tipo de dado no projeto)

```
O dado é necessário para cumprir uma LEI ou REGULAMENTO?
  (ex: enviar dados ao eSocial, Receita Federal, ANATEL)
  → SIM → Base: OBRIGAÇÃO LEGAL (Art. 7º, II)
  → NÃO ↓

O dado é necessário para executar o CONTRATO com o titular?
  (ex: prestar o serviço que ele contratou)
  → SIM → Base: EXECUÇÃO DE CONTRATO (Art. 7º, V)
  → NÃO ↓

O dado é necessário para DEFESA em eventual processo?
  (ex: logs de ação para comprovação)
  → SIM → Base: EXERCÍCIO REGULAR DE DIREITOS (Art. 7º, VI)
  → NÃO ↓

O uso atende a INTERESSE LEGÍTIMO sem prejudicar o titular?
  (ex: analytics agregados, melhoria do produto)
  → SIM → Base: LEGÍTIMO INTERESSE (Art. 7º, IX)
  → Documentar LIA (Legitimate Interest Assessment)
  → NÃO ↓

  → Precisa de CONSENTIMENTO explícito (Art. 7º, I)
  → Implementar opt-in claro e revogável
  → ATENÇÃO: consentimento é frágil — pode ser revogado a qualquer momento
```

### Regra prática

```
PARA A MAIORIA DOS PROJETOS TOTALUTILITI:
  • Dados para prestar o serviço → Execução de contrato
  • Dados exigidos por lei → Obrigação legal
  • Logs de segurança → Legítimo interesse
  • Marketing, newsletter → Consentimento (opt-in)

ERRO COMUM: Usar consentimento para tudo.
  Consentimento é a base MAIS FRACA (revogável).
  Prefira obrigação legal ou execução de contrato quando aplicável.
```

---

## 3. Princípios LGPD no Código `[UNIVERSAL]`

### 3.1 Finalidade — Cada campo tem um porquê

```typescript
// ❌ ERRADO — Campos sem finalidade clara
interface Cliente {
  nome: string;
  cpf: string;
  signoZodiacal: string;     // Para quê?
  corFavorita: string;        // Irrelevante
  redesSociais: string[];     // Sem finalidade no contexto
}

// ✅ CORRETO — Cada campo justificado
interface Cliente {
  nome: string;          // Identificação — necessário para o serviço
  cpf: string;           // Identificação fiscal — obrigação legal
  email: string;         // Comunicação — execução de contrato
  telefone?: string;     // Comunicação alternativa — execução de contrato
  // Se um campo não tem finalidade clara → NÃO colete
}
```

### 3.2 Necessidade (Minimização)

```
ANTES de criar um campo, pergunte:
  "Se eu remover esse campo, o sistema deixa de funcionar?"
  → NÃO → Não crie esse campo
  → SIM → Documente a base legal

ANTES de retornar dados em um endpoint, pergunte:
  "O frontend PRECISA de todos esses campos?"
  → NÃO → Retorne apenas os necessários (DTO/select específico)
  → SIM → Ok, mas documente
```

### 3.3 Transparência — O titular sabe o que está acontecendo

```
IMPLEMENTAR NO PRODUTO:
  □ Política de Privacidade acessível (link no footer de TODAS as telas)
  □ Na tela de coleta de dados: informar finalidade
  □ No primeiro acesso: aceite dos Termos (com registro)
  □ Se possível: painel "Meus Dados" para o titular consultar
```

---

## 4. Mapeamento de Dados — Como fazer `[UNIVERSAL]`

O Antigravity deve ser capaz de gerar o mapeamento automaticamente
analisando o projeto.

### Instrução para o Claude Code

```
PARA MAPEAR DADOS PESSOAIS NO PROJETO:

1. Liste todas as tabelas/entidades do banco
2. Para cada tabela, identifique campos que contêm dados de PF:
   - CPF, RG, nome, email, telefone, endereço → Dado pessoal
   - Dados de saúde, biometria, religião → Dado sensível
   - Data de nascimento de dependentes → Pode ser menor
3. Para cada campo identificado, preencha:

   | Tabela | Campo | Tipo LGPD | Base Legal | Retenção |
   |--------|-------|-----------|------------|----------|
   | users  | email | Pessoal   | Contrato   | Vida da conta + 5 anos |
   | users  | cpf   | Pessoal   | Obrigação legal | Vida da conta + 5 anos |
   
4. Identifique fluxos de dados para fora do sistema:
   - APIs externas (OpenAI, Document Intelligence, WhatsApp)
   - Armazenamento (Blob Storage, Redis)
   - Cada destino é um subprocessador a ser documentado
```

---

## 5. Direitos dos Titulares — Implementação `[UNIVERSAL]`

A LGPD (Art. 18) garante direitos aos titulares. O sistema deve
facilitar o exercício desses direitos.

### O que implementar (priorizado)

```
PRIORIDADE ALTA (implementar antes do primeiro deploy):
  □ Acesso aos dados — titular pode ver o que está armazenado
  □ Correção — titular pode corrigir dados incorretos
  □ Eliminação — titular pode solicitar exclusão (com verificação legal)

PRIORIDADE MÉDIA (implementar no primeiro mês):
  □ Portabilidade — exportar dados em JSON/CSV
  □ Confirmação de tratamento — verificar se há dados armazenados
  □ Informação sobre compartilhamento — com quem dados são compartilhados

PRIORIDADE BAIXA (implementar progressivamente):
  □ Anonimização — substituir dados por hash irreversível
  □ Revogação de consentimento — toggle para consentimentos específicos
```

### Código NestJS — Módulo LGPD reutilizável

```typescript
// ============================================================
// Módulo LGPD — Reutilizável em todos os projetos TotalUtiliti
// ============================================================
// Copie este módulo e adapte o LgpdDataService para o projeto.
// O controller e os endpoints são UNIVERSAIS.
// ============================================================

@Controller('api/lgpd/titular')
@UseGuards(AuthGuard, RbacGuard)
export class LgpdTitularController {

  // Confirmar se existem dados do titular
  @Get(':identificador/existe')
  async confirmarTratamento(
    @Param('identificador') identificador: string, // CPF, email, ou ID
  ) {
    const existe = await this.lgpdService.verificarExistencia(identificador);
    return { titular_encontrado: existe };
  }

  // Acesso completo aos dados
  @Get(':identificador/dados')
  @AuditLog('LGPD_ACESSO_DADOS')
  async acessarDados(@Param('identificador') identificador: string) {
    return {
      dados: await this.lgpdService.obterDadosCompletos(identificador),
      data_consulta: new Date().toISOString(),
      base_legal: 'Art. 18, II — Direito de acesso',
    };
  }

  // Exportação / Portabilidade
  @Get(':identificador/exportar')
  @AuditLog('LGPD_PORTABILIDADE')
  async exportar(
    @Param('identificador') identificador: string,
    @Query('formato') formato: 'json' | 'csv' = 'json',
  ) {
    return this.lgpdService.exportar(identificador, formato);
  }

  // Solicitação de eliminação
  @Delete(':identificador')
  @AuditLog('LGPD_SOLICITACAO_ELIMINACAO')
  async solicitarEliminacao(
    @Param('identificador') identificador: string,
  ) {
    const avaliacao = await this.lgpdService.avaliarEliminacao(identificador);

    if (avaliacao.possuiObrigacaoLegal) {
      return {
        status: 'RETIDO_POR_OBRIGACAO_LEGAL',
        motivo: avaliacao.motivo,
        previsao_eliminacao: avaliacao.dataEliminacao,
        base_legal: 'Art. 16, I — Cumprimento de obrigação legal',
      };
    }

    await this.lgpdService.agendarEliminacao(identificador);
    return { status: 'ELIMINACAO_AGENDADA', prazo: '15 dias' };
  }

  // Anonimização
  @Post(':identificador/anonimizar')
  @AuditLog('LGPD_ANONIMIZACAO')
  async anonimizar(@Param('identificador') identificador: string) {
    await this.lgpdService.anonimizar(identificador);
    return { status: 'ANONIMIZADO' };
  }
}

// ============================================================
// O LgpdDataService é PROJETO-ESPECÍFICO.
// Cada projeto implementa a interface abaixo com as suas tabelas.
// ============================================================
interface ILgpdDataService {
  verificarExistencia(identificador: string): Promise<boolean>;
  obterDadosCompletos(identificador: string): Promise<object>;
  exportar(identificador: string, formato: string): Promise<Buffer>;
  avaliarEliminacao(identificador: string): Promise<AvaliacaoEliminacao>;
  agendarEliminacao(identificador: string): Promise<void>;
  anonimizar(identificador: string): Promise<void>;
}
```

### Prazo de atendimento

```
LGPD Art. 19:
  • Resposta simplificada: IMEDIATA (automatizar via API)
  • Resposta completa: até 15 DIAS
  
IMPLEMENTAR:
  • Requisições simples (confirmação, acesso): resposta automatizada
  • Requisições complexas (eliminação, portabilidade): fila async +
    notificação ao controlador + prazo de 15 dias
  • Log de TODAS as solicitações e respostas (audit trail)
```

---

## 6. Retenção e Exclusão de Dados `[UNIVERSAL]`

### Regras gerais de retenção

```
REGRA: Dados pessoais NÃO podem ser mantidos indefinidamente.
Definir prazo para CADA tipo de dado no projeto.

PRAZOS COMUNS:
  • Dados necessários ao serviço → Duração do contrato + prazo legal
  • Logs de acesso/segurança → 1 ano
  • Dados de marketing (consentimento) → Até revogação ou 2 anos sem uso
  • Documentos processados (OCR, uploads temporários) → 90 dias
  • Registros de incidentes LGPD → 5 anos (Resolução ANPD nº 15/2024)
```

### Soft Delete vs Hard Delete vs Anonimização

```
SOFT DELETE (padrão TotalUtiliti):
  • Campo deleted_at = timestamp
  • Dados ainda existem no banco (recuperável)
  • Usar para: exclusão durante o prazo de retenção
  • TODAS as entidades com dados pessoais DEVEM ter soft delete

HARD DELETE:
  • Remoção física do banco (irrecuperável exceto backup)
  • Usar para: dados temporários após prazo (uploads OCR, cache)

ANONIMIZAÇÃO (preferida quando há dados agregados úteis):
  • Substituir dados identificáveis por hash irreversível
  • Manter dados agregados para relatórios/métricas
  • Usar para: dados históricos após prazo de retenção

  ANTES:  { cpf: "123.456.789-00", nome: "João Silva", valor: 5000 }
  DEPOIS: { cpf: "a1b2c3d4e5", nome: "ANONIMIZADO", valor: 5000 }
```

### Job de retenção automatizado

```typescript
// Rodar diariamente — adaptar tabelas para cada projeto
@Cron('0 3 * * *') // 3h da manhã
async aplicarPoliticaRetencao() {
  const politicas = await this.retencaoService.obterPoliticas();

  for (const politica of politicas) {
    const registrosExpirados = await this.retencaoService
      .buscarExpirados(politica.tabela, politica.prazo);

    for (const registro of registrosExpirados) {
      switch (politica.acao) {
        case 'anonimizar':
          await this.lgpdService.anonimizar(registro.identificador);
          break;
        case 'hard_delete':
          await this.dataService.hardDelete(registro.id);
          break;
      }

      await this.auditService.registrar({
        acao: 'RETENCAO_AUTOMATICA',
        tipo: politica.acao,
        registro_id: registro.id,
        politica: politica.nome,
      });
    }
  }
}
```

---

## 7. Pseudonimização em Logs `[UNIVERSAL]`

```typescript
// ============================================================
// REGRA ABSOLUTA: NUNCA logar dados pessoais em texto plano
// ============================================================

// ❌ PROIBIDO
logger.info(`Processando dados do CPF 123.456.789-00`);
logger.info(`Usuário João da Silva fez login`);
logger.error(`Erro ao processar renda de R$ 150.000`);

// ✅ CORRETO
logger.info(`Processando dados do CPF ***.***.789-00`);
logger.info(`Login: user_id=a1b2c3`);
logger.error(`Erro ao processar dados do titular_id=a1b2c3`);

// Funções de mascaramento (reutilizáveis)
function mascarCpf(cpf: string): string {
  return cpf.replace(/^\d{3}\.\d{3}/, '***. ***');
}

function mascarEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user[0]}***@${domain}`;
}

function mascarTelefone(tel: string): string {
  return tel.replace(/\d{4,5}(?=-)/, '****');
}

// O QUE NUNCA LOGAR (em nenhum projeto):
//   • CPF completo
//   • Nome completo
//   • Endereço
//   • Dados financeiros (renda, patrimônio, saldo)
//   • Dados de saúde
//   • Senhas (mesmo hasheadas)
//   • Tokens JWT
//   • Conteúdo de documentos pessoais
```

---

## 8. Comunicação de Incidentes `[UNIVERSAL]`

### Regulamento vigente: Resolução CD/ANPD nº 15/2024

```
PRAZO:
  • 3 dias úteis a partir da ciência do incidente
  • 6 dias úteis para agentes de pequeno porte
  • Complementação: até 20 dias úteis adicionais

QUANDO É OBRIGATÓRIO COMUNICAR (pelo menos 1 critério):
  • Tratamento em larga escala
  • Dados sensíveis ou de menores
  • Informações financeiras
  • Dados biométricos
  • Dados protegidos por sigilo legal

REGISTRO OBRIGATÓRIO:
  • Manter registro de TODOS os incidentes por 5 ANOS
  • Mesmo os que não foram comunicados à ANPD
```

### Fluxo de resposta (aplicável a qualquer projeto)

```
HORA 0 — DETECÇÃO
  ↓
CONTENÇÃO (primeiras horas)
  • Isolar sistema afetado
  • Preservar evidências (logs, snapshots)
  • Avaliar extensão (quais dados, quantos titulares)
  ↓
CLASSIFICAÇÃO (até 24h)
  • Envolve dados pessoais?
  • Risco relevante aos titulares?
  • Atende critérios de comunicação obrigatória?
  ↓
SE TotalUtiliti = OPERADOR:
  → Notificar o CONTROLADOR (cliente) IMEDIATAMENTE
  → Auxiliar o controlador na comunicação à ANPD
  ↓
SE TotalUtiliti = CONTROLADOR:
  → Comunicar ANPD em até 3 dias úteis
  → Comunicar titulares afetados (mesmo prazo)
  ↓
REMEDIAÇÃO
  • Correção da vulnerabilidade
  • Complementação à ANPD (20 dias úteis)
  • Post-mortem documentado
```

### Template de notificação ao titular

```
ASSUNTO: Notificação de Incidente de Segurança — [Nome do Produto]

Prezado(a) [Nome ou "Titular"],

Informamos que em [data], identificamos um incidente de segurança
que pode ter afetado seus dados pessoais.

O QUE ACONTECEU: [descrição objetiva]
QUAIS DADOS PODEM TER SIDO AFETADOS: [lista de tipos]
O QUE ESTAMOS FAZENDO: [medidas de contenção e remediação]
O QUE VOCÊ PODE FAZER: [recomendações práticas]
CANAL DE CONTATO: [email/telefone do DPO]

Comunicação realizada conforme LGPD Art. 48 e Resolução ANPD nº 15/2024.

Atenciosamente,
[Responsável] / [DPO]
```

---

## 9. Dados Financeiros e Fiscais `[FINANCEIRO]`

> **Aplica-se quando:** o projeto processa rendimentos, patrimônio,
> dados bancários, declarações fiscais, folha de pagamento, cartões de ponto.

### Prazos de retenção específicos

```
PRAZO DECADENCIAL TRIBUTÁRIO: 5 ANOS (Art. 150, §4º do CTN)
  → Dados de IRPF, IRPJ, ECF, ECD → 5 anos após ano-calendário
  → Dados de folha de pagamento → 5 anos (CLT)
  → Dados de FGTS → 30 anos
  → Dados de eSocial → 5 anos após desligamento
  → Documentos fiscais → 5 anos (o Fisco pode exigir a qualquer momento)
```

### Base legal primária

```
Para dados fiscais, a base legal PRIMÁRIA é:
  → OBRIGAÇÃO LEGAL (Art. 7º, II)
  → O escritório/empresa é OBRIGADO por lei a processar esses dados

NÃO usar consentimento como base para dados fiscais obrigatórios.
Se o titular revogar consentimento mas a lei exige o dado → conflito.
```

### Dados sensíveis em contexto fiscal

```
ATENÇÃO: Despesas médicas para dedução de IRPF = dado de saúde = SENSÍVEL
  → Base legal: obrigação legal (Art. 11, II, "a")
  → Reter APENAS: valor, CNPJ do prestador, tipo de despesa
  → NÃO armazenar: diagnósticos, receitas, laudos detalhados
```

---

## 10. Dados Sensíveis `[SENSÍVEL]`

> **Aplica-se quando:** o projeto processa dados de saúde, biometria,
> dados genéticos, religião, opinião política, orientação sexual,
> filiação sindical ou partidária.

### Regras adicionais (Art. 11)

```
DADOS SENSÍVEIS TÊM REGRAS MAIS RÍGIDAS:

  Bases legais permitidas (Art. 11):
    a) Consentimento ESPECÍFICO e DESTACADO, OU
    b) Sem consentimento, quando INDISPENSÁVEL para:
       • Obrigação legal
       • Exercício regular de direitos
       • Proteção da vida
       • Tutela da saúde
       • Prevenção de fraude

  IMPLEMENTAÇÃO:
    □ Consentimento separado e destacado (não misturar com termos gerais)
    □ Criptografia adicional no campo (column-level encryption)
    □ Acesso restrito (roles específicas — nem todo admin vê)
    □ Logs de acesso mais rigorosos
    □ NÃO usar para finalidades secundárias (analytics, marketing)
```

### Projetos TotalUtiliti que podem ter dados sensíveis

```
TOTAL LEDGER → Despesas médicas (dedução IRPF) = dado de saúde
TOTAL TALENT → Dados de candidatos podem incluir PcD, gênero
LELLO BELLA  → Condôminos podem reportar questões de saúde
KEGSAFE      → Geralmente NÃO tem dados sensíveis
VIDROSAAS    → Geralmente NÃO tem dados sensíveis
```

---

## 11. Dados de Menores `[MENORES]`

> **Aplica-se quando:** o projeto armazena dados de crianças (< 12 anos)
> ou adolescentes (12-17 anos), mesmo como dependentes ou beneficiários.

### Regras específicas (Art. 14)

```
CRIANÇAS (< 12 ANOS):
  → Tratamento APENAS com consentimento ESPECÍFICO de pelo menos
    um dos pais ou responsável legal
  → Consentimento deve ser verificável

ADOLESCENTES (12-17 ANOS):
  → Podem consentir em algumas situações
  → Mas o melhor interesse do menor SEMPRE prevalece

TODOS OS MENORES:
  → NÃO condicionar participação em serviço à coleta de dados
    além do estritamente necessário
  → Informação sobre tratamento deve ser clara e acessível
    à faixa etária

IMPLEMENTAÇÃO PRÁTICA:
  □ Se o projeto armazena dependentes (IRPF, plano de saúde):
    → Registrar que o responsável legal autorizou
    → Campo: data_consentimento_responsavel + responsavel_cpf
  □ Se o projeto tem cadastro direto de menores:
    → Fluxo de validação de responsável legal
    → NÃO coletar dados além do estritamente necessário
```

---

## 12. Transferência Internacional e IA `[TRANSFERÊNCIA]`

> **Aplica-se quando:** o projeto envia dados pessoais para serviços
> fora do Brasil (Azure OpenAI, Document Intelligence em outra região,
> APIs de terceiros internacionais).

### Quando acontece nos projetos TotalUtiliti

```
AZURE OPENAI (Sweden Central):
  → Dados enviados para processamento GPT
  → Se dados pessoais estão no prompt → transferência internacional
  → Microsoft DPA cobre como base legal (cláusulas contratuais padrão)
  → Suécia/UE tem nível adequado de proteção

AZURE DOCUMENT INTELLIGENCE (East US / East US 2):
  → Imagens de documentos com dados pessoais
  → Microsoft DPA cobre

WHATSAPP / META CLOUD API:
  → Mensagens com dados pessoais de candidatos (Total Talent)
  → Meta DPA necessário

TWILIO:
  → Mensagens SMS com dados pessoais
  → Twilio DPA necessário
```

### O que implementar

```
□ Verificar que o Microsoft DPA está aceito na assinatura Azure
□ Documentar CADA serviço externo que recebe dados pessoais
□ Informar nos Termos de Uso que dados podem ser processados
  em servidores fora do Brasil
□ No ROPA: listar todos os subprocessadores internacionais
□ Avaliar: é possível usar região Brazil South? Se sim, migrar.

MINIMIZAÇÃO DE DADOS EM PROMPTS DE IA:
  □ Antes de enviar para OpenAI: remover/mascarar dados desnecessários
  □ Enviar CPF completo para GPT? → Provavelmente NÃO necessário
  □ Enviar nome completo? → Avaliar se é estritamente necessário
  □ Preferir enviar IDs internos e só dados essenciais ao processamento
```

---

## 13. Documentação Obrigatória `[UNIVERSAL]`

### Para TODO projeto que processa dados pessoais

```
ANTES DO PRIMEIRO DEPLOY:
  □ Política de Privacidade — publicada no produto
  □ Termos de Uso — publicados no produto
  □ ROPA (Registro de Atividades de Tratamento) — preenchido
    → Listar: quais dados, por quê, base legal, retenção, compartilhamento

SE TotalUtiliti = OPERADOR (SaaS para clientes):
  □ Contrato de Processamento de Dados (DPA) modelo
    → Cláusulas obrigatórias: objeto, duração, obrigações do operador,
      subprocessadores, medidas de segurança, término
  □ Lista de subprocessadores (Azure, OpenAI, etc.)

SE TotalUtiliti = CONTROLADOR:
  □ DPO indicado com dados públicos (nome, email)
  □ Canal de atendimento ao titular funcional

REGISTRO DE ACEITE DE TERMOS:
  □ Armazenar: user_id, versão dos termos, data, IP, user-agent
  □ Tabela imutável (nunca deletar, nunca alterar)
  □ Se termos mudarem → exigir novo aceite
```

### Template ROPA (preencher para cada projeto)

```
REGISTRO DE ATIVIDADES DE TRATAMENTO

OPERADOR/CONTROLADOR: TotalUtiliti Management Consultoria Ltda
CNPJ: 55.249.293/0001-37
PROJETO: [Nome do projeto]
DPO: [Nome] — [email]
DATA: [data de atualização]

Para cada atividade de tratamento:
  ┌──────────────────┬────────────────────────────────────┐
  │ Atividade         │ [Descrição]                        │
  │ Finalidade        │ [Por que os dados são processados] │
  │ Base legal        │ [Art. 7º, inciso X]                │
  │ Categorias dados  │ [CPF, nome, email, etc.]           │
  │ Categorias titular│ [Quem são as pessoas]              │
  │ Compartilhamento  │ [Com quem: Azure, Receita, etc.]   │
  │ Transf. internac. │ [Sim/Não — se sim, para onde]      │
  │ Prazo retenção    │ [Quanto tempo]                     │
  │ Medidas segurança │ [Criptografia, RLS, etc.]          │
  └──────────────────┴────────────────────────────────────┘
```

---

## 14. Checklist de Validação `[UNIVERSAL]`

### Antes do primeiro deploy (QUALQUER projeto com dados pessoais):

```
JURÍDICO / DOCUMENTAL:
  □ Política de Privacidade publicada
  □ Termos de Uso publicados
  □ ROPA preenchido
  □ DPO indicado (se controlador)
  □ DPA modelo criado (se operador/SaaS)
  □ Microsoft DPA aceito (se usa Azure)

TÉCNICO / CÓDIGO:
  □ Soft delete em TODAS as entidades com dados pessoais
  □ Campos created_at, updated_at, deleted_at em entidades com dados pessoais
  □ Base legal documentada (comentário na migration ou no ROPA)
  □ Pseudonimização de dados pessoais nos logs
  □ Audit log em operações que acessam dados pessoais
  □ Endpoint de acesso aos dados do titular (GET /api/lgpd/titular/:id/dados)
  □ Endpoint de eliminação (DELETE /api/lgpd/titular/:id)
  □ Registro de aceite de termos (tabela imutável)
  □ RLS multi-tenant isolando dados entre clientes (se SaaS)
  □ Criptografia em repouso (Azure TDE)
  □ TLS 1.2+ em todas as conexões

OPERACIONAL:
  □ Plano de resposta a incidentes documentado
  □ Template de notificação ao titular pronto
  □ Canal de contato do DPO funcional
```

### Checklist adicional `[FINANCEIRO]`:

```
  □ Prazo de retenção de 5 anos configurado para dados fiscais
  □ Verificação de obrigação legal na eliminação de dados
  □ Job de retenção automatizado (não manter dados além do prazo)
```

### Checklist adicional `[SENSÍVEL]`:

```
  □ Consentimento específico e destacado para dados sensíveis
  □ Criptografia de coluna nos campos sensíveis (column-level)
  □ Acesso restrito (roles específicas)
```

### Checklist adicional `[TRANSFERÊNCIA]`:

```
  □ Subprocessadores internacionais documentados no ROPA
  □ DPAs dos subprocessadores aceitos/assinados
  □ Informação sobre transferência nos Termos de Uso
  □ Minimização de dados em prompts de IA
```

---

## 15. Instruções para Claude Code `[UNIVERSAL]`

> O Antigravity deve seguir estas regras ao trabalhar em QUALQUER projeto
> que processe dados pessoais.

````markdown
## LGPD — Regras para Antigravity

### Ao iniciar trabalho em um projeto
- Leia este prompt (03-lgpd) e identifique os NÍVEIS aplicáveis
  analisando entidades, tabelas e endpoints do projeto
- Se não souber se um nível se aplica, PERGUNTE ao João

### Ao criar entidades/tabelas
- SEMPRE incluir `created_at`, `updated_at`, `deleted_at` (soft delete)
- SEMPRE documentar a BASE LEGAL em comentário na migration
- NUNCA criar campos sem finalidade clara e documentada
- Se a tabela contém dados pessoais, adicionar ao ROPA

### Ao logar
- NUNCA logar CPF, nome, email, telefone completos
- NUNCA logar dados financeiros, de saúde, senhas, tokens
- Usar IDs internos (user_id, titular_id) em vez de dados pessoais
- Usar funções de mascaramento (mascarCpf, mascarEmail)

### Ao criar endpoints que acessam dados pessoais
- SEMPRE adicionar @AuditLog decorator (ou equivalente)
- SEMPRE aplicar controle RBAC (guards)
- Retornar APENAS os campos necessários (minimização via DTO)

### Ao excluir dados
- SEMPRE usar soft delete (nunca hard delete direto)
- Verificar obrigação legal antes de permitir eliminação total

### Ao enviar dados para APIs externas (OpenAI, etc.)
- Minimizar dados pessoais no payload
- Avaliar: precisa enviar CPF/nome completo? Provavelmente não.
- Documentar o subprocessador

### Ao criar telas de coleta de dados
- Incluir link para Política de Privacidade
- Informar finalidade da coleta
- Registrar aceite com timestamp + IP + versão dos termos
````

---

## 📝 Referências Legais

- [LGPD — Lei 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ANPD — Perguntas frequentes](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes)
- [Resolução CD/ANPD nº 15/2024 — Incidentes](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis)
- [Microsoft DPA](https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA)

> **DISCLAIMER:** Guia técnico de implementação, NÃO constitui assessoria
> jurídica. Para questões legais, consulte advogado especializado.

---

> **Próximo prompt:** `04-criptografia-e-dados-em-repouso.md`

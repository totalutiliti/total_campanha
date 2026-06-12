# 📝 22 — Contrato e SLA

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana (+ advogado)
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto é vendido como SaaS para clientes externos?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO (projeto interno, ferramenta interna) → Pular ou usar como referência.

O projeto processa dados pessoais em nome do cliente?
  → SIM → Contrato de Processamento de Dados (DPA) é OBRIGATÓRIO [DPA].
```

---

## 📋 CONTEÚDO

### 1. Termos de Uso (ToS) `[UNIVERSAL]`

```
ELEMENTOS OBRIGATÓRIOS:
  □ Identificação das partes (TotalUtiliti + cliente)
  □ Descrição do serviço prestado
  □ Responsabilidades do fornecedor (TotalUtiliti)
  □ Responsabilidades do cliente (escritório)
  □ Condições de uso aceitável
  □ Propriedade intelectual (o software é da TotalUtiliti, dados são do cliente)
  □ Limitação de responsabilidade
  □ Condições de rescisão
  □ Foro (comarca de São Paulo/Osasco)
  □ Data de vigência
  □ Link para Política de Privacidade
```

### 2. SLA (Service Level Agreement) `[UNIVERSAL]`

```
DEFINIR COM O CLIENTE:

  UPTIME:
    → Standard: 99.5% (permite ~3.6h de downtime/mês)
    → Premium: 99.9% (permite ~43min de downtime/mês)
    → Excluir: manutenções programadas (com aviso prévio de 48h)

  TEMPO DE RESPOSTA A INCIDENTES:
    → Crítico (sistema fora do ar): resposta em 1 hora
    → Alto (funcionalidade principal afetada): resposta em 4 horas
    → Médio (funcionalidade secundária): resposta em 8 horas
    → Baixo (dúvida, melhoria): resposta em 48 horas

  BACKUP E RECUPERAÇÃO:
    → RPO: máximo 1 hora de dados perdidos
    → RTO: máximo 4 horas para restaurar
    → Backup diário com retenção de X dias

  SUPORTE:
    → Canal: email / sistema de tickets
    → Horário: comercial (9h-18h) ou 24/7 (premium)
```

### 3. Contrato de Processamento de Dados (DPA) `[DPA]`

```
OBRIGATÓRIO quando TotalUtiliti processa dados pessoais em nome do cliente.
(Ver prompt 03, seção 12 para detalhes completos)

CLÁUSULAS ESSENCIAIS:
  □ Objeto: quais dados, para quê, por quanto tempo
  □ Obrigações do operador (TotalUtiliti):
    - Processar APENAS conforme instruções do controlador
    - Medidas de segurança implementadas (referenciar prompts 01-04)
    - Notificar incidentes ao controlador
    - Auxiliar no atendimento aos titulares
    - Não subcontratar sem autorização
    - Eliminar dados ao término do contrato
  □ Subprocessadores: Microsoft Azure (listar serviços e regiões)
  □ Transferência internacional: Azure Sweden Central (OpenAI)
  □ Término: procedimento de devolução/exclusão de dados
  □ Responsabilidade e indenização
```

### 4. Política de Privacidade `[UNIVERSAL]`

```
(Ver prompt 03, seção 11 para detalhes)
  □ Publicada no produto (link acessível)
  □ Atualizada quando houver mudança
  □ Registro de aceite com versão, data, IP
```

### 5. Material para o Cliente `[UNIVERSAL]`

```
DOCUMENTOS QUE FORTALECEM A VENDA:

  □ Resumo de medidas de segurança (1 página)
    → "Nosso SaaS implementa: criptografia AES-256, autenticação MFA,
       isolamento multi-tenant com RLS, backups automáticos..."
    → Baseado nos 22 prompts desta pasta

  □ Certificação/compliance (em evolução)
    → Conformidade LGPD documentada (ROPA, DPA, Política de Privacidade)
    → SOC 2 Type II (futuro — Azure já possui, TotalUtiliti herda parte)

  □ Referências
    → Caso de uso do primeiro cliente (com permissão)
```

### 6. Checklist

```
  □ Termos de Uso redigidos (com advogado)
  □ SLA definido (uptime, tempos de resposta, backup)
  □ DPA (Contrato de Processamento de Dados) modelo criado [DPA]
  □ Política de Privacidade publicada
  □ Lista de subprocessadores documentada
  □ Resumo de segurança para material comercial
  □ Procedimento de término de contrato (devolução/exclusão de dados)
  □ Foro e legislação aplicável definidos
```

### 7. DISCLAIMER

```
Este prompt é um GUIA TÉCNICO para estruturar documentos contratuais.
NÃO substitui assessoria jurídica. TODOS os contratos, termos de uso
e políticas devem ser revisados por advogado antes de publicação.
```

---

> **FIM DA PASTA DE VALIDAÇÃO — 22/22 prompts criados.**

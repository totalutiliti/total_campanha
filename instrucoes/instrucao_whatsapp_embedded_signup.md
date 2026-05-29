# Instrução — WhatsApp Embedded Signup (pendente de credenciais Meta)

> Status: **NÃO implementado** — bloqueado em configuração da Meta que só a
> Total/o tenant pode criar. Este documento registra o porquê e o ponto exato
> de plugar quando as credenciais existirem. O fluxo manual atual
> (`components/conexoes/whatsapp-wizard.tsx`) continua válido como fallback.

## Por que isto importa (auditoria de UX)

O **maior risco** da jornada de primeira campanha é **conectar o WhatsApp**: hoje
o usuário precisa de Meta Business Manager, WABA, número verificado e **token
permanente** — barreira intransponível para um dono de autopeças sem TI.

O **Embedded Signup** é o conserto: um botão "Conectar com Facebook" abre um
popup oficial da Meta onde a pessoa loga e autoriza; a plataforma recebe o
acesso sem o usuário tocar em token/WABA.

## Por que está bloqueado

Embedded Signup exige infraestrutura na Meta que **não dá para criar via código**
— precisa do painel `developers.facebook.com` e de verificação de negócio:

1. **App na Meta** com os produtos **Facebook Login for Business** + **WhatsApp**.
2. **Configuration ID** do Embedded Signup (criado no painel do app).
3. **App ID** (público) e **App Secret** (sigiloso → Key Vault).
4. **Verificação de negócio** da Total e status de **Tech Provider / Solution Partner**.
5. URL de redirect/domínio do app whitelistada no app da Meta.

Sem (1)–(5), qualquer código de Embedded Signup é inerte. Por isso **não foi
subido scaffold** — viraria código morto que dá falsa sensação de pronto.

## O que a Total precisa providenciar (checklist)

- [ ] Criar/verificar o App na Meta (Login for Business + WhatsApp).
- [ ] Concluir verificação de negócio + onboarding de Tech Provider.
- [ ] Gerar o Configuration ID do Embedded Signup.
- [ ] Definir as variáveis (App Secret no Key Vault):
  - `META_APP_ID`
  - `META_APP_SECRET`            (Key Vault → `secretref:`)
  - `META_EMBEDDED_CONFIG_ID`
  - `META_GRAPH_VERSION`         (ex.: `v21.0`)

## Onde plugar quando as credenciais existirem

**Frontend** (`apps/web/src/components/conexoes/whatsapp-wizard.tsx`):
- Trocar os passos manuais "Token Meta" + "Validação" por um botão único que
  carrega o Facebook JS SDK e chama `FB.login({ config_id: META_EMBEDDED_CONFIG_ID,
  response_type: 'code', override_default_response_type: true })`.
- O callback devolve um `code` de autorização → enviar ao backend.
- Manter o wizard manual atual atrás de um link "conectar manualmente" (fallback).

**Backend** (`apps/api/src/modules/conexoes/`):
- Novo endpoint `POST /conexoes/whatsapp/embedded` que recebe o `code` e:
  1. troca `code` por token via Graph API (`/oauth/access_token` com app secret);
  2. descobre `waba_id` e `phone_number_id` (Graph API `/debug_token` + `/{waba}/phone_numbers`);
  3. chama o **`ConexaoWhatsappService.criar`** que **já existe** — ele cifra o
     token (pgcrypto) e configura o webhook. Ou seja, o pipeline de persistência
     e o resto do produto (templates, disparo) **não mudam**.

Resumo: é só um **novo caminho de obtenção do token**; tudo a jusante já está pronto.

## Esforço estimado

~2–3 dias depois que as credenciais Meta estiverem disponíveis (SDK no front,
endpoint de troca de code→token no back, testes). Enquanto isso, o fluxo manual
permanece funcional para quem tem perfil técnico.

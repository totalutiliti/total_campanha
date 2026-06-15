import type { ReactElement, ReactNode } from 'react';

import { Dica, Figura, Passo, Passos, Subtitulo, UI } from '../../../components/manual/blocos';
import { AlertAviso } from '../../../components/ui/alerts';

/**
 * Conteúdo do Manual, uma seção por aba. Fiel aos rótulos/botões reais das telas
 * (`apps/web/src/app/(auth)/*`). Cada `Figura` é um slot de captura de tela: a
 * imagem entra depois em `public/manual/<arquivo>.png`.
 */

const V = '{{nome}}'; // placeholder de variável citado no texto (evita parse de JSX)

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{children}</code>;
}

// ───────────────────────────────── Início ─────────────────────────────────
function Inicio() {
  return (
    <div className="space-y-5">
      <P>
        A aba <strong>Início</strong> é o seu ponto de partida. No topo aparece o nome da sua
        empresa e o plano atual. Logo abaixo, o roteiro <UI>Comece por aqui</UI> com os{' '}
        <strong>4 passos</strong> para enviar a primeira campanha — o passo seguinte fica destacado
        e o contador mostra <Code>X de 4 concluídos</Code>.
      </P>
      <Figura
        src="/manual/inicio-1.png"
        legenda="Aba Início: roteiro “Comece por aqui” e atalhos."
      />
      <Subtitulo>Os 4 passos</Subtitulo>
      <Passos>
        <Passo n={1} titulo="Conectar um canal">
          <P>
            WhatsApp ou e-mail — é por onde as campanhas saem. Botão <UI>Conectar</UI>.
          </P>
        </Passo>
        <Passo n={2} titulo="Trazer seus contatos">
          <P>
            Importe sua planilha de clientes ou adicione um a um. Botão <UI>Adicionar contatos</UI>.
          </P>
        </Passo>
        <Passo n={3} titulo="Criar uma mensagem">
          <P>
            O texto que será enviado (template de WhatsApp ou e-mail). Botão <UI>Criar mensagem</UI>
            .
          </P>
        </Passo>
        <Passo n={4} titulo="Criar e disparar a campanha">
          <P>
            Junte a mensagem com um grupo de contatos e envie. Botão <UI>Nova campanha</UI>.
          </P>
        </Passo>
      </Passos>
      <P>
        Embaixo, a faixa <UI>Atalhos</UI> leva direto para Campanhas, Contatos, Grupos, Mensagens e
        Conexões. À medida que você conclui cada passo, ele fica marcado com um ✓.
      </P>
      <Dica>
        A ordem importa: <strong>conexão → contatos → mensagem → campanha</strong>. Sem um canal
        conectado e contatos com opt-in, a campanha não tem como sair.
      </Dica>
    </div>
  );
}

// ─────────────────────────────── Conexões ───────────────────────────────
function Conexoes() {
  return (
    <div className="space-y-6">
      <P>
        Em <strong>Conexões</strong> ficam os canais por onde suas campanhas saem: o{' '}
        <strong>WhatsApp</strong> e o <strong>e-mail</strong> da sua empresa. Cada um mostra um
        cartão de status: <UI>Ativa</UI>, <UI>Verificando</UI>, <UI>Suspensa</UI> ou <UI>Erro</UI>.
      </P>
      <Figura
        src="/manual/conexoes-1.png"
        legenda="Aba Conexões: cartões de WhatsApp e e-mail com status."
      />

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <Subtitulo className="flex items-center gap-2">📱 Conectar o WhatsApp (BYOA)</Subtitulo>
        <P>
          A plataforma usa o modelo <strong>BYOA</strong> (você traz a sua própria conta Meta).
          Clique em <UI>Conectar WhatsApp</UI> para abrir o assistente de <strong>4 passos</strong>.
        </P>
        <AlertAviso>
          Quem cuida da TI/marketing geralmente faz esta parte. É preciso ter conta na Meta — não dá
          para usar um número que já está no app de WhatsApp pessoal.
        </AlertAviso>
        <div className="mt-4">
          <Passos>
            <Passo n={1} titulo="Pré-requisitos">
              <P>O assistente lista o que você precisa ter antes de começar:</P>
              <ul className="ml-1 list-disc space-y-1 pl-5">
                <li>CNPJ ativo registrado no Meta Business Manager.</li>
                <li>
                  Conta WhatsApp Business API criada em{' '}
                  <a
                    className="font-medium text-primary hover:underline"
                    href="https://business.facebook.com/wa/manage"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    business.facebook.com/wa/manage
                  </a>
                  .
                </li>
                <li>
                  Número de telefone dedicado <strong>e verificado</strong> dentro da WABA.
                </li>
                <li>App de sistema no Meta for Developers para emitir o token permanente.</li>
              </ul>
              <P>
                Tendo tudo, clique em <UI>Já tenho tudo — continuar</UI>.
              </P>
            </Passo>
            <Passo n={2} titulo="Gerar o token permanente na Meta">
              <P>O assistente mostra o passo a passo na Meta:</P>
              <ul className="ml-1 list-decimal space-y-1 pl-5">
                <li>Abra o app de sistema da empresa no Meta for Developers.</li>
                <li>
                  Em <em>Business Settings → Users → System Users</em>, crie um usuário de sistema{' '}
                  <strong>Admin</strong>.
                </li>
                <li>Atribua a WABA ao usuário (Add Assets → WhatsApp Accounts → Manage).</li>
                <li>
                  Gere o token com as permissões <Code>whatsapp_business_messaging</Code> e{' '}
                  <Code>whatsapp_business_management</Code>.
                </li>
                <li>
                  Copie o token e <strong>guarde com segurança</strong> — ele não aparece de novo.
                </li>
              </ul>
              <P>
                Depois clique em <UI>Tenho o token</UI>.
              </P>
            </Passo>
            <Passo n={3} titulo="Validação — colar os dados">
              <P>
                Preencha os três campos e clique em <UI>Validar e conectar</UI>:
              </P>
              <ul className="ml-1 list-disc space-y-1 pl-5">
                <li>
                  <UI>WABA ID</UI> — ex.: <Code>123456789012345</Code>
                </li>
                <li>
                  <UI>Phone Number ID</UI> — ex.: <Code>987654321012345</Code>
                </li>
                <li>
                  <UI>Token permanente</UI> — começa com <Code>EAA…</Code>
                </li>
              </ul>
              <P>
                A plataforma valida com a Meta antes de salvar e guarda o token{' '}
                <strong>criptografado</strong> — ele nunca mais fica visível.
              </P>
              <AlertAviso>
                Use o <strong>token da Meta</strong> (começa com <Code>EAA…</Code>), não a senha do
                seu login. Se o navegador preencher sozinho, apague e cole o token correto.
              </AlertAviso>
            </Passo>
            <Passo n={4} titulo="Configurar o webhook na Meta">
              <P>
                Deu certo, aparece <UI>Conexão validada</UI> com o número. A plataforma gera dois
                valores — copie-os com o botão <UI>Copiar</UI> e cole na Meta em{' '}
                <em>WhatsApp → Configuration → Webhooks</em>:
              </P>
              <ul className="ml-1 list-disc space-y-1 pl-5">
                <li>
                  <UI>Callback URL</UI>
                </li>
                <li>
                  <UI>Verify Token</UI>
                </li>
              </ul>
              <P>
                Ative os campos <Code>messages</Code> e <Code>message_template_status_update</Code>.
                É isso que faz as respostas e os status de entrega voltarem para a plataforma.
              </P>
            </Passo>
          </Passos>
          <div className="mt-4">
            <Figura
              src="/manual/conexoes-whatsapp-wizard.png"
              legenda="Assistente do WhatsApp: Pré-requisitos → Token Meta → Validação → Webhook."
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5 shadow-sm">
        <Subtitulo className="flex items-center gap-2">✉️ Conectar o e-mail</Subtitulo>
        <P>
          Para enviar por e-mail você usa um <strong>domínio próprio</strong> (o que vem depois do
          @). Clique em <UI>Conectar e-mail</UI> e preencha:
        </P>
        <Passos>
          <Passo n={1} titulo="Informar domínio e remetente">
            <ul className="ml-1 list-disc space-y-1 pl-5">
              <li>
                <UI>Domínio de envio</UI> — ex.: <Code>campanhas.suaempresa.com.br</Code>
              </li>
              <li>
                <UI>Remetente (From)</UI> — ex.: <Code>no-reply@campanhas.suaempresa.com.br</Code>
              </li>
            </ul>
            <P>
              Clique em <UI>Conectar e-mail</UI>.
            </P>
          </Passo>
          <Passo n={2} titulo="Configurar os registros DNS">
            <P>
              A tela seguinte mostra uma tabela de registros (<Code>CNAME</Code>, <Code>TXT</Code>,{' '}
              <Code>MX</Code>) com <UI>Tipo</UI>, <UI>Nome</UI> e <UI>Valor</UI>. Use o botão{' '}
              <UI>Copiar valor</UI> e cadastre cada um no seu provedor de domínio (Registro.br,
              Cloudflare, etc.). Isso prova que o domínio é seu e libera o envio.
            </P>
          </Passo>
          <Passo n={3} titulo="Aguardar a verificação">
            <P>
              A propagação pode levar de minutos a algumas horas. Enquanto isso o status fica{' '}
              <UI>Verificando</UI>; quando o DNS propaga, vira <UI>Ativa</UI> e você já pode enviar.
            </P>
          </Passo>
        </Passos>
        <Figura
          src="/manual/conexoes-email-dns.png"
          legenda="Registros DNS gerados ao conectar um e-mail."
        />
        <Dica>
          Dá para conectar <strong>mais de um e-mail</strong>: depois do primeiro, use{' '}
          <UI>Conectar outro e-mail</UI> no topo da seção.
        </Dica>
      </div>
    </div>
  );
}

// ─────────────────────────────── Contatos ───────────────────────────────
function Contatos() {
  return (
    <div className="space-y-5">
      <P>
        <strong>Contatos</strong> é a sua base de clientes — é daqui que saem os grupos das
        campanhas. Cada contato precisa ter <strong>pelo menos um e-mail ou um telefone</strong>, e
        mostra os selos de opt-in (<UI>E-mail</UI> / <UI>WhatsApp</UI>) que dizem por quais canais
        ele aceitou receber.
      </P>
      <Figura
        src="/manual/contatos-1.png"
        legenda="Lista de contatos com busca, tags e selos de opt-in."
      />

      <Subtitulo>Adicionar um contato</Subtitulo>
      <Passos>
        <Passo n={1} titulo="Abrir o formulário">
          <P>
            No topo, clique em <UI>Adicionar contato</UI>.
          </P>
        </Passo>
        <Passo n={2} titulo="Preencher os dados">
          <ul className="ml-1 list-disc space-y-1 pl-5">
            <li>
              <UI>Nome</UI> — ex.: <Code>Auto Peças Silva</Code> (opcional, mas recomendado).
            </li>
            <li>
              <UI>E-mail</UI>
            </li>
            <li>
              <UI>Telefone (com DDD)</UI> — pode digitar com parênteses e traços; o formato é
              ajustado sozinho.
            </li>
            <li>
              <UI>Tags</UI> — separadas por vírgula (ex.: <Code>cliente-ativo, regiao-oeste</Code>).
              Servem para montar grupos depois.
            </li>
          </ul>
        </Passo>
        <Passo n={3} titulo="Marcar o opt-in">
          <P>
            Em <UI>Pode receber campanhas por</UI>, marque <UI>E-mail</UI> e/ou <UI>WhatsApp</UI>.
          </P>
          <AlertAviso>
            Marque só se você tem o <strong>consentimento</strong> da pessoa (LGPD). Sem o opt-in do
            canal, o contato não entra nas campanhas daquele canal.
          </AlertAviso>
          <P>
            Clique em <UI>Adicionar contato</UI>.
          </P>
        </Passo>
      </Passos>

      <Subtitulo>Importar uma planilha</Subtitulo>
      <P>
        Para trazer muitos contatos de uma vez, use <UI>Importar contatos</UI>. São 4 passos:
      </P>
      <Passos>
        <Passo n={1} titulo="Escolher o arquivo">
          <P>
            Baixe antes o <UI>Baixar modelo (Excel)</UI> — vem com 3 exemplos e as colunas
            esperadas. Depois arraste o arquivo <Code>.xlsx</Code> ou <Code>.csv</Code> (até 10 MB).
          </P>
          <P>
            Colunas reconhecidas: <Code>nome</Code>, <Code>email</Code>, <Code>telefone</Code>,{' '}
            <Code>tags</Code> (separadas por <Code>;</Code>). Qualquer outra coluna (ex.:{' '}
            <Code>cnpj</Code>, <Code>regiao</Code>) é guardada como atributo personalizado e pode
            virar filtro de grupo.
          </P>
        </Passo>
        <Passo n={2} titulo="Mapear as colunas">
          <P>
            Diga para a plataforma o que é cada coluna do seu arquivo (Nome, E-mail, Telefone, Tags,
            Atributo personalizado ou <UI>Ignorar esta coluna</UI>). A amostra da 1ª linha aparece
            ao lado para conferência.
          </P>
        </Passo>
        <Passo n={3} titulo="Pré-visualizar e escolher as opções">
          <P>
            Veja os números (linhas no arquivo, com e-mail, com telefone, sem contato válido). Aqui
            você decide:
          </P>
          <ul className="ml-1 list-disc space-y-1 pl-5">
            <li>
              <strong>Quando o contato já existir</strong> (mesmo e-mail ou telefone):{' '}
              <UI>Atualizar dados</UI> ou <UI>Ignorar (manter o atual)</UI>.
            </li>
            <li>
              <strong>Marcar opt-in</strong> de <UI>E-mail</UI> / <UI>WhatsApp</UI> — só com
              consentimento documentado (LGPD).
            </li>
          </ul>
        </Passo>
        <Passo n={4} titulo="Concluir">
          <P>
            A plataforma informa quantos foram <strong>adicionados/atualizados</strong>,{' '}
            <strong>ignorados</strong> e quantos <strong>não entraram</strong> (com o motivo, ex.:
            sem e-mail nem telefone). Acima de 1.000 contatos o processamento roda em segundo plano.
          </P>
        </Passo>
      </Passos>
      <Figura
        src="/manual/contatos-importar.png"
        legenda="Importação em 4 passos: arquivo → mapear → pré-visualizar → concluir."
      />
      <Dica>
        Selecionando contatos na lista (caixas à esquerda) aparece <UI>Criar grupo e campanha</UI> —
        um atalho para enviar para exatamente quem você marcou.
      </Dica>
    </div>
  );
}

// ──────────────────────────────── Grupos ────────────────────────────────
function Grupos() {
  return (
    <div className="space-y-5">
      <P>
        Um <strong>grupo</strong> reúne contatos por regras (tags, opt-in, dados) para você enviar
        de uma vez. É o que a campanha usa em <UI>Quem vai receber</UI>.
      </P>
      <Figura
        src="/manual/grupos-1.png"
        legenda="Lista de grupos com a contagem de contatos de cada um."
      />
      <Subtitulo>Criar um grupo</Subtitulo>
      <Passos>
        <Passo n={1} titulo="Novo grupo">
          <P>
            Clique em <UI>Novo grupo</UI> e dê um <UI>Nome do grupo</UI> (ex.:{' '}
            <Code>Clientes da região oeste</Code>).
          </P>
        </Passo>
        <Passo n={2} titulo="Montar as regras">
          <P>
            No construtor de filtros, escolha o modo <UI>E</UI> (todas as regras) ou <UI>OU</UI>{' '}
            (qualquer regra). Em cada condição você define <strong>campo</strong> (ex.:{' '}
            <Code>tags</Code>, <Code>extras.regiao</Code>), <strong>operador</strong> e{' '}
            <strong>valor</strong>. Use <UI>+ Condição</UI> para somar regras e <UI>+ Grupo</UI>{' '}
            para combinações mais avançadas.
          </P>
        </Passo>
        <Passo n={3} titulo="Conferir a prévia e salvar">
          <P>
            Enquanto você monta, aparece <UI>Contatos correspondentes: X</UI> em tempo real. Quando
            o número fizer sentido, clique em <UI>Salvar grupo</UI>.
          </P>
        </Passo>
      </Passos>
      <Figura
        src="/manual/grupos-novo.png"
        legenda="Construtor de regras com a prévia da contagem ao vivo."
      />
      <Dica>
        Excluir um grupo <strong>não afeta</strong> as campanhas que já o usaram — elas guardam a
        própria lista de destinatários.
      </Dica>
    </div>
  );
}

// ─────────────────────────────── Mensagens ───────────────────────────────
function Mensagens() {
  return (
    <div className="space-y-5">
      <P>
        <strong>Mensagens</strong> são os textos que você dispara nas campanhas — de WhatsApp ou de
        e-mail. Na lista, cada uma mostra um selo <UI>E-mail</UI> ou <UI>WhatsApp</UI>.
      </P>
      <Figura src="/manual/mensagens-1.png" legenda="Lista de mensagens (templates) por canal." />
      <Subtitulo>Criar uma mensagem</Subtitulo>
      <Passos>
        <Passo n={1} titulo="Escolher o canal">
          <P>
            Clique em <UI>Nova mensagem</UI> e escolha um dos cartões: <UI>WhatsApp</UI> (aponta
            para um template aprovado na Meta) ou <UI>E-mail</UI> (você escreve aqui mesmo).
          </P>
        </Passo>
        <Passo n={2} titulo="E-mail: assunto e conteúdo">
          <P>
            Preencha <UI>Nome do template</UI>, <UI>Assunto do e-mail</UI> e o{' '}
            <UI>Conteúdo do e-mail</UI>. Use <Code>{V}</Code> para personalizar com dados do contato
            (ex.: <em>Olá {V},</em>).
          </P>
        </Passo>
        <Passo n={3} titulo="WhatsApp: apontar para o template da Meta">
          <P>
            Informe o <UI>Nome do template na Meta</UI> (só minúsculas, números e <Code>_</Code>,
            ex.: <Code>promo_barras_direcao</Code>) e o <UI>Idioma</UI> (ex.: <Code>pt_BR</Code>).
          </P>
          <AlertAviso>
            No WhatsApp a mensagem precisa ser um template <strong>aprovado pela Meta</strong>. Aqui
            você só aponta para ele pelo nome — o texto é o que foi aprovado na sua conta Meta.
          </AlertAviso>
        </Passo>
        <Passo n={4} titulo="Variáveis (opcional)">
          <P>
            Em <UI>Variáveis</UI>, use <UI>+ Variável</UI> para cadastrar cada personalização: a{' '}
            <strong>chave</strong> (ex.: <Code>nome</Code>) e um <strong>exemplo</strong> (ex.:{' '}
            <Code>João</Code>). No WhatsApp, a ordem segue a do template da Meta.
          </P>
          <P>
            Por fim, <UI>Criar mensagem</UI>.
          </P>
        </Passo>
      </Passos>
      <Figura
        src="/manual/mensagens-nova.png"
        legenda="Formulário de mensagem com assunto/conteúdo e variáveis."
      />
    </div>
  );
}

// ─────────────────────────────── Campanhas ───────────────────────────────
function Campanhas() {
  return (
    <div className="space-y-5">
      <P>
        Uma <strong>campanha</strong> junta uma <strong>mensagem</strong> com um{' '}
        <strong>grupo</strong> de contatos e dispara. Na lista, o selo de status mostra o momento:{' '}
        <UI>Rascunho</UI>, <UI>Agendada</UI>, <UI>Disparando</UI>, <UI>Concluída</UI> ou{' '}
        <UI>Cancelada</UI>.
      </P>
      <Figura src="/manual/campanhas-1.png" legenda="Lista de campanhas com status de cada uma." />

      <Subtitulo>Criar a campanha</Subtitulo>
      <Passos>
        <Passo n={1} titulo="Nova campanha">
          <P>
            Clique em <UI>Nova campanha</UI> e dê um <UI>Nome da campanha</UI> (só você vê — ex.:{' '}
            <Code>Promoção de novembro</Code>).
          </P>
        </Passo>
        <Passo n={2} titulo="Escolher canal e mensagem">
          <P>
            Selecione o <UI>Canal</UI> (<UI>WhatsApp</UI> ou <UI>E-mail</UI>) e a <UI>Mensagem</UI>{' '}
            — a lista já filtra pelos templates daquele canal. Sem mensagem ainda? Há o atalho{' '}
            <UI>Criar uma agora</UI>.
          </P>
        </Passo>
        <Passo n={3} titulo="Escolher quem recebe">
          <P>
            Em <UI>Quem vai receber (grupo)</UI>, escolha o grupo. Lembre:{' '}
            <strong>só recebem os contatos com opt-in</strong> do canal escolhido.
          </P>
        </Passo>
        <Passo n={4} titulo="Enviar agora ou agendar">
          <P>
            Marque <UI>Agendar para depois</UI> e escolha data/hora, ou deixe desmarcado para
            disparar manualmente. Clique em <UI>Criar campanha</UI>.
          </P>
          <Dica>
            <strong>Criar não envia nada.</strong> Você confere o número de destinatários e o custo
            na próxima tela antes de disparar.
          </Dica>
        </Passo>
      </Passos>
      <Figura
        src="/manual/campanhas-nova.png"
        legenda="Nova campanha: nome, canal, mensagem, grupo e agendamento."
      />

      <Subtitulo>Conferir e disparar</Subtitulo>
      <P>
        Na campanha em <UI>Rascunho</UI>, o bloco <UI>Antes de disparar</UI> mostra{' '}
        <UI>Vão receber</UI> (contatos com opt-in no grupo) e o <UI>Custo estimado</UI>. Conferido,
        clique em <UI>Disparar agora</UI> (ou <UI>Agendar disparo</UI>). O envio é feito com
        intervalo de segurança, respeitando os limites do canal.
      </P>
      <AlertAviso>
        Se aparecer aviso de <strong>0 contatos com opt-in</strong> ou de canal não conectado,
        ajuste o grupo / conecte o canal antes — o botão de disparo fica bloqueado até resolver.
      </AlertAviso>
      <P>
        Depois de disparar, a mesma tela vira um <strong>painel de resultados</strong>:{' '}
        <UI>Destinatários</UI>, <UI>Enviadas</UI>, <UI>Entregues</UI>, <UI>Lidas</UI>,{' '}
        <UI>Respondidas</UI> e <UI>Falhas</UI> (com % e o <UI>Custo real</UI>). Enquanto está{' '}
        <UI>Disparando</UI>, atualiza sozinho a cada 5 segundos. Dá para <UI>Pausar</UI>,{' '}
        <UI>Retomar envio</UI>, <UI>Cancelar campanha</UI> ou <UI>Excluir</UI>, conforme o status.
      </P>
      <Figura
        src="/manual/campanhas-resultados.png"
        legenda="Painel de resultados da campanha (entregues, lidas, falhas, custo real)."
      />
    </div>
  );
}

// ─────────────────────────────── Respostas ───────────────────────────────
function Respostas() {
  return (
    <div className="space-y-5">
      <P>
        Quando alguém <strong>responde</strong> uma campanha de WhatsApp, a conversa aparece em{' '}
        <strong>Respostas</strong>. À esquerda fica a lista de conversas; à direita, a conversa
        aberta.
      </P>
      <Figura
        src="/manual/respostas-1.png"
        legenda="Caixa de respostas: lista de conversas e a conversa aberta."
      />
      <Passos>
        <Passo n={1} titulo="Abrir uma conversa">
          <P>Clique em um contato na lista da esquerda para ver o histórico de mensagens.</P>
        </Passo>
        <Passo n={2} titulo="Responder">
          <P>
            Escreva no campo <UI>Escreva sua resposta…</UI> e clique em <UI>Enviar</UI>.
          </P>
        </Passo>
      </Passos>
      <AlertAviso>
        O WhatsApp só permite responder em até <strong>24 horas</strong> depois da última mensagem
        do cliente. Se a janela fechou, o campo some — para falar de novo, envie uma nova campanha
        (template aprovado).
      </AlertAviso>
    </div>
  );
}

// ───────────────────────────────── Plano ─────────────────────────────────
function Plano() {
  return (
    <div className="space-y-5">
      <P>
        Em <strong>Plano</strong> (visível para o Administrador) você vê a situação da conta e
        escolhe o plano. O cartão <UI>Sua conta hoje</UI> mostra o <UI>Plano</UI> e a{' '}
        <UI>Situação</UI>: <UI>Em teste</UI>, <UI>Ativo</UI>, <UI>Pagamento pendente</UI>,{' '}
        <UI>Suspenso</UI> ou <UI>Cancelado</UI>.
      </P>
      <Figura src="/manual/plano-1.png" legenda="Situação da conta e os planos disponíveis." />
      <Passos>
        <Passo n={1} titulo="Escolher um plano">
          <P>
            Compare <UI>Starter</UI>, <UI>Pro</UI> e <UI>Enterprise</UI> (limites de contatos,
            domínios, etc.) e clique em <UI>Assinar este plano</UI> ou <UI>Mudar para este</UI>.
          </P>
        </Passo>
        <Passo n={2} titulo="Pagar">
          <P>
            Você recebe o <strong>link de pagamento</strong> na hora; em teste/pendente também há o
            botão <UI>Pagar agora</UI> no cartão da conta.
          </P>
        </Passo>
      </Passos>
      <AlertAviso>
        <strong>Cancelar assinatura</strong> faz os envios pararem e a conta fica somente leitura.
        Você pode assinar de novo quando quiser.
      </AlertAviso>
    </div>
  );
}

// ────────────────────────────── Minha conta ──────────────────────────────
function Conta() {
  return (
    <div className="space-y-5">
      <P>
        Em <strong>Minha conta</strong> ficam seus dados de acesso: <UI>E-mail</UI>,{' '}
        <UI>Empresa</UI> e <UI>Seu papel</UI> (Administrador, Editor de campanha ou Visualizador).
      </P>
      <Subtitulo>Trocar a senha</Subtitulo>
      <Passos>
        <Passo n={1} titulo="Preencher o formulário">
          <P>
            No cartão <UI>Trocar senha</UI>, informe <UI>Senha atual</UI>, <UI>Senha nova</UI> (pelo
            menos 8 caracteres) e <UI>Repita a senha nova</UI>.
          </P>
        </Passo>
        <Passo n={2} titulo="Salvar">
          <P>
            Clique em <UI>Salvar senha nova</UI>. Aparece <UI>Senha alterada com sucesso.</UI>
          </P>
        </Passo>
      </Passos>
      <Figura src="/manual/conta-1.png" legenda="Dados da conta e troca de senha." />
    </div>
  );
}

export const CONTEUDOS: Record<string, () => ReactElement> = {
  inicio: Inicio,
  conexoes: Conexoes,
  contatos: Contatos,
  grupos: Grupos,
  mensagens: Mensagens,
  campanhas: Campanhas,
  respostas: Respostas,
  plano: Plano,
  conta: Conta,
};

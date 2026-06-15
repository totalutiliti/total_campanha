import {
  CreditCard,
  FolderOpen,
  Home,
  Inbox,
  Megaphone,
  MessageSquare,
  Plug,
  UserCog,
  Users,
} from 'lucide-react';

/**
 * Metadados leves das seções do Manual (sem o conteúdo pesado, para o nav e o
 * índice importarem barato). O conteúdo de cada seção vive em `conteudo.tsx`.
 *
 * `rotas` é o(s) prefixo(s) de rota que aquela seção documenta — usado para o
 * Manual abrir já filtrado pela aba em que o usuário está.
 */
export interface SecaoMeta {
  id: string;
  titulo: string;
  resumo: string;
  icone: typeof Home;
  /** Rota "real" da aba, para o atalho "abrir a aba". */
  rota: string;
  /** Prefixos que mapeiam para esta seção (a rota real + variações). */
  rotas: string[];
}

export const SECOES: SecaoMeta[] = [
  {
    id: 'inicio',
    titulo: 'Início',
    resumo: 'O painel de boas-vindas e os 4 passos para a primeira campanha.',
    icone: Home,
    rota: '/',
    rotas: ['/'],
  },
  {
    id: 'conexoes',
    titulo: 'Conexões — WhatsApp e e-mail',
    resumo: 'Conectar a conta WhatsApp Business (Meta) e o domínio de e-mail.',
    icone: Plug,
    rota: '/conexoes',
    rotas: ['/conexoes'],
  },
  {
    id: 'contatos',
    titulo: 'Contatos',
    resumo: 'Sua base de clientes: adicionar um a um ou importar planilha.',
    icone: Users,
    rota: '/contatos',
    rotas: ['/contatos'],
  },
  {
    id: 'grupos',
    titulo: 'Grupos',
    resumo: 'Montar grupos de contatos (por tag, opt-in, dados) para enviar.',
    icone: FolderOpen,
    rota: '/segmentos',
    rotas: ['/segmentos'],
  },
  {
    id: 'mensagens',
    titulo: 'Mensagens',
    resumo: 'Os textos das campanhas — templates de WhatsApp e de e-mail.',
    icone: MessageSquare,
    rota: '/templates',
    rotas: ['/templates'],
  },
  {
    id: 'campanhas',
    titulo: 'Campanhas',
    resumo: 'Criar, conferir destinatários e custo, e disparar.',
    icone: Megaphone,
    rota: '/campanhas',
    rotas: ['/campanhas'],
  },
  {
    id: 'respostas',
    titulo: 'Respostas',
    resumo: 'A caixa de entrada das respostas de WhatsApp (janela de 24h).',
    icone: Inbox,
    rota: '/respostas',
    rotas: ['/respostas'],
  },
  {
    id: 'plano',
    titulo: 'Plano',
    resumo: 'Situação da conta, planos e cobrança.',
    icone: CreditCard,
    rota: '/plano',
    rotas: ['/plano'],
  },
  {
    id: 'conta',
    titulo: 'Minha conta',
    resumo: 'Seus dados de acesso e troca de senha.',
    icone: UserCog,
    rota: '/minha-conta',
    rotas: ['/minha-conta'],
  },
];

export const SECAO_PADRAO = 'inicio';

/** Descobre a seção do Manual correspondente à rota atual da aplicação. */
export function secaoDaRota(pathname: string): string {
  if (pathname === '/') return 'inicio';
  // Já está no Manual: mantém o padrão (a página resolve pelo ?secao=).
  if (pathname.startsWith('/manual')) return SECAO_PADRAO;
  const hit = SECOES.find((s) => s.rotas.some((r) => r !== '/' && pathname.startsWith(r)));
  return hit?.id ?? SECAO_PADRAO;
}

export function existeSecao(id: string | null | undefined): id is string {
  return Boolean(id) && SECOES.some((s) => s.id === id);
}

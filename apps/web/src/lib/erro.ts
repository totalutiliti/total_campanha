/**
 * Tradução de erros da API para frases que um vendedor entende.
 *
 * O api-client lança Error com texto "API POST /x → 400: <corpo>". Aqui
 * extraímos o corpo e montamos uma mensagem em português claro — NUNCA
 * mostramos JSON cru na tela.
 */

interface ErroZodIssue {
  message?: unknown;
  path?: unknown;
}

const NOMES_DE_CAMPO: Record<string, string> = {
  nome: 'nome',
  email: 'e-mail',
  telefoneE164: 'telefone',
  senha: 'senha',
  senhaAtual: 'senha atual',
  novaSenha: 'senha nova',
  assunto: 'assunto',
  mjml: 'conteúdo do e-mail',
  metaTemplateName: 'nome do template na Meta',
  wabaId: 'WABA ID',
  phoneNumberId: 'Phone Number ID',
  token: 'token',
  dominio: 'domínio',
  remetente: 'remetente',
  segmentoId: 'grupo',
  templateId: 'mensagem',
  agendadoPara: 'data de agendamento',
};

function nomeAmigavel(path: unknown): string | null {
  if (!Array.isArray(path) || path.length === 0) return null;
  const cru = String(path[0]);
  return NOMES_DE_CAMPO[cru] ?? cru;
}

export function mensagemErro(e: unknown, fallback = 'Algo deu errado. Tente de novo.'): string {
  if (!(e instanceof Error)) return fallback;
  let msg = e.message;

  // Sem resposta do servidor (rede caiu, API fora do ar).
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Não conseguimos falar com o servidor. Confira sua internet e tente de novo.';
  }

  const idx = msg.indexOf('→');
  let status = 0;
  if (idx >= 0) {
    const m = /→\s*(\d+)/.exec(msg);
    status = m ? Number(m[1]) : 0;
    msg = msg.slice(idx).replace(/^→\s*\d+:?\s*/, '');
  }

  try {
    const j = JSON.parse(msg) as { message?: unknown; errors?: unknown };

    // Erros de validação Zod: traduz cada issue para "campo: mensagem".
    if (Array.isArray(j.errors) && j.errors.length > 0) {
      const frases = (j.errors as ErroZodIssue[])
        .slice(0, 3)
        .map((issue) => {
          const campo = nomeAmigavel(issue.path);
          const texto = typeof issue.message === 'string' ? issue.message : 'valor inválido';
          // Mensagens já escritas em pt-BR no backend passam direto.
          if (/[áâãéêíóôõúç]| /.test(texto) && texto !== 'Required') {
            return campo && !texto.toLowerCase().includes(campo) ? `${capitalizar(campo)}: ${texto}` : texto;
          }
          // Mensagens padrão do Zod em inglês viram pt-BR.
          if (texto === 'Required') return campo ? `Preencha o campo ${campo}.` : 'Preencha os campos obrigatórios.';
          if (/invalid email/i.test(texto)) return 'Esse e-mail não parece válido.';
          if (/invalid/i.test(texto)) return campo ? `O campo ${campo} está inválido.` : 'Há um campo inválido.';
          return campo ? `${capitalizar(campo)}: ${texto}` : texto;
        });
      return frases.join(' ');
    }

    if (typeof j.message === 'string' && j.message !== 'Validation failed') return j.message;
    if (Array.isArray(j.message)) return j.message.join('; ');
    if (j.message === 'Validation failed') return 'Confira os campos destacados e tente de novo.';
  } catch {
    // corpo não-JSON — segue para os fallbacks por status
  }

  if (status === 401) return 'Sua sessão expirou. Entre de novo.';
  if (status === 403) return 'Você não tem permissão para fazer isso.';
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  if (status >= 500) return 'O servidor encontrou um problema. Tente de novo em instantes.';

  const limpa = msg.trim();
  // Nunca mostrar JSON cru.
  if (!limpa || limpa.startsWith('{') || limpa.startsWith('[')) return fallback;
  return limpa;
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

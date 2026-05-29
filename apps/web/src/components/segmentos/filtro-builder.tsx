'use client';

import { useMemo, useState } from 'react';

import {
  CamposPermitidos,
  Condicao,
  ehGrupo,
  Grupo,
  Operador,
  OperadorLabels,
  Operadores,
} from './filtros-tipos';

interface Props {
  valor: Grupo;
  onChange: (g: Grupo) => void;
}

/**
 * FiltroBuilder recursivo (BOOTSTRAP 3.1).
 *
 * Render:
 *   - Grupo: card com `modo` (E/OU) + botões + Condicao / + Grupo
 *   - Condicao: linha com campo/operador/valor
 *
 * Estado é controlado por `valor`; mutações reconstroem a árvore (imutável)
 * para integrar bem com React state.
 */
export function FiltroBuilder({ valor, onChange }: Props) {
  return <RenderGrupo grupo={valor} onChange={onChange} nivel={0} />;
}

function RenderGrupo({
  grupo,
  onChange,
  nivel,
}: {
  grupo: Grupo;
  onChange: (g: Grupo) => void;
  nivel: number;
}) {
  const fundoNivel = nivel === 0 ? 'bg-gray-50' : nivel % 2 ? 'bg-white' : 'bg-gray-50';

  function atualizarFilho(idx: number, novo: Grupo | Condicao) {
    const novos = grupo.condicoes.slice();
    novos[idx] = novo;
    onChange({ ...grupo, condicoes: novos });
  }

  function removerFilho(idx: number) {
    const novos = grupo.condicoes.slice();
    novos.splice(idx, 1);
    onChange({ ...grupo, condicoes: novos });
  }

  function adicionarCondicao() {
    onChange({
      ...grupo,
      condicoes: [
        ...grupo.condicoes,
        { campo: 'nome', operador: 'contains', valor: '' },
      ],
    });
  }

  function adicionarGrupo() {
    onChange({
      ...grupo,
      condicoes: [...grupo.condicoes, { modo: 'and', condicoes: [] }],
    });
  }

  function trocarModo(modo: 'and' | 'or') {
    onChange({ ...grupo, modo });
  }

  return (
    <div className={`rounded-md border border-gray-200 p-3 ${fundoNivel}`}>
      <div className="flex items-center gap-2 mb-2">
        <ModoToggle modo={grupo.modo} onChange={trocarModo} />
        <span className="text-xs text-gray-500">
          {grupo.condicoes.length} condição{grupo.condicoes.length === 1 ? '' : 'es'}
        </span>
      </div>

      <div className="space-y-2">
        {grupo.condicoes.map((filho, i) =>
          ehGrupo(filho) ? (
            <div key={i} className="flex gap-2">
              <div className="flex-1">
                <RenderGrupo
                  grupo={filho}
                  onChange={(g) => atualizarFilho(i, g)}
                  nivel={nivel + 1}
                />
              </div>
              <button
                type="button"
                onClick={() => removerFilho(i)}
                className="text-xs text-red-700 hover:underline self-start"
              >
                remover
              </button>
            </div>
          ) : (
            <div key={i} className="flex gap-2 items-center">
              <RenderCondicao
                condicao={filho}
                onChange={(c) => atualizarFilho(i, c)}
              />
              <button
                type="button"
                onClick={() => removerFilho(i)}
                className="text-xs text-red-700 hover:underline"
              >
                remover
              </button>
            </div>
          ),
        )}
      </div>

      <div className="mt-3 flex gap-2 text-sm">
        <button
          type="button"
          onClick={adicionarCondicao}
          className="rounded-md border border-gray-300 px-3 py-1 hover:bg-white"
        >
          + Condição
        </button>
        <button
          type="button"
          onClick={adicionarGrupo}
          className="rounded-md border border-gray-300 px-3 py-1 hover:bg-white"
        >
          + Grupo
        </button>
      </div>
    </div>
  );
}

function ModoToggle({
  modo,
  onChange,
}: {
  modo: 'and' | 'or';
  onChange: (m: 'and' | 'or') => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => onChange('and')}
        className={`px-2 py-1 ${modo === 'and' ? 'bg-gray-900 text-white' : 'bg-white'}`}
      >
        E
      </button>
      <button
        type="button"
        onClick={() => onChange('or')}
        className={`px-2 py-1 ${modo === 'or' ? 'bg-gray-900 text-white' : 'bg-white'}`}
      >
        OU
      </button>
    </div>
  );
}

function RenderCondicao({
  condicao,
  onChange,
}: {
  condicao: Condicao;
  onChange: (c: Condicao) => void;
}) {
  const valorBooleano = condicao.operador === 'has_opt_in_email' || condicao.operador === 'has_opt_in_whatsapp';

  return (
    <div className="flex flex-1 gap-2 items-center text-sm">
      <input
        type="text"
        value={condicao.campo}
        onChange={(e) => onChange({ ...condicao, campo: e.target.value })}
        placeholder="campo (ex: tags, extras.regiao)"
        list="campos-permitidos"
        className="flex-1 rounded-md border border-gray-300 px-2 py-1"
      />
      <datalist id="campos-permitidos">
        {CamposPermitidos.map((c) => (
          <option key={c} value={c} />
        ))}
        <option value="extras." />
      </datalist>

      <select
        value={condicao.operador}
        onChange={(e) => onChange({ ...condicao, operador: e.target.value as Operador })}
        className="rounded-md border border-gray-300 px-2 py-1 bg-white"
      >
        {Operadores.map((op) => (
          <option key={op} value={op}>
            {OperadorLabels[op]}
          </option>
        ))}
      </select>

      {!valorBooleano && (
        <input
          type="text"
          value={typeof condicao.valor === 'string' ? condicao.valor : ''}
          onChange={(e) => onChange({ ...condicao, valor: e.target.value })}
          placeholder="valor"
          className="flex-1 rounded-md border border-gray-300 px-2 py-1"
        />
      )}
    </div>
  );
}

/**
 * Container com FiltroBuilder + preview de contagem debounced (500ms).
 *
 * Nota sobre auth: ainda não temos contexto de auth no Next.js. Esse componente
 * espera que `fetchPreview` seja injetado pelo caller — pode ser um fetch que
 * passa Authorization Bearer, ou no painel "/admin" um SSR action. Sem auth,
 * o preview fica desabilitado.
 */
export function FiltroBuilderComPreview({
  valor,
  onChange,
  fetchPreview,
}: Props & {
  fetchPreview?: (filtros: Grupo) => Promise<{ total: number }>;
}) {
  const [previa, setPrevia] = useState<{ total: number } | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Debounce manual com setTimeout — evita pull de uma lib extra para isso.
  const debouncedFetch = useMemo(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    return (g: Grupo) => {
      if (!fetchPreview) return;
      if (pending) clearTimeout(pending);
      setCarregando(true);
      pending = setTimeout(async () => {
        try {
          const r = await fetchPreview(g);
          setPrevia(r);
        } catch {
          setPrevia(null);
        } finally {
          setCarregando(false);
        }
      }, 500);
    };
  }, [fetchPreview]);

  return (
    <div className="space-y-3">
      <FiltroBuilder
        valor={valor}
        onChange={(g) => {
          onChange(g);
          debouncedFetch(g);
        }}
      />
      {fetchPreview && (
        <div className="text-sm text-gray-700">
          {carregando ? (
            <span className="text-gray-400">calculando…</span>
          ) : previa ? (
            <span>
              Contatos correspondentes: <strong>{previa.total}</strong>
            </span>
          ) : (
            <span className="text-gray-400">prévia indisponível</span>
          )}
        </div>
      )}
    </div>
  );
}

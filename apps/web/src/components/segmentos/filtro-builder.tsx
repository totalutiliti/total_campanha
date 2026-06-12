'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn } from '../../lib/cn';
import { Button } from '../ui/button';

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

const CONTROLE_CLASSES =
  'h-9 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

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
  const fundoNivel = nivel === 0 ? 'bg-muted/40' : nivel % 2 ? 'bg-card' : 'bg-muted/40';

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
    <div className={cn('rounded-md border p-3', fundoNivel)}>
      <div className="mb-2 flex items-center gap-2">
        <ModoToggle modo={grupo.modo} onChange={trocarModo} />
        <span className="text-xs text-muted-foreground">
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
              <BotaoRemover onClick={() => removerFilho(i)} className="self-start" />
            </div>
          ) : (
            <div key={i} className="flex items-center gap-2">
              <RenderCondicao
                condicao={filho}
                onChange={(c) => atualizarFilho(i, c)}
              />
              <BotaoRemover onClick={() => removerFilho(i)} />
            </div>
          ),
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={adicionarCondicao} className="gap-1">
          <Plus className="h-4 w-4" />
          Condição
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={adicionarGrupo} className="gap-1">
          <Plus className="h-4 w-4" />
          Grupo
        </Button>
      </div>
    </div>
  );
}

function BotaoRemover({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Remover"
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <X className="h-3.5 w-3.5" />
      Remover
    </button>
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
    <div className="inline-flex overflow-hidden rounded-md border border-input text-xs">
      <button
        type="button"
        onClick={() => onChange('and')}
        className={cn(
          'px-2 py-1 transition-colors',
          modo === 'and'
            ? 'bg-primary text-primary-foreground'
            : 'bg-background hover:bg-accent hover:text-accent-foreground',
        )}
      >
        E
      </button>
      <button
        type="button"
        onClick={() => onChange('or')}
        className={cn(
          'px-2 py-1 transition-colors',
          modo === 'or'
            ? 'bg-primary text-primary-foreground'
            : 'bg-background hover:bg-accent hover:text-accent-foreground',
        )}
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
    <div className="flex flex-1 items-center gap-2 text-sm">
      <input
        type="text"
        value={condicao.campo}
        onChange={(e) => onChange({ ...condicao, campo: e.target.value })}
        placeholder="campo (ex: tags, extras.regiao)"
        list="campos-permitidos"
        className={cn(CONTROLE_CLASSES, 'flex-1')}
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
        className={CONTROLE_CLASSES}
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
          className={cn(CONTROLE_CLASSES, 'flex-1')}
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
        <div className="text-sm">
          {carregando ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculando…
            </span>
          ) : previa ? (
            <span>
              Contatos correspondentes: <strong className="tabular-nums">{previa.total}</strong>
            </span>
          ) : (
            <span className="text-muted-foreground">prévia indisponível</span>
          )}
        </div>
      )}
    </div>
  );
}

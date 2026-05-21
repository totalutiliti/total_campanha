import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

/**
 * Templates pré-aprovados por vertical (BOOTSTRAP 3.2).
 *
 * Estrutura no filesystem:
 *   src/modules/templates/biblioteca/<vertical>/<slug>.json
 *
 * O tenant clona o template (UI), edita, submete na Meta dele, e depois
 * cadastra a referência (metaTemplateName + metaLanguage) via CRUD normal.
 */

export interface ItemBiblioteca {
  slug: string;
  vertical: string;
  canal: 'EMAIL' | 'WHATSAPP';
  nome: string;
  descricao: string;
  // Email
  mjml?: string;
  assunto?: string;
  // WhatsApp (texto de referência — sem metaTemplateName, esse só existe após
  // o tenant aprovar na conta dele).
  textoExemplo?: string;
  variaveis: Array<{ key: string; exemplo: string }>;
}

const VERTICAIS_VALIDAS = ['autopecas', 'floricultura', 'perfumaria', 'materiais_construcao'];

@Injectable()
export class BibliotecaService {
  private readonly logger = new Logger(BibliotecaService.name);

  private get raiz(): string {
    // Em prod compila para dist/modules/templates/biblioteca; em dev roda direto.
    // Mantemos os JSONs em ./biblioteca/<vertical>/*.json relativo a este arquivo.
    return path.resolve(__dirname);
  }

  async listarVerticais(): Promise<string[]> {
    return VERTICAIS_VALIDAS.slice();
  }

  async listarPorVertical(vertical: string): Promise<ItemBiblioteca[]> {
    if (!VERTICAIS_VALIDAS.includes(vertical)) {
      throw new NotFoundException(`Vertical desconhecida: ${vertical}`);
    }
    const dir = path.join(this.raiz, vertical);
    try {
      const arquivos = await fs.readdir(dir);
      const itens = await Promise.all(
        arquivos
          .filter((f) => f.endsWith('.json'))
          .map((f) => this.carregar(dir, f, vertical)),
      );
      return itens.filter((i): i is ItemBiblioteca => i !== null);
    } catch (err) {
      this.logger.warn({ msg: 'biblioteca_dir_indisponivel', vertical, err });
      return [];
    }
  }

  private async carregar(
    dir: string,
    nomeArquivo: string,
    vertical: string,
  ): Promise<ItemBiblioteca | null> {
    try {
      const conteudo = await fs.readFile(path.join(dir, nomeArquivo), 'utf8');
      const parsed = JSON.parse(conteudo) as Partial<ItemBiblioteca>;
      const slug = nomeArquivo.replace(/\.json$/, '');
      if (!parsed.canal || !parsed.nome) {
        this.logger.warn({ msg: 'item_invalido', slug, vertical });
        return null;
      }
      return {
        slug,
        vertical,
        canal: parsed.canal,
        nome: parsed.nome,
        descricao: parsed.descricao ?? '',
        mjml: parsed.mjml,
        assunto: parsed.assunto,
        textoExemplo: parsed.textoExemplo,
        variaveis: parsed.variaveis ?? [],
      };
    } catch (err) {
      this.logger.warn({ msg: 'falha_parse_item', nomeArquivo, vertical, err });
      return null;
    }
  }
}

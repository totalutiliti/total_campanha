import { Injectable, BadRequestException } from '@nestjs/common';
import mjml2html from 'mjml';
import Mustache from 'mustache';

export interface ResultadoRender {
  html: string;
  warnings: Array<{ line?: number; message: string }>;
}

/**
 * Render MJML → HTML com interpolação Mustache.
 *
 * Pipeline:
 *   1. Mustache.render aplica `{{nome}}`, `{{cidade}}`, etc no MJML *e* no assunto.
 *   2. mjml2html compila o MJML interpolado em HTML responsivo.
 *
 * Por que Mustache antes do MJML: variáveis dentro de atributos `href` ou
 * `style` precisam aparecer já interpoladas antes de o mjml validar a estrutura.
 */
@Injectable()
export class MjmlRenderService {
  async renderizar(
    mjml: string,
    variaveis: Record<string, unknown>,
  ): Promise<ResultadoRender> {
    if (mjml.length > 200_000) {
      throw new BadRequestException('MJML inválido: limite de 200 mil caracteres excedido.');
    }
    // Mustache escapa HTML por padrão — ótimo para evitar XSS via {{nome}}.
    const mjmlInterpolado = Mustache.render(mjml, variaveis);

    try {
      const r = await mjml2html(mjmlInterpolado, {
        keepComments: false,
        validationLevel: 'soft',
      });
      return {
        html: r.html,
        warnings: r.errors.map((e) => ({ line: e.line, message: e.message })),
      };
    } catch (err) {
      throw new BadRequestException(
        `MJML inválido: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  renderizarAssunto(assunto: string, variaveis: Record<string, unknown>): string {
    return Mustache.render(assunto, variaveis);
  }
}

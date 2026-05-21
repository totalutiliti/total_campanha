import { Global, Module } from '@nestjs/common';

import { AsaasClient } from './asaas.client.js';
import { MetaWhatsappClient } from './meta-whatsapp.client.js';
import { SesIdentityClient } from './ses-identity.client.js';

/**
 * Clients de integrações externas — Meta, SES, Asaas. Global porque vários
 * módulos consomem (Templates, Conexoes, Billing, Worker/Dispatch).
 */
@Global()
@Module({
  providers: [MetaWhatsappClient, SesIdentityClient, AsaasClient],
  exports: [MetaWhatsappClient, SesIdentityClient, AsaasClient],
})
export class IntegrationsModule {}

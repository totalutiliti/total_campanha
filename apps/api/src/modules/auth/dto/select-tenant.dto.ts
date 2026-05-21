import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SelectTenantSchema = z.object({
  tenantId: z.string().uuid(),
});

export class SelectTenantDto extends createZodDto(SelectTenantSchema) {}

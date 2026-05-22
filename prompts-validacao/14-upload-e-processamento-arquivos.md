# 📄 14 — Upload e Processamento de Arquivos

> **Tipo:** Prompt de validação pré-produção
> **Consumidor:** Claude Code (Antigravity) + revisão humana
> **Última atualização:** 2026-03-15

---

## 🔍 CLASSIFICAÇÃO AUTOMÁTICA — LEIA PRIMEIRO

```
O projeto aceita upload de arquivos dos usuários?
  → SIM → Aplicar INTEGRALMENTE.
  → NÃO → Pular este prompt.

O projeto processa documentos com dados pessoais (OCR, PDF, imagens)?
  → SIM → Aplicar também seções [DADOS-PESSOAIS].
```

---

## 📋 CONTEÚDO

### 1. Validação de Upload `[UNIVERSAL]`

```typescript
// REGRAS PARA TODO UPLOAD:
@UseInterceptors(FileInterceptor('file', {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB (ajustar por projeto)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // Validar MIME type real (não confiar na extensão)
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new BadRequestException('Tipo de arquivo não permitido'), false);
    }
    cb(null, true);
  },
}))
```

### 2. Armazenamento `[UNIVERSAL]`

```
  ❌ NUNCA armazenar em filesystem local do container (efêmero)
  ✅ SEMPRE enviar para Azure Blob Storage
  ✅ Nomes de arquivo: UUID (nunca nome original do usuário)
  ✅ Organizar por tenant: container/tenant-id/uuid.ext
  
  blob-container/
  ├── tenant-abc/
  │   ├── a1b2c3d4-e5f6.pdf
  │   └── f7g8h9i0-j1k2.jpg
  └── tenant-def/
      └── ...
```

### 3. Segurança de Arquivos `[UNIVERSAL]`

```
  □ Validar MIME type real (magic bytes, não extensão)
  □ Limitar tamanho por tipo e por rota
  □ Sanitizar nome de arquivo (usar UUID)
  □ NÃO executar arquivos uploadados (nunca eval, exec, spawn)
  □ Scan antivírus se disponível (ClamAV ou Azure Defender)
  □ Deletar arquivos temporários IMEDIATAMENTE após processamento
  □ Arquivos com dados pessoais → considerar criptografia (prompt 04)
```

### 4. Processamento de Documentos com Dados Pessoais `[DADOS-PESSOAIS]`

```
FLUXO SEGURO PARA OCR / DOCUMENT INTELLIGENCE:
  1. Upload para Blob Storage (criptografado)
  2. Download temporário para processamento
  3. Enviar para Document Intelligence / OpenAI
  4. Receber resultado → armazenar dados estruturados no banco
  5. DELETAR arquivo temporário e imagem original após prazo definido
  6. NÃO manter imagens de documentos pessoais indefinidamente

PRAZO RECOMENDADO:
  → Imagens OCR: deletar após 90 dias (ou menos)
  → Dados extraídos: manter conforme política de retenção (prompt 03)
```

### 5. Checklist

```
  □ MIME type validado (magic bytes, não apenas extensão)
  □ Tamanho limitado por tipo e rota
  □ Nome de arquivo = UUID (nunca nome do usuário)
  □ Armazenamento em Blob Storage (nunca filesystem local)
  □ Organizado por tenant (tenant-id/uuid.ext)
  □ Arquivos temporários deletados após processamento
  □ Imagens de documentos pessoais com prazo de exclusão [DADOS-PESSOAIS]
  □ Scan antivírus configurado (se disponível)
```

````markdown
## Upload — Regras para Antigravity

- SEMPRE validar MIME type real antes de aceitar arquivo
- SEMPRE usar UUID como nome do arquivo (nunca nome original)
- SEMPRE enviar para Blob Storage (nunca filesystem local)
- Arquivos temporários DEVEM ser deletados após processamento
- Se o arquivo contém dados pessoais: prazo de exclusão obrigatório
````

---

> **Próximo prompt:** `15-logging-e-auditoria.md`

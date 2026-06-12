# 1. OBJECTIVE

Implementar um sistema profissional e seguro de venda e entrega de eBook para o projeto "Do Zero ao Milhão", garantindo que:

- O download do eBook seja liberado **exclusivamente** após confirmação real do pagamento via webhook do Stripe
- A página de sucesso (`/sucesso`, `/success`) **NÃO conceda acesso** apenas por ser acessada manualmente
- Tokens de download sejam **criptográficos, temporários e intransferíveis**
- O arquivo do eBook esteja **protegido contra acesso direto por URL**
- Todas as permissões sejam **validadas no backend** (nunca no frontend)
- Logs de auditoria registrem todas as tentativas de acesso
- Medidas de segurança contra ataques comuns (manipulação de URL, bypass, brute force, bots, injeções) sejam implementadas

---

# 2. CONTEXT SUMMARY

## Estado Atual do Projeto

### ✅ Pontos Fortes já Implementados
- Backend Node.js/Express com TypeScript
- Integração com Stripe (webhook para confirmação de pagamento)
- Tokens de download gerados no webhook (`checkout.session.completed`)
- Schema PostgreSQL com tabelas: `purchases`, `downloads`, `subscribers`, `activity_logs`
- Rate limiting configurado
- Helmet.js para security headers
- Validação Zod para variáveis de ambiente

### ❌ Vulnerabilidades Críticas Identificadas

| # | Vulnerabilidade | Risco | Impacto |
|---|-----------------|-------|---------|
| 1 | **SuccessPage aceita qualquer URL com `session_id`** | CRÍTICO | Usuário pode acessar `/sucesso?session_id=qualquer-coisa` e ver a página de sucesso SEM pagamento |
| 2 | **Download por redirect para URL pública** | CRÍTICO | Arquivo pode ser compartilhado via URL gerada |
| 3 | **Token não verifica status da compra** | CRÍTICO | Qualquer token válido permite download, mesmo se compra foi reembolsada |
| 4 | **Sem verificação de idempotência no webhook** | MÉDIO | Webhook pode processar evento duplicado |
| 5 | **Link de download expõe `purchaseId` na URL** | MÉDIO | Enumeração de IDs pode permitir acesso não autorizado |
| 6 | **Sem proteção anti-brute-force nos tokens** | MÉDIO | Força bruta pode testar tokens |
| 7 | **SuccessPage não confirma com backend** | CRÍTICO | Página depende apenas de parâmetro URL |
| 8 | **Sem verificação de revogação de tokens** | MÉDIO | Token não pode ser revogado após geração |

## Arquitetura Atual do Fluxo

```
Usuário → Checkout Stripe → Sucesso (URL) → Acesso ao eBook ❌
                                                    ↑
                                    Webhook confirma pagamento → Gera token
```

## Arquitetura Proposta (Segura)

```
Usuário → Checkout Stripe → Webhook confirma → Salva no banco → E-mail com link
                                                              ↓
Usuário acessa link → Backend valida token → Backend serve arquivo (streaming)
                                    ↓
                            Verifica: token existe? | não expirou? | compra confirmada? | não reembolsada?
```

---

# 3. APPROACH OVERVIEW

## Estratégia de Segurança em Camadas

Implementaremos **defense in depth** com múltiplas camadas de proteção:

### Camada 1: Confirmação de Pagamento (Webhook)
- Validar assinatura HMAC do Stripe (anti-spoofing)
- Verificar idempotência via `stripe_session_id` único
- Marcar compra como `completed` apenas após webhook válido

### Camada 2: Geração de Token Seguro
- Tokens de 256 bits (criptograficamente seguros)
- Assinados com HMAC-SHA256 (não previsíveis)
- Vinculados a: `purchase_id`, `email_hash`, `expiry_timestamp`
- Expiração: 30 dias (configurável)

### Camada 3: Validação de Download
- Verificar assinatura do token (integridade)
- Verificar expiração (tempo)
- Verificar status da compra (não reembolsada, não cancelada)
- Rate limiting: 5 downloads por hora por IP

### Camada 4: Entrega de Arquivo
- **Streaming** via backend (nunca redirect para URL pública)
- Headers de segurança: `Content-Disposition: attachment`
- Range requests suportados para estabilidade
- logging completo de cada download

### Camada 5: Monitoramento e Detecção
- Logs de auditoria para todas as operações
- Alertas para tentativas suspeitas (múltiplos IPs para mesmo token)
- Métricas de uso

---

# 4. IMPLEMENTATION STEPS

## Fase 1: Backend - Sistema de Tokens Criptográficos

### Step 1.1: Criar serviço de tokens HMAC-assinados
**Arquivo:** `backend/src/services/token.ts` (novo)

```typescript
interface TokenPayload {
  purchaseId: number;
  emailHash: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}
```

- Usar HMAC-SHA256 para assinatura
- Payload codificado em Base64URL
- Assinatura separada
- Não armazenar tokens em banco (stateless validation)

### Step 1.2: Criar endpoint de verificação de compra
**Arquivo:** `backend/src/routes/purchase.ts` (novo)

```
GET /api/purchase/:sessionId
```

- Verifica se `stripe_session_id` existe e está `completed`
- Retorna: `{ exists: boolean, verified: boolean }`
- Não expõe dados sensíveis

### Step 1.3: Criar endpoint de download com streaming
**Arquivo:** `backend/src/routes/download.ts` (reescrever)

```
GET /api/download/:token
```

Fluxo de validação:
1. Parse e validar formato do token
2. Verificar assinatura HMAC
3. Verificar expiração
4. Buscar compra no banco
5. Verificar status (`completed`, não `refunded`)
6. Streaming do arquivo com headers seguros

### Step 1.4: Adicionar tabela de tokens revogados
**Arquivo:** `backend/database.sql`

```sql
CREATE TABLE IF NOT EXISTS revoked_tokens (
  id SERIAL PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  revoked_at TIMESTAMP DEFAULT NOW(),
  reason TEXT
);
```

## Fase 2: Frontend - Integração Segura

### Step 2.1: Modificar SuccessPage para verificação real
**Arquivo:** `src/pages/SuccessPage.tsx` (reescrever)

```typescript
// Fluxo correto:
1. Obter session_id da URL
2. Chamar GET /api/purchase/:sessionId
3. Se verified = true, mostrar UI de download
4. Se verified = false, mostrar erro
5. Não mostrar "sucesso" baseado apenas em parâmetro URL
```

### Step 2.2: Adicionar endpoint de verificação no backend
**Arquivo:** `backend/src/routes/purchase.ts` (novo)

```typescript
// GET /api/purchase/:sessionId
// Retorna apenas boolean, nunca dados sensíveis
```

### Step 2.3: Implementar rate limiting no frontend
- Impedir múltiplos requests simultâneos
- Timeout para re-tentativas

## Fase 3: Segurança Adicional

### Step 3.1: Adicionar proteção anti-brute-force
**Arquivo:** `backend/src/middleware/rate-limiter.ts` (novo)

```typescript
// Rate limit: 10 tentativas de token por IP por minuto
// Rate limit: 5 downloads por IP por hora
```

### Step 3.2: Implementar logging de auditoria
**Arquivo:** `backend/src/services/audit.ts` (novo)

```typescript
logEvent({
  action: "download.attempt",
  purchaseId: payload.purchaseId,
  ip: req.ip,
  userAgent: req.headers["user-agent"],
  success: boolean,
  reason?: string
});
```

### Step 3.3: Adicionar proteção CSRF
- Verificar `Origin` header
- Validar `X-Requested-With` header

## Fase 4: Migração do Schema

### Step 4.1: Atualizar database.sql
```sql
-- Adicionar coluna revoked_status à tabela purchases
ALTER TABLE purchases ADD COLUMN status_reason TEXT;
ALTER TABLE purchases ADD COLUMN refunded_at TIMESTAMP;

-- Adicionar índices para performance
CREATE INDEX idx_purchases_stripe_session ON purchases(stripe_session_id);
CREATE INDEX idx_purchases_status ON purchases(status);
```

## Fase 5: Documentação e Deploy

### Step 5.1: Criar fluxograma visual (SVG)
- Criar arquivo `docs/architecture-flowchart.svg`
- Documentar fluxo completo de segurança

### Step 5.2: Criar documentação de segurança
**Arquivo:** `SECURITY-IMPLEMENTATION.md`

```markdown
# Sistema Seguro de Entrega de eBook

## Vulnerabilidades Mitigadas

| Vulnerabilidade | Mitigação | Status |
|-----------------|-----------|--------|
| Bypass de pagamento | Webhook + verificação backend | ✅ |
| Manipulação de URL | Tokens HMAC-assinados | ✅ |
| Força bruta | Rate limiting +tokens longos | ✅ |
| Compartilhamento de link | Streaming via backend | ✅ |
| Replay attacks | Nonce + timestamp | ✅ |

## Testes de Segurança
- [ ] Teste de bypass de pagamento
- [ ] Teste de força bruta em tokens
- [ ] Teste de manipulação de URL
- [ ] Teste de replay attack
- [ ] Teste de CSRF
```

---

# 5. TESTING AND VALIDATION

## Checklist de Segurança

### 5.1 Testes de Bypass de Pagamento
- [ ] Acessar `/sucesso` sem `session_id` → Deve mostrar erro
- [ ] Acessar `/sucesso?session_id=fake` → Deve mostrar erro
- [ ] Acessar `/sucesso?session_id=valid` sem pagamento → Deve mostrar erro
- [ ] Modificar `session_id` na URL → Deve falhar

### 5.2 Testes de Tokens
- [ ] Token forjado → Deve ser rejeitado (HMAC)
- [ ] Token expirado → Deve ser rejeitado
- [ ] Token usado após reembolso → Deve ser rejeitado
- [ ] Força bruta de token → Rate limit aplicado

### 5.3 Testes de Download
- [ ] Download sem token → 403 Forbidden
- [ ] Download com token válido → 200 OK + arquivo
- [ ] Download com token diferente IP → Logado, permitido
- [ ] Múltiplos downloads mesmo token → Rate limitado

### 5.4 Testes de Webhook
- [ ] Webhook sem assinatura → 400 Bad Request
- [ ] Webhook com assinatura inválida → 400 Bad Request
- [ ] Webhook duplicado → Idempotente (não duplica)
- [ ] Webhook com evento diferente → Ignorado

## Validação de Funcionalidade

### Cenário 1: Compra Completa
```
1. Usuário inicia checkout → Stripe
2. Pagamento aprovado → Stripe envia webhook
3. Webhook validado → Compra salva como "completed"
4. E-mail enviado → Link de download
5. Usuário acessa link → Token verificado
6. Download concedido → Arquivo entregue
```

### Cenário 2: Tentativa de Bypass
```
1. Usuário acessa /sucesso?session_id=fake
2. Frontend chama /api/purchase/fake
3. Backend retorna { verified: false }
4. Frontend mostra erro "Pagamento não confirmado"
5. Log de auditoria registrado
```

### Cenário 3: Reembolso
```
1. Stripe processa charge.refunded
2. Backend atualiza compra para "refunded"
3. Token já usado não funciona mais
4. Próximo download é bloqueado
```

---

# ANEXO: Estrutura de Arquivos

```
dozeroaomilhao/
├── backend/
│   ├── src/
│   │   ├── config/env.ts
│   │   ├── middleware/
│   │   │   ├── error-handler.ts
│   │   │   └── rate-limiter.ts          # NOVO
│   │   ├── routes/
│   │   │   ├── checkout.ts
│   │   │   ├── download.ts              # REESCREVER
│   │   │   ├── purchase.ts             # NOVO
│   │   │   ├── webhook.ts
│   │   │   └── health.ts
│   │   ├── services/
│   │   │   ├── database.ts
│   │   │   ├── download.ts
│   │   │   ├── email.ts
│   │   │   ├── audit.ts               # NOVO
│   │   │   └── token.ts               # NOVO
│   │   └── server.ts
│   ├── database.sql                    # ATUALIZAR
│   └── package.json
├── src/
│   ├── pages/
│   │   └── SuccessPage.tsx            # REESCREVER
│   └── ...
└── docs/
    ├── architecture-flowchart.svg     # NOVO
    └── SECURITY-IMPLEMENTATION.md     # NOVO
```

---

# ANEXO: Endpoints da API

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| POST | /webhook/stripe | Recebe confirmação do Stripe | HMAC Signature |
| GET | /api/purchase/:sessionId | Verifica status da compra | None (público) |
| GET | /api/download/:token | Baixa o eBook | Token HMAC |
| GET | /health | Health check | None |

---

# ANEXO: Variáveis de Ambiente

```bash
# Novas variáveis necessárias:
DOWNLOAD_FILE_PATH=/secure/ebook-do-zero-ao-milhao.pdf
TOKEN_SECRET=openssl rand -hex 64
DOWNLOAD_RATE_LIMIT=5
DOWNLOAD_RATE_WINDOW=3600
```

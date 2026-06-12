# Sistema Seguro de Entrega de eBook

## Visão Geral

Este documento descreve a arquitetura de segurança implementada para o sistema de venda e entrega de eBooks "Do Zero ao Milhão".

## Vulnerabilidades Mitigadas

| Vulnerabilidade | Mitigação | Status |
|-----------------|-----------|--------|
| Bypass de pagamento | Webhook Stripe + verificação backend | ✅ |
| Manipulação de URL | Tokens HMAC-assinados (stateless) | ✅ |
| Força bruta | Rate limiting + tokens 256 bits | ✅ |
| Compartilhamento de link | Streaming via backend (não redirect) | ✅ |
| Replay attacks | Nonce + timestamp + expiração | ✅ |
| Uso após reembolso | Verificação de status da compra | ✅ |
| Enumeração de IDs | Retorno "false" para sessão inexistente | ✅ |
| CSRF | Tokens + validação de Origin | ✅ |

## Arquitetura de Segurança

### Fluxo de Pagamento Seguro

```
1. Usuário inicia checkout → Stripe Checkout
2. Pagamento aprovado → Stripe envia webhook (checkout.session.completed)
3. Backend valida assinatura HMAC do webhook
4. Backend salva compra como "completed" no banco
5. Backend gera token HMAC-assinado e envia por e-mail
6. Usuário acessa link de download → GET /api/download/:token
7. Backend valida token HMAC, status da compra e expiração
8. Backend faz streaming do arquivo (não redirect para URL pública)
```

### Sistema de Tokens HMAC

#### Formato do Token
```
base64url(payload).base64url(signature)
```

#### Payload (JSON codificado)
```json
{
  "purchaseId": 123,
  "emailHash": "a1b2c3d4e5f6g7h8",
  "issuedAt": 1704067200000,
  "expiresAt": 1706745600000,
  "nonce": "random16byteshex"
}
```

#### Assinatura
- HMAC-SHA256 do payload codificado
- Chave secreta armazenada em `TOKEN_SECRET` ou `DOWNLOAD_SECRET`

#### Validações por Camada

| Camada | Verificação | Ação se Falhar |
|--------|-------------|----------------|
| 1 | Formato do token | 400 Bad Request |
| 2 | Assinatura HMAC | 403 Forbidden |
| 3 | Expiração | 403 Token expirado |
| 4 | Token não revogado | 403 Token revogado |
| 5 | Compra existe | 404 Não encontrado |
| 6 | Status = completed | 403 Pagamento não confirmado |
| 7 | Email hash corresponde | 403 Token não pertence a esta compra |

## Endpoints da API

### Verificação de Compra

```
GET /api/purchase/:sessionId
```

**Resposta:**
```json
{
  "verified": true,
  "purchaseId": 123
}
```

ou

```json
{
  "verified": false
}
```

### Download de Arquivo

```
GET /api/download/:token
```

**Headers de resposta:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="ebook-do-zero-ao-milhao.pdf"
Content-Length: [tamanho]
Cache-Control: no-store, no-cache, must-revalidate
X-Download-Token: validated
```

## Rate Limiting

| Endpoint | Limite | Janela |
|----------|--------|--------|
| Global | 100 req | 15 min |
| Checkout | 5 req | 1 hora |
| Download | 5 req | 1 hora |
| Webhook | 30 req | 1 min |

## Logs de Auditoria

### Ações Registradas

| Ação | Descrição |
|------|-----------|
| `purchase.created` | Nova compra iniciada |
| `purchase.completed` | Pagamento confirmado |
| `purchase.refunded` | Reembolso processado |
| `token.created` | Token de download gerado |
| `token.revoked` | Token revogado |
| `download.attempt` | Tentativa de download |
| `download.success` | Download realizado |
| `download.invalid_token` | Token inválido fornecido |
| `download.rejected` | Download bloqueado |

### Estrutura do Log

```json
{
  "id": 1,
  "action": "download.success",
  "entity_type": "download",
  "entity_id": 123,
  "metadata": {
    "success": true,
    "reason": null
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Testes de Segurança

### Checklist de Testes

#### Bypass de Pagamento
- [ ] Acessar `/sucesso` sem `session_id` → Erro
- [ ] Acessar `/sucesso?session_id=fake` → Erro
- [ ] Modificar `session_id` na URL → Falha na verificação

#### Tokens
- [ ] Token forjado → Rejeitado (HMAC)
- [ ] Token expirado → Rejeitado
- [ ] Token usado após reembolso → Rejeitado
- [ ] Força bruta de token → Rate limit

#### Download
- [ ] Download sem token → 403
- [ ] Download com token válido → 200 + arquivo
- [ ] Múltiplos downloads → Rate limitado

#### Webhook
- [ ] Webhook sem assinatura → 400
- [ ] Webhook com assinatura inválida → 400
- [ ] Webhook duplicado → Idempotente

## Variáveis de Ambiente

```bash
# Obrigatórias
TOKEN_SECRET=openssl rand -hex 64        # Chave para HMAC de tokens
DOWNLOAD_SECRET=openssl rand -hex 64      # Compatibilidade com código antigo

# Opcionais
DOWNLOAD_FILE_PATH=/secure/ebook.pdf     # Caminho do arquivo (padrão: variável de ambiente)
DOWNLOAD_RATE_LIMIT=5                     # Limite de downloads por hora
DOWNLOAD_RATE_WINDOW=3600                # Janela de rate limit em segundos
```

## Checklist de Deploy

- [ ] `TOKEN_SECRET` configurado (mínimo 32 caracteres)
- [ ] `DOWNLOAD_FILE_PATH` aponta para arquivo real
- [ ] Arquivo do eBook protegido contra acesso direto (bucket privado)
- [ ] Stripe webhook configurado com URL correta
- [ ] Rate limiting ativado
- [ ] Logs de auditoria configurados
- [ ] HTTPS forçado em produção

---

**Última atualização:** 2024-01
# Segurança — Do Zero ao Milhão

## Camadas de proteção implementadas

### 🛡️ 1. Content Security Policy (CSP)
Meta tag CSP aplicada bloqueia:
- Injeção de scripts não autorizados (XSS)
- Carregamento de recursos de domínios não confiáveis
- Clickjacking via `frame-ancestors 'none'`
- Mixed content via `upgrade-insecure-requests` e `block-all-mixed-content`
- Formulários externos não autorizados

### 🔒 2. Headers de proteção (via `<meta http-equiv>`)
- `X-Content-Type-Options: nosniff` — bloqueia MIME sniffing
- `X-Frame-Options: DENY` — previne clickjacking (iframe)
- `X-XSS-Protection: 1; mode=block` — filtro XSS legacy
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — força HTTPS
- `Referrer-Policy: strict-origin-when-cross-origin` — previne leakage de dados
- `Permissions-Policy` — desabilita camera, mic, geolocation
- `Cross-Origin-Opener-Policy: same-origin` — isola contexto de navegação
- `Cross-Origin-Resource-Policy: same-origin` — previne hotlinking

### 🔗 3. Links externos seguros
Todos os `target="_blank"` usam `rel="noopener noreferrer"`:
- Previne `window.opener` attacks (tabnabbing)
- Previne leakage do referrer

### 🚫 4. Código limpo de vetores XSS
- **Zero** `dangerouslySetInnerHTML`
- **Zero** `innerHTML` / `outerHTML` / `document.write`
- **Zero** `eval()` / `new Function()`
- **Zero** event handlers inline no HTML
- **Zero** `javascript:` URLs

### 📦 5. Build hardened
- Vite `build` sem source maps (`viteSingleFile` inline tudo)
- React 19 sanitize props automaticamente
- TypeScript type-safe

### 🌐 6. Recomendações para deploy (server-side headers)
Para proteção máxima, configure os mesmos headers no servidor:

**Cloudflare (via Page Rules ou Workers):**
```
Content-Security-Policy: default-src 'self' ...
X-Frame-Options: DENY
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

**Netlify** — arquivo `_headers`:
```
/*
  Content-Security-Policy: default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://pay.cakto.com.br; script-src 'self' 'unsafe-inline' https://pay.cakto.com.br; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://pay.cakto.com.br; frame-src https://pay.cakto.com.br; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://pay.cakto.com.br; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

**Vercel** — `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Resource-Policy", "value": "same-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    }
  ]
}
```

### 🔑 7. Segurança do checkout
- URL de pagamento via domínio verificado (cakto.com.br)
- `target="_blank"` com `rel="noopener noreferrer"`
- Nenhum dado sensível trafega pelo site (apenas redirecionamento)
- Checkout processado pelo Cakto (PCI-DSS compliant)

### ⚠️ Observação
Como o projeto usa `vite-plugin-singlefile` (tudo inline em um único HTML), os headers HTTP precisam ser **reforçados no servidor de hospedagem** (Cloudflare, Netlify, Vercel, Nginx) para proteção total. Meta tags são uma camada adicional, não substituem headers HTTP.

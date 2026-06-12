import { useState } from "react";
import { PRODUCT, PIX } from "../constants/product";

export default function CheckoutPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PIX.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = PIX.copyPaste;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white antialiased radial-bg">
      <div className="noise" />

      {/* ===== HEADER ===== */}
      <header className="border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 lg:px-10 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo-icon.png"
              alt="Do Zero ao Milhão"
              width={32}
              height={32}
              className="logo-float"
            />
            <span className="text-sm font-medium tracking-tight hidden sm:inline">
              Do Zero ao Milhão
            </span>
          </a>
          <a
            href="/"
            className="text-xs text-white/50 hover:text-gold-400 transition flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Voltar
          </a>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-5 lg:px-10 py-10 lg:py-16">
        {/* ===== TITLE ===== */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs tracking-[0.3em] uppercase text-gold-400">
            Checkout Seguro · Pagamento via Pix
          </span>
          <h1 className="mt-4 font-display text-3xl md:text-5xl font-light tracking-tight leading-[1.05]">
            Finalize sua compra do{" "}
            <span className="italic text-gold-gradient">Guia Definitivo</span>
          </h1>
          <p className="mt-4 text-sm md:text-base text-mist">
            Acesso imediato após confirmação automática do pagamento.
          </p>
        </div>

        <div className="mt-12 grid lg:grid-cols-[1.05fr,0.95fr] gap-6 lg:gap-8 items-start">
          {/* ===== ORDER SUMMARY ===== */}
          <aside className="rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur p-7 lg:p-9 order-2 lg:order-1">
            <div className="text-xs tracking-[0.3em] uppercase text-gold-400 mb-5">
              Resumo do pedido
            </div>

            <div className="flex gap-5 items-center pb-6 border-b border-white/10">
              <div className="shrink-0 w-20 h-28 rounded-lg overflow-hidden border border-gold-400/30 bg-gradient-to-br from-gold-400/10 to-black flex items-center justify-center">
                <img
                  src="/ebook-cover.png"
                  alt="Ebook Do Zero ao Milhão"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] tracking-widest uppercase text-gold-400/80">
                  Ebook Premium · {PRODUCT.pages} páginas
                </div>
                <h2 className="mt-1 font-display text-lg leading-tight">
                  {PRODUCT.fullName}
                </h2>
                <div className="mt-1 text-xs text-mist">
                  Entrega digital em {PRODUCT.format}
                </div>
              </div>
            </div>

            <div className="py-6 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-mist">Subtotal</span>
                <span className="text-white/60 line-through">
                  R$ {PRODUCT.price.original}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-mist">Desconto exclusivo</span>
                <span className="text-gold-400">
                  −{PRODUCT.price.discountPct}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-mist">Forma de pagamento</span>
                <span className="text-white/90">Pix · à vista</span>
              </div>
            </div>

            <div className="pt-5 border-t border-white/10 flex items-end justify-between">
              <span className="text-xs tracking-[0.3em] uppercase text-white/50">
                Total
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-mist">R$</span>
                <span className="font-display text-4xl text-gold-gradient">
                  {PRODUCT.price.current}
                </span>
              </div>
            </div>

            {/* Badges segurança */}
            <div className="mt-7 grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-black/40">
                <svg className="w-3.5 h-3.5 text-gold-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span className="text-[11px] text-white/70 leading-tight">
                  Ambiente Seguro
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-black/40">
                <svg className="w-3.5 h-3.5 text-gold-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                <span className="text-[11px] text-white/70 leading-tight">
                  Garantia {PRODUCT.guaranteeDays} dias
                </span>
              </div>
{/* INFO MERCADO PAGO REMOVIDA */}
            </div>
          </aside>

          {/* ===== PIX PAYMENT ===== */}
          <section className="rounded-3xl border border-gold-400/30 bg-gradient-to-b from-gold-400/[0.06] to-transparent backdrop-blur p-6 lg:p-9 shimmer-border order-1 lg:order-2">
            <div className="text-xs tracking-[0.3em] uppercase text-gold-400 mb-2">
              01 · Pagamento Pix
            </div>
            <h3 className="font-display text-2xl lg:text-3xl font-light tracking-tight">
              Escaneie ou copie o código
            </h3>

            {/* QR CODE */}
            <div className="mt-7 flex flex-col items-center">
              <div className="relative">
                <div className="absolute -inset-3 rounded-3xl bg-gold-400/10 blur-2xl" aria-hidden="true" />
                <div className="relative bg-white p-3 rounded-2xl shadow-2xl">
                  <img
                    src={PIX.qrCodeImage}
                    alt="QR Code Pix · Ebook Do Zero ao Milhão"
                    width={240}
                    height={240}
                    className="w-[240px] h-[240px] block"
                  />
                </div>
              </div>
              <div className="mt-4 text-xs text-mist text-center">
                Aponte a câmera do app do seu banco para o QR Code
              </div>
            </div>

            {/* DIVISOR */}
            <div className="mt-7 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-white/30">
              <span className="flex-1 h-px bg-white/10" />
              <span>ou</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>

            {/* COPY PASTE */}
            <div className="mt-6">
              <label className="text-[10px] uppercase tracking-[0.25em] text-white/50">
                Pix copia e cola
              </label>
              <div className="mt-2 rounded-xl border border-white/10 bg-black/60 p-3 text-[11px] font-mono text-white/60 break-all max-h-24 overflow-y-auto">
                {PIX.copyPaste}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={`mt-3 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold text-sm tracking-wide transition-all duration-300 ${
                  copied
                    ? "bg-emerald-500 text-black"
                    : "bg-gold-400 text-black hover:bg-gold-300 glow-pulse"
                }`}
              >
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Copiado!
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                    Copiar código Pix
                  </>
                )}
              </button>
            </div>

{/* RECEIVER INFO REMOVIDO PARA PRIVACIDADE */}
          </section>
        </div>

        {/* ===== INSTRUCTIONS ===== */}
        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur p-7 lg:p-9">
          <div className="text-xs tracking-[0.3em] uppercase text-gold-400 mb-2">
            02 · Como pagar
          </div>
          <h3 className="font-display text-2xl font-light tracking-tight">
            4 passos para liberar seu acesso
          </h3>
          <ol className="mt-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "1", t: "Abra o app do seu banco" },
              { n: "2", t: "Escolha a opção Pagar via Pix" },
              { n: "3", t: "Escaneie o QR Code ou cole o código" },
              {
                n: "4",
                t: "Após pagamento, o acesso será enviado ao seu e-mail",
              },
            ].map((s) => (
              <li
                key={s.n}
                className="relative p-5 rounded-2xl border border-white/10 bg-black/40"
              >
                <div className="font-display text-4xl text-gold-400/30">
                  {s.n}
                </div>
                <p className="mt-2 text-sm text-white/80 leading-relaxed">
                  {s.t}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-7 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <p className="text-xs text-mist max-w-md leading-relaxed">
              Já efetuou o pagamento? O acesso ao PDF é liberado em até{" "}
              <span className="text-white">2 minutos</span> após a confirmação
              do pagamento.
            </p>
            <a
              href="/sucesso?session_id=demo"
              className="btn-ghost !text-sm whitespace-nowrap"
            >
              Já paguei · liberar acesso
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </section>

        {/* ===== LEGAL ===== */}
        <p className="mt-10 text-center text-[11px] text-white/40 max-w-2xl mx-auto leading-relaxed">
          Compra 100% segura · Garantia incondicional de {PRODUCT.guaranteeDays}{" "}
          dias · Material educacional, não constitui recomendação de
          investimento.
        </p>
      </main>
    </div>
  );
}

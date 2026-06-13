import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { PRODUCT, PIX } from "../constants/product";
import { auth, loginWithGoogle } from "../firebase";
import { onAuthStateChanged, User } from "firebase/auth";

export default function CheckoutPage() {
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "payment">("email");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.email) {
        setEmail(currentUser.email);
        setStep("payment");
      }
    });
    return () => unsubscribe();
  }, []);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes("@")) {
      setStep("payment");
    }
  };

  useEffect(() => {
    // Generate QR Code dynamically from the PIX payload
    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL(PIX.copyPaste, {
          width: 300,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        setQrCodeDataUrl(url);
      } catch (err) {
        console.error("Failed to generate QR Code", err);
        // Fallback to static image if dynamic generation fails
        setQrCodeDataUrl(PIX.qrCodeImage);
      }
    };
    generateQR();
  }, []);

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

          {/* ===== ACTION AREA ===== */}
          <section className="rounded-3xl border border-gold-400/30 bg-gradient-to-b from-gold-400/[0.06] to-transparent backdrop-blur p-6 lg:p-9 shimmer-border order-1 lg:order-2">
            
            {step === "email" ? (
              <div className="flex flex-col h-full justify-center">
                <div className="text-xs tracking-[0.3em] uppercase text-gold-400 mb-2">
                  01 · Identificação
                </div>
                <h3 className="font-display text-2xl lg:text-3xl font-light tracking-tight mb-6">
                  Para onde enviamos seu acesso?
                </h3>
                
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-[0.25em] text-white/50 mb-2">
                      Seu melhor e-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="seu@email.com"
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-gold-400/50 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gold-400 text-black font-semibold text-sm tracking-wide hover:bg-gold-300 transition-colors glow-pulse"
                  >
                    Continuar para pagamento
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </form>

                <div className="mt-8 flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.3em] text-white/30">
                  <span className="flex-1 h-px bg-white/10" />
                  <span>ou acesse rápido</span>
                  <span className="flex-1 h-px bg-white/10" />
                </div>
                
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-white text-black font-semibold text-sm hover:bg-gray-200 transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Login com Google
                </button>
              </div>
            ) : (
              <>
                <div className="text-xs tracking-[0.3em] uppercase text-gold-400 mb-2 flex items-center justify-between">
                  <span>02 · Pagamento Pix</span>
                  <button onClick={() => setStep("email")} className="text-mist hover:text-white underline text-[10px]">Alterar E-mail</button>
                </div>
                <h3 className="font-display text-2xl lg:text-3xl font-light tracking-tight">
                  Escaneie ou copie o código
                </h3>

                {/* QR CODE */}
                <div className="mt-7 flex flex-col items-center">
                  <div className="relative">
                    <div className="absolute -inset-3 rounded-3xl bg-gold-400/10 blur-2xl" aria-hidden="true" />
                    <div className="relative bg-white p-2 sm:p-3 rounded-2xl shadow-2xl">
                      {/* Aspect ratio to prevent layout shift while rendering dynamic QR */}
                      <div className="w-[180px] h-[180px] sm:w-[240px] sm:h-[240px] flex items-center justify-center">
                        <img
                          src={qrCodeDataUrl || PIX.qrCodeImage}
                          alt="QR Code Pix · Ebook Do Zero ao Milhão"
                          className="w-full h-full object-contain block transition-opacity duration-300"
                        />
                      </div>
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
              </>
            )}
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
              do pagamento via Mercado Pago.
            </p>
            {user && (
              <a
                href={`/sucesso?session_id=${encodeURIComponent(user.uid)}`}
                className="btn-ghost !text-sm whitespace-nowrap"
              >
                Verificar pagamento
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </a>
            )}
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

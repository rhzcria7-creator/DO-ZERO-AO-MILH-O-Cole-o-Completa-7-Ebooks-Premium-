import { useEffect, useState, useRef } from "react";
import { PRODUCT } from "../constants/product";

interface VerificationResult {
  verified: boolean;
  downloadToken?: string;
  error?: string;
}

type Status = "loading" | "verifying" | "success" | "error";

const API_BASE = import.meta.env.VITE_API_URL || "";
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export default function SuccessPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const downloadStartedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;

    const verifyPayment = async () => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");

      if (!sessionId) {
        if (mounted) {
          setStatus("error");
          setErrorMessage("Link de confirmação inválido. Acesse o link enviado para seu e-mail.");
        }
        return;
      }

      // Buscar token de download dos parâmetros da URL (enviado por email)
      const downloadToken = params.get("token");
      
      if (downloadToken) {
        // Token fornecido diretamente - verificar formato e usar
        if (mounted) {
          setStatus("success");
          setDownloadUrl(`/api/download/${downloadToken}`);
        }
        return;
      }

      // Sem token na URL - verificar com backend
      if (mounted) {
        setStatus("verifying");
      }

      const tryVerify = async (): Promise<VerificationResult> => {
        try {
          const response = await fetch(`${API_BASE}/api/purchase/${sessionId}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          return data;
        } catch (error) {
          console.error("Verification failed:", error);
          return { verified: false, error: "Falha ao verificar pagamento" };
        }
      };

      // Tentar verificação com retry
      const attemptVerification = async () => {
        const result = await tryVerify();

        if (result.verified) {
          if (mounted) {
            setStatus("success");
            // Não temos o token aqui - usuário deve usar link do email
            // Em produção, o email contém o token de download
          }
          return;
        }

        if (retryCount < MAX_RETRIES) {
          retryCount++;
          if (mounted) {
            setTimeout(attemptVerification, RETRY_DELAY);
          }
        } else {
          if (mounted) {
            setStatus("error");
            setErrorMessage(
              "Pagamento não confirmado ainda. O processamento pode levar alguns minutos. " +
              "Verifique seu e-mail para o link de download."
            );
          }
        }
      };

      await attemptVerification();
    };

    verifyPayment();

    return () => {
      mounted = false;
    };
  }, []);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (!downloadUrl || downloadStartedRef.current || isDownloading) {
      return;
    }

    downloadStartedRef.current = true;
    setIsDownloading(true);

    // Abrir download em nova aba
    window.open(downloadUrl, "_blank");

    // Resetar após um tempo para permitir novo download
    setTimeout(() => {
      downloadStartedRef.current = false;
      setIsDownloading(false);
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 radial-bg">
      <div className="noise" />
      <div className="relative max-w-2xl text-center w-full">
        {status === "loading" && (
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto border-4 border-gold-400/20 border-t-gold-400 rounded-full animate-spin" />
            <p className="mt-6 text-white/60">Preparando...</p>
          </div>
        )}

        {status === "verifying" && (
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto border-4 border-gold-400/20 border-t-gold-400 rounded-full animate-spin" />
            <p className="mt-6 text-white/60">Confirmando seu pagamento...</p>
          </div>
        )}

        {status === "success" && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-400/10 border-2 border-gold-400 mb-8 glow-pulse">
              <svg
                className="w-10 h-10 text-gold-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.4}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <span className="text-xs tracking-[0.3em] uppercase text-gold-400">
              Acesso liberado
            </span>
            <h1 className="mt-3 font-display text-4xl md:text-5xl lg:text-6xl font-light leading-[1.05]">
              Pagamento{" "}
              <span className="text-gold-gradient italic">confirmado.</span>
            </h1>

            <p className="mt-6 text-lg text-white/70 max-w-lg mx-auto leading-relaxed">
              Bem-vindo à jornada. Seu{" "}
              <span className="text-white">{PRODUCT.fullName}</span> já está
              pronto para download.
            </p>

            <div className="mt-10 rounded-3xl border border-gold-400/30 bg-gradient-to-b from-gold-400/[0.08] to-transparent backdrop-blur p-7 lg:p-9 shimmer-border text-left">
              <div className="flex items-center gap-5">
                <div className="shrink-0 w-16 h-22 rounded-lg overflow-hidden border border-gold-400/40 bg-black">
                  <img
                    src="/ebook-cover.png"
                    alt="Ebook Do Zero ao Milhão"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] tracking-widest uppercase text-gold-400/80">
                    Ebook Premium · {PRODUCT.pages} páginas
                  </div>
                  <h2 className="mt-1 font-display text-xl">
                    {PRODUCT.name}
                  </h2>
                  <div className="text-xs text-mist">
                    {PRODUCT.subtitle}
                  </div>
                </div>
              </div>

              {downloadUrl ? (
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full bg-gold-400 text-black font-semibold hover:bg-gold-300 transition-colors glow-pulse disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Iniciando download...
                    </>
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <path d="M7 10l5 5 5-5" />
                        <path d="M12 15V3" />
                      </svg>
                      Baixar Ebook ({PRODUCT.pages} páginas · PDF)
                    </>
                  )}
                </button>
              ) : (
                <div className="mt-6 p-4 rounded-xl bg-gold-400/10 border border-gold-400/20">
                  <p className="text-sm text-gold-400/80">
                    📧 O link de download foi enviado para seu e-mail.
                    <br />
                    <span className="text-xs text-white/60">
                      Verifique também sua caixa de spam.
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left">
              <h3 className="text-sm font-medium text-gold-400 mb-3">
                O que acontece agora
              </h3>
              <ul className="space-y-2.5 text-sm text-white/80">
                <li className="flex gap-3">
                  <span className="text-gold-400">✓</span>
                  <span>
                    Enviamos uma cópia do PDF e do recibo para o seu e-mail
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold-400">✓</span>
                  <span>O link de download fica válido por 30 dias</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold-400">✓</span>
                  <span>
                    Atualizações futuras do ebook são gratuitas para você
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-gold-400">✓</span>
                  <span>
                    Garantia incondicional de {PRODUCT.guaranteeDays} dias
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-8 space-y-3">
              <a
                href="/"
                className="btn-ghost !text-sm inline-flex"
              >
                Voltar ao início
              </a>
              <p className="text-xs text-white/50">
                Não recebeu o e-mail? Verifique sua caixa de spam ou{" "}
                <a
                  href="mailto:rhz.cria.7@gmail.com"
                  className="text-gold-400 hover:underline"
                >
                  entre em contato
                </a>
                .
              </p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500 mb-8">
              <svg
                className="w-10 h-10 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="font-display text-5xl font-light mb-4">
              Pagamento{" "}
              <span className="text-red-500 italic">não confirmado</span>
            </h1>

            <p className="text-lg text-white/70 mb-6 max-w-lg mx-auto">
              {errorMessage}
            </p>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left max-w-lg mx-auto mb-8">
              <h3 className="text-sm font-medium text-white/80 mb-3">
                O que você pode fazer:
              </h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li>• Aguarde alguns minutos e atualize esta página</li>
                <li>• Verifique se o pagamento foi processado no Stripe</li>
                <li>• Procure o e-mail de confirmação na sua caixa de entrada</li>
                <li>• Verifique sua pasta de spam ou lixo eletrônico</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gold-400 text-black font-semibold hover:bg-gold-300 transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 4v6h6M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                </svg>
                Tentar novamente
              </button>
              <a
                href="/checkout"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-gold-400/30 text-gold-400 font-semibold hover:bg-gold-400/10 transition-colors"
              >
                Voltar ao checkout
              </a>
            </div>

            <p className="mt-8 text-xs text-white/40">
              Precisa de ajuda?{" "}
              <a
                href="mailto:rhz.cria.7@gmail.com"
                className="text-gold-400 hover:underline"
              >
                Entre em contato
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Image from "next/image";
import Logo from "@/public/assets/images/new_logo.png";

export default function Login() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const popupCenter = (url: string, title: string) => {
    const dualScreenLeft = window.screenLeft ?? window.screenX;
    const dualScreenTop = window.screenTop ?? window.screenY;

    const width =
      window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;

    const height =
      window.innerHeight ??
      document.documentElement.clientHeight ??
      screen.height;

    const systemZoom = width / window.screen.availWidth;

    const left = (width - 500) / 2 / systemZoom + dualScreenLeft;
    const top = (height - 550) / 2 / systemZoom + dualScreenTop;

    const newWindow = window.open(
      url,
      title,
      `width=${500 / systemZoom},height=${
        550 / systemZoom
      },top=${top},left=${left}`
    );

    newWindow?.focus();
  };

  // Si la sesión ya existe, redirige al usuario automáticamente
  useEffect(() => {
    if (status === "loading") return;
    if (session) {
      // Usamos replace para no dejar el login en el historial
      router.replace("/");
    }
  }, [session, status, router]);

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    popupCenter("/googleSignIn", "Sample Sign In");
    // Resetear loading después de un tiempo
    setTimeout(() => setIsLoading(false), 3000);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#f2eede] via-[#e6d5b8] to-[#d9c4a6] p-4 relative overflow-hidden">
      {/* Fondo animado con cartas flotantes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-red-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl animate-pulse delay-700"></div>

        {/* Cartas decorativas */}
        <div className="absolute top-[5%] left-[5%] opacity-[0.03] transform rotate-12 hover:opacity-10 transition-opacity duration-300">
          <div className="w-32 h-44 OP01_BG rounded-lg"></div>
        </div>
        <div className="absolute top-[10%] right-[10%] opacity-[0.03] transform -rotate-12 hover:opacity-10 transition-opacity duration-300">
          <div className="w-32 h-44 OP02_BG rounded-lg"></div>
        </div>
        <div className="absolute bottom-[15%] left-[10%] opacity-[0.03] transform rotate-6 hover:opacity-10 transition-opacity duration-300">
          <div className="w-32 h-44 OP03_BG rounded-lg"></div>
        </div>
        <div className="absolute bottom-[5%] right-[5%] opacity-[0.03] transform -rotate-6 hover:opacity-10 transition-opacity duration-300">
          <div className="w-32 h-44 OP04_BG rounded-lg"></div>
        </div>
      </div>

      {/* Contenido principal */}
      <div
        className={`w-full max-w-md z-10 transition-all duration-1000 ease-out ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
        }`}
      >
        {/* Logo animado */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
            <Image
              src={Logo}
              height={140}
              width={140}
              alt="OharaTCG Logo"
              className="relative z-10 transform transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <h1 className="title text-4xl md:text-5xl mt-4 text-gray-800 animate-fade-in">
            OharaTCG
          </h1>
        </div>

        {/* Card de login mejorada */}
        <div className="relative">
          {/* Efecto de brillo detrás de la card */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 blur-xl"></div>

          <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/50">
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-gray-800">
                  ¡Bienvenido, Nakama!
                </h2>

                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  La colección más completa del TCG de One Piece.
                </p>
              </div>

              {/* Línea decorativa */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                <span className="text-xs text-gray-400 px-2">
                  INICIAR SESIÓN
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              </div>

              {/* Botón de Google mejorado */}
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="group relative w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-4 px-6 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center gap-3">
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      height="24"
                      viewBox="0 0 24 24"
                      width="24"
                      className="h-5 w-5 transform transition-transform group-hover:scale-110"
                    >
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                      <path d="M1 1h22v22H1z" fill="none" />
                    </svg>
                  )}
                  <span className="text-base">
                    {isLoading ? "Conectando..." : "Continuar con Google"}
                  </span>
                </div>

                {/* Efecto de hover */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-10 transition-opacity duration-200"></div>
              </button>

              {/* Features */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-red-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-600">Todas las cartas</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-orange-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-orange-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                      />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-600">Versiones alternas</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-yellow-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-yellow-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-600">Actualizado</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Al continuar, aceptas nuestros{" "}
            <a href="#" className="text-red-600 hover:text-red-700 font-medium">
              términos de servicio
            </a>
          </p>
        </div>
      </div>

      {/* CSS para animaciones adicionales */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out 0.3s both;
        }

        .delay-700 {
          animation-delay: 0.7s;
        }
      `}</style>
    </div>
  );
}

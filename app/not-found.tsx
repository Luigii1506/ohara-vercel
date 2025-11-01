"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotFound() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-gradient-to-b from-[#f2eede] to-[#e6d5b8] flex items-center justify-center p-4 relative">
      {/* Fondo con cartas - más sutil */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[10%] left-[10%] opacity-5">
          <div className="w-24 h-32 md:w-32 md:h-44 OP01_BG rounded-lg transform rotate-12"></div>
        </div>
        <div className="absolute top-[15%] right-[15%] opacity-5">
          <div className="w-24 h-32 md:w-32 md:h-44 OP02_BG rounded-lg transform -rotate-12"></div>
        </div>
        <div className="absolute bottom-[20%] left-[15%] opacity-5">
          <div className="w-24 h-32 md:w-32 md:h-44 OP03_BG rounded-lg transform rotate-6"></div>
        </div>
        <div className="absolute bottom-[10%] right-[10%] opacity-5">
          <div className="w-24 h-32 md:w-32 md:h-44 OP04_BG rounded-lg transform -rotate-6"></div>
        </div>
      </div>

      {/* Contenido principal centrado */}
      <div className="relative z-10 text-center max-w-3xl mx-auto w-full">
        {/* Animación de entrada más sutil */}
        <div
          className={`transition-all duration-700 ease-out ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          {/* Número 404 grande y elegante */}
          <div className="mb-8">
            <h1 className="text-8xl md:text-9xl font-bold mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500">
                404
              </span>
            </h1>
            {/* Línea decorativa debajo del 404 */}
            <div className="w-32 h-1 bg-gradient-to-r from-red-500 to-orange-500 mx-auto rounded-full"></div>
          </div>

          {/* Mensaje principal */}
          <h2 className="title text-2xl md:text-4xl mb-6 text-gray-800 ">
            ¡Esta página se perdió en el Grand Line!
          </h2>

          {/* Descripción */}
          <p className="text-base md:text-lg text-gray-600 mb-10 max-w-lg mx-auto leading-relaxed">
            Parece que te has desviado de la ruta. Ni siquiera el Log Pose puede
            encontrar esta página.
          </p>

          {/* Botones mejorados con iconos */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-10 mb-10">
            <Link
              href="/"
              className="group inline-flex items-center justify-center px-8 py-4 font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 shadow-lg hover:shadow-xl min-w-[200px]"
            >
              <svg
                className="w-5 h-5 mr-2 transition-transform group-hover:-translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Volver al Inicio
            </Link>

            <Link
              href="/cardList"
              className="group inline-flex items-center justify-center px-8 py-4 font-semibold text-gray-700 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-lg hover:shadow-xl min-w-[200px]"
            >
              Ver Colección
              <svg
                className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </Link>
          </div>

          {/* Footer más sutil */}
          <p className="mt-12 text-sm text-gray-400">
            Error Code: Gomu Gomu no... Page Not Found!
          </p>
        </div>
      </div>
    </div>
  );
}

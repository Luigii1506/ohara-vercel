"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!email) {
      setError("Ingresa tu correo");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.error ?? "No se pudo procesar la solicitud");
      return;
    }

    setMessage(
      "Si el correo existe en nuestros registros, recibirás un enlace para restablecer tu contraseña en unos minutos."
    );
    setEmail("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f2eede] via-[#e6d5b8] to-[#d9c4a6] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-white/50">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-gray-500 text-center mb-6">
          Ingresa tu correo para enviarte un enlace de restablecimiento.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white/70 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-800"
              placeholder="tu-correo@ejemplo.com"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {message && (
            <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Recordaste tu contraseña?
          <Link href="/login" className="text-orange-500 font-semibold ml-1 hover:underline">
            Regresar al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

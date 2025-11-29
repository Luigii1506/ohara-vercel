"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!token) {
      setError("El enlace es inválido o ha expirado");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.error ?? "No se pudo actualizar la contraseña");
      return;
    }

    setStatus("Tu contraseña se actualizó correctamente. Ahora puedes iniciar sesión.");
    setPassword("");
    setConfirmPassword("");

    setTimeout(() => {
      router.replace("/login");
    }, 2000);
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f2eede] via-[#e6d5b8] to-[#d9c4a6] p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-white/50 text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-800">Enlace inválido</h1>
          <p className="text-gray-500">Solicita un nuevo enlace desde la página de recuperación.</p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Ir a recuperación
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f2eede] via-[#e6d5b8] to-[#d9c4a6] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-white/50">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
          Restablecer contraseña
        </h1>
        <p className="text-gray-500 text-center mb-6">
          Define una nueva contraseña para tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white/70 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-800"
              placeholder="********"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white/70 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-800"
              placeholder="********"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {status && (
            <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {status}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
          >
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}

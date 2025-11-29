"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Image from "next/image";
import Logo from "@/public/assets/images/new_logo.png";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!name || !email || !password) {
      setError("Todos los campos son obligatorios");
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

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.error ?? "No se pudo crear el usuario");
      setLoading(false);
      return;
    }

    setSuccess("Cuenta creada correctamente. Iniciando sesión...");

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.replace("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#f2eede] via-[#e6d5b8] to-[#d9c4a6] p-4 relative overflow-hidden w-full">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-red-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src={Logo} height={120} width={120} alt="OharaTCG" />
          <h1 className="title text-4xl md:text-5xl mt-4 text-gray-800">
            Crea tu cuenta
          </h1>
        </div>

        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/30 to-orange-500/30 blur-xl" />
          <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/50">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white/70 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-800"
                  placeholder="Nombre completo"
                  disabled={loading}
                />
              </div>

              <div className="text-left">
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

              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-600 mb-1">
                  Contraseña
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

              <div className="text-left">
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

              {success && (
                <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  {success}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              ¿Ya tienes cuenta?
              <Link
                href="/login"
                className="text-orange-500 font-semibold ml-1 hover:underline"
              >
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

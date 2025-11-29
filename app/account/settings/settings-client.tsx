"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

interface SettingsClientProps {
  user: {
    name: string;
    email: string;
    role: string;
    hasPassword: boolean;
  };
  providers: string[];
}

const KNOWN_PROVIDERS = [
  { id: "credentials", label: "Email y contraseña" },
  { id: "google", label: "Google" },
  { id: "discord", label: "Discord" },
];

export default function SettingsClient({ user, providers }: SettingsClientProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePasswordUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener mínimo 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data?.error ?? "No se pudo actualizar tu contraseña");
      return;
    }

    setStatus("Contraseña actualizada correctamente");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const normalizedProviders = new Set(providers.map((provider) => provider.toLowerCase()));
  if (user.hasPassword) {
    normalizedProviders.add("credentials");
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Perfil
        </h2>
        <div className="grid gap-4">
          <div>
            <p className="text-sm text-gray-500">Nombre</p>
            <p className="text-lg font-medium text-gray-800">{user.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Correo</p>
            <p className="text-lg font-medium text-gray-800">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Rol</p>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold">
              {user.role}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Contraseña
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {user.hasPassword
            ? "Puedes actualizar tu contraseña actual."
            : "Añade una contraseña para acceder también con tu correo."}
        </p>
        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          {user.hasPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Contraseña actual
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="********"
                disabled={loading}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="********"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
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
            {loading ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          Métodos de acceso
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Conecta tus proveedores preferidos para acceder rápidamente a tu cuenta.
        </p>
        <div className="space-y-3">
          {KNOWN_PROVIDERS.map((provider) => {
            const connected = normalizedProviders.has(provider.id);
            const isGoogle = provider.id === "google";

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-gray-800">{provider.label}</p>
                  <p className="text-sm text-gray-500">
                    {connected ? "Conectado" : "No conectado"}
                  </p>
                </div>
                {isGoogle && !connected ? (
                  <button
                    onClick={() => signIn("google", { callbackUrl: "/account/settings" })}
                    className="text-sm font-semibold text-orange-500 hover:text-orange-600"
                  >
                    Conectar Google
                  </button>
                ) : (
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      connected
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {connected ? "Activo" : "Inactivo"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

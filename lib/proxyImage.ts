// Algunos orígenes (p.ej. en.onepiece-cardgame.com) sirven las imágenes con
// `Cross-Origin-Resource-Policy: same-site`, lo que hace que el NAVEGADOR bloquee
// cargarlas en un <img> desde otro dominio (oharatcg.com) — aunque por curl den
// 200. La solución es servirlas a través de nuestro proxy same-origin
// (/api/proxy-image), que hace el fetch en el servidor (donde CORP no aplica).

// Dominios que bloquean el hotlinking cross-site y deben pasar por el proxy.
const BLOCKED_HOSTS = ["onepiece-cardgame.com"];

export function proxyImage(url?: string | null): string | undefined {
  if (!url) return url ?? undefined;
  try {
    const host = new URL(url).hostname;
    if (BLOCKED_HOSTS.some((d) => host === d || host.endsWith("." + d))) {
      return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // URL relativa o inválida: dejarla tal cual.
  }
  return url;
}

/**
 * Genera un CSS scopeado bajo `.event-page` a partir del CSS oficial de
 * onepiece-cardgame.com (layout.css + article.css), para que el contenido
 * scrapeado de detalle de eventos se vea igual que en el sitio oficial sin
 * filtrar estilos globales al resto de la app.
 *
 * Uso:  node scripts/gen-event-official-css.mjs
 * Salida: app/events/event-article-official.css
 *
 * Re-ejecutar si el sitio oficial cambia su CSS de forma notable.
 */
import postcss from "postcss";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ORIGIN = "https://en.onepiece-cardgame.com";
// Orden igual al del sitio: primero layout, luego article (article depende de layout).
const SOURCES = [
  `${ORIGIN}/renewal/css/layout.css`,
  `${ORIGIN}/renewal/css/article.css`,
];
// Scopeamos SOLO el contenedor del contenido inyectado (no todo .event-page),
// así las reglas de body/html del oficial (font-size base, bg, padding del
// header fijo) no afectan nuestro chrome (botón Back, hero, gradiente).
const SCOPE = ".event-official-content";

async function fetchCss(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: ORIGIN },
  });
  if (!res.ok) throw new Error(`No se pudo bajar ${url}: ${res.status}`);
  return res.text();
}

/** Prefija un selector individual con `.event-page`, mapeando globales. */
function scopeSelector(sel) {
  const s = sel.trim();
  if (!s) return s;
  // Ya scopeado.
  if (s === SCOPE || s.startsWith(`${SCOPE} `) || s.startsWith(`${SCOPE}.`))
    return s;
  // Globales -> se convierten en el propio contenedor.
  if (/^:root\b/.test(s)) return s.replace(/^:root\b/, SCOPE);
  if (/^html\b/.test(s)) return s.replace(/^html\b/, SCOPE);
  if (/^body\b/.test(s)) return s.replace(/^body\b/, SCOPE);
  // Cualquier otro selector (clase, elemento, etc.) queda como descendiente.
  return `${SCOPE} ${s}`;
}

function isInsideKeyframes(rule) {
  let p = rule.parent;
  while (p) {
    if (p.type === "atrule" && /keyframes$/i.test(p.name)) return true;
    p = p.parent;
  }
  return false;
}

// Base para resolver rutas relativas de url(): ambos CSS viven en /renewal/css/.
const URL_BASE = `${ORIGIN}/renewal/css/`;

/** Reescribe las url() relativas del CSS oficial a URLs absolutas del dominio
 *  oficial, para que el bundler de Next no intente resolverlas como módulos
 *  locales (y no falle el build). */
function rewriteUrls(value) {
  return value.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (whole, quote, ref) => {
      const r = ref.trim();
      if (
        !r ||
        r.startsWith("data:") ||
        r.startsWith("#") ||
        /^https?:\/\//i.test(r)
      ) {
        return whole;
      }
      let abs;
      try {
        abs = r.startsWith("/")
          ? `${ORIGIN}${r}`
          : new URL(r, URL_BASE).toString();
      } catch {
        return whole;
      }
      return `url("${abs}")`;
    }
  );
}

const scopePlugin = {
  postcssPlugin: "scope-under-event-page",
  Once(root) {
    // Fonts externas: no se pueden anidar y traen dependencias externas.
    root.walkAtRules("import", (r) => r.remove());
    root.walkAtRules("charset", (r) => r.remove());
    root.walkDecls((decl) => {
      if (decl.value && decl.value.includes("url(")) {
        decl.value = rewriteUrls(decl.value);
      }
    });
    root.walkRules((rule) => {
      if (isInsideKeyframes(rule)) return;
      rule.selectors = rule.selectors.map(scopeSelector);
      // En las reglas que vienen de body/html (ahora el propio wrapper) quitamos
      // el padding-top: era el hueco para el header fijo del sitio oficial, que
      // aquí no existe.
      if (rule.selector === SCOPE) {
        rule.walkDecls(/^padding-top$/, (d) => d.remove());
      }
    });
  },
};

async function main() {
  const parts = [];
  for (const url of SOURCES) {
    console.log(`[fetch] ${url}`);
    parts.push(`/* ===== ${url} ===== */`);
    parts.push(await fetchCss(url));
  }
  const combined = parts.join("\n");
  const result = await postcss([scopePlugin]).process(combined, {
    from: undefined,
  });

  const header =
    `/* AUTO-GENERADO por scripts/gen-event-official-css.mjs — NO EDITAR A MANO.\n` +
    `   CSS oficial de onepiece-cardgame.com scopeado bajo ${SCOPE}.\n` +
    `   Regenerar: node scripts/gen-event-official-css.mjs */\n\n`;

  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "app",
    "events",
    "event-article-official.css"
  );
  writeFileSync(outPath, header + result.css, "utf8");
  console.log(
    `[ok] escrito ${outPath} (${Math.round((header.length + result.css.length) / 1024)} KB)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

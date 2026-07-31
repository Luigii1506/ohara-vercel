import "../event-global.scss";
import "../event.scss";
// CSS oficial de onepiece-cardgame.com scopeado bajo .event-official-content
// (generado por scripts/gen-event-official-css.mjs) para renderizar el
// contenido de detalle scrapeado igual que en el sitio oficial.
import "../event-article-official.css";
import { ReactNode } from "react";

export default function EventSlugLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}

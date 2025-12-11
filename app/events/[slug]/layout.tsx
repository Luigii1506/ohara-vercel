import "../event-global.scss";
import "../event.scss";
import { ReactNode } from "react";

export default function EventSlugLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}

import { redirect } from "next/navigation";

// La vista de EV de sellados se integró al dashboard unificado de mercado.
export default function SealedEvRedirect() {
  redirect("/market");
}

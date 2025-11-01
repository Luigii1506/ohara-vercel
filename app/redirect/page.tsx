"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function PostLoginUpdate() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    // // Espera a que la sesión esté cargada
    // if (status === "loading") return;

    // async function postLoginData() {
    //   try {
    //     if (session) {
    //       const { user } = session; // user contiene name y email
    //       const res = await fetch("/api/admin/user", {
    //         method: "POST",
    //         headers: {
    //           "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //           name: user?.name,
    //           email: user?.email,
    //         }),
    //       });

    //       console.log("res", res);
    //       console.log("user", user);
    //       if (!res.ok) {
    //         console.error(
    //           "Error al actualizar datos post-login:",
    //           res.statusText
    //         );
    //       }
    //     }
    //   } catch (error) {
    //     console.error("Error en la petición post-login:", error);
    //   } finally {
    //     router.replace("/googleSignIn");
    //   }
    // }

    //postLoginData();

    router.replace("/googleSignIn");
  }, [router, session, status]);

  return <div>Actualizando datos... Por favor, espera.</div>;
}

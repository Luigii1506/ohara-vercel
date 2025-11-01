"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Logo from "@/public/assets/images/new_logo.png";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const popupCenter = (url: string, title: string) => {
    const dualScreenLeft = window.screenLeft ?? window.screenX;
    const dualScreenTop = window.screenTop ?? window.screenY;

    const width =
      window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;

    const height =
      window.innerHeight ??
      document.documentElement.clientHeight ??
      screen.height;

    const systemZoom = width / window.screen.availWidth;

    const left = (width - 500) / 2 / systemZoom + dualScreenLeft;
    const top = (height - 550) / 2 / systemZoom + dualScreenTop;

    const newWindow = window.open(
      url,
      title,
      `width=${500 / systemZoom},height=${
        550 / systemZoom
      },top=${top},left=${left}`
    );

    newWindow?.focus();
  };

  // Si la sesión ya existe, cierra el modal automáticamente
  useEffect(() => {
    if (status === "loading") return;
    if (session) {
      onClose();
    }
  }, [session, status, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-none shadow-lg">
        <div className="flex flex-col items-center text-center mb-4">
          <Image
            src={Logo || "/placeholder.svg"}
            height={120}
            width={120}
            alt="logo"
            className="ml-0 md:ml-3 w-[90px] h-fit md:w-[120px]"
          />
        </div>

        <DialogHeader className="space-y-1">
          <DialogTitle className="text-2xl text-center">
            Welcome to OharaTCG
          </DialogTitle>
          <DialogDescription className="text-center">
            Sign in with your social account
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="grid gap-4">
            <Button
              variant="outline"
              className="w-full bg-white text-black border border-gray-300 hover:bg-gray-100 flex items-center justify-center gap-2 py-5"
              onClick={() => popupCenter("/googleSignIn", "Sample Sign In")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="24"
                viewBox="0 0 24 24"
                width="24"
                className="h-5 w-5"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              Continue with Google
            </Button>
            {/* <Button
              variant="outline"
              className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4] flex items-center justify-center gap-2 py-5"
              onClick={() => signIn("discord")}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
              >
                <path
                  d="M19.8437 4.91622C18.4814 4.29926 17.0214 3.84535 15.5 3.58333C15.4779 3.58333 15.4558 3.59444 15.4449 3.61666C15.2664 3.94629 15.0659 4.37407 14.9214 4.71481C13.2977 4.47037 11.6848 4.47037 10.0795 4.71481C9.93491 4.36296 9.72879 3.94629 9.54917 3.61666C9.53825 3.59537 9.51618 3.58333 9.49411 3.58333C7.97269 3.84535 6.51269 4.29926 5.15047 4.91622C5.14064 4.91622 5.13189 4.92407 5.12532 4.93407C1.90547 9.73888 1.00231 14.4241 1.44658 19.0518C1.44767 19.0707 1.45752 19.0885 1.47084 19.0996C3.22973 20.3774 4.93325 21.1707 6.60658 21.6996C6.62865 21.7063 6.65181 21.6974 6.66491 21.6785C7.09825 21.0818 7.48658 20.4529 7.82084 19.7929C7.83613 19.7618 7.82084 19.7252 7.78875 19.7141C7.17658 19.4707 6.59658 19.1741 6.04084 18.8374C6.00547 18.8174 6.00328 18.7663 6.03647 18.7429C6.14658 18.6596 6.25669 18.5718 6.36134 18.4829C6.37662 18.4707 6.39759 18.4674 6.41528 18.4752C10.0357 20.1596 13.9884 20.1596 17.5647 18.4752C17.5824 18.4663 17.6034 18.4696 17.6197 18.4818C17.7243 18.5707 17.8344 18.6596 17.9456 18.7429C17.9788 18.7663 17.9777 18.8174 17.9413 18.8374C17.3855 19.1796 16.8055 19.4707 16.1934 19.7129C16.1613 19.724 16.1471 19.7618 16.1623 19.7929C16.5033 20.4518 16.8917 21.0807 17.3172 21.6774C17.3292 21.6974 17.3534 21.7063 17.3755 21.6996C19.0577 21.1707 20.7612 20.3774 22.5201 19.0996C22.5345 19.0885 22.5433 19.0718 22.5444 19.0529C23.0744 13.6952 21.6534 9.05184 19.8655 4.93518C19.86 4.92407 19.8513 4.91622 19.8437 4.91622ZM8.22047 16.1796C7.11269 16.1796 6.20069 15.1674 6.20069 13.9329C6.20069 12.6985 7.09047 11.6863 8.22047 11.6863C9.36158 11.6863 10.2625 12.7096 10.2403 13.9329C10.2403 15.1674 9.35047 16.1796 8.22047 16.1796ZM15.7914 16.1796C14.6836 16.1796 13.7716 15.1674 13.7716 13.9329C13.7716 12.6985 14.6614 11.6863 15.7914 11.6863C16.9325 11.6863 17.8334 12.7096 17.8112 13.9329C17.8112 15.1674 16.9325 16.1796 15.7914 16.1796Z"
                  fill="white"
                />
              </svg>
              Continue with Discord
            </Button> */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import SignInButton from "./SignInButton";
import { useSession } from "next-auth/react";
import Image from "next/image";

const UserInfo = () => {
  const { status, data: session } = useSession();

  if (status === "authenticated") {
    return (
      <div className="shadow-xl p-8 rounded-md flex flex-col gap-3 bg-yellow-200 w-[500px] justify-center items-center">
        <Image
          src={session?.user?.image || ""}
          alt="user"
          className="rounded-full"
          width={40}
          height={40}
        />
        <div>
          Name: <span className="font-bold">{session?.user?.name}</span>{" "}
        </div>
        <div>
          Email: <span className="font-bold">{session?.user?.email}</span>{" "}
        </div>
      </div>
    );
  } else {
    return <SignInButton />;
  }
};

export default UserInfo;

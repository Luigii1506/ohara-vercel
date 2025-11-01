"use client";

import { signIn } from "next-auth/react";

const SignInButton = () => {
  return (
    <button
      className={"py-4 bg-[#938156] w-[200px] rounded-lg text-[#FAF9F3] shadow-md mb-8 hover:bg-[#c9ae6e] title border-2 border-[#faf9f3]"}
      onClick={() => signIn("google")}
    >
      Sign in with Google
    </button>
  );
};

export default SignInButton;

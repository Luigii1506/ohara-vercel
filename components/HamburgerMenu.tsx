import React, { useEffect, useRef } from "react";
import Link from "next/link";
import Bars from "./Icons/Bars";
import Logo from "@/public/assets/images/new_logo.png";
import Image from "next/image";

interface HamburgerMenuProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isOpen, setIsOpen }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [setIsOpen]);

  return (
    <div className="fixed top-0 left-0 w-full z-50 h-[80px] flex justify-start items-center">
      <button
        className="p-4"
        onClick={() => setIsOpen(true)}
        aria-label="Toggle menu"
      >
        <Bars />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="bg-[#faf9f3] text-white fixed top-0 left-0 w-64 h-full"
        >
          <div className="flex w-ful justify-between">
            <button
              className="p-4 mt-[7px]"
              onClick={() => setIsOpen(false)}
              aria-label="Toggle menu"
            >
              <Bars />
            </button>
            {/* <div className="flex flex-1 justify-center items-center">
              <Image src={Logo} height={100} width={100} alt="logo" />
            </div> */}
          </div>

          <nav className="flex flex-col">
            <Link
              href="/"
              className="mb-4 p-2 text-[#928157] rounded font-bold border-b border-[#928157]"
            >
              Home
            </Link>
            <Link
              href="/cardList"
              className="mb-4 p-2 text-[#928157] rounded font-bold border-b border-[#928157]"
            >
              Card list
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
};

export default HamburgerMenu;

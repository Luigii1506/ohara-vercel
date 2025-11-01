import Link from "next/link";
import ChestIcon from "@/components/Icons/ChestIcon";
import ScrollIcon from "@/components/Icons/ScrollIcon";
import CompassIcon from "@/components/Icons/CompassIcon";

const SideNav = () => {
  return (
    <div className="side-nav sm:w-full bg-[#faf9f3] relative md:hidden ">
      <nav className="flex justify-evenly md:hidden border-t border-[#938156]">
        {/* Home */}
        <Link
          href="/"
          className="w-1/3 p-2 text-[#928157] md:flex md:flex-row md:items-center font-bold border-b hover:bg-[#C6C5BA] hover:text-[#FAF9F3] flex flex-col items-center gap-2 md:gap-4"
        >
          <div>
            <ChestIcon />
          </div>

          <span className={"text-sm md:text-lg"}>Home</span>
        </Link>

        {/* Card List */}
        <Link
          href="/cardList"
          className="w-1/3 p-2 text-[#928157] md:flex md:flex-row md:items-center font-bold border-b hover:bg-[#C6C5BA] hover:text-[#FAF9F3] flex flex-col items-center gap-2 md:gap-4"
        >
          <div>
            <ScrollIcon />
          </div>
          <span className={"text-sm md:text-lg"}>Card list</span>
        </Link>

        {/* Card Codes*/}
        {/* <Link
          href="/codeList"
          className="w-1/3 p-2 text-[#928157] md:flex md:flex-row md:items-center font-bold border-b hover:bg-[#C6C5BA] hover:text-[#FAF9F3] flex flex-col items-center gap-2 md:gap-4"
        >
          <div>
            <CompassIcon />
          </div>
          <span className={"text-sm md:text-lg"}>Card codes</span>
        </Link> */}
      </nav>
    </div>
  );
};

export default SideNav;

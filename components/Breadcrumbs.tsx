import Link from "next/link";
import { usePathname } from "next/navigation";

function splitAndCapitalize(str: string): string {
  return str
    .split(/(?=[A-Z])|\-|\_/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export default function Breadcrumb() {
  const pathname = usePathname();
  const pathSegments =
    pathname?.split("/").filter((segment) => segment !== "") || [];

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm text-gray-500 mb-2 ml-2">
        <li>
          <Link href="/" className="hover:text-black text-[#938156]">
            Home
          </Link>
        </li>
        {pathSegments.map((segment, index) => {
          const href = `/${pathSegments.slice(0, index + 1).join("/")}`;
          const isLast = index === pathSegments.length - 1;
          const label = splitAndCapitalize(segment);

          return (
            <li key={href} className="flex items-center">
              <span className="mx-2 text-[#938156]">/</span>
              {isLast ? (
                <span className="font-bold text-[#938156]" aria-current="page">
                  {label}
                </span>
              ) : (
                <Link href={href} className="hover:text-black text-[#938156]">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

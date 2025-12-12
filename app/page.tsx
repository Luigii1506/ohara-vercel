import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value) {
      params.set(key, value);
    }
  }

  const queryString = params.toString();
  redirect(queryString ? `/card-list?${queryString}` : "/card-list");
}

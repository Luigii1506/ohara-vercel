// app/page.tsx
import CardList from "@/app/card-list/page";

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default async function HomePage({ searchParams }: PageProps) {
  return <CardList searchParams={searchParams} />;
}

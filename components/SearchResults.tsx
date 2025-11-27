interface SearchResultsProps {
  count: number;
  uniqueCount?: number;
  showResult?: boolean;
}

export default function SearchResults({
  count = 0,
  uniqueCount,
  showResult = false,
}: SearchResultsProps) {
  const showUniqueCount =
    typeof uniqueCount === "number" && uniqueCount > 0 && uniqueCount !== count;

  return (
    <div className=" flex justify-between items-center">
      {showResult && (
        <p className="!text-sm text-muted-foreground md:text-lg">
          <span className="font-semibold text-foreground mr-1">
            {count.toLocaleString()}
          </span>
          <span>{count === 1 ? "result" : "results"}</span>
        </p>
      )}
    </div>
  );
}

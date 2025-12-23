interface SearchResultsProps {
  count: number;
  uniqueCount?: number;
  totalCount?: number;
  showResult?: boolean;
}

export default function SearchResults({
  count = 0,
  uniqueCount,
  totalCount,
  showResult = false,
}: SearchResultsProps) {
  const showUniqueCount =
    typeof uniqueCount === "number" && uniqueCount > 0 && uniqueCount !== count;

  return (
    <div className=" flex justify-between items-center gap-2">
      {showResult && (
        <p className="!text-sm text-muted-foreground md:text-lg flex items-center gap-2">
          {typeof totalCount === "number" && totalCount !== count && (
            <span className="font-semibold text-foreground mr-1">
              {totalCount.toLocaleString()}
            </span>
          )}
          <span>{count === 1 ? "result" : "results"}</span>
        </p>
      )}
    </div>
  );
}

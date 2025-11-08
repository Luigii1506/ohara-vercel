interface SearchResultsProps {
  count: number;
  totalWithAlternates?: number;
  showResult: boolean;
}

export default function SearchResults({
  count = 0,
  totalWithAlternates,
  showResult = false,
}: SearchResultsProps) {
  const showAlternatesCount =
    totalWithAlternates && totalWithAlternates > count;

  return (
    <div className=" flex justify-between items-center">
      {showResult && (
        <p className="!text-sm text-muted-foreground md:text-lg">
          {showAlternatesCount && (
            <span className="font-medium text-foreground">
              {totalWithAlternates.toLocaleString()}
            </span>
          )}{" "}
          <span>{count === 1 ? "result " : "results "} </span>
        </p>
      )}
    </div>
  );
}

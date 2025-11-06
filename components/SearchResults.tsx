interface SearchResultsProps {
  count: number;
  totalWithAlternates?: number;
}

export default function SearchResults({ count = 0, totalWithAlternates }: SearchResultsProps) {
  const showAlternatesCount = totalWithAlternates && totalWithAlternates > count;

  return (
    <div className=" flex justify-between items-center">
      <p className="!text-sm text-muted-foreground md:text-lg">
        <span className="font-medium text-foreground">
          {count.toLocaleString()}
        </span>{" "}
        <span>{count === 1 ? "result " : "results "} </span>
        {showAlternatesCount && (
          <span className="text-xs">
            ({totalWithAlternates.toLocaleString()} with variants)
          </span>
        )}
        <span className="hidden sm:inline-block"> in One Piece Card Game</span>
      </p>
    </div>
  );
}

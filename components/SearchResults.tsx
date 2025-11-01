interface SearchResultsProps {
  count: number;
}

export default function SearchResults({ count = 0 }: SearchResultsProps) {
  return (
    <div className=" flex justify-between items-center">
      <p className="!text-sm text-muted-foreground md:text-lg">
        <span className="font-medium text-foreground">
          {count.toLocaleString()}
        </span>{" "}
        <span>{count === 1 ? "result " : "results "} </span>
        <span className="hidden sm:inline-block">in One Piece Card Game</span>
      </p>
    </div>
  );
}

import SearchIcon from "../components/Icons/SearchIcon";
interface InputSearchBarProps {
  setSearch: (value: string) => void;
  search: string;
}

const InputSearchBar = ({ setSearch, search }: InputSearchBarProps) => {
  return (
    <div className="md:w-[75%] flex items-center bg-white rounded-full border-2 border-[#928157] shadow-lg">
      <input
        type="text"
        placeholder="Search from cardlist"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full pl-4 rounded-full bg-white text-xs md:text-lg focus:outline-none text-[#928157]"
      />
      <div className="p-[10px] m-1 bg-[#928157] rounded-full flex justify-center items-center">
        <SearchIcon size="16px" />
      </div>
    </div>
  );
};

export default InputSearchBar;

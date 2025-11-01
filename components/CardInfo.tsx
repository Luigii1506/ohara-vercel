import { CardWithCollectionData } from "@/types";

interface CardInfoProps {
  selectedCard: CardWithCollectionData | undefined;
  colorsArray?: string[];
  typeArray?: string[];
  textArray?: string[];
  setsArray?: string[];
}

const CardInfo: React.FC<CardInfoProps> = ({
  selectedCard,
  colorsArray,
  typeArray,
  textArray,
  setsArray,
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 max-h-auto lg:max-h-[520px] overflow-auto">
      <div className="grid grid-cols-2 gap-4">
        {selectedCard && selectedCard.cost && (
          <div>
            <h3 className="text-xl font-bold">Cost</h3>
            <p className="text-md">{selectedCard.cost}</p>
          </div>
        )}

        {selectedCard && selectedCard.life && (
          <div>
            <h3 className="text-xl font-bold">Life</h3>
            <p className="text-md">{selectedCard.life}</p>
          </div>
        )}
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            Attribute
          </h3>
          {selectedCard?.attribute ? (
            <span className="inline-block bg-blue-500 text-white px-2 py-1 text-sm rounded">
              {selectedCard?.attribute}
            </span>
          ) : (
            <p className="text-md">-</p>
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold">Powers</h3>
          <p className="text-md">
            {selectedCard?.power
              ? selectedCard?.power?.replace("Power", "")
              : "-"}
          </p>
        </div>
        <div>
          <h3 className="text-xl font-bold">Counter</h3>
          <p className="text-md">{selectedCard?.counter ?? "-"}</p>
        </div>
      </div>
      <div>
        <h3 className="text-xl font-bold">Colors</h3>
        <p className="text-md">
          {colorsArray?.map((color, index) => (
            <span key={index} className="inline-block px-2 py-1 text-md">
              {"○ " + color}
            </span>
          ))}
        </p>
      </div>
      <div>
        <h3 className="text-xl font-bold">Type</h3>
        <p className="text-md">
          {typeArray?.map((type, index) => (
            <span key={index} className="inline-block px-2 py-1 text-md">
              {"○ " + type}
            </span>
          ))}
        </p>
      </div>
      <div>
        <h3 className="text-xl font-bold">Effect</h3>
        <div className="space-y-2">
          {textArray?.map((text, index) => (
            <p key={index} className="text-md">
              {text}
            </p>
          ))}
        </div>
      </div>
      <div className="bg-gray-100 p-4 rounded-lg">
        <h3 className="text-xl font-bold mb-2">Card Set(s)</h3>
        {setsArray?.map((set, index) => (
          <p key={index} className="text-md">
            {set}
          </p>
        ))}
      </div>
    </div>
  );
};

export default CardInfo;

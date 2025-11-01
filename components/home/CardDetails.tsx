import Card from "@/components/Card";
import React from "react";

interface CardDetailsProps {
  card: {
    cardId: {
      _id: string;
      src: string;
      name: string;
      code: string;
      category: string;
      colors: string[];
      life?: number;
      cost?: number;
      power?: number;
      attribute?: string;
      counter?: string;
      texts?: string[];
      effects: string[];
      types: string[];
    };
  };
}

const CardDetails: React.FC<CardDetailsProps> = ({ card }) => {
  return (
    <div
      key={card.cardId._id}
      className="w-full flex flex-col gap-4 md:gap-8 border-b pb-8 border-b-[#938156]"
    >
      {/* Picture and table */}
      <div className={"flex gap-4 md:gap-8"}>
        {/* Thumbnail */}
        <div className={"w-1/2 md:w-auto"}>
          <Card src={card.cardId.src} />
        </div>
        {/* Title and Table*/}
        <div className={"w-1/2 md:w-auto"}>
          {/* Title*/}
          <div className="flex flex-col md:flex-row  justify-start items-center gap-1 md:gap-3 mb-2">
            <div className="text-lg font-bold title">{card.cardId.name}</div>
            <div>({card.cardId.code})</div>
          </div>
          {/* Table*/}
          <table className="w-full md:w-[300px] bg-[#FAF9F3] border-collapse text-xs md:text-lg mb-4">
            <tbody>
              {/* Row type */}
              <tr>
                <td className="p-2 border border-[#938156] font-bold">Type:</td>
                <td className="p-2 text-md border border-[#938156]">
                  {card.cardId.category}
                </td>
              </tr>
              {/* Row Color */}
              <tr>
                <td className="p-2 border border-[#938156] font-bold">
                  Color:
                </td>
                <td className="p-2 border border-[#938156]">
                  {card.cardId.colors.map((color, index) => (
                    <span key={color}>
                      {color}
                      {index < card.cardId.colors.length - 1 && "/"}
                    </span>
                  ))}
                </td>
              </tr>
              {/* Row Life */}
              <tr>
                <td className="p-2 border border-[#938156] font-bold">Life:</td>
                <td className="p-2 border border-[#938156]">
                  {card.cardId.category === "Leader" ? (
                    <span>{card.cardId.life}</span>
                  ) : (
                    <span>{card.cardId.cost}</span>
                  )}
                </td>
              </tr>

              {/* Conditional Rows */}
              {card.cardId.category !== "Event" && (
                <>
                  {/* Row Attack */}
                  <tr>
                    <td className="p-2 border border-[#938156] font-bold">
                      Attack:
                    </td>
                    <td className="p-2 border border-[#938156]">
                      {card.cardId.power}
                    </td>
                  </tr>
                  {/* Row Attribute */}
                  <tr>
                    <td className="p-2 border border-[#938156] font-bold">
                      Attribute:
                    </td>
                    <td className="p-2 border border-[#938156]">
                      {card.cardId.attribute}
                    </td>
                  </tr>
                  {/* Row Counter */}
                  {card.cardId.counter && (
                    <tr>
                      <td className="p-2 border border-[#938156] font-bold">
                        Counter
                      </td>
                      <td className="p-2 border border-[#938156]">
                        {card.cardId.counter}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Card Effects */}
      <div>
        <div className="flex justify-start items-start gap-3 flex-col">
          {card.cardId.texts?.map((text) => (
            <div key={text}>
              <p className="whitespace-pre-line">
                {card.cardId.effects.map((effect) => (
                  <span
                    className={
                      "text-white text-sm bg-[#938156] p-1 mr-2 rounded"
                    }
                  >
                    {effect}
                  </span>
                ))}
                {text}
              </p>
            </div>
          ))}
        </div>
        <div className="flex justify-start items-center">
          {card.cardId.types.map((type, index) => (
            <span key={type}>
              {type}
              {index < card.cardId.types.length - 1 && "/"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
export default CardDetails;

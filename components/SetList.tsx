import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Set } from "@/types";

const SetList = () => {
  const [sets, setSets] = useState<Set[]>([]);

  useEffect(() => {
    const fetchSets = async () => {
      try {
        const res = await fetch("/api/sets", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch sets");
        }

        const data = await res.json();
        setSets(data.sets);
      } catch (error) {
        console.error(error);
      }
    };

    fetchSets();
  }, []);

  return (
    <div className="grid grid-cols-4 gap-3 justify-center items-center px-4">
      {sets.map((set) => (
        <Link href={`/cardList/${set.id}`}>
          <div
            key={set.id}
            className="bg-red-300 h-[150px] rounded-lg flex justify-center items-center cursor-pointer flex-col"
          >
            <div className="font-bold">{set.title}</div>
            <div>({set.code})</div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default SetList;

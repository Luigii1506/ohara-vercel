"use client";
import React, { useEffect } from "react";
import { setCodes, standarDecks } from "@/helpers/constants";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs";

const Home = () => {
  return (
    <div
      className="bg-[#f2eede] p-4 pt-8 md:p-16 overflow-y-scroll flex-1"
      style={{
        backgroundImage: "url('/assets/images/Map_15.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      {/*  Code Cards Collection */}
      <div className={"flex flex-col gap-8 mb-16"}>
        {/* Title */}
        <div>
          <Breadcrumb />
          <h2 className="title text-lg md:text-3xl md:mb-14 text-[#938156] text-center md:text-left border-b-2 border-[#938156] pb-2">
            CARD CODES
          </h2>
        </div>

        {/* Body */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 justify-center items-center">
          {setCodes.map((set, index) => (
            <Link
              href={`/codeList/${set}`}
              className={`${set + "_BG"} rounded-lg`}
            >
              <div
                key={set + "_" + index}
                className="h-[150px] md:h-[100px] lg:h-[230px] rounded-lg flex justify-center items-center cursor-pointer flex-col text-2xl font-bold"
              >
                <div className="text-[#FFFFFF] mb-2 text-[3rem] shadow-text">{set}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/*  Standard Decks Collections */}
      <div className={"flex flex-col gap-8"}>
        {/* Title */}
        <h2 className="title text-lg md:text-3xl md:mb-14 text-[#938156] text-center md:text-left border-b-2 border-[#938156] pb-2">
          STANDARD DECKS
        </h2>
        {/* Body */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 justify-center items-center">
          {standarDecks.map((set, index) => (
            <Link
              href={`/codeList/${set}`}
              className={`${set + "_BG"} rounded-lg`}
            >
              <div
                key={set + "_" + index}
                className="h-[150px] md:h-[100px] lg:h-[230px] rounded-lg flex items-center justify-center cursor-pointer flex-col text-2xl font-bold"
              >
                <div className="text-[#FFFFFF] mb-2 text-[3rem] shadow-text">{set}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;

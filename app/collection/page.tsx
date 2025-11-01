"use client";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { UserCollection } from "@/types";

import Card from "@/components/Card";
import CollectionForm from "@/components/CollectionForm";
import { useUser } from "@/app/context/UserContext";
import { TableSkeleton } from "@/components/skeletons";

import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import SearchFilters from "@/components/home/SearchFilters";
import Logo from "@/public/assets/images/new_logo.png";

const Collection = () => {
  const [isCollectionCreated, setIsCollectionCreated] = useState(false);
  const [myCollection, setMyCollection] = useState<UserCollection>();
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const { userId } = useUser();
  const [search, setSearch] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState("");

  useEffect(() => {
    if (userId === "") {
      setLoading(false);
      return;
    }
    const fetchCollection = async () => {
      const id = userId;
      try {
        const res = await fetch(`/api/collection/${id}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch sets");
        }

        const data = await res.json();

        setMyCollection(data.collection);
        setIsCollectionCreated(true);
        setCollectionLoading(false);
        setLoading(false);
      } catch (error) {
        setIsCollectionCreated(false);
        setCollectionLoading(false);
        setLoading(false);
        console.error(error);
      }
    };

    fetchCollection();
  }, [userId]);

  if (loading || collectionLoading) {
    return (
      <div
        className="bg-[#f2eede] p-4 pt-8 md:p-16 overflow-y-scroll w-full flex justify-center items-center"
        style={{
          backgroundImage: "url('/assets/images/Map_15.png')",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      >
        <div className="max-w-6xl mx-auto">
          <TableSkeleton rows={10} columns={5} />
        </div>
      </div>
    );
  }

  return (
    <section
      className="bg-[#f2eede] p-4 pt-8 md:p-16 overflow-y-scroll w-full"
      style={{
        backgroundImage: "url('/assets/images/Map_15.png')",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <>
        {userId && (
          <h1
            className={
              "title text-lg md:text-3xl mb-8 md:mb-14 text-[#938156] text-center md:text-right"
            }
          >
            COLLECTION
          </h1>
        )}

        {!userId && (
          <div className="relative flex justify-center items-center flex-1 h-full">
            <main className="relative z-10 flex flex-col items-center justify-center px-4 text-center">
              <div className="bg-black rounded-lg p-3 mb-5">
                <Image
                  src={Logo}
                  height={250}
                  width={250}
                  alt="logo"
                  className="ml-3 invert"
                />
              </div>

              <h1 className="text-4xl md:text-6xl font-bold text-black mb-8">
                Welcome to One Piece Card Collection
              </h1>
              <p className="text-xl text-black mb-12 max-w-2xl">
                Join our community of collectors and showcase your favorite One
                Piece trading cards. Sign in to start your adventure!
              </p>
              <Button
                size="lg"
                className="bg-white text-black hover:bg-white/90"
                onClick={() => signIn("google")}
              >
                <LogIn className="w-5 h-5 mr-2" />
                Sign in with Google
              </Button>
            </main>
          </div>
        )}

        {userId && (
          <>
            {/* <SearchFilters
              search={search}
              setSearch={setSearch}
              selectedColor={selectedColor}
              setSelectedColor={setSelectedColor}
            /> */}

            {isCollectionCreated ? (
              <div className={"flex flex-col gap-12 justify-center"}>
                {myCollection &&
                  myCollection?.cards.map((card) => (
                    <div
                      key={card.cardId._id}
                      className="flex flex-col md:flex-row w-full gap-5 border-b border-[#938156] pb-8"
                    >
                      {/* Title Mobile*/}
                      <div className="md:hidden justify-center items-center gap-3 mb-2">
                        <div className="text-lg font-bold title">
                          {card.cardId.name}
                        </div>
                        <div>({card.cardId.code})</div>
                      </div>

                      <div className="cursor-pointer flex justify-center items-center">
                        <div
                          className={`card charizard w-full h-[400px] lg:w-[245px] lg:h-[342px] !bg-contain sm:!bg-cover !bg-[#f2eede]`}
                          //ref={cardRef}
                          style={{
                            backgroundImage: `url(${card.cardId.src})`,
                          }}
                        ></div>
                      </div>

                      {/* Card Info */}
                      <div className="flex-1">
                        {/* Title*/}
                        <div className="md:flex justify-start hidden items-center gap-3 mb-2">
                          <div className="text-lg font-bold title">
                            {card.cardId.name}
                          </div>
                          <div>({card.cardId.code})</div>
                        </div>

                        {/* Table*/}
                        <table className="w-full md:w-[300px] bg-[#FAF9F3] border-collapse text-md mb-4">
                          <tbody>
                            {/* Row type */}
                            <tr>
                              <td className="p-2 border border-[#938156] font-bold">
                                Type:
                              </td>
                              <td className="p-2 text-md border border-[#938156]">
                                {card.cardId.category}
                              </td>
                            </tr>
                            {/* Row Color */}
                            <tr>
                              <td className="p-2 border border-[#938156] font-bold">
                                Color:
                              </td>
                              {/* <td className="p-2 border border-[#938156]">
                                {card.cardId.colors.map((color, index) => (
                                  <span key={color}>
                                    {color}
                                    {index < card.cardId.colors.length - 1 &&
                                      "/"}
                                  </span>
                                ))}
                              </td> */}
                            </tr>
                            {/* Row Life */}
                            <tr>
                              <td className="p-2 border border-[#938156] font-bold">
                                Life:
                              </td>
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

                        {/* Card Text 1*/}
                        <div className="flex justify-start items-start gap-3 flex-col">
                          {/* {card.cardId.texts?.map((text) => (
                            <div key={text.text} className={"md:font-bold"}>
                              {card.cardId.effects?.map((effect) => (
                                <span
                                  className={
                                    "bg-[#9D8957] p-1 rounded-sm font-bold text-white text-sm mr-2"
                                  }
                                >
                                  {effect}
                                </span>
                              ))}
                              {text.text}
                            </div>
                          ))} */}
                        </div>

                        {/* Card Text 2*/}
                        {/* <div className="flex justify-start items-center">
                          {card.cardId.types.map((type, index) => (
                            <span key={type}>
                              {type}
                              {index < card.cardId.types.length - 1 && "/"}
                            </span>
                          ))}
                        </div> */}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <CollectionForm
                userId={userId || ""}
                setIsCollectionCreated={setIsCollectionCreated}
              />
            )}
          </>
        )}
      </>
    </section>
  );
};
export default Collection;

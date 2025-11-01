"use client";

import React from "react";
import "react-responsive-carousel/lib/styles/carousel.min.css"; // requires a loader
import { Carousel } from "react-responsive-carousel";
import Image from "next/image";

const heroImages = [
  {
    imgUrl: "https://static.dotgg.gg/onepiece/card/OP02-013_p2.webp",
    alt: "smartwatch",
  },
  {
    imgUrl: "https://static.dotgg.gg/onepiece/card/OP03-114_p3.webp",
    alt: "bag",
  },
  {
    imgUrl: "https://static.dotgg.gg/onepiece/card/P-041.webp",
    alt: "lamp",
  },
  {
    imgUrl: "https://static.dotgg.gg/onepiece/card/OP06-118_p1.webp",
    alt: "air fryer",
  },
  {
    imgUrl: "https://static.dotgg.gg/onepiece/card/OP01-016_p2.webp",
    alt: "chair",
  },
];

const HeroCarousel = () => {
  return (
    <div className="hero-carousel">
      <Carousel
        showThumbs={false}
        infiniteLoop={true}
        autoPlay={true}
        showArrows={false}
        showStatus={false}
        interval={2000}
      >
        {heroImages.map((image) => (
          <Image
            src={image.imgUrl}
            alt={image.alt}
            width={484}
            height={484}
            className="object-contain"
            key={image.alt}
          />
        ))}
      </Carousel>

      <Image
        src={"/assets/icons/hand-drawn-arrow.svg"}
        alt="arrow"
        height={175}
        width={175}
        className="max-xl:hidden absolute -left-[15%] bottom-0 z-0"
      />
    </div>
  );
};

export default HeroCarousel;

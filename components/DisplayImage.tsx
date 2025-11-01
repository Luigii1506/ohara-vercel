import Image from "next/image";
import React from "react";

interface DisplayImageProps {
  src: string;
  alt: string;
}

const DisplayImage: React.FC<DisplayImageProps> = ({ src, alt }) => {
  return (
    <>
      <Image
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        width={245}
        height={342}
      />
      <div className="absolute top-0 left-0 w-full h-full secret-rare-effect pointer-events-none"></div>
    </>
  );
};

export default DisplayImage;

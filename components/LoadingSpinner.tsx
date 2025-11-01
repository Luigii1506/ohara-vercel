import Image from "next/image";
import luffy from "@/public/assets/images/LuffyLoader.gif";

interface LoadingSpinnerProps {
  bg?: string;
  color?: string;
}

const LoadingSpinner = ({ bg, color }: LoadingSpinnerProps) => {
  return (
    <div className={`flex justify-center items-center flex-1 flex-col gap-2 `}>
      <Image
        src={luffy}
        alt="Luffy from One Piece"
        width={150}
        height={150}
        priority
        className={"drop-shadow-lg"}
      />
    </div>
  );
};

export default LoadingSpinner;

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Eye from "@/public/assets/images/EYE_FILTER.svg";

import { FC } from "react";

interface CustomSwitchProps {
  label: string;
  isChecked: boolean;
  setIsChecked: (value: boolean) => void;
}

const CustomSwitch: FC<CustomSwitchProps> = ({
  label,
  isChecked,
  setIsChecked,
}) => {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg bg-white hover:bg-gray-100 px-3 py-2 shadow-sm w-max border-input border ${
        isChecked && "border-[#2463eb]"
      }`}
    >
      {/* <Switch
        checked={isChecked}
        onCheckedChange={setIsChecked}
        id="personalised"
        className="h-6 w-11 rounded-full bg-gray-200 transition-colors duration-200 ease-in-out data-[state=checked]:bg-[#2463eb] border-[6px]"
      /> */}
      <img src={Eye.src} alt="eye" className="h-6 w-6" />
      {/* <Label
        htmlFor="personalised"
        className="text-base font-normal cursor-pointer"
      >
        {label}
      </Label> */}
    </div>
  );
};

export default CustomSwitch;

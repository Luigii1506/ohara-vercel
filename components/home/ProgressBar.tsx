import { useState } from "react";

const ProgressBar = () => {
    const [progress, setProgress] = useState(90);

    return (
        <div className={"w-full"}>
            {/* Title */}
            <div className={"flex justify-between"}>
                <p className={"text-sm text-[#9d8957] translate-y-[-6px]"}>Completion bar</p>
                <p className={"text-sm text-[#9d8957] translate-y-[-6px] font-black"}> {progress}%/100</p>
            </div>

            {/* Bar */}
            <div className=" border border-[#9d8957] bg-[#F2EEDE] h-6 rounded-md shadow-md">
                {/* Progress */}
                <div
                    className="h-full bg-[#9d8957] flex rounded-sm"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

export default ProgressBar;

import React from "react";

interface FolderTabProps {
  label: string;
  className?: string;
}

export const FolderTab: React.FC<FolderTabProps> = ({
  label,
  className = "",
}) => {
  return (
    <div className={`absolute -top-6 left-6 z-20 hidden md:block ${className}`}>
      {/* Tab Base */}
      <div
        className="relative bg-gradient-to-b from-amber-50 to-amber-100 border border-amber-200 border-b-0 shadow-lg"
        style={{
          clipPath: "polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%)",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingTop: "8px",
          paddingBottom: "12px",
          minWidth: "80px",
        }}
      >
        {/* Tab Content */}
        <div className="flex items-center gap-2">
          {/* Small folder icon */}
          <div className="text-amber-600 text-xs">📂</div>

          {/* Label */}
          <span className="text-xs font-mono font-medium text-amber-800 uppercase tracking-wide">
            {label}
          </span>
        </div>

        {/* Subtle inner shadow for depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 50%, rgba(0, 0, 0, 0.05) 100%)",
            clipPath:
              "polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%)",
          }}
        />

        {/* Small adhesive tape effect */}
        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-2 bg-yellow-200/60 rounded-sm border border-yellow-300/40" />
      </div>

      {/* Drop shadow */}
      <div
        className="absolute top-0 left-0 bg-black/10 -z-10"
        style={{
          clipPath: "polygon(8px 0%, calc(100% - 8px) 0%, 100% 100%, 0% 100%)",
          width: "100%",
          height: "100%",
          transform: "translate(2px, 2px)",
        }}
      />
    </div>
  );
};

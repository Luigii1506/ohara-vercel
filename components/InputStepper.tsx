import React from "react";

interface InputStepperProps {
  value: number;
  setValue: (value: number) => void;
}

const InputStepper: React.FC<InputStepperProps> = ({ value, setValue }) => {
  // Función para asegurar que el valor mínimo sea 0
  const handleDecrement = () => {
    if (value > 0) {
      setValue(value - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = Number(e.target.value);
    setValue(inputValue < 0 ? 0 : inputValue); // Prevenir valores negativos
  };

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        onClick={handleDecrement}
        className="bg-black text-white w-[40px] h-[40px] rounded-lg flex items-center justify-center"
      >
        -
      </button>
      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        className="bg-[#f2eede] w-[72px] h-[40px] text-center border-[2px] border-gray-200 rounded-lg text-white"
        style={{
          appearance: "textfield",
          MozAppearance: "textfield",
          WebkitAppearance: "none",
        }}
        min="0" // Evitar que el usuario ingrese números negativos desde el input
      />
      <button
        onClick={() => setValue(value + 1)}
        className="bg-green-500 text-white w-[40px] h-[40px] rounded-lg flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
};

export default InputStepper;

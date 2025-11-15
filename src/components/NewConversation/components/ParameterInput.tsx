import type { ChangeEvent } from "react";
import { Info } from "lucide-react";

interface ParameterInputProps {
  label: string;
  helpText: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  isInteger?: boolean;
}

export function ParameterInput({
  label,
  helpText,
  value,
  onChange,
  min,
  max,
  step,
  disabled = false,
  isInteger = false,
}: ParameterInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const parsed = isInteger
      ? parseInt(e.target.value, 10)
      : parseFloat(e.target.value);
    onChange(parsed);
  };

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <label className="block text-xs text-gray-600 dark:text-gray-400">
          {label}
        </label>
        <div className="group relative">
          <Info
            size={12}
            className="text-gray-400 dark:text-gray-500 cursor-help"
          />
          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-48 p-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg z-10">
            {helpText}
          </div>
        </div>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        disabled={disabled}
      />
    </div>
  );
}

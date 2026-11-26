"use client";

import React from "react";
import { Check } from "lucide-react";

interface RadioOption {
  label: string;
  value: boolean;
}

interface BooleanRadioGroupProps {
  value: boolean;
  onChange: (value: boolean) => void;
  options: RadioOption[];
  name?: string;
}

export function BooleanRadioGroup({ value, onChange, options, name }: BooleanRadioGroupProps) {
  return (
    <div role="radiogroup" aria-label={name} className="space-y-2">
      {options.map((option) => {
        const isSelected = Boolean(value) === Boolean(option.value);
        const key = String(option.value);

        return (
          <div
            key={key}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onChange(option.value);
              }
            }}
            className="flex items-center space-x-2.5 cursor-pointer select-none"
          >
            <div
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-gray-400 dark:border-gray-500 bg-background hover:border-primary"
              }`}
            >
              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
            </div>

            <span className="text-sm font-medium text-foreground">{option.label}</span>
          </div>
        );
      })}
    </div>
  );
}
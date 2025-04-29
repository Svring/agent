"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LucideIcon } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

type Option = { label: string; value: string };

interface ISelectProps {
  label: string;
  icon: LucideIcon;
  options: Option[];
  selectedOptions: string[];
  setSelectedOptions: Dispatch<SetStateAction<string[]>>;
}

const MultiSelect = ({
  label,
  icon: Icon,
  options: values,
  selectedOptions: selectedItems,
  setSelectedOptions: setSelectedItems,
}: ISelectProps) => {

  const handleSelectChange = (value: string) => {
    if (!selectedItems.includes(value)) {
      setSelectedItems((prev) => [...prev, value]);
    } else {
      const referencedArray = [...selectedItems];
      const indexOfItemToBeRemoved = referencedArray.indexOf(value);
      referencedArray.splice(indexOfItemToBeRemoved, 1);
      setSelectedItems(referencedArray);
    }
  };

  const isOptionSelected = (value: string): boolean => {
    return selectedItems.includes(value) ? true : false;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs flex items-center space-x-1">
            <Icon className="h-4 w-4 opacity-80" />
            <span>{label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-auto"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {values.map((value: ISelectProps["options"][0], index: number) => {
            return (
              <DropdownMenuCheckboxItem
                className="text-xs"
                onSelect={(e) => e.preventDefault()}
                key={index}
                checked={isOptionSelected(value.value)}
                onCheckedChange={() => handleSelectChange(value.value)}
              >
                {value.label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default MultiSelect;
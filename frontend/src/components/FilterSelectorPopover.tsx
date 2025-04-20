'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FilterOption {
  code: string;
  description: string;
}

interface FilterSelectorPopoverProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxDisplay?: number;
}

export default function FilterSelectorPopover({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...',
  disabled = false,
  className,
  maxDisplay = 2,
}: FilterSelectorPopoverProps) {
  const [open, setOpen] = React.useState(false);

  // Sort options alphabetically by description
  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) => a.description.localeCompare(b.description));
  }, [options]);

  // Function to handle toggling a value
  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  // Get descriptions of selected items
  const selectedLabels = selectedValues
    .map((value) => options.find((option) => option.code === value)?.description || value)
    .slice(0, maxDisplay);

  // Create display text with selected values
  const displayText = selectedValues.length > 0
    ? (
      <>
        {selectedLabels.join(', ')}
        {selectedValues.length > maxDisplay && ` +${selectedValues.length - maxDisplay} more`}
      </>
    )
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-sm font-normal h-9",
            selectedValues.length > 0 ? "text-foreground" : "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
          <CommandGroup>
            <ScrollArea className="h-60">
              {sortedOptions.map((option) => {
                const isSelected = selectedValues.includes(option.code);
                return (
                  <CommandItem
                    key={option.code}
                    onSelect={() => {
                      toggleValue(option.code);
                    }}
                    className="cursor-pointer"
                  >
                    <div className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                      isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="flex-1 text-sm">{option.description}</span>
                    <span className="text-xs text-muted-foreground">{option.code}</span>
                  </CommandItem>
                );
              })}
            </ScrollArea>
          </CommandGroup>
          {selectedValues.length > 0 && (
            <div className="border-t p-2">
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedValues.map((value) => {
                  const option = options.find((o) => o.code === value);
                  return (
                    <Badge key={value} variant="secondary" className="text-xs">
                      {option?.description || value}
                      <button
                        className="ml-1 rounded-full outline-none"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleValue(value);
                        }}
                      >
                        <span className="sr-only">Remove</span>×
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => onChange([])}
              >
                Clear All
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
import { useState, useRef, useEffect, memo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';

interface ComboboxInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  ariaLabel?: string;
  'data-field'?: string;
}

export const ComboboxInput = memo(function ComboboxInput({
  value,
  onChange,
  options,
  placeholder = "Select or type…",
  emptyMessage = "No results found.",
  className,
  ariaLabel,
  'data-field': dataField,
}: ComboboxInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    onChange(val);
    setOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative" data-field={dataField}>
        <PopoverPrimitive.Anchor asChild>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-label={ariaLabel ?? placeholder}
              className={cn(
                "flex h-11 w-full rounded-xl border px-3 py-2 text-sm pr-10",
                "bg-white/10 border-white/20 backdrop-blur-xl shadow-sm",
                "text-foreground placeholder:text-muted-foreground/70",
                "transition-all duration-150 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:border-primary/40 focus-visible:bg-white/15",
                "dark:bg-white/5 dark:border-white/20",
                className
              )}
            />
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Toggle options"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onMouseDown={(e) => {
                  // Prevent input from losing focus before Radix processes the trigger
                  e.preventDefault();
                }}
                onClick={() => setOpen((v) => !v)}
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
              </button>
            </PopoverTrigger>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 glass-panel border-white/25"
          align="start"
        >
          <Command>
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => handleSelect(option)}
                    onClick={() => handleSelect(option)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{option}</span>
                    {option === value && (
                      <Check className="w-4 h-4 opacity-80" aria-hidden="true" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </div>
    </Popover>
  );
});

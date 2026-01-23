import { useState, useRef, useEffect, memo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverAnchor, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface ComboboxInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  'data-field'?: string;
}

export const ComboboxInput = memo(function ComboboxInput({
  value,
  onChange,
  options,
  placeholder = "Select or type...",
  emptyMessage = "No options found.",
  className,
  'data-field': dataField
}: ComboboxInputProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [contentWidth, setContentWidth] = useState<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setInputValue(selectedValue);
    setOpen(false);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    onChange(newValue);
    if (!open) setOpen(true);
  };

  // Radix sets --radix-popover-trigger-width based on the trigger element.
  // Because our *input* is anchored (not the trigger), we measure and set an explicit width.
  useEffect(() => {
    if (!open) return;
    const el = inputRef.current;
    if (!el) return;
    const measure = () => setContentWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Use PopoverAnchor instead of PopoverTrigger so the input remains a real input
          (Radix Trigger can block focus/typing on some browsers). */}
      <PopoverAnchor asChild>
        <div className="relative" data-field={dataField}>
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
            aria-label={placeholder}
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className
            )}
          />
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Toggle options"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md",
                "hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
              )}
              onMouseDown={(e) => {
                // Keep focus on the input (prevents iOS/Safari from closing before select).
                e.preventDefault();
              }}
              onClick={() => setOpen((v) => !v)}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  open && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
      <PopoverContent 
        className="p-0" 
        style={contentWidth ? { width: `${contentWidth}px` } : undefined}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList className="max-h-60">
            {filteredOptions.length === 0 && inputValue && (
              <div className="py-3 px-4 text-sm text-muted-foreground">
                Press Enter to use: <span className="font-medium text-foreground">"{inputValue}"</span>
              </div>
            )}
            {filteredOptions.length === 0 && !inputValue && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onMouseDown={(e) => e.preventDefault()}
                  onSelect={(v) => handleSelect(v)}
                  onClick={() => handleSelect(option)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
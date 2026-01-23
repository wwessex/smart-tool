import { useEffect, useMemo, useRef, useState, memo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

export interface LanguageOption {
  code: string;
  label: string;
}

interface LanguageComboboxProps {
  value: string;
  onChange: (code: string) => void;
  options: LanguageOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Typeable/searchable language dropdown.
 * - User can type to filter.
 * - Only commits a value when an option is selected.
 * - Keeps flags visible (label is plain text including emoji).
 */
export const LanguageCombobox = memo(function LanguageCombobox({
  value,
  onChange,
  options,
  placeholder = 'English only',
  disabled = false,
  className,
}: LanguageComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(() => {
    return options.find((o) => o.code === value)?.label ?? '';
  }, [options, value]);

  useEffect(() => {
    // When the selected value changes externally, clear the filter query
    setQuery('');
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild disabled={disabled}>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={open ? query : (selectedLabel || '')}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-autocomplete="list"
              className={cn(
                'flex h-9 w-full rounded-xl border px-3 py-2 text-sm pr-10',
                'bg-white/10 border-white/20 backdrop-blur-xl shadow-sm',
                'text-foreground placeholder:text-muted-foreground/70',
                'transition-all duration-150 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:border-primary/40 focus-visible:bg-white/15',
                'dark:bg-white/5 dark:border-white/10 dark:focus-visible:bg-white/8',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
              disabled={disabled}
            />
            <ChevronDown
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 glass-panel border-white/25"
          align="start"
        >
          <Command>
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt.code}
                    value={opt.label}
                    onSelect={() => handleSelect(opt.code)}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.code === value && <Check className="w-4 h-4 opacity-80" aria-hidden="true" />}
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

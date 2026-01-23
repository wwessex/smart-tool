import { memo } from 'react';
import { Languages } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const LanguageSelector = memo(function LanguageSelector({
  value,
  onChange,
  disabled = false,
  className,
}: LanguageSelectorProps) {
  const selectedLang = SUPPORTED_LANGUAGES[value] || SUPPORTED_LANGUAGES["none"];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Languages className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Select value={value || "none"} onValueChange={onChange} disabled={disabled}>
        {/* Radix SelectValue does not support children. Rendering children can be
            inconsistent across browsers (Windows in particular). */}
        <SelectTrigger className="w-[200px] h-9 text-sm">
          <span className="flex items-center gap-2">
            <span className="font-emoji" aria-hidden="true">{selectedLang.flag}</span>
            <span>{selectedLang.name}</span>
          </span>
          <SelectValue className="hidden" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
            <SelectItem key={code} value={code}>
              <span className="flex items-center gap-2">
                <span className="font-emoji" aria-hidden="true">{lang.flag}</span>
                <span>{lang.name}</span>
                {code !== "none" && (
                  <span className="text-muted-foreground text-xs">({lang.nativeName})</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});

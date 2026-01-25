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

function FlagBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center justify-center rounded-sm border px-1 text-[10px] font-semibold leading-4 text-foreground/80">
      {text}
    </span>
  );
}

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
        <SelectTrigger className="w-[200px] h-9 text-sm">
          <SelectValue>
            <span className="flex items-center gap-2">
              <FlagBadge text={selectedLang.flag} />
              <span>{selectedLang.name}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
            <SelectItem key={code} value={code}>
              <span className="flex items-center gap-2">
                <FlagBadge text={lang.flag} />
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

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


function Flag({ code, emoji }: { code?: string; emoji: string }) {
  // Use images to ensure flags render reliably on Windows.
  if (code) {
    return (
      <img
        src={`https://flagcdn.com/24x18/${code}.png`}
        alt=""
        className="w-[18px] h-[14px] rounded-[2px] inline-block"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }
  return <span className="flag-emoji">{emoji}</span>;
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
              <Flag code={selectedLang.flagCode} emoji={selectedLang.flag} />
              <span>{selectedLang.name}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
            <SelectItem key={code} value={code}>
              <span className="flex items-center gap-2">
                <Flag code={lang.flagCode} emoji={lang.flag} />
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

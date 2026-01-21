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

function labelFor(code: string): string {
  const lang = SUPPORTED_LANGUAGES[code] || SUPPORTED_LANGUAGES['none'];
  if (code === 'none') return `${lang.flag} ${lang.name}`;
  return `${lang.flag} ${lang.name} (${lang.nativeName})`;
}

export const LanguageSelector = memo(function LanguageSelector({
  value,
  onChange,
  disabled = false,
  className,
}: LanguageSelectorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Languages className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Select value={value || 'none'} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-[200px] h-9 text-sm">
          {/* Radix Select uses the selected <SelectItem> text (ItemText) as the trigger value.
              Using a plain string here ensures emoji flags render reliably across browsers. */}
          <SelectValue placeholder="English only" />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(SUPPORTED_LANGUAGES).map((code) => (
            <SelectItem key={code} value={code}>
              {labelFor(code)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});

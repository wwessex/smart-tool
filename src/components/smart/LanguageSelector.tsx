import { memo } from 'react';
import { Languages } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { LanguageCombobox } from './LanguageCombobox';

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
  const options = Object.keys(SUPPORTED_LANGUAGES).map((code) => ({
    code,
    label: labelFor(code),
  }));

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Languages className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <div className="w-[200px]">
        <LanguageCombobox
          value={value || 'none'}
          onChange={onChange}
          options={options}
          disabled={disabled}
          placeholder="English only"
        />
      </div>
    </div>
  );
});

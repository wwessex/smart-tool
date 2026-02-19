import { Shield, Heart, Scale, CheckCircle2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FooterProps {
  onOpenPrivacySettings?: () => void;
  className?: string;
}

export function Footer({ onOpenPrivacySettings, className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn(
      "border-t border-border/50 bg-card/50 backdrop-blur-sm",
      className
    )}>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* GDPR Summary with Trust Badge */}
        <div className="flex flex-col sm:flex-row items-start gap-3 mb-3 p-3 rounded-lg bg-muted/30 border border-border/50">
          {/* Trust Badge */}
          <a href="#/privacy" className="flex items-center gap-2 shrink-0 group cursor-pointer">
            <div className="relative">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20 group-hover:border-primary/50 group-hover:from-primary/30 group-hover:to-primary/10">
                <Shield className="w-6 h-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 absolute -bottom-0.5 -right-0.5 bg-background rounded-full transition-transform duration-300 group-hover:scale-125" />
              </div>
            </div>
            <div className="flex flex-col transition-transform duration-300 group-hover:translate-x-0.5">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">UK GDPR</span>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors duration-300">Aligned</span>
            </div>
          </a>

          {/* Summary Text */}
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Lock className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium text-foreground">Privacy-First Design</span>
            </div>
	            <p className="text-xs text-muted-foreground">
	              This tool stores data locally, uses no third-party analytics, and runs AI features on-device (no cloud AI).{' '}
              <a href="#/privacy" className="text-primary hover:underline">
                See the Privacy Policy for details.
              </a>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>Copyright © {currentYear} William Wessex.</span>
            <span className="hidden sm:inline">Made with</span>
            <Heart className="w-3.5 h-3.5 text-destructive hidden sm:inline" />
          </div>
          
          <div className="flex items-center gap-4">
            <a
              href="#/privacy"
              className="hover:text-foreground transition-all duration-200 ease-spring flex items-center gap-1.5 hover:-translate-y-0.5"
            >
              <Shield className="w-3.5 h-3.5" />
              Privacy
            </a>

            <a
              href="#/terms"
              className="hover:text-foreground transition-all duration-200 ease-spring flex items-center gap-1.5 hover:-translate-y-0.5"
            >
              <Scale className="w-3.5 h-3.5" />
              Terms
            </a>

            {onOpenPrivacySettings && (
              <button
                onClick={onOpenPrivacySettings}
                className="hover:text-foreground transition-all duration-200 ease-spring hover:-translate-y-0.5"
              >
                Cookie Settings
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}

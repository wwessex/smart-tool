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
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 absolute -bottom-0.5 -right-0.5 bg-background rounded-full" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">UK GDPR</span>
              <span className="text-[10px] text-muted-foreground">Aligned</span>
            </div>
          </div>

          {/* Summary Text */}
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Lock className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium text-foreground">Privacy-First Design</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This tool stores data locally, uses no third-party analytics, and only sends text 
              for AI processing with explicit consent.{' '}
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
              className="hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              Privacy
            </a>
            
            <a 
              href="#/terms" 
              className="hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Scale className="w-3.5 h-3.5" />
              Terms
            </a>
            
            {onOpenPrivacySettings && (
              <button
                onClick={onOpenPrivacySettings}
                className="hover:text-foreground transition-colors"
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

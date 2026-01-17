import { Shield, Heart, Scale } from 'lucide-react';
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
        {/* GDPR Summary */}
        <div className="flex items-start gap-2 mb-3 p-3 rounded-lg bg-muted/30 border border-border/50">
          <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            This tool is designed to be UK GDPR/PECR-aligned: it stores data locally, uses no 
            third-party analytics, and only sends text for AI processing with explicit consent.{' '}
            <a href="#/privacy" className="text-primary hover:underline">
              See the Privacy Policy for details.
            </a>
          </p>
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

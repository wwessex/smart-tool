import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Premium textarea styling (glass + modern focus ring)
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      spellCheck={props.spellCheck ?? true}
      className={cn(
        "flex min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm",
        "bg-white/10 border-white/20 backdrop-blur-xl shadow-sm",
        "text-foreground placeholder:text-muted-foreground/70",
        "transition-all duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:border-primary/40 focus-visible:bg-white/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:bg-white/5 dark:border-white/10 dark:focus-visible:bg-white/8",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/40",
        "resize-y",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

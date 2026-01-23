import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Premium input styling (glass + modern focus ring)
 * - Larger tap target (44px+)
 * - Strong focus-visible ring for accessibility
 * - Subtle glass background to match Option A design system
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // Enable spellcheck by default for text inputs
    const shouldSpellCheck = props.spellCheck ?? (type === "text" || type === undefined);

    return (
      <input
        type={type}
        ref={ref}
        spellCheck={shouldSpellCheck}
        className={cn(
          "flex h-11 w-full rounded-xl border px-3 py-2 text-sm",
          "bg-white/10 border-white/20 backdrop-blur-xl shadow-sm",
          "text-foreground placeholder:text-muted-foreground/70",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:border-primary/40 focus-visible:bg-white/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-white/5 dark:border-white/10 dark:focus-visible:bg-white/8",
          "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/40",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

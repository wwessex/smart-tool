import * as React from "react";
import { cn } from "@/lib/utils";
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({
  className,
  type,
  spellCheck,
  ...props
}, ref) => {
  // Enable spellcheck by default for text inputs
  const shouldSpellCheck = spellCheck ?? (type === "text" || type === undefined);
  return <input type={type} className={cn("flex h-10 w-full rounded-md border border-input bg-background text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm my-0 py-0 px-[8px] mx-[8px] ml-[5px]", className)} ref={ref} {...props} spellCheck={shouldSpellCheck} />;
});
Input.displayName = "Input";
export { Input };

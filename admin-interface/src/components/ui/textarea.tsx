import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={
                    [
                        "border border-input bg-background rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full transition-colors",
                        className
                    ].filter(Boolean).join(" ")
                }
                {...props}
            />
        );
    }
);
Textarea.displayName = "Textarea";

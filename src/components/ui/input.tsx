import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared field chrome. The border colour is `--input`, which is contrast-checked
 * at 3:1 against both the field and the page — these inputs sit on a card that
 * is nearly the same value as the background, so the border is the only thing
 * identifying the control and it has to carry that weight on its own.
 *
 * `aria-invalid` drives the error styling, so a field turns red because it is
 * genuinely marked invalid rather than because a class was remembered.
 */
const field =
  // A field sits *in* its panel, so it uses the sunken surface rather than the
// same colour as the card it lives on. On the auth card the old bg-card fill
// made the inputs invisible except for their border.
"w-full rounded-control border border-input bg-surface-sunken text-foreground shadow-soft " +
  // 16px on phones, 14px from `sm` up. iOS Safari zooms the whole viewport in
  // whenever a focused field computes to less than 16px, and it does not zoom
  // back out afterwards — so with a flat `text-sm` every input on the site
  // (login, signup, search, the chat composer, every admin form) left iPhone
  // users on a magnified, horizontally-shifted page. Fixing the font size is the
  // right lever; the alternative, pinning `maximum-scale`, would disable pinch
  // zoom and fail accessibility.
  "text-base sm:text-sm " +
  "transition-[border-color,box-shadow,background-color] duration-200 " +
  "placeholder:text-muted-foreground/70 " +
  "hover:border-border-strong " +
  "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 " +
  "disabled:cursor-not-allowed disabled:opacity-55 disabled:bg-muted " +
  "focus-visible:bg-card " +
  "read-only:bg-muted/60 " +
  "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-3 aria-[invalid=true]:ring-destructive/15";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(field, "h-10 pointer-coarse:min-h-11 px-3 py-2", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(field, "min-h-24 px-3 py-2", className)} {...props} />
));
Textarea.displayName = "Textarea";

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("block text-sm font-medium text-foreground select-none", className)} {...props}>
      {children}
      {required && (
        <>
          <span aria-hidden className="ml-0.5 text-destructive">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </label>
  );
}

/**
 * Errors get an icon as well as colour — colour alone is not an accessible
 * signal — and `role="alert"` so a screen reader announces the message when it
 * appears rather than only on next focus.
 */
export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

export function FieldHint({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/** Label + control + hint/error in one consistently spaced stack. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {hint && !error && <FieldHint>{hint}</FieldHint>}
      <FieldError message={error} />
    </div>
  );
}

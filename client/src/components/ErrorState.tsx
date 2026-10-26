import { AlertCircle } from "lucide-react";
import { Button } from "./ui/button";

interface ErrorStateProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <div
        className="flex items-start gap-3 border border-line bg-surface p-6 sm:p-8"
        role="alert"
      >
        <AlertCircle
          className="mt-0.5 size-5 shrink-0 text-brand-strong"
          aria-hidden="true"
        />
        <div>
          <h2 className="font-serif text-xl leading-snug text-ink">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {message}
          </p>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={onRetry}
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

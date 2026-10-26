import { BookOpen, SearchX } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: "book" | "search";
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({
  icon = "book",
  title,
  description,
  action,
}: EmptyStateProps) {
  const Icon = icon === "search" ? SearchX : BookOpen;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-full border border-line text-[#B9B4AA]">
        <Icon className="size-5" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-serif text-[1.6rem] leading-tight text-ink">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

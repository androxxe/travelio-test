import { Search } from "lucide-react";
import type { FormEvent } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const SUGGESTIONS = ["Dune", "Atomic Habits", "design systems"];

interface SearchHeroProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSuggestion: (value: string) => void;
}

export function SearchHero({
  value,
  onChange,
  onSubmit,
  onSuggestion,
}: SearchHeroProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="mx-auto max-w-7xl px-5 pb-10 pt-12 sm:px-8 sm:pb-12 sm:pt-16">
      <h1 className="max-w-3xl font-serif text-[clamp(2.6rem,7vw,4.2rem)] font-medium leading-[0.98] tracking-[-0.03em] text-ink">
        Find your next read.
      </h1>
      <p className="mt-4 max-w-lg text-[0.95rem] leading-relaxed text-muted-foreground">
        Search millions of titles, then keep the ones worth remembering.
      </p>

      <form onSubmit={handleSubmit} role="search" className="mt-8 max-w-2xl">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Search by title, author, or topic"
            aria-label="Search books"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={120}
            className="h-14 rounded-xl pl-11 pr-28 text-[0.95rem] shadow-[0_16px_35px_-30px_rgba(23,24,26,0.6)]"
          />
          <Button
            type="submit"
            className="absolute right-1.5 top-1/2 h-11 -translate-y-1/2 rounded-lg px-5"
          >
            Search
          </Button>
        </div>
      </form>

      {value.trim().length === 1 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Keep typing — searches need at least 2 characters.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="mr-0.5">Try</span>
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSuggestion(suggestion)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink transition-colors hover:border-ink/30 hover:bg-ink/[0.03]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  );
}

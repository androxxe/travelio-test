import { cn } from "@/lib/utils";

interface ResultBandProps {
  id?: string;
  tone?: "brand" | "ink";
  title: string;
  meta: string;
  isRefreshing?: boolean;
  refreshingLabel?: string;
}

export function ResultBand({
  id,
  tone = "brand",
  title,
  meta,
  isRefreshing = false,
  refreshingLabel = "Searching…",
}: ResultBandProps) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-16 text-white",
        tone === "brand" ? "bg-brand-strong" : "bg-ink",
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-x-8 gap-y-2 px-5 py-8 sm:px-8 sm:py-10">
        <h2 className="font-serif text-[1.8rem] italic leading-tight tracking-[-0.01em] sm:text-[2.15rem]">
          {title}
        </h2>
        <p
          className="pb-1 text-[0.8rem] font-medium text-white/90"
          aria-live="polite"
        >
          {isRefreshing ? refreshingLabel : meta}
        </p>
      </div>
    </section>
  );
}

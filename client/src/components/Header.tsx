import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

interface HeaderProps {
  savedCount: number;
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center rounded-md px-3 py-2 text-sm transition-colors",
    isActive
      ? "font-medium text-ink"
      : "text-muted-foreground hover:text-ink",
  );
}

export function Header({ savedCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <NavLink
          to="/"
          className="font-serif text-[1.4rem] font-semibold tracking-[-0.03em] text-ink"
          aria-label="Shelf home"
        >
          Shelf<span className="text-brand">.</span>
        </NavLink>

        <nav aria-label="Main" className="flex items-center gap-1">
          <NavLink to="/" end className={navClass}>
            Search
          </NavLink>
          <NavLink to="/wishlist" className={navClass}>
            Wishlist
            {savedCount > 0 && (
              <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {savedCount > 99 ? "99+" : savedCount}
              </span>
            )}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatRatingCount, StarRating } from "@/components/StarRating";

describe("StarRating", () => {
  it("exposes a fractional rating to assistive technology", () => {
    render(<StarRating rating={4.3} ratingsCount={1200} />);

    expect(
      screen.getByRole("img", {
        name: "Rated 4.3 out of 5 from 1200 ratings",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("(1.2k)")).toBeInTheDocument();
  });

  it("renders an explicit empty state when Google has no rating", () => {
    render(<StarRating rating={null} />);

    expect(
      screen.getByRole("img", { name: "No ratings yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No ratings yet")).toBeInTheDocument();
  });

  it("clamps out-of-range values", () => {
    render(<StarRating rating={7} ratingsCount={12} />);

    expect(
      screen.getByRole("img", { name: "Rated 5.0 out of 5 from 12 ratings" }),
    ).toBeInTheDocument();
  });
});

describe("formatRatingCount", () => {
  it("formats thousands and millions compactly", () => {
    expect(formatRatingCount(999)).toBe("999");
    expect(formatRatingCount(1000)).toBe("1k");
    expect(formatRatingCount(1250)).toBe("1.3k");
    expect(formatRatingCount(2_400_000)).toBe("2.4m");
  });
});

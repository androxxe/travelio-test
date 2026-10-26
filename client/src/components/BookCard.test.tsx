import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BookCard } from "@/components/BookCard";
import type { Book } from "@/lib/types";

const book: Book = {
  id: "volume-1",
  title: "Dune",
  subtitle: null,
  authors: ["Frank Herbert"],
  thumbnail: "https://books.google.com/cover.jpg",
  publishedDate: "1965",
  averageRating: 4.3,
  ratingsCount: 1200,
  previewLink: null,
  categories: ["Fiction"],
};

describe("BookCard", () => {
  it("renders the book metadata and a save control", async () => {
    const onToggle = vi.fn();
    render(<BookCard book={book} saved={false} onToggle={onToggle} />);

    expect(screen.getByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Rated 4.3 out of 5 from 1200 ratings",
      }),
    ).toBeInTheDocument();

    const button = screen.getByRole("button", {
      name: "Save Dune to your shelf",
    });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith(book);
  });

  it("reflects the saved state", () => {
    render(<BookCard book={book} saved onToggle={() => undefined} />);

    expect(
      screen.getByRole("button", { name: "Remove Dune from your shelf" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("falls back to a placeholder when the cover fails to load", () => {
    const { container } = render(
      <BookCard book={book} saved={false} onToggle={() => undefined} />,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();

    fireEvent.error(image as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText("Dune").length).toBeGreaterThan(1);
  });

  it("uses a placeholder when Google returns no thumbnail", () => {
    const { container } = render(
      <BookCard
        book={{ ...book, thumbnail: null }}
        saved={false}
        onToggle={() => undefined}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
  });
});

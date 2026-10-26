import type { Book } from "../domain";

/**
 * Small curated catalog used only when Google Books is unavailable (quota
 * exhausted, timeout, 5xx). Every response built from this data is labelled
 * `source: "fallback"` and the UI shows a notice, so demo data is never
 * mistaken for a live Google result.
 *
 * Covers are Open Library ISBN covers; a missing cover falls back to the
 * designed placeholder like any other broken thumbnail.
 */
export const FALLBACK_NOTICE =
  "Google Books is rate-limiting searches right now, so these results come from a small built-in demo catalog.";

function cover(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

function book(
  id: string,
  title: string,
  authors: string[],
  isbn: string,
  options: {
    publishedDate?: string;
    averageRating?: number | null;
    ratingsCount?: number;
    categories?: string[];
    subtitle?: string;
  } = {},
): Book {
  return {
    id: `demo-${id}`,
    title,
    subtitle: options.subtitle ?? null,
    authors,
    thumbnail: cover(isbn),
    publishedDate: options.publishedDate ?? null,
    averageRating: options.averageRating ?? null,
    ratingsCount: options.ratingsCount ?? 0,
    previewLink: null,
    categories: options.categories ?? [],
  };
}

export const FALLBACK_BOOKS: Book[] = [
  book("dune", "Dune", ["Frank Herbert"], "9780441013593", {
    publishedDate: "1965",
    averageRating: 4.3,
    ratingsCount: 2140,
    categories: ["Fiction", "Science Fiction"],
  }),
  book(
    "left-hand-darkness",
    "The Left Hand of Darkness",
    ["Ursula K. Le Guin"],
    "9780441478125",
    {
      publishedDate: "1969",
      averageRating: 4.1,
      ratingsCount: 890,
      categories: ["Fiction", "Science Fiction"],
    },
  ),
  book("neuromancer", "Neuromancer", ["William Gibson"], "9780441569595", {
    publishedDate: "1984",
    averageRating: 4.0,
    ratingsCount: 640,
    categories: ["Fiction", "Cyberpunk"],
  }),
  book(
    "name-of-the-wind",
    "The Name of the Wind",
    ["Patrick Rothfuss"],
    "9780756404741",
    {
      publishedDate: "2007",
      averageRating: 4.5,
      ratingsCount: 3120,
      categories: ["Fiction", "Fantasy"],
    },
  ),
  book("atomic-habits", "Atomic Habits", ["James Clear"], "9780735211292", {
    publishedDate: "2018",
    averageRating: 4.4,
    ratingsCount: 5280,
    categories: ["Self-Help", "Productivity"],
  }),
  book("sapiens", "Sapiens", ["Yuval Noah Harari"], "9780062316097", {
    subtitle: "A Brief History of Humankind",
    publishedDate: "2011",
    averageRating: 4.4,
    ratingsCount: 4310,
    categories: ["History", "Nonfiction"],
  }),
  book(
    "thinking-fast-and-slow",
    "Thinking, Fast and Slow",
    ["Daniel Kahneman"],
    "9780374533557",
    {
      publishedDate: "2011",
      averageRating: 4.2,
      ratingsCount: 2870,
      categories: ["Psychology", "Nonfiction"],
    },
  ),
  book(
    "design-everyday-things",
    "The Design of Everyday Things",
    ["Don Norman"],
    "9780465050659",
    {
      publishedDate: "1988",
      averageRating: 4.2,
      ratingsCount: 1190,
      categories: ["Design", "Nonfiction"],
    },
  ),
  book("refactoring", "Refactoring", ["Martin Fowler"], "9780134757599", {
    subtitle: "Improving the Design of Existing Code",
    publishedDate: "1999",
    averageRating: 4.3,
    ratingsCount: 730,
    categories: ["Computers", "Software Engineering"],
  }),
  book(
    "pragmatic-programmer",
    "The Pragmatic Programmer",
    ["David Thomas", "Andrew Hunt"],
    "9780135957059",
    {
      publishedDate: "1999",
      averageRating: 4.4,
      ratingsCount: 980,
      categories: ["Computers", "Software Engineering"],
    },
  ),
  book("clean-code", "Clean Code", ["Robert C. Martin"], "9780132350884", {
    publishedDate: "2008",
    averageRating: 4.1,
    ratingsCount: 1540,
    categories: ["Computers", "Software Engineering"],
  }),
  book("educated", "Educated", ["Tara Westover"], "9780399590504", {
    publishedDate: "2018",
    averageRating: 4.5,
    ratingsCount: 3980,
    categories: ["Biography", "Memoir"],
  }),
  book("becoming", "Becoming", ["Michelle Obama"], "9781524763138", {
    publishedDate: "2018",
    averageRating: 4.5,
    ratingsCount: 4620,
    categories: ["Biography", "Memoir"],
  }),
  book(
    "midnight-library",
    "The Midnight Library",
    ["Matt Haig"],
    "9780525559474",
    {
      publishedDate: "2020",
      averageRating: 4.0,
      ratingsCount: 2210,
      categories: ["Fiction"],
    },
  ),
  book("project-hail-mary", "Project Hail Mary", ["Andy Weir"], "9780593135204", {
    publishedDate: "2021",
    averageRating: 4.5,
    ratingsCount: 2760,
    categories: ["Fiction", "Science Fiction"],
  }),
  book(
    "klara-and-the-sun",
    "Klara and the Sun",
    ["Kazuo Ishiguro"],
    "9780571364879",
    {
      publishedDate: "2021",
      averageRating: 3.9,
      ratingsCount: 860,
      categories: ["Fiction"],
    },
  ),
  book(
    "norwegian-wood",
    "Norwegian Wood",
    ["Haruki Murakami"],
    "9780375704024",
    {
      publishedDate: "1987",
      averageRating: 4.0,
      ratingsCount: 1320,
      categories: ["Fiction"],
    },
  ),
  book("the-hobbit", "The Hobbit", ["J.R.R. Tolkien"], "9780547928227", {
    publishedDate: "1937",
    averageRating: 4.5,
    ratingsCount: 5120,
    categories: ["Fiction", "Fantasy"],
  }),
  book(
    "harry-potter-sorcerers-stone",
    "Harry Potter and the Sorcerer's Stone",
    ["J.K. Rowling"],
    "9780590353427",
    {
      publishedDate: "1997",
      averageRating: 4.5,
      ratingsCount: 6240,
      categories: ["Fiction", "Fantasy"],
    },
  ),
  book(
    "song-of-achilles",
    "The Song of Achilles",
    ["Madeline Miller"],
    "9780062060624",
    {
      publishedDate: "2011",
      averageRating: 4.3,
      ratingsCount: 2480,
      categories: ["Fiction", "Historical Fiction"],
    },
  ),
  book("circe", "Circe", ["Madeline Miller"], "9780316556347", {
    publishedDate: "2018",
    averageRating: 4.2,
    ratingsCount: 1860,
    categories: ["Fiction", "Fantasy"],
  }),
  book("the-alchemist", "The Alchemist", ["Paulo Coelho"], "9780062315007", {
    publishedDate: "1988",
    averageRating: 4.0,
    ratingsCount: 5340,
    categories: ["Fiction"],
  }),
  book(
    "brief-history-of-time",
    "A Brief History of Time",
    ["Stephen Hawking"],
    "9780553380163",
    {
      publishedDate: "1988",
      averageRating: 4.1,
      ratingsCount: 1720,
      categories: ["Science", "Nonfiction"],
    },
  ),
  book("cosmos", "Cosmos", ["Carl Sagan"], "9780345539434", {
    publishedDate: "1980",
    averageRating: null,
    ratingsCount: 0,
    categories: ["Science", "Nonfiction"],
  }),
];

export function searchFallbackBooks(
  query: string,
  page: number,
  limit: number,
): { items: Book[]; totalItems: number } {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  const matches = FALLBACK_BOOKS.filter((candidate) => {
    const haystack = [
      candidate.title,
      candidate.subtitle ?? "",
      ...candidate.authors,
      ...candidate.categories,
      candidate.publishedDate ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });

  const start = (page - 1) * limit;

  return {
    items: matches.slice(start, start + limit),
    totalItems: matches.length,
  };
}

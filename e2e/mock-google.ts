import express from "express";

/**
 * Stand-in for the Google Books API so end-to-end tests never depend on
 * network access or quota. The app points GOOGLE_BOOKS_BASE_URL here.
 */
const volumes = [
  {
    id: "harry-1",
    volumeInfo: {
      title: "Harry Potter and the Philosopher's Stone",
      authors: ["J.K. Rowling"],
      publishedDate: "1997",
      averageRating: 4.5,
      ratingsCount: 1200,
      categories: ["Juvenile Fiction"],
    },
  },
  {
    id: "harry-2",
    volumeInfo: {
      title: "Harry Potter and the Chamber of Secrets",
      authors: ["J.K. Rowling"],
      publishedDate: "1998",
      averageRating: 4.2,
      ratingsCount: 860,
    },
  },
  {
    id: "harry-3",
    volumeInfo: {
      title: "Harry Potter: A History of Magic",
      authors: ["British Library"],
      publishedDate: "2017",
    },
  },
];

const app = express();

app.get("/volumes", (request, response) => {
  const query = String(request.query.q ?? "").trim().toLowerCase();
  const startIndex = Number(request.query.startIndex ?? 0);
  const maxResults = Math.min(Number(request.query.maxResults ?? 20), 40);

  const matches = query
    ? volumes.filter((volume) => {
        const haystack = [
          volume.volumeInfo.title,
          ...(volume.volumeInfo.authors ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
    : [];

  response.json({
    totalItems: matches.length,
    items: matches.slice(startIndex, startIndex + maxResults),
    source: "google",
    notice: null,
  });
});

const port = Number(process.env.MOCK_GOOGLE_PORT ?? 4010);

app.listen(port, "127.0.0.1", () => {
  process.stdout.write(`mock google books listening on ${port}\n`);
});

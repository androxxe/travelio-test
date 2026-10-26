import { expect, test } from "@playwright/test";

test("searches, saves, persists and removes a book", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Find your next read." }),
  ).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Search books" })
    .fill("harry");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page.getByRole("heading", { name: "“harry”" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Harry Potter and the Philosopher's Stone",
    }),
  ).toBeVisible();
  await expect(page.getByText("J.K. Rowling").first()).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Rated 4.5 out of 5 from 1200 ratings",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Save Harry Potter and the Philosopher's Stone to your shelf",
    })
    .click();
  await expect(page.getByText("Saved to your shelf")).toBeVisible();

  await page.getByRole("link", { name: /Wishlist/ }).click();
  await expect(page.getByRole("heading", { name: "Your shelf" })).toBeVisible();
  await expect(page.getByText("1 book saved")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Harry Potter and the Philosopher's Stone",
    }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Harry Potter and the Philosopher's Stone",
    }),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Remove Harry Potter and the Philosopher's Stone from your shelf",
    })
    .click();

  await expect(page.getByText("Your shelf is empty.")).toBeVisible();
  await expect(page.getByText("0 books saved")).toBeVisible();
});

test("shows a useful empty state for a query with no matches", async ({
  page,
}) => {
  await page.goto("/?q=zzzz");

  await expect(page.getByText("No books found for “zzzz”")).toBeVisible();
  await expect(
    page.getByText("Try a shorter query, a different spelling"),
  ).toBeVisible();
});

test("ignores a one-character query instead of calling the API", async ({
  page,
}) => {
  let bookRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/books")) {
      bookRequests += 1;
    }
  });

  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search books" }).fill("d");

  await expect(
    page.getByText("Keep typing — searches need at least 2 characters."),
  ).toBeVisible();
  await page.waitForTimeout(700);

  expect(bookRequests).toBe(0);
});

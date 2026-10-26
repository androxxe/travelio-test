import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);
const apiPort = 3000;
const webPort = 5173;
const mockPort = 4010;

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (isCi ? `http://127.0.0.1:${apiPort}` : `http://localhost:${webPort}`);

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://shelf:shelf@localhost:5433/shelf";

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

const sharedEnv: Record<string, string> = {
  ...inheritedEnv,
  DATABASE_URL: databaseUrl,
  GOOGLE_BOOKS_BASE_URL: `http://127.0.0.1:${mockPort}/volumes`,
  GOOGLE_BOOKS_API_KEY: "",
  RATE_LIMIT_MAX: "1000",
  LOG_LEVEL: "warn",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: 1,
  reporter: isCi
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: isCi
    ? [
        {
          command: "pnpm exec tsx e2e/mock-google.ts",
          port: mockPort,
          reuseExistingServer: false,
          env: sharedEnv,
        },
        {
          command: "pnpm start",
          port: apiPort,
          timeout: 90_000,
          reuseExistingServer: false,
          env: {
            ...sharedEnv,
            NODE_ENV: "production",
            CLIENT_DIST: "client/dist",
            MIGRATIONS_DIR: "server/migrations",
            CLIENT_ORIGIN: baseURL,
            TRUST_PROXY: "false",
          },
        },
      ]
    : [
        {
          command: "pnpm exec tsx e2e/mock-google.ts",
          port: mockPort,
          reuseExistingServer: false,
          env: sharedEnv,
        },
        {
          command: "pnpm dev:server",
          port: apiPort,
          timeout: 90_000,
          reuseExistingServer: false,
          env: sharedEnv,
        },
        {
          command: "pnpm dev:client",
          port: webPort,
          timeout: 90_000,
          reuseExistingServer: false,
        },
      ],
});

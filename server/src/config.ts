import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: [".env", "../.env"], quiet: true });

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : value === "true"));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GOOGLE_BOOKS_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  GOOGLE_BOOKS_BASE_URL: z
    .string()
    .url()
    .default("https://www.googleapis.com/books/v1/volumes"),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  CLIENT_DIST: z.string().min(1).optional(),
  MIGRATIONS_DIR: z.string().min(1).default("migrations"),
  RUN_MIGRATIONS: booleanFromEnv(true),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  FALLBACK_CATALOG_ENABLED: booleanFromEnv(true),
  TRUST_PROXY: booleanFromEnv(false),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  googleBooksApiKey: string | null;
  googleBooksBaseUrl: string;
  clientOrigin: string;
  clientDist: string | null;
  migrationsDir: string;
  runMigrations: boolean;
  rateLimitMax: number;
  trustProxy: boolean;
  fallbackCatalogEnabled: boolean;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const values = parsed.data;

  return {
    nodeEnv: values.NODE_ENV,
    isProduction: values.NODE_ENV === "production",
    port: values.PORT,
    databaseUrl: values.DATABASE_URL,
    googleBooksApiKey: values.GOOGLE_BOOKS_API_KEY ?? null,
    googleBooksBaseUrl: values.GOOGLE_BOOKS_BASE_URL,
    clientOrigin: values.CLIENT_ORIGIN,
    clientDist: values.CLIENT_DIST ?? null,
    migrationsDir: values.MIGRATIONS_DIR,
    runMigrations: values.RUN_MIGRATIONS,
    rateLimitMax: values.RATE_LIMIT_MAX,
    trustProxy: values.TRUST_PROXY,
    fallbackCatalogEnabled: values.FALLBACK_CATALOG_ENABLED,
    logLevel: values.LOG_LEVEL,
  };
}

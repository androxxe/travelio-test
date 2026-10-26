import type { ZodError } from "zod";

export interface ValidationIssue {
  path: string;
  message: string;
}

export function formatIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

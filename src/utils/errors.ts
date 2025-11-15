/**
 * Error handling utilities for consistent error formatting
 */

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  // Handle Tauri API errors which often have a string representation
  try {
    return String(error);
  } catch {
    return "Unknown error occurred";
  }
}

export function logError(context: string, error: unknown): void {
  console.error(`[${context}] Error:`, error);
  console.error(`[${context}] Formatted:`, formatError(error));
}

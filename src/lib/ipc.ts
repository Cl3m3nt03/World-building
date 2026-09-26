import type { TranslationKey } from "@/i18n";
import type { AppError } from "@/lib/bindings";

type CommandResult<T> = { status: "ok"; data: T } | { status: "error"; error: AppError };

/** A Rust `AppError` surfaced as a thrown value, e.g. by a TanStack Query hook. */
export class IpcError extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(`${appError.code}: ${appError.message}`);
    this.name = "IpcError";
    this.appError = appError;
  }
}

/**
 * Turns a generated command result into a plain value, or throws an
 * `IpcError`. Use it in query functions: `queryFn: () => unwrap(commands.appInfo())`.
 */
export async function unwrap<T>(result: Promise<CommandResult<T>>): Promise<T> {
  const outcome = await result;
  if (outcome.status === "error") {
    throw new IpcError(outcome.error);
  }
  return outcome.data;
}

const ERROR_KEYS: Record<AppError["code"], TranslationKey> = {
  io: "errors.io",
  path_unavailable: "errors.path_unavailable",
  internal: "errors.internal",
};

/** Translation key for any error: a known Rust error code, or a generic message. */
export function errorKey(error: unknown): TranslationKey {
  return error instanceof IpcError ? ERROR_KEYS[error.appError.code] : "errors.unknown";
}

/** Technical detail shown under the translated message. */
export function errorDetail(error: unknown): string | undefined {
  if (error instanceof IpcError) return error.appError.message;
  if (error instanceof Error) return error.message;
  return undefined;
}

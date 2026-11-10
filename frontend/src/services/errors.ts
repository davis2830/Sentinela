import axios from "axios";

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
const string = (value: unknown) =>
  typeof value === "string" ? value : undefined;
const number = (value: unknown) =>
  typeof value === "number" ? value : undefined;

export function apiFailure(error: unknown) {
  const raw = record(error);
  const rawResponse = record(raw.response);
  const response = axios.isAxiosError<unknown>(error)
    ? error.response
    : raw.response
      ? {
          status: number(rawResponse.status) || 0,
          headers: record(rawResponse.headers),
          data: rawResponse.data,
        }
      : undefined;
  const body = record(response?.data);
  const errors = record(body.errors);
  const messages = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : typeof value === "string"
        ? [value]
        : [];
  return {
    message: error instanceof Error ? error.message : string(raw.message),
    code: axios.isAxiosError(error) ? error.code : undefined,
    response: response
      ? {
          status: response.status,
          headers: response.headers,
          data: {
            message: string(body.message),
            detail: string(body.detail),
            errors: {
              code: string(errors.code),
              detail: string(errors.detail),
              retry_after_seconds: number(errors.retry_after_seconds),
              password: messages(errors.password),
              email: messages(errors.email),
            },
            password: messages(body.password),
            email: messages(body.email),
            token: messages(body.token),
            data: { status_code: number(record(body.data).status_code) },
          },
        }
      : undefined,
  };
}

export function errorMessage(
  error: unknown,
  fallback = "No se pudo completar la operación.",
): string {
  if (axios.isAxiosError<unknown>(error)) {
    const data = error.response?.data;
    if (typeof data === "object" && data !== null) {
      if ("message" in data && typeof data.message === "string")
        return data.message;
      if ("detail" in data && typeof data.detail === "string")
        return data.detail;
    }
  }
  return fallback;
}

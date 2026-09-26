// An unexpected HTTP status, kept on the error so that the retry policy can
// tell a 404 (an answer) from a failure worth one more try.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    what: string,
  ) {
    super(`${what} failed with status ${String(status)}`);
    this.name = "HttpError";
  }
}

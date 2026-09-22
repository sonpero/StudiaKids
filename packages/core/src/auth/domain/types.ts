// Codes du système scolaire français, non traduits — exception assumée à
// la convention "code en anglais", voir docs/glossaire.md.
export type Grade = "CP" | "CE1" | "CE2" | "CM1" | "CM2" | "6e";

export type Account = {
  id: string;
  username: string;
  firstName: string;
  grade: Grade;
  createdAt: string;
};

export type SessionPayload = { userId: string; sessionVersion: number };

export type LoginError =
  | { kind: "invalid-credentials" }
  | { kind: "rate-limited"; retryAfterSeconds: number };

export type CreateAccountError = { kind: "username-taken" };

export type ResetPasswordError = { kind: "unknown-account" };

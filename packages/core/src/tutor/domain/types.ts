import type { FixedIssue } from "./fixed-texts.js";

// docs/modules/tutor.md, Domaine. A citation is a snapshot of a section's
// text taken when the answer was given, never a live index.
export type Citation = { text: string };

export type Conversation = { id: string; userId: string; courseId: string; title: string | null; createdAt: string };

export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  issue: FixedIssue | null;
  outOfBand: boolean;
  partial: boolean;
  createdAt: string;
};

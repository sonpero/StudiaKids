import type { Grade } from "../../auth/index.js";
import type { Subject } from "./subject.js";

// `failed` is never stored: it is derived from the latest extract-course
// job (displayStatus, docs/modules/ingestion.md "Statut failed").
export type StoredExtractionStatus = "pending" | "running" | "illegible" | "not_a_course_page" | "ready";
export type ExtractionStatus = StoredExtractionStatus | "failed";

export type Course = {
  id: string;
  userId: string;
  title: string;
  subject: Subject | null;
  grade: Grade;
  color: string; // design token name, e.g. "matiere-maths" — never a hex value
  extractionStatus: StoredExtractionStatus;
  confirmed: boolean;
  pageCount: number;
  createdAt: string;
  lastAccessedAt: string;
};

export type Page = {
  courseId: string;
  index: number;
  sha256: string;
  storedPath: string;
  sizeBytes: number;
  legible: boolean | null;
  isCoursePage: boolean | null;
  unusableReason: string | null;
};

export type Extraction = { courseId: string; markdown: string; extractedAt: string };

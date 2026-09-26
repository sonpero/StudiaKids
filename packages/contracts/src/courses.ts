import { z } from "zod";

// Mirrors ingestion's domain enums: contracts depends on nothing but zod.
const subjectSchema = z.enum(["maths", "french", "history", "geography", "science", "english", "other"]);
const gradeSchema = z.enum(["CP", "CE1", "CE2", "CM1", "CM2", "6e"]);

export const extractionStatusSchema = z.enum(["pending", "running", "illegible", "not_a_course_page", "ready", "failed"]);
export type ExtractionStatus = z.infer<typeof extractionStatusSchema>;

// Never carries userId: a course is only ever read by its own account.
export const courseSchema = z.object({
  id: z.string(),
  title: z.string().describe("Vide tant que l'extraction n'est pas prête"),
  subject: subjectSchema.nullable(),
  grade: gradeSchema,
  color: z.string().describe("Nom de token de design (matiere-*), vide tant que l'extraction n'est pas prête"),
  extractionStatus: extractionStatusSchema,
  extractionStarted: z.boolean().describe("Faux tant que « C'est tout ! » n'a pas lancé la lecture : le bandeau ramène alors à la capture"),
  confirmed: z.boolean(),
  pageCount: z.number().int(),
  createdAt: z.string(),
  lastAccessedAt: z.string(),
});
export type CourseDto = z.infer<typeof courseSchema>;

export const courseParamsSchema = z.object({ id: z.string() });
export const pageFileParamsSchema = z.object({ id: z.string(), index: z.coerce.number().int().min(0) });

export const createCourseResponseSchema = z.object({ id: z.string() });
export const startExtractionResponseSchema = z.object({ extractionStatus: extractionStatusSchema });
export const addPageResponseSchema = z.object({ index: z.number().int() });
// The home cards also show how many games are ready (M3).
export const courseListItemSchema = courseSchema.extend({ exerciseCount: z.number().int().describe("Nombre d'exercices prêts, 0 avant « Créer mes jeux »") });
export type CourseListItemDto = z.infer<typeof courseListItemSchema>;
export const courseListResponseSchema = z.object({ courses: z.array(courseListItemSchema) });
export const unconfirmedCourseResponseSchema = z.object({ course: courseSchema.nullable() });

// One stable code per refusal, so the web client picks the mascot's message
// from the code, never from a status alone. not_found is identical for an
// unknown id and another account's course (docs/securite.md).
export const courseErrorSchema = z.object({
  error: z.enum([
    "not_found",
    "missing_file",
    "locked",
    "unsupported",
    "too_large",
    "too_many_pages",
    "duplicate",
    "no_pages",
    "not_ready",
    "already_confirmed",
    "not_failed",
  ]),
});
export type CourseError = z.infer<typeof courseErrorSchema>["error"];

import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accountsTable = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    sessionVersion: integer("session_version").notNull().default(1),
    firstName: text("first_name").notNull(),
    grade: text("grade").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [check("grade_check", sql`${table.grade} IN ('CP','CE1','CE2','CM1','CM2','6e')`)],
);

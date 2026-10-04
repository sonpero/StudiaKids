-- An exercise that was played is retired instead of deleted: its attempts,
-- hence the child's stars, cascade with it (docs/modules/exercise-generator.md,
-- "Exercice retiré"). Pinned by exercise-retirement.int.test.ts.
ALTER TABLE `exercises` ADD `retired` integer DEFAULT false NOT NULL;

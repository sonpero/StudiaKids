export { sectionsOf, splitIntoParagraphs, splitIntoSections, type Section } from "./domain/split-into-sections.js";
export { truncateTitle } from "./domain/truncate-title.js";
export { decide, isLimitReached, questionsToday, TUTOR_DAILY_LIMIT, type Classification, type ClassificationError, type Decision } from "./domain/decision.js";
export { DISTRESS_TEXT, fixedText, type FixedIssue } from "./domain/fixed-texts.js";
export type { ChatModel, CitationExtractor, ConversationRepository, CourseForTutor, ExtractError, QuestionClassifier, TutorCourseSource } from "./domain/ports.js";
export type { Citation, Conversation, Message } from "./domain/types.js";
export { answerHistory } from "./domain/history.js";

export { ask, type AskDeps, type AskEvent, type AskTerminal } from "./application/ask.js";
export { openConversation, getConversation, listConversations, deleteConversation, exportTutorHistory, type ConversationDeps } from "./application/conversations.js";

export { ClaudeQuestionClassifier, CLASSIFIER_TIMEOUT_MS } from "./infra/claude-question-classifier.js";
export { ClaudeChatModel, ANSWER_MAX_TOKENS } from "./infra/claude-chat-model.js";
export { ClaudeCitationExtractor } from "./infra/claude-citation-extractor.js";
export { TUTOR_PROMPTS_VERSION, classifierPrompt, answerSystemPrompt } from "./infra/prompts.js";
export { SqliteConversationRepository, type TutorDb } from "./infra/sqlite-conversation-repository.js";
export { IngestionTutorCourses } from "./infra/ingestion-tutor-courses.js";
export { FixtureQuestionClassifier, FixtureChatModel, FixtureCitationExtractor } from "./infra/fixture-adapters.js";
export { conversationsTable, messagesTable, tutorDisclosuresTable } from "./infra/schema.js";

export { sectionsOf, splitIntoParagraphs, splitIntoSections, type Section } from "./domain/split-into-sections.js";
export { truncateTitle } from "./domain/truncate-title.js";
export { decide, isLimitReached, questionsToday, TUTOR_DAILY_LIMIT, type Classification, type ClassificationError, type Decision } from "./domain/decision.js";
export { DISTRESS_TEXT, fixedText, type FixedIssue } from "./domain/fixed-texts.js";
export type { ChatModel, CitationExtractor, CourseForTutor, ExtractError, QuestionClassifier } from "./domain/ports.js";

export { ClaudeQuestionClassifier, CLASSIFIER_TIMEOUT_MS } from "./infra/claude-question-classifier.js";
export { ClaudeChatModel, ANSWER_MAX_TOKENS } from "./infra/claude-chat-model.js";
export { ClaudeCitationExtractor } from "./infra/claude-citation-extractor.js";
export { TUTOR_PROMPTS_VERSION, classifierPrompt, answerSystemPrompt } from "./infra/prompts.js";

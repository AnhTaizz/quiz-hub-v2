import { practiceApi } from "@/api/practice.api";
import type { PracticeDetail, PracticeHistoryItem, PracticeQuestion } from "@/types/api";
import { DEFAULT_SETTINGS, type PracticeSettings } from "./practiceModel";
import { loadSettingsFor, type PracticeSession } from "./practiceSession";

export function questionFromDetail(detail: PracticeDetail): PracticeQuestion {
  return {
    id: detail.questionId,
    text: detail.questionText,
    type: detail.questionType,
    level: detail.questionLevel,
    answers: detail.answers ?? [],
    selectedAnswerIds: detail.selectedAnswerIds,
    selectedText: detail.selectedText,
    isCorrect: detail.isCorrect,
  };
}

/**
 * Rebuilds a playable session for an unfinished practice. There is no "current practice" endpoint, and the two
 * kinds resume differently (this mirrors the legacy history page):
 *  - random: the question set was locked server-side when it started, so it is read back from the history detail;
 *  - sequential range: start is called again for the same category/limit/offset with forceNew=false and the
 *    practiceId, which returns the same page of questions with the answers saved so far.
 */
export async function buildResumeSession(item: PracticeHistoryItem): Promise<PracticeSession> {
  if (item.categoryId === null) throw new Error("This practice has no category and cannot be resumed.");

  const isRandom = item.isRandom === true;
  const stored = loadSettingsFor(item.id);
  const settings: PracticeSettings = { ...(stored ?? DEFAULT_SETTINGS), isRandom };

  if (isRandom) {
    const detail = await practiceApi.detail(item.id);
    return {
      questions: detail.details.map(questionFromDetail),
      practiceId: item.id,
      categoryId: item.categoryId,
      categoryName: detail.categoryName ?? item.categoryName ?? "",
      offset: 0,
      settings,
    };
  }

  const offset = item.practiceOffset ?? 0;
  const started = await practiceApi.start({
    categoryId: item.categoryId,
    limit: item.practiceLimit ?? 10,
    offset,
    isRandom: false,
    forceNew: false,
    practiceId: item.id,
  });
  return {
    questions: started.questions,
    practiceId: started.practiceId ?? item.id,
    categoryId: item.categoryId,
    categoryName: started.categoryName ?? item.categoryName ?? "",
    offset,
    settings,
  };
}

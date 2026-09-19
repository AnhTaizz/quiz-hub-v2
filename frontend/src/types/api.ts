// Types mirror the verified backend DTOs exactly (see
// docs/frontend/API_MAP.md). Field names/casing match the real JSON the
// Spring controllers return - do not "clean up" a field name here without
// checking the backend DTO first.

export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "FILL_IN_BLANK";
export type QuestionLevel = "EASY" | "MEDIUM" | "HARD";
export type JoinStatus = "PENDING" | "APPROVED" | "REJECTED" | "REMOVED";

export interface ApiError {
  code?: number;
  status: number;
  message: string;
  errors?: Record<string, string>;
}

// --- Auth ---

export interface AuthResponse {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  token: string;
  avatarUrl: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface OAuth2RegisterRequest {
  email: string;
  fullName: string;
  avatarUrl: string;
  role: string;
}

// --- User profile ---

export interface UserProfileResponse {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  isEnable: boolean;
}

export interface UpdateProfileRequest {
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
}

// --- Student dashboard / quizzes ---

export interface AssignedQuizSummary {
  assigningId: number;
  quizId: string | null;
  quizTitle: string | null;
  classroomId: number | null;
  classroomName: string | null;
  startDate: string | null;
  dueDate: string | null;
  durationInMins: number | null;
  maxAttempt: number | null;
  attemptsMade: number;
  attemptsLeft: number; // -1 = unlimited
  hasStarted: boolean;
  hasUnfinished: boolean;
  /** Decided by the server clock (see quizAvailability.ts for why the client must not compute this). */
  availability: "NOT_STARTED" | "AVAILABLE" | "EXPIRED";
}

export interface StudentDashboardResponse {
  greeting: string;
  totalCompleted: number;
  quizAvg: number | null;
  practiceAvg: number | null;
  pendingCount: number;
  pendingThisWeekCount: number;
  assignedQuizzes: AssignedQuizSummary[];
}

// --- Classrooms ---

export interface StudentClassroomSummary {
  id: number;
  code: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  teacherName: string | null;
  joinStatus: JoinStatus;
  joinedAt: string | null;
}

export interface ClassTopic {
  id: number;
  name: string;
  classroomId: number;
}

export interface StudentClassroomDetail {
  id: number;
  code: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  teacherName: string | null;
  topics: ClassTopic[];
  assignedQuizzes: AssignedQuizSummary[];
}

// --- Quiz taking (revision-aware) ---

export interface AnswerTaking {
  id: number;
  text: string;
}

export interface QuestionTaking {
  id: number;
  text: string;
  type: QuestionType;
  level: QuestionLevel;
  answers: AnswerTaking[];
}

export interface QuizTakingResponse {
  attemptId: number;
  quizTitle: string;
  durationInMins: number;
  startedAt: string;
  startedAtMillis: number;
  questions: QuestionTaking[];
  selectedAnswers: Record<string, number[]>;
  selectedTexts: Record<string, string>;
  answerRevisions: Record<string, number>;
}

export interface SaveAnswerRequest {
  answerIds: number[] | null;
  selectedText: string | null;
  revision: number | null;
}

export interface QuestionSubmit {
  questionId: number;
  answerIds: number[];
  selectedText: string;
  revision: number;
}

export interface QuizSubmitRequest {
  attemptId: number;
  questions: QuestionSubmit[];
}

export interface QuizSubmitResult {
  id: number;
  score: number;
}

export interface AnswerResult {
  answerId: number;
  text: string;
  isCorrect: boolean;
}

export interface QuestionResult {
  questionId: number;
  text: string;
  type: string;
  level: string;
  answers: AnswerResult[];
  selectedAnswerIds: number[];
  selectedText: string | null;
  isCorrect: boolean;
}

export interface QuizResultResponse {
  attemptId: number;
  quizTitle: string;
  score: number;
  correctNum: number;
  incorrectNum: number;
  totalNum: number;
  startedAt: string;
  endedAt: string;
  questions: QuestionResult[];
}

export interface ViolationRequest {
  attemptId: number;
  violationCode: string;
}

export interface ViolationResponse {
  violationCount: number;
  autoSubmitted: boolean;
  attemptId: number;
}

// --- History ---

export interface QuizHistoryItem {
  attemptId: number;
  result: number;
  startedAt: string;
  endedAt: string;
  quizTitle: string;
  quizAssigningId: number;
  classroomName: string | null;
}

// Spring Data's native Page<T> JSON shape.
export interface Page<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

// --- Profile ---

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// --- Notifications (the wire name for the read flag is "read", shared with the legacy bell) ---

export type NotificationType =
  | "QUESTION_APPROVED"
  | "QUESTION_REJECTED"
  | "JOIN_REQUEST"
  | "JOIN_APPROVED"
  | "QUIZ_SUBMITTED"
  | "QUIZ_ASSIGNED"
  | "JOIN_REJECTED"
  | "SYSTEM_ALERT";

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: NotificationType | null;
  read: boolean;
  link: string | null;
  createdAt: string | null;
}

// --- Categories (only what the practice setup needs) ---

export interface CategoryNode {
  id: number;
  name: string;
  fullPath: string | null;
  children: CategoryNode[];
}

// --- Practice ---

export interface PracticeStartRequest {
  categoryId: number;
  limit: number;
  offset?: number | null;
  isRandom?: boolean | null;
  forceNew?: boolean | null;
  practiceId?: number | null;
}

export interface PracticeAnswerOption {
  id: number;
  text: string;
  /** Sent by the backend already at start; used for optional instant feedback only - the score is always the server's. */
  isCorrect: boolean | null;
}

export interface PracticeQuestion {
  id: number;
  text: string;
  type: QuestionType;
  level: QuestionLevel | string | null;
  answers: PracticeAnswerOption[];
  selectedAnswerIds: number[] | null;
  selectedText: string | null;
  isCorrect: boolean | null;
}

export interface PracticeStartResponse {
  questions: PracticeQuestion[];
  practiceId: number | null;
  categoryId: number | null;
  categoryName: string | null;
  quizTitle: string | null;
}

export interface PracticeAnswerRequest {
  questionId: number;
  selectedAnswerId?: number | null;
  selectedAnswerIds?: number[] | null;
  selectedText?: string | null;
}

export interface PracticeSubmitRequest {
  categoryId: number;
  practiceId: number | null;
  answers: PracticeAnswerRequest[];
}

export interface PracticeDetail {
  questionId: number;
  questionText: string;
  selectedAnswerIds: number[] | null;
  selectedText: string | null;
  correctAnswerIds: number[] | null;
  correctTexts: string[] | null;
  isCorrect: boolean | null;
  questionType: QuestionType;
  questionLevel: string | null;
  answers: PracticeAnswerOption[];
}

export interface PracticeResult {
  practiceId: number;
  categoryName: string | null;
  totalQuestions: number;
  correctAnswers: number | null;
  score: number | null;
  createdAt: string | null;
  details: PracticeDetail[];
}

export interface PracticeHistoryItem {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  totalQuestions: number | null;
  correctAnswers: number | null;
  answeredQuestions: number | null;
  createdAt: string | null;
  isCompleted: boolean;
  isRandom: boolean | null;
  practiceLimit: number | null;
  practiceOffset: number | null;
}

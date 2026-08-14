export const THREAD_FORMATS = ["single", "thread"] as const;
export const THREAD_GOALS = ["reach", "clicks", "leads"] as const;
export const THREAD_CATEGORIES = ["problem", "solution", "capability", "offer"] as const;
export const THREAD_STATUSES = ["draft", "queued", "publishing", "published", "failed"] as const;

export type ThreadsFormat = (typeof THREAD_FORMATS)[number];
export type ThreadsGoal = (typeof THREAD_GOALS)[number];
export type ThreadsCategory = (typeof THREAD_CATEGORIES)[number];

export type GenerationInput = {
  niche: string;
  city: string;
  service: string;
  format: ThreadsFormat;
  goal: ThreadsGoal;
};

export function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function cleanTextArray(value: unknown, maxItems = 10, maxLength = 500) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function parsePositiveId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("Некорректный ID публикации");
  return id;
}

export function parseGenerationInput(payload: Record<string, unknown>): GenerationInput {
  const niche = cleanText(payload.niche, 100);
  const city = cleanText(payload.city, 100);
  const service = cleanText(payload.service, 160);
  const format = cleanText(payload.format, 20) as ThreadsFormat;
  const goal = cleanText(payload.goal, 20) as ThreadsGoal;
  if (!niche) throw new Error("Укажите нишу бизнеса");
  if (!service) throw new Error("Укажите предлагаемую услугу");
  if (!THREAD_FORMATS.includes(format)) throw new Error("Выберите формат публикации");
  if (!THREAD_GOALS.includes(goal)) throw new Error("Выберите цель публикации");
  return { niche, city, service, format, goal };
}

export function parseDate(value: unknown, label = "дата") {
  const text = cleanText(value, 50);
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) throw new Error(`Укажите корректную ${label}`);
  return date.toISOString();
}

export function cleanUrl(value: unknown) {
  const text = cleanText(value, 500);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new Error("Ссылки должны начинаться с http:// или https://");
  }
}

export function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Неизвестная ошибка";
  const isValidation = /^(Укажите|Выберите|Некоррект|Ссылки|Текст|Формат|Цель|Дата|Количество)/.test(message);
  return Response.json({ error: message }, { status: isValidation ? 400 : status });
}

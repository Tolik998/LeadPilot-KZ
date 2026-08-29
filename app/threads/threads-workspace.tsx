/* eslint-disable react-hooks/set-state-in-effect, jsx-a11y/label-has-associated-control */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AppShell,
  BrandMark,
  ConfirmDialog,
  Dialog,
  FeedbackBanner,
  Icon,
  type IconName,
} from "../ui";

type Tab =
  | "overview"
  | "create"
  | "plan"
  | "drafts"
  | "queue"
  | "published"
  | "analytics"
  | "settings";
type Format = "single" | "thread";
type Goal = "reach" | "clicks" | "leads";

type Post = {
  id: number;
  contentPlanId: number | null;
  niche: string;
  city: string;
  service: string;
  format: Format;
  goal: Goal;
  category: string;
  topic: string;
  messages: string[];
  firstLines: string[];
  ctas: string[];
  alternativeText: string;
  status: string;
  plannedFor: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  rootThreadsPostId: string;
  threadsPostIds: string[];
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

type QueueItem = {
  id: number;
  publicationId: number;
  scheduledAt: string;
  status: string;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string;
};

type Analytics = {
  id: number;
  publicationId: number;
  trackingSlug: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  linkClicks: number;
  manualLeads: number;
  lastSyncedAt: string | null;
};

type Settings = {
  performerName: string;
  services: string;
  prices: string;
  timelines: string;
  portfolioUrl: string;
  exampleUrl: string;
  whatsapp: string;
  ctaText: string;
  connected: boolean;
  threadsUsername: string;
  tokenExpiresAt: string | null;
};

type Plan = {
  id: number;
  durationDays: number;
  postsPerDay: number;
  niche: string;
  city: string;
  service: string;
  startDate: string;
  createdAt: string;
};
type AutoPostResult = {
  scheduled: number;
  skippedPast: number;
  alreadyQueued: number;
};
type Log = {
  id: number;
  publicationId: number | null;
  level: string;
  message: string;
  action: string;
  createdAt: string;
};
type WeeklyReport = {
  headline: string;
  recommendation: string;
  publicationId: number | null;
  generatedAt: string;
};
type Dashboard = {
  posts: Post[];
  plans: Plan[];
  queue: QueueItem[];
  analytics: Analytics[];
  logs: Log[];
  settings: Settings;
  weeklyReport: WeeklyReport;
};

const tabs: Array<{ id: Tab; label: string; short: string }> = [
  { id: "overview", label: "Обзор", short: "Обзор" },
  { id: "create", label: "Создать публикацию", short: "Создать" },
  { id: "plan", label: "Контент-план", short: "План" },
  { id: "drafts", label: "Черновики", short: "Черновики" },
  { id: "queue", label: "Очередь", short: "Очередь" },
  { id: "published", label: "Опубликованные", short: "Готово" },
  { id: "analytics", label: "Аналитика", short: "Аналитика" },
  { id: "settings", label: "Настройки", short: "Настройки" },
];

const emptySettings: Settings = {
  performerName: "",
  services: "",
  prices: "",
  timelines: "",
  portfolioUrl: "",
  exampleUrl: "",
  whatsapp: "",
  ctaText: "",
  connected: false,
  threadsUsername: "",
  tokenExpiresAt: null,
};

const today = () => new Date().toISOString().slice(0, 10);
const dateTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
const compact = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    notation: value > 9999 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
const postPreview = (post: Post) =>
  post.messages.join(" ").replace(/\s+/g, " ").trim();

function localDateTimeInput(value: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok)
    throw new Error(data.error || "Не удалось выполнить действие");
  return data;
}

export function ThreadsWorkspace() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Dashboard | null>(null);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Post | null>(null);
  const [editingBaseline, setEditingBaseline] = useState<Post | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Post | null>(null);
  const [scheduleAt, setScheduleAt] = useState(localDateTimeInput(null));
  const [coldTopics, setColdTopics] = useState<string[]>([]);
  const [generation, setGeneration] = useState({
    niche: "Все заведения",
    service: "Разработка сайтов",
    format: "single" as Format,
    goal: "leads" as Goal,
  });
  const [planForm, setPlanForm] = useState({
    durationDays: 7,
    postsPerDay: 1,
    startDate: today(),
    format: "single" as Format,
    goal: "reach" as Goal,
    autoPost: true,
  });

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const dashboard = await api<Dashboard>("/api/threads/dashboard");
      setData(dashboard);
      setSettings(dashboard.settings);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить раздел Threads",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth") === "connected")
      setNotice(
        "Аккаунт Threads подключён. Теперь можно подтверждать публикации и ставить их в очередь.",
      );
    if (params.get("oauth") === "error")
      setError(
        params.get("message") || "Не удалось подключить аккаунт Threads",
      );
    if (params.has("oauth")) window.history.replaceState({}, "", "/threads");
  }, []);

  const analyticsByPost = useMemo(
    () =>
      new Map(
        (data?.analytics || []).map((item) => [item.publicationId, item]),
      ),
    [data],
  );
  const postById = useMemo(
    () => new Map((data?.posts || []).map((item) => [item.id, item])),
    [data],
  );
  const totals = useMemo(
    () =>
      (data?.analytics || []).reduce(
        (result, item) => ({
          views: result.views + item.views,
          likes: result.likes + item.likes,
          replies: result.replies + item.replies,
          reposts: result.reposts + item.reposts,
          clicks: result.clicks + item.linkClicks,
          leads: result.leads + item.manualLeads,
        }),
        { views: 0, likes: 0, replies: 0, reposts: 0, clicks: 0, leads: 0 },
      ),
    [data],
  );

  function showError(value: unknown) {
    setError(
      value instanceof Error ? value.message : "Не удалось выполнить действие",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function generatePost() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ post: Post; coldTopics: string[] }>(
        "/api/threads/generate",
        { method: "POST", body: JSON.stringify(generation) },
      );
      setColdTopics(result.coldTopics);
      setEditing(result.post);
      setEditingBaseline(result.post);
      setScheduleAt(localDateTimeInput(null));
      setNotice(
        "Текст сохранён как черновик. Он не будет опубликован без вашего подтверждения.",
      );
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function generatePlan() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{
        posts: Post[];
        duplicateCount: number;
        autoPost: AutoPostResult;
      }>(
        "/api/threads/plans",
        {
          method: "POST",
          body: JSON.stringify({
            ...generation,
            ...planForm,
            autoPost: planForm.autoPost && settings.connected,
          }),
        },
      );
      const autoPostNote = result.autoPost.scheduled
        ? ` В очередь поставлено: ${result.autoPost.scheduled}.`
        : "";
      const skippedNote = result.autoPost.skippedPast
        ? ` Просроченные слоты оставлены в черновиках: ${result.autoPost.skippedPast}.`
        : "";
      setNotice(
        `План создан: ${result.posts.length} публикаций, повторов найдено: ${result.duplicateCount}.${autoPostNote}${skippedNote}`,
      );
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function enablePlanAutoPost(plan: Plan) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ autoPost: AutoPostResult }>(
        "/api/threads/plans",
        {
          method: "PATCH",
          body: JSON.stringify({ id: plan.id, action: "enable_autopost" }),
        },
      );
      const { scheduled, skippedPast, alreadyQueued } = result.autoPost;
      setNotice(
        scheduled > 0
          ? `Автопост включён: ${scheduled} публикаций добавлены в очередь.${skippedPast ? ` Просроченные публикации оставлены в черновиках: ${skippedPast}.` : ""}`
          : alreadyQueued > 0
            ? `Автопост уже активен: в очереди ${alreadyQueued} публикаций.`
            : "В этом плане нет будущих черновиков для автопоста.",
      );
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function persistEditor() {
    if (!editing) throw new Error("Черновик не выбран");
    const result = await api<{ post: Post }>("/api/threads/posts", {
      method: "PATCH",
      body: JSON.stringify({
        id: editing.id,
        action: "save",
        topic: editing.topic,
        messages: editing.messages,
        firstLines: editing.firstLines,
        ctas: editing.ctas,
        alternativeText: editing.alternativeText,
        format: editing.format,
        goal: editing.goal,
      }),
    });
    setEditing(result.post);
    setEditingBaseline(result.post);
    return result.post;
  }

  async function saveDraft(close = true) {
    setBusy(true);
    setError("");
    try {
      await persistEditor();
      setNotice("Изменения сохранены в черновике.");
      if (close) setEditing(null);
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function schedulePost() {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      const saved = await persistEditor();
      await api("/api/threads/posts", {
        method: "PATCH",
        body: JSON.stringify({
          id: saved.id,
          action: "schedule",
          scheduledAt: new Date(scheduleAt).toISOString(),
        }),
      });
      setEditing(null);
      setNotice(
        `Публикация поставлена в очередь на ${dateTime(new Date(scheduleAt).toISOString())}.`,
      );
      setTab("queue");
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function publishNow() {
    if (
      !editing ||
      !window.confirm(
        "Опубликовать этот текст в Threads сейчас? После подтверждения публикация начнётся сразу.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const saved = await persistEditor();
      const result = await api<{ post: Post; retryScheduled?: boolean }>(
        `/api/threads/posts/${saved.id}/publish`,
        { method: "POST" },
      );
      setEditing(null);
      setNotice(
        result.retryScheduled
          ? "Threads временно недоступен. Повторная попытка добавлена в очередь."
          : "Публикация размещена в Threads.",
      );
      setTab(result.retryScheduled ? "queue" : "published");
      await load(true);
    } catch (actionError) {
      showError(actionError);
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function deletePost(post: Post) {
    setBusy(true);
    try {
      await api(`/api/threads/posts?id=${post.id}`, { method: "DELETE" });
      setEditing(null);
      setDeleteCandidate(null);
      setNotice("Черновик удалён.");
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function cancelQueue(post: Post) {
    setBusy(true);
    try {
      await api("/api/threads/posts", {
        method: "PATCH",
        body: JSON.stringify({ id: post.id, action: "cancel_queue" }),
      });
      setNotice("Публикация снята с очереди и возвращена в черновики.");
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(index: number) {
    if (!editing) return;
    setBusy(true);
    try {
      const result = await api<{ post: Post }>("/api/threads/generate", {
        method: "POST",
        body: JSON.stringify({
          ...editing,
          mode: "part",
          publicationId: editing.id,
          partIndex: index,
        }),
      });
      setEditing(result.post);
      setEditingBaseline(result.post);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ settings: Settings }>(
        "/api/threads/settings",
        { method: "PATCH", body: JSON.stringify(settings) },
      );
      setSettings(result.settings);
      setNotice(
        "Настройки предложения сохранены и будут использоваться в новых текстах.",
      );
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        "Отключить аккаунт Threads? Черновики и аналитика останутся в LeadPilot.",
      )
    )
      return;
    setBusy(true);
    try {
      await api("/api/threads/settings", { method: "DELETE" });
      setNotice("Аккаунт Threads отключён.");
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function syncAnalytics() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ synced: number }>("/api/threads/analytics", {
        method: "POST",
      });
      setNotice(`Аналитика обновлена для ${result.synced} публикаций.`);
      await load(true);
    } catch (actionError) {
      showError(actionError);
    } finally {
      setBusy(false);
    }
  }

  async function updateLeads(publicationId: number, value: number) {
    try {
      await api("/api/threads/analytics", {
        method: "PATCH",
        body: JSON.stringify({
          publicationId,
          manualLeads: Math.max(0, value),
        }),
      });
      await load(true);
    } catch (actionError) {
      showError(actionError);
    }
  }

  function openEditor(post: Post) {
    const copy = {
      ...post,
      messages: [...post.messages],
      firstLines: [...post.firstLines],
      ctas: [...post.ctas],
    };
    setEditing(copy);
    setEditingBaseline(copy);
    setScheduleAt(localDateTimeInput(post.scheduledAt));
  }

  function requestCloseEditor() {
    if (!editing) return;
    const editable = (post: Post) => ({
      topic: post.topic,
      messages: post.messages,
      firstLines: post.firstLines,
      ctas: post.ctas,
      alternativeText: post.alternativeText,
      format: post.format,
      goal: post.goal,
    });
    const changed =
      editingBaseline &&
      JSON.stringify(editable(editing)) !==
        JSON.stringify(editable(editingBaseline));
    if (
      changed &&
      !window.confirm("Закрыть редактор и потерять несохранённые изменения?")
    )
      return;
    setEditing(null);
  }

  function moveMessage(index: number, direction: -1 | 1) {
    if (!editing) return;
    const next = [...editing.messages];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEditing({ ...editing, messages: next });
  }

  function chooseFirstLine(line: string) {
    if (!editing) return;
    const messages = [...editing.messages];
    if (editing.format === "thread") messages[0] = line;
    else
      messages[0] =
        `${line}\n\n${messages[0].split(/\n\n/).slice(1).join("\n\n")}`.trim();
    setEditing({ ...editing, messages });
  }

  function appendCta(cta: string) {
    if (!editing) return;
    const messages = [...editing.messages];
    const last = messages.length - 1;
    messages[last] =
      `${messages[last].replace(/\n\n[^\n]+$/, "")}\n\n${cta}`.slice(0, 500);
    setEditing({ ...editing, messages });
  }

  if (loading && !data)
    return (
      <div className="threads-loading-page">
        <BrandMark />
        <p>Загружаю рабочее пространство Threads…</p>
      </div>
    );

  const drafts = (data?.posts || []).filter((post) =>
    ["draft", "failed"].includes(post.status),
  );
  const queued = (data?.queue || []).filter((item) =>
    ["pending", "processing", "retry", "failed"].includes(item.status),
  );
  const published = (data?.posts || []).filter(
    (post) => post.status === "published",
  );

  return (
    <AppShell active="threads">
      <div className="threads-main threads-shell">
        <header className="topbar threads-heading">
          <div>
            <p className="eyebrow">Привлечение клиентов на разработку сайтов</p>
            <h1>Threads</h1>
            <p className="subtitle">
              Создавайте экспертный контент, согласовывайте его и публикуйте по
              расписанию.
            </p>
          </div>
          <div className="top-actions">
            <span
              className={`connection-chip ${settings.connected ? "connected" : ""}`}
            >
              <i />
              {settings.connected
                ? `@${settings.threadsUsername || "подключён"}`
                : "Аккаунт не подключён"}
            </span>
            <button className="button primary" onClick={() => setTab("create")}>
              <Icon name="plus" />
              Создать публикацию
            </button>
          </div>
        </header>

        <div
          className="threads-tabs"
          role="tablist"
          aria-label="Разделы Threads"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
              role="tab"
              aria-selected={tab === item.id}
            >
              <span className="desktop-tab-label">{item.label}</span>
              <span className="mobile-tab-label">{item.short}</span>
            </button>
          ))}
        </div>

        {error && (
          <FeedbackBanner tone="error" onClose={() => setError("")}>
            <span>{error}</span>
          </FeedbackBanner>
        )}
        {notice && (
          <FeedbackBanner tone="info" onClose={() => setNotice("")}>
            <span>{notice}</span>
          </FeedbackBanner>
        )}

        {tab === "overview" && (
          <Overview
            data={data}
            drafts={drafts}
            queued={queued}
            published={published}
            totals={totals}
            onTab={setTab}
            onEdit={openEditor}
            postById={postById}
          />
        )}
        {tab === "create" && (
          <section className="threads-two-column">
            <div className="threads-card padded">
              <div className="section-title">
                <div>
                  <span className="step-number">1</span>
                  <h2>Параметры публикации</h2>
                </div>
                <p>Новый текст автоматически сохранится в черновики.</p>
              </div>
              <div className="form-grid threads-form">
                <div className="form-group full">
                  <label>Ниша бизнеса *</label>
                  <input
                    className="field"
                    value={generation.niche}
                    onChange={(event) =>
                      setGeneration({
                        ...generation,
                        niche: event.target.value,
                      })
                    }
                    placeholder="Например, стоматология"
                  />
                </div>
                <div className="form-group full">
                  <label>Предлагаемая услуга *</label>
                  <input
                    className="field"
                    value={generation.service}
                    onChange={(event) =>
                      setGeneration({
                        ...generation,
                        service: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Формат</label>
                  <div className="segmented">
                    <button
                      className={generation.format === "single" ? "active" : ""}
                      onClick={() =>
                        setGeneration({ ...generation, format: "single" })
                      }
                    >
                      Одиночный пост
                    </button>
                    <button
                      className={generation.format === "thread" ? "active" : ""}
                      onClick={() =>
                        setGeneration({ ...generation, format: "thread" })
                      }
                    >
                      Ветка 5–7
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Цель</label>
                  <select
                    className="select"
                    value={generation.goal}
                    onChange={(event) =>
                      setGeneration({
                        ...generation,
                        goal: event.target.value as Goal,
                      })
                    }
                  >
                    <option value="reach">Охват</option>
                    <option value="clicks">Переходы</option>
                    <option value="leads">Заявки</option>
                  </select>
                </div>
              </div>
              <button
                className="button primary wide-action"
                disabled={busy}
                onClick={() => void generatePost()}
              >
                <Icon name="spark" />
                {busy ? "Создаю и сохраняю…" : "Создать черновик"}
              </button>
            </div>
            <aside className="threads-card padded guardrail-card">
              <span className="guardrail-mark">
                <Icon name="check" />
              </span>
              <h3>Фактологически безопасный контент</h3>
              <p>
                Генератор не использует личные истории, выдуманные кейсы, ложные
                цифры или гарантии продаж.
              </p>
              <ul>
                <li>Проблемы бизнеса и путь клиента</li>
                <li>Практичные возможности сайта</li>
                <li>Естественный призыв написать</li>
                <li>Альтернативный вариант текста</li>
              </ul>
            </aside>
            {coldTopics.length > 0 && (
              <div className="threads-card padded full-column">
                <div className="section-title">
                  <div>
                    <span className="step-number">2</span>
                    <h2>Темы для холодной аудитории</h2>
                  </div>
                </div>
                <div className="topic-grid">
                  {coldTopics.map((topic) => (
                    <div key={topic} className="topic-item">
                      {topic}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "plan" && (
          <section className="threads-stack">
            <div className="threads-card padded plan-builder">
              <div className="section-title">
                <div>
                  <h2>Новый контент-план</h2>
                  <p>
                    40% проблем · 30% решений · 20% возможностей · 10%
                    предложения
                  </p>
                </div>
              </div>
              <div className="plan-controls">
                <div className="form-group">
                  <label>Период</label>
                  <div className="segmented">
                    <button
                      className={planForm.durationDays === 7 ? "active" : ""}
                      onClick={() =>
                        setPlanForm({ ...planForm, durationDays: 7 })
                      }
                    >
                      7 дней
                    </button>
                    <button
                      className={planForm.durationDays === 30 ? "active" : ""}
                      onClick={() =>
                        setPlanForm({ ...planForm, durationDays: 30 })
                      }
                    >
                      30 дней
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Частота</label>
                  <select
                    className="select"
                    value={planForm.postsPerDay}
                    onChange={(event) =>
                      setPlanForm({
                        ...planForm,
                        postsPerDay: Number(event.target.value),
                      })
                    }
                  >
                    <option value={1}>1 публикация в день</option>
                    <option value={2}>2 публикации в день</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Начало</label>
                  <input
                    className="field"
                    type="date"
                    value={planForm.startDate}
                    onChange={(event) =>
                      setPlanForm({
                        ...planForm,
                        startDate: event.target.value,
                      })
                    }
                  />
                </div>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void generatePlan()}
                >
                  {busy
                    ? "Собираю план…"
                    : planForm.autoPost && settings.connected
                      ? "Создать план с автопостом"
                      : `Создать ${planForm.durationDays * planForm.postsPerDay} черновиков`}
                </button>
              </div>
              <label
                className={`automation-toggle plan-autopost-toggle ${!settings.connected ? "disabled" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={planForm.autoPost && settings.connected}
                  disabled={!settings.connected}
                  onChange={(event) =>
                    setPlanForm({
                      ...planForm,
                      autoPost: event.target.checked,
                    })
                  }
                />
                <span>
                  <strong>Автопостинг по контент-плану</strong>
                  <small>
                    {settings.connected
                      ? "Будущие публикации сразу попадут в очередь и выйдут после наступления времени при ближайшем запуске cron."
                      : "Сначала подключите аккаунт Threads в настройках — до этого план сохранится как черновики."}
                  </small>
                </span>
              </label>
              <p className="hint">
                Ниша, город и услуга берутся из формы «Создать публикацию».
                Повторы тем проверяются до сохранения.
              </p>
            </div>
            {(data?.plans || []).map((plan) => (
              <PlanBlock
                key={plan.id}
                plan={plan}
                posts={(data?.posts || []).filter(
                  (post) => post.contentPlanId === plan.id,
                )}
                onEdit={openEditor}
                onEnableAutoPost={enablePlanAutoPost}
                connected={settings.connected}
                busy={busy}
              />
            ))}
            {!data?.plans.length && (
              <Empty
                icon="calendar"
                title="Контент-планов пока нет"
                text="Выберите период и частоту — LeadPilot подготовит темы и сохранит все тексты как черновики."
              />
            )}
          </section>
        )}

        {tab === "drafts" && (
          <PostCollection
            title="Черновики"
            subtitle="Ничего отсюда не публикуется автоматически."
            posts={drafts}
            analyticsByPost={analyticsByPost}
            onEdit={openEditor}
            empty={
              <Empty
                icon="edit"
                title="Черновиков пока нет"
                text="Создайте публикацию или контент-план — новые тексты появятся здесь."
              />
            }
          />
        )}

        {tab === "queue" && (
          <section className="threads-card list-card">
            <div className="list-heading">
              <div>
                <h2>Очередь публикаций</h2>
                <p>
                  На бесплатном тарифе Vercel очередь запускается ежедневно в
                  09:00.
                </p>
              </div>
              <span className="count-badge">{queued.length}</span>
            </div>
            {queued.length ? (
              <div className="queue-list">
                {queued.map((item) => {
                  const post = postById.get(item.publicationId);
                  if (!post) return null;
                  return (
                    <div className="queue-row" key={item.id}>
                      <div className={`queue-status ${item.status}`}>
                        <i />
                      </div>
                      <div className="queue-time">
                        <strong>{dateTime(item.scheduledAt)}</strong>
                        <span>
                          {item.status === "retry"
                            ? `Повтор ${item.attempts + 1}`
                            : item.status === "failed"
                              ? "Ошибка"
                              : item.status === "processing"
                                ? "Публикуется"
                                : "Запланировано"}
                        </span>
                      </div>
                      <div className="queue-content">
                        <strong>{post.topic}</strong>
                        <p>{post.messages[0]}</p>
                        {item.lastError && (
                          <small className="danger-text">
                            {item.lastError}
                          </small>
                        )}
                      </div>
                      <div className="row-actions">
                        <button
                          className="button small"
                          onClick={() => openEditor(post)}
                        >
                          Открыть
                        </button>
                        <button
                          className="button small danger"
                          disabled={busy || item.status === "processing"}
                          onClick={() => void cancelQueue(post)}
                        >
                          Снять
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                icon="calendar"
                title="Очередь пуста"
                text="Назначьте дату и время в редакторе черновика."
              />
            )}
          </section>
        )}

        {tab === "published" && (
          <PostCollection
            title="Опубликованные"
            subtitle="Журнал успешно размещённых постов и веток."
            posts={published}
            analyticsByPost={analyticsByPost}
            onEdit={openEditor}
            empty={
              <Empty
                icon="check"
                title="Публикаций пока нет"
                text="После подтверждения и успешной отправки посты появятся здесь."
              />
            }
            published
          />
        )}

        {tab === "analytics" && (
          <section className="threads-stack">
            <div className="analytics-header">
              <div>
                <h2>Результаты публикаций</h2>
                <p>
                  Метрики Threads обновляются через официальный API; переходы
                  считаются по отслеживаемой ссылке, заявки отмечаются вручную.
                </p>
              </div>
              <button
                className="button"
                disabled={busy || !settings.connected}
                onClick={() => void syncAnalytics()}
              >
                <Icon name="refresh" />
                {busy ? "Обновляю…" : "Обновить метрики"}
              </button>
            </div>
            <div className="stats analytics-stats">
              <Stat
                label="Просмотры"
                value={totals.views}
                detail="всего"
                color="#dcebe3"
              />
              <Stat
                label="Реакции"
                value={totals.likes + totals.replies + totals.reposts}
                detail="лайки, ответы, репосты"
                color="#fff0d6"
              />
              <Stat
                label="Переходы"
                value={totals.clicks}
                detail="по отслеживаемой ссылке"
                color="#dfe9ff"
              />
              <Stat
                label="Заявки"
                value={totals.leads}
                detail="отмечены вручную"
                color="#dff4c0"
              />
            </div>
            <div className="threads-card weekly-report">
              <span>Еженедельный разбор</span>
              <h3>{data?.weeklyReport.headline}</h3>
              <p>{data?.weeklyReport.recommendation}</p>
              <button className="button small" onClick={() => setTab("plan")}>
                Создать новый план →
              </button>
            </div>
            <div className="threads-card table-wrap analytics-table">
              <table>
                <thead>
                  <tr>
                    <th>Публикация</th>
                    <th>Просмотры</th>
                    <th>Лайки</th>
                    <th>Ответы</th>
                    <th>Репосты</th>
                    <th>Переходы</th>
                    <th>Заявки</th>
                  </tr>
                </thead>
                <tbody>
                  {published.map((post) => {
                    const stats = analyticsByPost.get(post.id);
                    return (
                      <tr key={post.id}>
                        <td>
                          <strong className="table-topic">{post.topic}</strong>
                          <small>{dateTime(post.publishedAt)}</small>
                        </td>
                        <td>{compact(stats?.views || 0)}</td>
                        <td>{compact(stats?.likes || 0)}</td>
                        <td>{compact(stats?.replies || 0)}</td>
                        <td>{compact(stats?.reposts || 0)}</td>
                        <td>{compact(stats?.linkClicks || 0)}</td>
                        <td>
                          <input
                            className="leads-input"
                            type="number"
                            min={0}
                            defaultValue={stats?.manualLeads || 0}
                            aria-label={`Заявки для ${post.topic}`}
                            onBlur={(event) =>
                              void updateLeads(
                                post.id,
                                Number(event.target.value),
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!published.length && (
                <Empty
                  icon="analytics"
                  title="Нет данных для аналитики"
                  text="Метрики появятся после первой публикации."
                />
              )}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="settings-grid">
            <div className="threads-card padded">
              <div className="section-title">
                <div>
                  <h2>Ваше предложение</h2>
                  <p>Эти данные используются только в новых публикациях.</p>
                </div>
              </div>
              <div className="form-grid threads-form">
                <div className="form-group">
                  <label>Имя исполнителя</label>
                  <input
                    className="field"
                    value={settings.performerName}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        performerName: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>WhatsApp</label>
                  <input
                    className="field"
                    value={settings.whatsapp}
                    onChange={(event) =>
                      setSettings({ ...settings, whatsapp: event.target.value })
                    }
                    placeholder="+7 777 000 00 00"
                  />
                </div>
                <div className="form-group full">
                  <label>Услуги</label>
                  <textarea
                    className="textarea"
                    value={settings.services}
                    onChange={(event) =>
                      setSettings({ ...settings, services: event.target.value })
                    }
                    placeholder="Разработка сайта, каталог, онлайн-запись…"
                  />
                </div>
                <div className="form-group">
                  <label>Цены</label>
                  <input
                    className="field"
                    value={settings.prices}
                    onChange={(event) =>
                      setSettings({ ...settings, prices: event.target.value })
                    }
                    placeholder="Только реальные условия"
                  />
                </div>
                <div className="form-group">
                  <label>Сроки</label>
                  <input
                    className="field"
                    value={settings.timelines}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        timelines: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Ссылка на портфолио</label>
                  <input
                    className="field"
                    type="url"
                    value={settings.portfolioUrl}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        portfolioUrl: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Ссылка на пример сайта</label>
                  <input
                    className="field"
                    type="url"
                    value={settings.exampleUrl}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        exampleUrl: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group full">
                  <label>Текст призыва к действию</label>
                  <textarea
                    className="textarea"
                    value={settings.ctaText}
                    onChange={(event) =>
                      setSettings({ ...settings, ctaText: event.target.value })
                    }
                    placeholder="Если хотите разобрать задачу для вашего бизнеса, напишите мне…"
                  />
                </div>
              </div>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void saveSettings()}
              >
                {busy ? "Сохраняю…" : "Сохранить настройки"}
              </button>
            </div>
            <aside className="threads-card padded account-card">
              <div className="account-icon">@</div>
              <h2>Аккаунт Threads</h2>
              {settings.connected ? (
                <>
                  <span className="signal good">
                    ● Подключён @{settings.threadsUsername}
                  </span>
                  <p>
                    Токен хранится на сервере в зашифрованном виде и никогда не
                    передаётся в браузер.
                  </p>
                  <dl>
                    <div>
                      <dt>Действует до</dt>
                      <dd>{dateTime(settings.tokenExpiresAt)}</dd>
                    </div>
                    <div>
                      <dt>Публикации</dt>
                      <dd>Только после подтверждения</dd>
                    </div>
                  </dl>
                  <button
                    className="button danger"
                    disabled={busy}
                    onClick={() => void disconnect()}
                  >
                    Отключить аккаунт
                  </button>
                </>
              ) : (
                <>
                  <p>
                    Подключите профессиональный профиль через официальную
                    авторизацию Meta, чтобы публиковать и получать аналитику.
                  </p>
                  <a className="button primary" href="/api/threads/oauth/start">
                    Подключить Threads
                  </a>
                  <small>
                    Потребуются серверные ключи Meta в окружении проекта.
                  </small>
                </>
              )}
            </aside>
          </section>
        )}
      </div>

      {editing && (
        <Editor
          post={editing}
          scheduleAt={scheduleAt}
          setScheduleAt={setScheduleAt}
          busy={busy}
          connected={settings.connected}
          onChange={setEditing}
          onClose={requestCloseEditor}
          onMove={moveMessage}
          onRegenerate={(index) => void regenerate(index)}
          onFirstLine={chooseFirstLine}
          onCta={appendCta}
          onSave={() => void saveDraft()}
          onSchedule={() => void schedulePost()}
          onPublish={() => void publishNow()}
          onDelete={() => {
            setDeleteCandidate(editing);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title="Удалить черновик?"
        description={
          deleteCandidate
            ? `«${deleteCandidate.topic}» будет удалён из LeadPilot. Это действие нельзя отменить.`
            : ""
        }
        confirmLabel="Удалить"
        busy={busy}
        onClose={() => {
          if (deleteCandidate) setEditing(deleteCandidate);
          setDeleteCandidate(null);
        }}
        onConfirm={() => deleteCandidate && void deletePost(deleteCandidate)}
      />
    </AppShell>
  );
}

function Stat({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  color: string;
}) {
  return (
    <div
      className="stat"
      style={{ "--stat-color": color } as React.CSSProperties}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value">{compact(value)}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

function Overview({
  data,
  drafts,
  queued,
  published,
  totals,
  onTab,
  onEdit,
  postById,
}: {
  data: Dashboard | null;
  drafts: Post[];
  queued: QueueItem[];
  published: Post[];
  totals: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    clicks: number;
    leads: number;
  };
  onTab: (tab: Tab) => void;
  onEdit: (post: Post) => void;
  postById: Map<number, Post>;
}) {
  return (
    <section className="threads-stack">
      <div className="stats">
        <Stat
          label="Черновики"
          value={drafts.length}
          detail="ожидают согласования"
          color="#fff0d6"
        />
        <Stat
          label="В очереди"
          value={queued.length}
          detail="подтверждены"
          color="#dfe9ff"
        />
        <Stat
          label="Опубликовано"
          value={published.length}
          detail="успешно размещено"
          color="#dff4c0"
        />
        <Stat
          label="Просмотры"
          value={totals.views}
          detail="по всем публикациям"
          color="#dcebe3"
        />
      </div>
      <div className="threads-dashboard-grid">
        <div className="threads-card padded overview-hero">
          <span className="eyebrow">Следующий шаг</span>
          <h2>
            {drafts.length
              ? `${drafts.length} ${drafts.length === 1 ? "черновик ждёт" : "черновиков ждут"} проверки`
              : "Подготовьте первую публикацию"}
          </h2>
          <p>
            {drafts.length
              ? "Проверьте формулировки, выберите первую строку и подтвердите время публикации."
              : "Укажите нишу, город, услугу и цель — LeadPilot предложит темы, первые строки и готовый текст."}
          </p>
          <div className="top-actions">
            <button
              className="button primary"
              onClick={() => (drafts[0] ? onEdit(drafts[0]) : onTab("create"))}
            >
              {drafts.length ? "Открыть черновик" : "Создать публикацию"}
            </button>
            <button className="button" onClick={() => onTab("plan")}>
              Собрать контент-план
            </button>
          </div>
        </div>
        <div className="threads-card padded overview-mini">
          <div className="mini-heading">
            <h3>Ближайшие публикации</h3>
            <button onClick={() => onTab("queue")}>Вся очередь →</button>
          </div>
          {queued.slice(0, 3).map((item) => {
            const post = postById.get(item.publicationId);
            return (
              <div className="mini-row" key={item.id}>
                <span>
                  {new Date(item.scheduledAt).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <div>
                  <strong>{post?.topic || "Публикация"}</strong>
                  <small>{dateTime(item.scheduledAt)}</small>
                </div>
              </div>
            );
          })}
          {!queued.length && <p className="muted">Очередь пока пуста.</p>}
        </div>
      </div>
      <div className="threads-card activity-card">
        <div className="list-heading">
          <div>
            <h2>Последние события</h2>
            <p>Результаты публикации и ошибки API.</p>
          </div>
        </div>
        {data?.logs.length ? (
          <div className="activity-list">
            {data.logs.slice(0, 6).map((log) => (
              <div key={log.id}>
                <span className={`log-dot ${log.level}`} />
                <p>
                  <strong>{log.message}</strong>
                  <small>{dateTime(log.createdAt)}</small>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon="threads"
            title="Событий пока нет"
            text="Здесь появится журнал работы очереди и Threads API."
          />
        )}
      </div>
    </section>
  );
}

function Empty({
  icon,
  title,
  text,
}: {
  icon: IconName;
  title: string;
  text: string;
}) {
  return (
    <div className="empty compact-empty">
      <div className="empty-mark">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function PlanBlock({
  plan,
  posts,
  onEdit,
  onEnableAutoPost,
  connected,
  busy,
}: {
  plan: Plan;
  posts: Post[];
  onEdit: (post: Post) => void;
  onEnableAutoPost: (plan: Plan) => void;
  connected: boolean;
  busy: boolean;
}) {
  const [renderedAt] = useState(() => Date.now());
  const queuedCount = posts.filter((post) => post.status === "queued").length;
  const futureDraftCount = posts.filter(
    (post) =>
      ["draft", "failed"].includes(post.status) &&
      post.plannedFor &&
      new Date(post.plannedFor).getTime() > renderedAt + 30_000,
  ).length;
  const grouped = [...posts]
    .sort((left, right) => {
      const byDate = (left.plannedFor || left.createdAt).localeCompare(
        right.plannedFor || right.createdAt,
      );
      return byDate || left.id - right.id;
    })
    .reduce((map, post) => {
      const key = (post.plannedFor || post.createdAt).slice(0, 10);
      map.set(key, [...(map.get(key) || []), post]);
      return map;
    }, new Map<string, Post[]>());
  return (
    <div className="threads-card plan-block">
      <div className="list-heading">
        <div>
          <h2>
            {plan.durationDays} дней · {plan.niche}
          </h2>
          <p>
            {plan.city ? `${plan.city} · ` : ""}
            {plan.postsPerDay} публикации в день · {posts.length} черновиков
          </p>
        </div>
        <div className="plan-heading-actions">
          <span className={`signal ${queuedCount ? "good" : ""}`}>
            {queuedCount ? `Автопост: ${queuedCount} в очереди` : "Активный план"}
          </span>
          {futureDraftCount > 0 && (
            <button
              className="button small"
              type="button"
              disabled={busy || !connected}
              title={
                connected
                  ? "Поставить будущие публикации плана в очередь"
                  : "Сначала подключите аккаунт Threads в настройках"
              }
              onClick={() => onEnableAutoPost(plan)}
            >
              {queuedCount ? "Добавить оставшиеся" : "Включить автопост"}
            </button>
          )}
        </div>
      </div>
      <div className="plan-days">
        {[...grouped.entries()].map(([date, items], dayIndex) => (
          <div className="plan-day" key={date}>
            <div className="plan-date">
              <span>День {dayIndex + 1}</span>
              <strong>
                {new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                })}
              </strong>
            </div>
            <div>
              {items.map((post) => (
                <button
                  key={post.id}
                  onClick={() => onEdit(post)}
                  className="plan-post"
                >
                  <span className={`category-dot ${post.category}`} />
                  <div>
                    <strong>{post.topic}</strong>
                    <small>
                      {post.format === "thread"
                        ? `Ветка · ${post.messages.length} частей`
                        : "Одиночный пост"}
                    </small>
                  </div>
                  <i>→</i>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostCollection({
  title,
  subtitle,
  posts,
  analyticsByPost,
  onEdit,
  empty,
  published = false,
}: {
  title: string;
  subtitle: string;
  posts: Post[];
  analyticsByPost: Map<number, Analytics>;
  onEdit: (post: Post) => void;
  empty: React.ReactNode;
  published?: boolean;
}) {
  return (
    <section className="threads-card list-card">
      <div className="list-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="count-badge">{posts.length}</span>
      </div>
      {posts.length ? (
        <div className="post-grid">
          {posts.map((post) => {
            const stats = analyticsByPost.get(post.id);
            return (
              <article className="post-card" key={post.id}>
                <div className="post-card-top">
                  <span className={`format-badge ${post.format}`}>
                    {post.format === "thread"
                      ? `Ветка · ${post.messages.length}`
                      : "Пост"}
                  </span>
                  <span className={`category-label ${post.category}`}>
                    {post.category === "problem"
                      ? "Проблема"
                      : post.category === "solution"
                        ? "Решение"
                        : post.category === "capability"
                          ? "Возможность"
                          : "Предложение"}
                  </span>
                </div>
                <h3>{post.topic}</h3>
                <p>{postPreview(post)}</p>
                {post.lastError && (
                  <small className="danger-text">{post.lastError}</small>
                )}
                <footer>
                  {published ? (
                    <div className="post-metrics">
                      <span>
                        <Icon name="analytics" size={14} />
                        {compact(stats?.views || 0)}
                      </span>
                      <span>
                        <Icon name="message" size={14} />
                        {compact(stats?.likes || 0)}
                      </span>
                      <span>
                        <Icon name="external" size={14} />
                        {compact(stats?.linkClicks || 0)}
                      </span>
                    </div>
                  ) : (
                    <span>
                      {post.plannedFor
                        ? `В плане: ${dateTime(post.plannedFor)}`
                        : `Изменён ${dateTime(post.updatedAt)}`}
                    </span>
                  )}
                  <button className="button small" onClick={() => onEdit(post)}>
                    {published ? "Подробнее" : "Редактировать"}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        empty
      )}
    </section>
  );
}

function Editor({
  post,
  scheduleAt,
  setScheduleAt,
  busy,
  connected,
  onChange,
  onClose,
  onMove,
  onRegenerate,
  onFirstLine,
  onCta,
  onSave,
  onSchedule,
  onPublish,
  onDelete,
}: {
  post: Post;
  scheduleAt: string;
  setScheduleAt: (value: string) => void;
  busy: boolean;
  connected: boolean;
  onChange: (post: Post) => void;
  onClose: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRegenerate: (index: number) => void;
  onFirstLine: (line: string) => void;
  onCta: (cta: string) => void;
  onSave: () => void;
  onSchedule: () => void;
  onPublish: () => void;
  onDelete: () => void;
}) {
  const readOnly = post.status === "published";

  const editorFooter = readOnly ? undefined : (
    <>
      <button className="button danger" disabled={busy} onClick={onDelete}>
        Удалить
      </button>
      <span className="editor-footer-spacer" />
      <button className="button" disabled={busy} onClick={onSave}>
        {busy ? "Сохраняю…" : "Сохранить черновик"}
      </button>
      <button
        className="button"
        disabled={busy || !connected}
        onClick={onSchedule}
      >
        Назначить время
      </button>
      <button
        className="button primary"
        disabled={busy || !connected}
        onClick={onPublish}
      >
        Опубликовать сейчас
      </button>
    </>
  );

  return (
    <Dialog
      open
      title={readOnly ? "Опубликованная публикация" : "Редактор публикации"}
      description={
        readOnly
          ? `Опубликовано ${dateTime(post.publishedAt)}`
          : "Проверьте текст перед сохранением или публикацией."
      }
      onClose={onClose}
      size="editor"
      footer={editorFooter}
    >
      <div className="threads-editor editor-body">
        <div className="editor-main">
          <div className="form-group">
            <label>Тема</label>
            <input
              className="field"
              disabled={readOnly}
              value={post.topic}
              onChange={(event) =>
                onChange({ ...post, topic: event.target.value })
              }
            />
          </div>
          <div className="message-stack">
            {post.messages.map((message, index) => (
              <div className="message-editor" key={index}>
                <div className="message-number">{index + 1}</div>
                <div>
                  <div className="message-toolbar">
                    <span>
                      {post.format === "thread"
                        ? `Сообщение ${index + 1}`
                        : "Текст публикации"}
                    </span>
                    <div>
                      {post.messages.length > 1 && (
                        <>
                          <button
                            disabled={readOnly || index === 0}
                            onClick={() => onMove(index, -1)}
                            title="Поднять"
                          >
                            ↑
                          </button>
                          <button
                            disabled={
                              readOnly || index === post.messages.length - 1
                            }
                            onClick={() => onMove(index, 1)}
                            title="Опустить"
                          >
                            ↓
                          </button>
                        </>
                      )}
                      <button
                        disabled={readOnly || busy}
                        onClick={() => onRegenerate(index)}
                      >
                        Пересоздать
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="textarea"
                    disabled={readOnly}
                    maxLength={500}
                    value={message}
                    onChange={(event) => {
                      const messages = [...post.messages];
                      messages[index] = event.target.value;
                      onChange({ ...post, messages });
                    }}
                  />
                  <small className={message.length > 480 ? "near-limit" : ""}>
                    {message.length} / 500
                  </small>
                </div>
              </div>
            ))}
          </div>
          {!readOnly && (
            <div className="alternative">
              <div>
                <strong>Альтернативный вариант</strong>
                <button
                  onClick={() =>
                    onChange({
                      ...post,
                      messages: [post.alternativeText],
                      format: "single",
                    })
                  }
                >
                  Использовать
                </button>
              </div>
              <p>{post.alternativeText}</p>
            </div>
          )}
        </div>
        <aside className="editor-aside">
          <div className="editor-option">
            <h3>Первые строки</h3>
            <p>Выберите один из 10 вариантов.</p>
            <div className="option-list">
              {post.firstLines.map((line, index) => (
                <button
                  disabled={readOnly}
                  key={line}
                  onClick={() => onFirstLine(line)}
                >
                  <span>{index + 1}</span>
                  {line}
                </button>
              ))}
            </div>
          </div>
          <div className="editor-option">
            <h3>Призывы написать</h3>
            <div className="cta-list">
              {post.ctas.map((cta) => (
                <button
                  disabled={readOnly}
                  key={cta}
                  onClick={() => onCta(cta)}
                >
                  {cta}
                  <Icon name="plus" size={14} />
                </button>
              ))}
            </div>
          </div>
          {!readOnly && (
            <div className="editor-option schedule-box">
              <h3>Дата и время</h3>
              <input
                className="field"
                type="datetime-local"
                value={scheduleAt}
                min={localDateTimeInput(new Date().toISOString())}
                onChange={(event) => setScheduleAt(event.target.value)}
              />
              <p>
                {connected
                  ? "Очередь опубликует текст после подтверждения."
                  : "Сначала подключите Threads в настройках."}
              </p>
            </div>
          )}
        </aside>
      </div>
    </Dialog>
  );
}

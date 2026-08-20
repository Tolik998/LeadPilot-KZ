/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, ConfirmDialog, Dialog, FeedbackBanner, Icon } from "./ui";

type Status = "new" | "contacted" | "replied" | "demo" | "client" | "declined";

type Lead = {
  id: number;
  name: string;
  category: string;
  city: string;
  address: string;
  phone: string;
  whatsapp: string;
  website: string;
  instagram: string;
  sourceUrl: string;
  rating: number | null;
  reviewsCount: number;
  reviewsCheckedAt: string | null;
  hasSite: boolean;
  status: Status;
  notes: string;
  lastContactedAt: string | null;
  createdAt: string;
};

type LeadDraft = Omit<
  Lead,
  "id" | "createdAt" | "lastContactedAt" | "reviewsCount" | "reviewsCheckedAt"
>;

type ImportForm = {
  apiKey: string;
  city: string;
  query: string;
  pages: number;
  minReviews: number;
};

type SavedAutomation = ImportForm & {
  enabled: boolean;
  lastSync: string | null;
  reviewsBackfillCompleted?: boolean;
  nextCursor?: number;
  searchScope?: string;
};

type SearchSort = "creation_time" | "relevance" | "rating" | "name";

const automationStorageKey = "leadpilot-2gis-automation";
const templateStorageKey = "leadpilot-message-template-v5";
const followUpTemplateStorageKey = "leadpilot-follow-up-template-v1";
const defaultSearchQueries = [
  "кафе",
  "ресторан",
  "кофейня",
  "пиццерия",
  "суши бар",
  "столовая",
  "донерная",
  "кондитерская",
];
const defaultSearchQuery = defaultSearchQueries.join(", ");
const searchSorts: Array<{ value: SearchSort; label: string }> = [
  { value: "creation_time", label: "новые заведения" },
  { value: "relevance", label: "по релевантности" },
  { value: "rating", label: "по рейтингу" },
  { value: "name", label: "по названию" },
];

const blankLead: LeadDraft = {
  name: "",
  category: "Кафе",
  city: "Кызылорда",
  address: "",
  phone: "",
  whatsapp: "",
  website: "",
  instagram: "",
  sourceUrl: "",
  rating: null,
  hasSite: false,
  status: "new",
  notes: "",
};

const statusLabels: Record<Status, string> = {
  new: "Новый",
  contacted: "Написал",
  replied: "Ответил",
  demo: "Показ",
  client: "Клиент",
  declined: "Отказ",
};

const statusOrder: Status[] = [
  "new",
  "contacted",
  "replied",
  "demo",
  "client",
  "declined",
];

const defaultTemplate = `Здравствуйте. Посмотрел ваше заведение «{name}» и хотел предложить удобный сайт для онлайн-заказов: актуальное меню, корзина, заказ через WhatsApp, QR-меню для столов и админ-панель, в которой можно менять меню и информацию.

Вот пример сайта, который я уже сделал для ресторана:
https://tuysqan.vercel.app

Могу бесплатно показать весь функционал за 5 минут и предложить вариант под ваше заведение. Разработка быстрая и по доступной цене.

Если интересно, отправлю короткую демонстрацию. Если вы сотрудник, подскажите, пожалуйста, как связаться с администратором или владельцем заведения, чтобы обсудить предложение.`;

const defaultFollowUpTemplate = `Здравствуйте! Хотел уточнить по поводу моего прошлого сообщения насчёт сайта для {name}

Я могу бесплатно сделать небольшой демо-вариант именно под ваше заведение, чтобы вы сразу увидели, как будет выглядеть меню, корзина, QR-меню и оформление заказа через WhatsApp.

Если вам это направление интересно, могу отправить пример и примерную стоимость. Если вопрос решает администратор или владелец, буду благодарен, если подскажете контакт.`;

function normalizeSearchInput(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.toLocaleLowerCase("ru") === "кафе ресторан")
    return defaultSearchQuery;
  return normalized;
}

function searchQueries(value: string) {
  const unique = new Map<string, string>();
  for (const part of normalizeSearchInput(value).split(/[,;\n]+/)) {
    const query = part.trim();
    if (query) unique.set(query.toLocaleLowerCase("ru"), query);
  }
  return [...unique.values()];
}

function automationScope(form: ImportForm) {
  return `${form.city.trim().toLocaleLowerCase("ru")}::${searchQueries(
    form.query,
  )
    .map((query) => query.toLocaleLowerCase("ru"))
    .join("|")}::${form.minReviews}`;
}

function searchJob(form: ImportForm, cursor: number) {
  const queries = searchQueries(form.query);
  const totalJobs = queries.length * searchSorts.length;
  const safeCursor = ((cursor % totalJobs) + totalJobs) % totalJobs;
  const queryIndex = safeCursor % queries.length;
  const sortIndex = Math.floor(safeCursor / queries.length);
  return {
    query: queries[queryIndex],
    sort: searchSorts[sortIndex],
    nextCursor: (safeCursor + 1) % totalJobs,
  };
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8"))
    digits = `7${digits.slice(1)}`;
  if (digits.length === 10) digits = `7${digits}`;
  return digits;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function downloadCsv(leads: Lead[]) {
  const header = [
    "Название",
    "Категория",
    "Город",
    "Адрес",
    "Телефон",
    "WhatsApp",
    "Сайт",
    "Instagram",
    "Статус",
    "Заметки",
  ];
  const rows = leads.map((lead) => [
    lead.name,
    lead.category,
    lead.city,
    lead.address,
    lead.phone,
    lead.whatsapp,
    lead.website,
    lead.instagram,
    statusLabels[lead.status],
    lead.notes,
  ]);
  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `leadpilot-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function LeadWorkspace() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [minReviewsFilter, setMinReviewsFilter] = useState(50);
  const [sortBy, setSortBy] = useState<"created" | "status" | "reviews">(
    "reviews",
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [draft, setDraft] = useState<LeadDraft>(blankLead);
  const [nameError, setNameError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [messageTemplate, setMessageTemplate] = useState(defaultTemplate);
  const [followUpTemplate, setFollowUpTemplate] = useState(
    defaultFollowUpTemplate,
  );
  const [importForm, setImportForm] = useState<ImportForm>({
    apiKey: "",
    city: "Кызылорда",
    query: defaultSearchQuery,
    pages: 5,
    minReviews: 50,
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [searchCursor, setSearchCursor] = useState(0);
  const [searchCursorScope, setSearchCursorScope] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const editorSnapshot = useRef("");
  const importSnapshot = useRef("");
  const templateSnapshot = useRef("");
  const routedActionHandled = useRef(false);

  async function loadLeads() {
    setError("");
    try {
      const response = await fetch("/api/leads", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Не удалось загрузить базу");
      setLeads(data.leads);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить базу",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
    const savedTemplate = window.localStorage.getItem(templateStorageKey);
    if (savedTemplate) setMessageTemplate(savedTemplate);
    const savedFollowUpTemplate = window.localStorage.getItem(
      followUpTemplateStorageKey,
    );
    if (savedFollowUpTemplate) setFollowUpTemplate(savedFollowUpTemplate);
    const savedAutomation = window.localStorage.getItem(automationStorageKey);
    if (!savedAutomation) return;
    try {
      const settings = JSON.parse(savedAutomation) as SavedAutomation;
      const restored = {
        apiKey: settings.apiKey || "",
        city: settings.city || "Кызылорда",
        query: normalizeSearchInput(settings.query || defaultSearchQuery),
        pages: Math.max(1, Math.min(5, Number(settings.pages) || 5)),
        minReviews: Math.max(
          0,
          Math.min(10000, Number(settings.minReviews) || 50),
        ),
      };
      const restoredScope = automationScope(restored);
      const restoredCursor =
        settings.searchScope === restoredScope
          ? Math.max(0, Number(settings.nextCursor) || 0)
          : 0;
      setImportForm(restored);
      setAutoSyncEnabled(settings.enabled !== false);
      setLastSync(settings.lastSync || null);
      setSearchCursor(restoredCursor);
      setSearchCursorScope(restoredScope);
      const lastRun = settings.lastSync
        ? new Date(settings.lastSync).getTime()
        : 0;
      const isDue = Date.now() - lastRun > 24 * 60 * 60 * 1000;
      const needsOneTimeBackfill = settings.reviewsBackfillCompleted !== true;
      if (
        settings.enabled !== false &&
        settings.apiKey &&
        (needsOneTimeBackfill || isDue)
      ) {
        void (async () => {
          if (needsOneTimeBackfill)
            await refreshNewLeadReviews(
              settings.apiKey,
              restored.minReviews,
              true,
            );
          if (isDue) await importFrom2Gis(true, restored, restoredCursor);
        })();
      }
    } catch {
      window.localStorage.removeItem(automationStorageKey);
    }
  }, []);

  useEffect(() => {
    if (loading || routedActionHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("panel") === "template") openTemplate();
    if (params.get("action") === "export") downloadCsv(leads);
    if (params.has("panel") || params.has("action"))
      window.history.replaceState({}, "", "/");
    routedActionHandled.current = true;
  }, [loading, leads]);

  const cities = useMemo(
    () =>
      Array.from(
        new Set(leads.map((lead) => lead.city).filter(Boolean)),
      ).sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matches = leads.filter((lead) => {
      const matchesSearch =
        !needle ||
        [lead.name, lead.category, lead.address, lead.phone, lead.instagram]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      const matchesReviews =
        lead.status !== "new" ||
        minReviewsFilter === 0 ||
        lead.reviewsCheckedAt == null ||
        lead.reviewsCount >= minReviewsFilter;
      return (
        matchesSearch &&
        matchesReviews &&
        (statusFilter === "all" || lead.status === statusFilter) &&
        (cityFilter === "all" || lead.city === cityFilter)
      );
    });
    if (sortBy === "status")
      return [...matches].sort(
        (a, b) =>
          statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) ||
          b.id - a.id,
      );
    if (sortBy === "reviews")
      return [...matches].sort(
        (a, b) =>
          Number(b.status === "new") - Number(a.status === "new") ||
          b.reviewsCount - a.reviewsCount ||
          b.id - a.id,
      );
    return [...matches].sort((a, b) => b.id - a.id);
  }, [leads, search, statusFilter, cityFilter, minReviewsFilter, sortBy]);

  const counts = useMemo(
    () => ({
      total: leads.length,
      new: leads.filter((lead) => lead.status === "new").length,
      contacted: leads.filter((lead) => lead.status === "contacted").length,
      replied: leads.filter((lead) => lead.status === "replied").length,
      demo: leads.filter((lead) => lead.status === "demo").length,
      client: leads.filter((lead) => lead.status === "client").length,
    }),
    [leads],
  );

  const activeFilters = useMemo(() => {
    const result: Array<{ key: string; label: string; clear: () => void }> = [];
    if (search.trim())
      result.push({
        key: "search",
        label: `Поиск: ${search.trim()}`,
        clear: () => setSearch(""),
      });
    if (statusFilter !== "all")
      result.push({
        key: "status",
        label: `Статус: ${statusLabels[statusFilter as Status]}`,
        clear: () => setStatusFilter("all"),
      });
    if (cityFilter !== "all")
      result.push({
        key: "city",
        label: `Город: ${cityFilter}`,
        clear: () => setCityFilter("all"),
      });
    if (minReviewsFilter !== 50)
      result.push({
        key: "reviews",
        label: minReviewsFilter
          ? `Отзывы: от ${minReviewsFilter}`
          : "Отзывы: без ограничения",
        clear: () => setMinReviewsFilter(50),
      });
    if (sortBy !== "reviews")
      result.push({
        key: "sort",
        label:
          sortBy === "created" ? "Сначала новые записи" : "По этапу продаж",
        clear: () => setSortBy("reviews"),
      });
    return result;
  }, [search, statusFilter, cityFilter, minReviewsFilter, sortBy]);

  function openCreate() {
    setEditing(null);
    setDraft(blankLead);
    setNameError("");
    editorSnapshot.current = JSON.stringify(blankLead);
    setEditorOpen(true);
  }

  function openEdit(lead: Lead) {
    const nextDraft = {
      name: lead.name,
      category: lead.category,
      city: lead.city,
      address: lead.address,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      website: lead.website,
      instagram: lead.instagram,
      sourceUrl: lead.sourceUrl,
      rating: lead.rating,
      hasSite: lead.hasSite,
      status: lead.status,
      notes: lead.notes,
    };
    setEditing(lead);
    setDraft(nextDraft);
    setNameError("");
    editorSnapshot.current = JSON.stringify(nextDraft);
    setEditorOpen(true);
  }

  function requestCloseEditor() {
    if (
      JSON.stringify(draft) !== editorSnapshot.current &&
      !window.confirm("Закрыть форму и отменить несохранённые изменения?")
    )
      return;
    setEditorOpen(false);
  }

  function openImport() {
    importSnapshot.current = JSON.stringify({ importForm, autoSyncEnabled });
    setImportOpen(true);
  }

  function requestCloseImport() {
    if (
      JSON.stringify({ importForm, autoSyncEnabled }) !==
        importSnapshot.current &&
      !window.confirm("Закрыть настройки 2ГИС без сохранения изменений?")
    )
      return;
    setImportOpen(false);
  }

  function openTemplate() {
    templateSnapshot.current = JSON.stringify({
      messageTemplate,
      followUpTemplate,
    });
    setTemplateOpen(true);
  }

  function requestCloseTemplate() {
    if (
      JSON.stringify({ messageTemplate, followUpTemplate }) !==
        templateSnapshot.current &&
      !window.confirm("Закрыть шаблон без сохранения изменений?")
    )
      return;
    setTemplateOpen(false);
  }

  async function pastePhoneFromClipboard() {
    try {
      const clipboardValue = await navigator.clipboard.readText();
      const phone = clipboardValue.trim();
      if (normalizePhone(phone).length < 10) {
        setError("В буфере обмена не найден корректный номер телефона");
        return;
      }
      setDraft((current) => ({
        ...current,
        phone,
        whatsapp: current.whatsapp || phone,
      }));
      setError("");
    } catch {
      setError(
        "Не удалось прочитать буфер обмена. Разрешите доступ или вставьте номер вручную.",
      );
    }
  }

  async function saveLead() {
    if (!draft.name.trim()) {
      setNameError("Укажите название заведения");
      document.getElementById("lead-name")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    setNameError("");
    try {
      const response = await fetch("/api/leads", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...draft } : draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить");
      setEditorOpen(false);
      setSyncNotice(
        editing
          ? "Изменения в карточке сохранены."
          : "Заведение добавлено в базу.",
      );
      await loadLeads();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Не удалось сохранить",
      );
    } finally {
      setBusy(false);
    }
  }

  async function patchLead(id: number, changes: Partial<Lead>) {
    const response = await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...changes }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Не удалось обновить запись");
      return false;
    }
    setLeads((current) =>
      current.map((lead) => (lead.id === id ? { ...lead, ...changes } : lead)),
    );
    if (changes.status)
      setSyncNotice(`Статус изменён на «${statusLabels[changes.status]}».`);
    return true;
  }

  async function confirmDeleteLead() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/leads?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Не удалось удалить заведение");
      setLeads((current) =>
        current.filter((lead) => lead.id !== deleteTarget.id),
      );
      setSyncNotice(`«${deleteTarget.name}» удалено из базы.`);
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить заведение",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openWhatsApp(lead: Lead) {
    const phone = normalizePhone(lead.whatsapp || lead.phone);
    if (!phone) {
      setError(
        "У заведения нет номера WhatsApp. Добавьте его через редактирование карточки.",
      );
      return;
    }
    const template = lead.lastContactedAt
      ? followUpTemplate
      : messageTemplate;
    const text = template
      .replaceAll("{name}", lead.name)
      .replaceAll("{city}", lead.city || "вашем городе");
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    await patchLead(lead.id, {
      status: lead.status === "new" ? "contacted" : lead.status,
      lastContactedAt: new Date().toISOString(),
    });
  }

  async function refreshNewLeadReviews(
    apiKey: string,
    minReviews: number,
    silent = false,
  ) {
    setBusy(true);
    if (silent) setSyncNotice("Обновляю оценки текущих новых заведений…");
    try {
      const response = await fetch("/api/import/2gis/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, minReviews }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Не удалось обновить оценки");
      const savedAutomation = window.localStorage.getItem(automationStorageKey);
      if (savedAutomation) {
        const settings = JSON.parse(savedAutomation) as SavedAutomation;
        window.localStorage.setItem(
          automationStorageKey,
          JSON.stringify({ ...settings, reviewsBackfillCompleted: true }),
        );
      }
      await loadLeads();
      if (data.checked > 0)
        setSyncNotice(
          `Оценки обновлены: ${data.updated}. Подходят под фильтр «от ${minReviews} отзывов»: ${data.aboveThreshold}.`,
        );
      return true;
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Не удалось обновить оценки",
      );
      if (silent) setSyncNotice("Не удалось обновить оценки текущих заведений");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function importFrom2Gis(
    silent = false,
    sourceForm: ImportForm = importForm,
    requestedCursor?: number,
  ) {
    setBusy(true);
    setError("");
    if (silent) setSyncNotice("Проверяю новые заведения в 2ГИС…");
    try {
      const scope = automationScope(sourceForm);
      const cursor =
        requestedCursor ?? (scope === searchCursorScope ? searchCursor : 0);
      const job = searchJob(sourceForm, cursor);
      const response = await fetch("/api/import/2gis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sourceForm,
          query: job.query,
          sort: job.sort.value,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Не удалось импортировать данные");
      const syncedAt = new Date().toISOString();
      const savedAutomation = window.localStorage.getItem(automationStorageKey);
      const savedSettings = savedAutomation
        ? (JSON.parse(savedAutomation) as SavedAutomation)
        : null;
      const automation: SavedAutomation = {
        ...sourceForm,
        query: normalizeSearchInput(sourceForm.query),
        enabled: autoSyncEnabled,
        lastSync: syncedAt,
        reviewsBackfillCompleted:
          savedSettings?.reviewsBackfillCompleted === true,
        nextCursor: job.nextCursor,
        searchScope: scope,
      };
      if (autoSyncEnabled)
        window.localStorage.setItem(
          automationStorageKey,
          JSON.stringify(automation),
        );
      else window.localStorage.removeItem(automationStorageKey);
      setLastSync(syncedAt);
      setSearchCursor(job.nextCursor);
      setSearchCursorScope(scope);
      if (!silent) setImportOpen(false);
      await loadLeads();
      const nextJob = searchJob(sourceForm, job.nextCursor);
      const contactsNote =
        data.withContacts === 0 && data.eligible > 0
          ? " Контакты не получены: для поля contacts нужен расширенный доступ 2ГИС."
          : "";
      const reviewsNote =
        data.skippedLowReviews > 0
          ? ` Не прошли фильтр «от ${sourceForm.minReviews} отзывов»: ${data.skippedLowReviews}.`
          : "";
      const resultNote =
        data.added > 0
          ? `Автосбор «${job.query}» добавил заведений: ${data.added}`
          : data.updated > 0
            ? `По запросу «${job.query}» обновлено контактов: ${data.updated}`
            : `По текущему запросу «${job.query}» (${job.sort.label}) новых заведений нет. Следующая проверка: «${nextJob.query}» (${nextJob.sort.label})`;
      setSyncNotice(resultNote + reviewsNote + contactsNote);
      if (!silent)
        window.alert(
          `Проверено: «${job.query}» (${job.sort.label}). Добавлено: ${data.added}. Обновлено данных: ${data.updated || 0}. Пропущено дублей: ${data.skipped}.${reviewsNote}${contactsNote} Следующая проверка: «${nextJob.query}» (${nextJob.sort.label}). Автосбор ${autoSyncEnabled ? "включён" : "выключен"}.`,
        );
    } catch (importError) {
      const message =
        importError instanceof Error
          ? importError.message
          : "Не удалось импортировать данные";
      setError(message);
      setSyncNotice("Автосбор требует проверки настроек 2ГИС");
    } finally {
      setBusy(false);
    }
  }

  function saveTemplate() {
    window.localStorage.setItem(templateStorageKey, messageTemplate);
    window.localStorage.setItem(
      followUpTemplateStorageKey,
      followUpTemplate,
    );
    templateSnapshot.current = JSON.stringify({
      messageTemplate,
      followUpTemplate,
    });
    setTemplateOpen(false);
    setSyncNotice("Шаблоны WhatsApp сохранены в этом браузере.");
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setCityFilter("all");
    setMinReviewsFilter(50);
    setSortBy("reviews");
  }

  function LeadActions({
    lead,
    compact = false,
  }: {
    lead: Lead;
    compact?: boolean;
  }) {
    return (
      <div className={`row-actions ${compact ? "card-actions" : ""}`}>
        {lead.phone || lead.whatsapp ? (
          <button
            className="button whatsapp"
            onClick={() => void openWhatsApp(lead)}
          >
            <Icon name="whatsapp" />
            <span>WhatsApp</span>
          </button>
        ) : lead.sourceUrl ? (
          <a
            className="button"
            href={lead.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="external" />
            <span>2ГИС</span>
          </a>
        ) : (
          <button className="button" onClick={() => openEdit(lead)}>
            <Icon name="plus" />
            <span>Номер</span>
          </button>
        )}
        <button
          className="icon-button"
          onClick={() => openEdit(lead)}
          aria-label={`Изменить ${lead.name}`}
          title="Изменить"
        >
          <Icon name="edit" />
        </button>
        <button
          className="icon-button danger-icon"
          onClick={() => setDeleteTarget(lead)}
          aria-label={`Удалить ${lead.name}`}
          title="Удалить"
        >
          <Icon name="trash" />
        </button>
      </div>
    );
  }

  return (
    <AppShell
      active="leads"
      onTemplate={openTemplate}
      onExport={() => downloadCsv(leads)}
    >
      <header className="page-header">
        <div className="page-heading">
          <p className="page-kicker">Продажи / Казахстан</p>
          <h1>База заведений</h1>
          <p>
            Квалифицируйте заведения, фиксируйте контакт и двигайте каждую
            возможность к следующему этапу.
          </p>
        </div>
        <div className="page-actions">
          <button
            className={`button ${lastSync ? "sync-active" : ""}`}
            onClick={openImport}
          >
            <Icon name="refresh" />
            {busy
              ? "Обновляю…"
              : lastSync
                ? "Автосбор 2ГИС"
                : "Подключить 2ГИС"}
          </button>
          <button className="button primary" onClick={openCreate}>
            <Icon name="plus" />
            Добавить заведение
          </button>
        </div>
      </header>

      <div className="feedback-stack">
        {error && (
          <FeedbackBanner tone="error" onClose={() => setError("")}>
            <strong>Действие не выполнено.</strong>
            <span>{error}</span>
          </FeedbackBanner>
        )}
        {syncNotice && (
          <FeedbackBanner tone="info" onClose={() => setSyncNotice("")}>
            <span>{syncNotice}</span>
          </FeedbackBanner>
        )}
        {leads.length > 0 &&
          leads.every((lead) => !lead.phone && !lead.whatsapp) && (
            <FeedbackBanner tone="warning">
              <strong>2ГИС не передал телефоны.</strong>
              <span>
                Для поля contacts нужен расширенный доступ. Номер можно добавить
                вручную из карточки 2ГИС.
              </span>
            </FeedbackBanner>
          )}
      </div>

      <section
        className="metric-grid sales-metrics"
        aria-label="Воронка продаж"
      >
        <article className="metric-card metric-total">
          <span>Всего</span>
          <strong>{counts.total}</strong>
          <small>заведений в базе</small>
        </article>
        <article className="metric-card status-new">
          <span>Новые</span>
          <strong>{counts.new}</strong>
          <small>ждут первого касания</small>
        </article>
        <article className="metric-card status-contacted">
          <span>Написал</span>
          <strong>{counts.contacted}</strong>
          <small>сообщение отправлено</small>
        </article>
        <article className="metric-card status-replied">
          <span>Ответили</span>
          <strong>{counts.replied}</strong>
          <small>диалог начался</small>
        </article>
        <article className="metric-card status-demo">
          <span>Показы</span>
          <strong>{counts.demo}</strong>
          <small>назначено или проведено</small>
        </article>
        <article className="metric-card status-client">
          <span>Клиенты</span>
          <strong>{counts.client}</strong>
          <small>успешные сделки</small>
        </article>
      </section>

      <section className="workspace-panel" aria-labelledby="lead-list-title">
        <div className="workspace-panel-heading">
          <div>
            <h2 id="lead-list-title">Рабочий список</h2>
            <p role="status" aria-live="polite">
              Показано {filtered.length} из {leads.length}
            </p>
          </div>
          {activeFilters.length > 0 && (
            <button className="button quiet" onClick={resetFilters}>
              <Icon name="refresh" />
              Сбросить
            </button>
          )}
        </div>

        <div className="filter-panel">
          <label className="search-control" htmlFor="lead-search">
            <Icon name="search" />
            <span className="sr-only">Поиск</span>
            <input
              id="lead-search"
              className="field"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Название, адрес, телефон"
            />
          </label>
          <label>
            <span className="sr-only">Фильтр по статусу</span>
            <select
              className="select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Все статусы</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Фильтр по городу</span>
            <select
              className="select"
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
            >
              <option value="all">Все города</option>
              {cities.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Фильтр новых заведений по отзывам</span>
            <select
              className="select"
              value={minReviewsFilter}
              onChange={(event) =>
                setMinReviewsFilter(Number(event.target.value))
              }
            >
              <option value={0}>Отзывы: без ограничения</option>
              <option value={10}>Отзывы: от 10</option>
              <option value={25}>Отзывы: от 25</option>
              <option value={50}>Отзывы: от 50</option>
              <option value={100}>Отзывы: от 100</option>
              <option value={250}>Отзывы: от 250</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Сортировка списка</span>
            <select
              className="select"
              value={sortBy}
              onChange={(event) =>
                setSortBy(
                  event.target.value as "created" | "status" | "reviews",
                )
              }
            >
              <option value="reviews">По количеству отзывов</option>
              <option value="created">Сначала новые записи</option>
              <option value="status">По этапу продаж</option>
            </select>
          </label>
        </div>

        {activeFilters.length > 0 && (
          <div className="active-filters" aria-label="Активные фильтры">
            {activeFilters.map((filter) => (
              <button key={filter.key} onClick={filter.clear}>
                {filter.label}
                <Icon name="close" size={14} />
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="skeleton-list" aria-label="Загружаю базу">
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name={leads.length ? "search" : "database"} size={24} />
            </span>
            <h3>
              {leads.length ? "Совпадений не найдено" : "База пока пустая"}
            </h3>
            <p>
              {leads.length
                ? "Измените условия поиска или сбросьте активные фильтры."
                : "Добавьте заведение вручную или импортируйте список через официальный API 2ГИС."}
            </p>
            {leads.length ? (
              <button className="button" onClick={resetFilters}>
                Сбросить фильтры
              </button>
            ) : (
              <button className="button primary" onClick={openImport}>
                Импортировать из 2ГИС
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap lead-table-wrap">
              <table className="lead-table">
                <thead>
                  <tr>
                    <th className="row-number">№</th>
                    <th>Заведение</th>
                    <th>Контакт</th>
                    <th>Сигнал</th>
                    <th>Этап</th>
                    <th>Заметка</th>
                    <th>
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead, index) => (
                    <tr key={lead.id}>
                      <td className="row-number">{index + 1}</td>
                      <td>
                        <div className="company">
                          <span className="company-avatar">
                            {initials(lead.name)}
                          </span>
                          <div className="company-copy">
                            <strong title={lead.name}>{lead.name}</strong>
                            <small>
                              {lead.category}
                              {lead.city ? ` · ${lead.city}` : ""}
                            </small>
                            {lead.address && (
                              <small title={lead.address}>{lead.address}</small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {lead.phone || lead.whatsapp ? (
                          <a
                            className="contact-line"
                            href={`tel:+${normalizePhone(lead.phone || lead.whatsapp)}`}
                          >
                            +{normalizePhone(lead.phone || lead.whatsapp)}
                          </a>
                        ) : (
                          <span className="muted">Нет номера</span>
                        )}
                        {lead.instagram && (
                          <a
                            className="contact-line secondary"
                            href={
                              lead.instagram.startsWith("http")
                                ? lead.instagram
                                : `https://instagram.com/${lead.instagram.replace("@", "")}`
                            }
                            target="_blank"
                            rel="noreferrer"
                          >
                            {lead.instagram}
                          </a>
                        )}
                      </td>
                      <td>
                        <span
                          className={`signal ${lead.website ? "site" : "opportunity"}`}
                        >
                          {lead.website ? "Есть сайт" : "Нет сайта"}
                        </span>
                        {lead.rating != null && (
                          <span className="rating-line">
                            <strong>{lead.rating.toFixed(1)}</strong>
                            <span>
                              {lead.reviewsCheckedAt
                                ? `${lead.reviewsCount} отзывов`
                                : "оценки обновляются"}
                            </span>
                          </span>
                        )}
                      </td>
                      <td>
                        <label
                          className={`status-control status-${lead.status}`}
                        >
                          <span className="status-dot" />
                          <span className="sr-only">Статус {lead.name}</span>
                          <select
                            value={lead.status}
                            onChange={(event) =>
                              void patchLead(lead.id, {
                                status: event.target.value as Status,
                              })
                            }
                          >
                            {Object.entries(statusLabels).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </td>
                      <td>
                        <p
                          className="note-cell"
                          title={lead.notes || "Без заметки"}
                        >
                          {lead.notes || "Без заметки"}
                        </p>
                      </td>
                      <td>
                        <LeadActions lead={lead} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lead-card-list" aria-label="Заведения">
              {filtered.map((lead, index) => (
                <article className="lead-card" key={lead.id}>
                  <header>
                    <span className="mobile-row-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="company-avatar">
                      {initials(lead.name)}
                    </span>
                    <div className="company-copy">
                      <h3>{lead.name}</h3>
                      <p>
                        {lead.category}
                        {lead.city ? ` · ${lead.city}` : ""}
                      </p>
                    </div>
                    <label className={`status-control status-${lead.status}`}>
                      <span className="status-dot" />
                      <span className="sr-only">Статус {lead.name}</span>
                      <select
                        value={lead.status}
                        onChange={(event) =>
                          void patchLead(lead.id, {
                            status: event.target.value as Status,
                          })
                        }
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </header>
                  <div className="lead-card-details">
                    {lead.address && (
                      <p>
                        <Icon name="building" />
                        <span>{lead.address}</span>
                      </p>
                    )}
                    <p>
                      <Icon name="analytics" />
                      <span>
                        {lead.rating != null
                          ? `${lead.rating.toFixed(1)} · ${lead.reviewsCount} отзывов`
                          : "Оценки обновляются"}
                      </span>
                      <span
                        className={`signal ${lead.website ? "site" : "opportunity"}`}
                      >
                        {lead.website ? "Есть сайт" : "Нет сайта"}
                      </span>
                    </p>
                    <p>
                      <Icon name="message" />
                      <span>
                        {lead.phone || lead.whatsapp
                          ? `+${normalizePhone(lead.phone || lead.whatsapp)}`
                          : "Номер не добавлен"}
                      </span>
                    </p>
                  </div>
                  {lead.notes && <p className="lead-card-note">{lead.notes}</p>}
                  <LeadActions lead={lead} compact />
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <Dialog
        open={editorOpen}
        title={editing ? "Изменить заведение" : "Новое заведение"}
        description="Сохраните рабочие контакты и следующий полезный шаг."
        onClose={requestCloseEditor}
        size="large"
        footer={
          <>
            <button className="button" onClick={requestCloseEditor}>
              Отмена
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void saveLead()}
            >
              {busy ? "Сохраняю…" : "Сохранить"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="lead-name">
              Название <span aria-hidden="true">*</span>
            </label>
            <input
              id="lead-name"
              className={`field ${nameError ? "invalid" : ""}`}
              value={draft.name}
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
                if (nameError) setNameError("");
              }}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "lead-name-error" : undefined}
            />
            {nameError && (
              <span className="field-error" id="lead-name-error">
                {nameError}
              </span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="lead-category">Категория</label>
            <input
              id="lead-category"
              className="field"
              value={draft.category}
              onChange={(event) =>
                setDraft({ ...draft, category: event.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="lead-city">Город</label>
            <input
              id="lead-city"
              className="field"
              value={draft.city}
              onChange={(event) =>
                setDraft({ ...draft, city: event.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="lead-address">Адрес</label>
            <input
              id="lead-address"
              className="field"
              value={draft.address}
              onChange={(event) =>
                setDraft({ ...draft, address: event.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="lead-phone">Телефон</label>
            <div className="phone-entry">
              <input
                id="lead-phone"
                className="field"
                type="tel"
                inputMode="tel"
                value={draft.phone}
                onChange={(event) =>
                  setDraft({ ...draft, phone: event.target.value })
                }
                placeholder="+7 777 000 00 00"
              />
              <button
                className="button"
                type="button"
                onClick={() => void pastePhoneFromClipboard()}
              >
                Вставить
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="lead-whatsapp">WhatsApp</label>
            <input
              id="lead-whatsapp"
              className="field"
              type="tel"
              inputMode="tel"
              value={draft.whatsapp}
              onChange={(event) =>
                setDraft({ ...draft, whatsapp: event.target.value })
              }
              placeholder="Если отличается от телефона"
            />
          </div>
          <div className="form-group">
            <label htmlFor="lead-website">Сайт</label>
            <input
              id="lead-website"
              className="field"
              type="url"
              value={draft.website}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  website: event.target.value,
                  hasSite: Boolean(event.target.value),
                })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="lead-instagram">Instagram</label>
            <input
              id="lead-instagram"
              className="field"
              value={draft.instagram}
              onChange={(event) =>
                setDraft({ ...draft, instagram: event.target.value })
              }
              placeholder="@restaurant"
            />
          </div>
          <div className="form-group">
            <label htmlFor="lead-status">Статус</label>
            <select
              id="lead-status"
              className="select"
              value={draft.status}
              onChange={(event) =>
                setDraft({ ...draft, status: event.target.value as Status })
              }
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="lead-source">Ссылка 2ГИС</label>
            <input
              id="lead-source"
              className="field"
              type="url"
              value={draft.sourceUrl}
              onChange={(event) =>
                setDraft({ ...draft, sourceUrl: event.target.value })
              }
            />
          </div>
          <div className="form-group full">
            <label htmlFor="lead-notes">Заметка</label>
            <textarea
              id="lead-notes"
              className="textarea"
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
              placeholder="Например: меню только в актуальных сторис"
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={importOpen}
        title="Импорт и автосбор 2ГИС"
        description="Официальный Places API. Ключ хранится только в этом браузере."
        onClose={requestCloseImport}
        size="large"
        footer={
          <>
            <button className="button" onClick={requestCloseImport}>
              Отмена
            </button>
            <button
              className="button"
              disabled={busy || !importForm.apiKey.trim()}
              onClick={() =>
                void refreshNewLeadReviews(
                  importForm.apiKey,
                  importForm.minReviews,
                )
              }
            >
              {busy ? "Обновляю…" : "Обновить оценки"}
            </button>
            <button
              className="button primary"
              disabled={busy || !importForm.apiKey.trim()}
              onClick={() => void importFrom2Gis()}
            >
              {busy ? "Ищу заведения…" : "Запустить импорт"}
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group full">
            <label htmlFor="dgis-key">API-ключ 2ГИС</label>
            <input
              id="dgis-key"
              className="field"
              type="password"
              autoComplete="off"
              value={importForm.apiKey}
              onChange={(event) =>
                setImportForm({ ...importForm, apiKey: event.target.value })
              }
              placeholder="Вставьте demo или рабочий ключ"
            />
            <span className="field-hint">
              Ключ не попадает в базу заведений или серверные переменные.
            </span>
          </div>
          <div className="form-group">
            <label htmlFor="dgis-city">Город</label>
            <input
              id="dgis-city"
              className="field"
              value={importForm.city}
              onChange={(event) =>
                setImportForm({ ...importForm, city: event.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label htmlFor="dgis-pages">Страниц результатов</label>
            <select
              id="dgis-pages"
              className="select"
              value={importForm.pages}
              onChange={(event) =>
                setImportForm({
                  ...importForm,
                  pages: Number(event.target.value),
                })
              }
            >
              <option value={1}>1 страница · до 10</option>
              <option value={2}>2 страницы · до 20</option>
              <option value={3}>3 страницы · до 30</option>
              <option value={5}>5 страниц · до 50</option>
            </select>
          </div>
          <div className="form-group full">
            <label htmlFor="dgis-query">Что искать</label>
            <input
              id="dgis-query"
              className="field"
              value={importForm.query}
              onChange={(event) =>
                setImportForm({ ...importForm, query: event.target.value })
              }
              placeholder="кафе, ресторан, кофейня"
            />
            <span className="field-hint">
              Разделяйте категории запятыми. Автосбор будет проверять их и
              варианты сортировки по очереди.
            </span>
          </div>
          <div className="form-group">
            <label htmlFor="dgis-reviews">Минимум отзывов</label>
            <select
              id="dgis-reviews"
              className="select"
              value={importForm.minReviews}
              onChange={(event) => {
                const value = Number(event.target.value);
                setImportForm({ ...importForm, minReviews: value });
                setMinReviewsFilter(value);
              }}
            >
              <option value={0}>Без ограничения</option>
              <option value={10}>От 10 отзывов</option>
              <option value={25}>От 25 отзывов</option>
              <option value={50}>От 50 отзывов</option>
              <option value={100}>От 100 отзывов</option>
              <option value={250}>От 250 отзывов</option>
            </select>
            <span className="field-hint">По умолчанию — от 50 отзывов.</span>
          </div>
          <div className="import-rules">
            <strong>Правила импорта</strong>
            <span>Только без сайта</span>
            <span>Защита от дублей</span>
            <span>До 50 за запуск</span>
          </div>
          <label
            className="automation-toggle full"
            aria-label="Проверять автоматически раз в сутки"
          >
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(event) => setAutoSyncEnabled(event.target.checked)}
            />
            <span>
              <strong>Проверять автоматически раз в сутки</strong>
              <small>
                Проверка запускается при открытии сайта и переходит к следующей
                категории.
              </small>
            </span>
          </label>
          {lastSync && (
            <p className="last-sync full">
              Последняя успешная проверка:{" "}
              {new Date(lastSync).toLocaleString("ru-RU")}
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={templateOpen}
        title="Шаблоны WhatsApp"
        description="При первом контакте LeadPilot использует основной текст, при следующем — повторный. Название и город подставляются автоматически."
        onClose={requestCloseTemplate}
        size="large"
        footer={
          <>
            <button
              className="button"
              onClick={() => {
                setMessageTemplate(defaultTemplate);
                setFollowUpTemplate(defaultFollowUpTemplate);
              }}
            >
              Вернуть исходные
            </button>
            <button className="button primary" onClick={saveTemplate}>
              Сохранить шаблоны
            </button>
          </>
        }
      >
        <div className="template-layout">
          <div className="form-group">
            <label htmlFor="message-template">Первое сообщение</label>
            <textarea
              id="message-template"
              className="textarea template-textarea"
              value={messageTemplate}
              onChange={(event) => setMessageTemplate(event.target.value)}
            />
            <span className="field-hint">
              Переменные: <code>{"{name}"}</code> <code>{"{city}"}</code>
            </span>
          </div>
          <aside className="template-preview">
            <span>Предпросмотр первого сообщения</span>
            <p>
              {messageTemplate
                .replaceAll("{name}", "Пример Кафе")
                .replaceAll("{city}", "Кызылорда")}
            </p>
          </aside>
          <div className="form-group">
            <label htmlFor="follow-up-template">Повторное сообщение</label>
            <textarea
              id="follow-up-template"
              className="textarea template-textarea"
              value={followUpTemplate}
              onChange={(event) => setFollowUpTemplate(event.target.value)}
            />
            <span className="field-hint">
              Используется, если клиенту уже писали. Переменные:{" "}
              <code>{"{name}"}</code> <code>{"{city}"}</code>
            </span>
          </div>
          <aside className="template-preview">
            <span>Предпросмотр повторного сообщения</span>
            <p>
              {followUpTemplate
                .replaceAll("{name}", "Carla`s Cake")
                .replaceAll("{city}", "Кызылорда")}
            </p>
          </aside>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить заведение?"
        description={
          deleteTarget
            ? `«${deleteTarget.name}» будет удалено из базы. Это действие нельзя отменить.`
            : ""
        }
        confirmLabel="Удалить"
        busy={busy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteLead()}
      />
    </AppShell>
  );
}

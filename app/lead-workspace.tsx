"use client";

import { useEffect, useMemo, useState } from "react";

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
  hasSite: boolean;
  status: Status;
  notes: string;
  lastContactedAt: string | null;
  createdAt: string;
};

type LeadDraft = Omit<Lead, "id" | "createdAt" | "lastContactedAt">;

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
  declined: "Неактуально",
};

const defaultTemplate = `Здравствуйте! Посмотрел ваше заведение «{name}». Заметил, что гостям не очень удобно быстро открыть актуальное меню и оформить заказ.

Я сделал похожий сайт для Tuysqan: онлайн-меню, корзина, заказ через WhatsApp, QR для столов и админка. Пример: https://tuysqan.vercel.app

Могу бесплатно показать за 5 минут, как это будет выглядеть для «{name}». Если неактуально — больше беспокоить не буду.`;

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
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

export function LeadWorkspace() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [draft, setDraft] = useState<LeadDraft>(blankLead);
  const [importOpen, setImportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [messageTemplate, setMessageTemplate] = useState(defaultTemplate);
  const [importForm, setImportForm] = useState({ apiKey: "", city: "Кызылорда", query: "кафе ресторан", pages: 2 });
  const [busy, setBusy] = useState(false);

  async function loadLeads() {
    setError("");
    try {
      const response = await fetch("/api/leads", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось загрузить базу");
      setLeads(data.leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить базу");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
    const savedTemplate = window.localStorage.getItem("leadpilot-message-template");
    if (savedTemplate) setMessageTemplate(savedTemplate);
  }, []);

  const cities = useMemo(() => Array.from(new Set(leads.map((lead) => lead.city).filter(Boolean))).sort(), [leads]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch = !needle || [lead.name, lead.category, lead.address, lead.phone, lead.instagram]
        .join(" ")
        .toLowerCase()
        .includes(needle);
      return matchesSearch && (statusFilter === "all" || lead.status === statusFilter) && (cityFilter === "all" || lead.city === cityFilter);
    });
  }, [leads, search, statusFilter, cityFilter]);

  const counts = useMemo(() => ({
    total: leads.length,
    new: leads.filter((lead) => lead.status === "new").length,
    replied: leads.filter((lead) => ["replied", "demo", "client"].includes(lead.status)).length,
    client: leads.filter((lead) => lead.status === "client").length,
  }), [leads]);

  function openCreate() {
    setEditing(null);
    setDraft(blankLead);
    setEditorOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setDraft({
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
    });
    setEditorOpen(true);
  }

  async function saveLead() {
    if (!draft.name.trim()) return setError("Укажите название заведения");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/leads", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...draft } : draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить");
      setEditorOpen(false);
      await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
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
    setLeads((current) => current.map((lead) => (lead.id === id ? { ...lead, ...changes } : lead)));
    return true;
  }

  async function deleteLead(id: number) {
    if (!window.confirm("Удалить заведение из базы?")) return;
    const response = await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    if (response.ok) setLeads((current) => current.filter((lead) => lead.id !== id));
  }

  async function openWhatsApp(lead: Lead) {
    const phone = normalizePhone(lead.whatsapp || lead.phone);
    if (!phone) {
      openEdit(lead);
      setError("Добавьте номер WhatsApp для этого заведения");
      return;
    }
    const text = messageTemplate.replaceAll("{name}", lead.name).replaceAll("{city}", lead.city || "вашем городе");
    const opened = window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    await patchLead(lead.id, { status: lead.status === "new" ? "contacted" : lead.status, lastContactedAt: new Date().toISOString() });
  }

  async function importFrom2Gis() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/import/2gis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось импортировать данные");
      setImportOpen(false);
      await loadLeads();
      window.alert(`Добавлено: ${data.added}. Пропущено дублей: ${data.skipped}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось импортировать данные");
    } finally {
      setBusy(false);
    }
  }

  function saveTemplate() {
    window.localStorage.setItem("leadpilot-message-template", messageTemplate);
    setTemplateOpen(false);
  }

  function exportCsv() {
    const header = ["Название", "Категория", "Город", "Адрес", "Телефон", "WhatsApp", "Сайт", "Instagram", "Статус", "Заметки"];
    const rows = leads.map((lead) => [lead.name, lead.category, lead.city, lead.address, lead.phone, lead.whatsapp, lead.website, lead.instagram, statusLabels[lead.status], lead.notes]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leadpilot-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">LP</span><span>LeadPilot KZ</span></div>
        <div className="nav-label">Рабочее пространство</div>
        <nav>
          <button className="nav-item active"><span className="nav-icon">⌂</span><span>База заведений</span></button>
          <button className="nav-item" onClick={() => setTemplateOpen(true)}><span className="nav-icon">✎</span><span>Шаблон сообщения</span></button>
          <button className="nav-item" onClick={exportCsv}><span className="nav-icon">⇩</span><span>Экспорт базы</span></button>
        </nav>
        <div className="sidebar-note"><strong>Без массового спама</strong>Сообщение открывается в WhatsApp и отправляется только после вашего нажатия.</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Продажи ресторанным бизнесам</p>
            <h1>База заведений</h1>
            <p className="subtitle">Находите подходящие кафе, ведите контакты и не теряйте повторные касания.</p>
          </div>
          <div className="top-actions">
            <button className="button" onClick={() => setTemplateOpen(true)}>✎ Шаблон</button>
            <button className="button" onClick={() => setImportOpen(true)}>↻ Импорт из 2ГИС</button>
            <button className="button primary" onClick={openCreate}>＋ Добавить заведение</button>
          </div>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <section className="stats" aria-label="Статистика базы">
          <div className="stat" style={{ "--stat-color": "#dcebe3" } as React.CSSProperties}><div className="stat-label">Всего в базе</div><div className="stat-value">{counts.total}</div><div className="stat-detail">заведений</div></div>
          <div className="stat" style={{ "--stat-color": "#fff0d6" } as React.CSSProperties}><div className="stat-label">Новые</div><div className="stat-value">{counts.new}</div><div className="stat-detail">ещё не обработаны</div></div>
          <div className="stat" style={{ "--stat-color": "#dfe9ff" } as React.CSSProperties}><div className="stat-label">Есть интерес</div><div className="stat-value">{counts.replied}</div><div className="stat-detail">ответили или смотрят демо</div></div>
          <div className="stat" style={{ "--stat-color": "#dff4c0" } as React.CSSProperties}><div className="stat-label">Стали клиентами</div><div className="stat-value">{counts.client}</div><div className="stat-detail">оплаченных проектов</div></div>
        </section>

        <section className="workspace">
          <div className="toolbar">
            <div className="search-wrap"><span className="search-icon">⌕</span><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название, адрес, телефон…" aria-label="Поиск" /></div>
            <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Фильтр по статусу">
              <option value="all">Все статусы</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="select" value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} aria-label="Фильтр по городу">
              <option value="all">Все города</option>
              {cities.map((city) => <option key={city}>{city}</option>)}
            </select>
          </div>

          {loading ? <div className="loading">Загружаю базу…</div> : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-mark">⌕</div>
              <h3>{leads.length ? "Ничего не найдено" : "База пока пустая"}</h3>
              <p>{leads.length ? "Измените фильтры или поисковый запрос." : "Добавьте заведение вручную или импортируйте список через официальный API 2ГИС."}</p>
              {!leads.length && <button className="button primary" onClick={() => setImportOpen(true)}>Импортировать из 2ГИС</button>}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Заведение</th><th>Контакты</th><th>Возможность</th><th>Статус</th><th>Заметка</th><th></th></tr></thead>
                <tbody>
                  {filtered.map((lead) => (
                    <tr key={lead.id}>
                      <td><div className="company"><div className="company-avatar">{initials(lead.name)}</div><div><strong>{lead.name}</strong><small>{lead.category}{lead.city ? ` · ${lead.city}` : ""}</small>{lead.address && <small style={{ display: "block" }}>{lead.address}</small>}</div></div></td>
                      <td>{lead.phone || lead.whatsapp ? <a className="contact-line" href={`tel:+${normalizePhone(lead.phone || lead.whatsapp)}`}>+{normalizePhone(lead.phone || lead.whatsapp)}</a> : <span className="muted">Нет номера</span>}{lead.instagram && <a className="contact-line muted" href={lead.instagram.startsWith("http") ? lead.instagram : `https://instagram.com/${lead.instagram.replace("@", "")}`} target="_blank" rel="noreferrer">{lead.instagram}</a>}</td>
                      <td>{!lead.hasSite ? <span className="signal hot">● Нет сайта</span> : <span className="signal good">● Есть сайт</span>}{lead.rating != null && <div className="muted" style={{ marginTop: 6 }}>★ {lead.rating.toFixed(1)}</div>}</td>
                      <td><select className="status-select" value={lead.status} onChange={(event) => void patchLead(lead.id, { status: event.target.value as Status })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                      <td className="muted" style={{ maxWidth: 210 }}>{lead.notes || "—"}</td>
                      <td><div className="row-actions"><button className="button whatsapp small" onClick={() => void openWhatsApp(lead)} aria-label={`Написать ${lead.name} в WhatsApp`}>WhatsApp ↗</button><button className="icon-button" onClick={() => openEdit(lead)} title="Изменить">✎</button><button className="icon-button" onClick={() => void deleteLead(lead.id)} title="Удалить">×</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {editorOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditorOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lead-editor-title">
            <div className="modal-header"><div><h2 id="lead-editor-title">{editing ? "Изменить заведение" : "Новое заведение"}</h2><p>Сохраните только рабочие контакты компании.</p></div><button className="icon-button" onClick={() => setEditorOpen(false)} aria-label="Закрыть">×</button></div>
            <div className="modal-body"><div className="form-grid">
              <div className="form-group"><label>Название *</label><input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div className="form-group"><label>Категория</label><input className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></div>
              <div className="form-group"><label>Город</label><input className="field" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></div>
              <div className="form-group"><label>Адрес</label><input className="field" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></div>
              <div className="form-group"><label>Телефон</label><input className="field" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+7 777 000 00 00" /></div>
              <div className="form-group"><label>WhatsApp</label><input className="field" value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} placeholder="Если отличается от телефона" /></div>
              <div className="form-group"><label>Сайт</label><input className="field" value={draft.website} onChange={(e) => setDraft({ ...draft, website: e.target.value, hasSite: Boolean(e.target.value) })} /></div>
              <div className="form-group"><label>Instagram</label><input className="field" value={draft.instagram} onChange={(e) => setDraft({ ...draft, instagram: e.target.value })} placeholder="@restaurant" /></div>
              <div className="form-group"><label>Статус</label><select className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              <div className="form-group"><label>Ссылка 2ГИС</label><input className="field" value={draft.sourceUrl} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} /></div>
              <div className="form-group full"><label>Заметка</label><textarea className="textarea" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Например: меню только в актуальных сторис" /></div>
            </div><div className="modal-footer"><button className="button" onClick={() => setEditorOpen(false)}>Отмена</button><button className="button primary" disabled={busy} onClick={() => void saveLead()}>{busy ? "Сохраняю…" : "Сохранить"}</button></div></div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setImportOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <div className="modal-header"><div><h2 id="import-title">Импорт из 2ГИС</h2><p>Поиск работает через официальный Places API.</p></div><button className="icon-button" onClick={() => setImportOpen(false)} aria-label="Закрыть">×</button></div>
            <div className="modal-body"><div className="form-grid">
              <div className="form-group full"><label>API‑ключ 2ГИС</label><input className="field" type="password" value={importForm.apiKey} onChange={(e) => setImportForm({ ...importForm, apiKey: e.target.value })} placeholder="Вставьте demo или рабочий ключ" /><div className="hint">Ключ используется только для этого запроса и не сохраняется в базе.</div></div>
              <div className="form-group"><label>Город</label><input className="field" value={importForm.city} onChange={(e) => setImportForm({ ...importForm, city: e.target.value })} /></div>
              <div className="form-group"><label>Что искать</label><input className="field" value={importForm.query} onChange={(e) => setImportForm({ ...importForm, query: e.target.value })} placeholder="кафе ресторан" /></div>
              <div className="form-group"><label>Страниц результатов</label><select className="select" value={importForm.pages} onChange={(e) => setImportForm({ ...importForm, pages: Number(e.target.value) })}><option value={1}>1 страница · до 10</option><option value={2}>2 страницы · до 20</option><option value={3}>3 страницы · до 30</option><option value={5}>5 страниц · до 50</option></select></div>
              <div className="form-group"><label>После импорта</label><div className="hint"><span className="pill">Автодубли</span><span className="pill">Фильтр без сайта</span><br />Проверьте номера перед первым сообщением.</div></div>
            </div><div className="modal-footer"><button className="button" onClick={() => setImportOpen(false)}>Отмена</button><button className="button primary" disabled={busy || !importForm.apiKey.trim()} onClick={() => void importFrom2Gis()}>{busy ? "Импортирую…" : "Начать импорт"}</button></div></div>
          </div>
        </div>
      )}

      {templateOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setTemplateOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="template-title">
            <div className="modal-header"><div><h2 id="template-title">Шаблон WhatsApp</h2><p>Перед отправкой WhatsApp покажет готовый текст — его можно изменить.</p></div><button className="icon-button" onClick={() => setTemplateOpen(false)} aria-label="Закрыть">×</button></div>
            <div className="modal-body"><div className="form-group"><label>Текст сообщения</label><textarea className="textarea" style={{ minHeight: 220 }} value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} /><div className="hint">Переменные: <span className="pill">{"{name}"}</span><span className="pill">{"{city}"}</span></div></div><div className="template-preview">{messageTemplate.replaceAll("{name}", "Пример Кафе").replaceAll("{city}", "Кызылорда")}</div><div className="modal-footer"><button className="button" onClick={() => setMessageTemplate(defaultTemplate)}>Вернуть исходный</button><button className="button primary" onClick={saveTemplate}>Сохранить шаблон</button></div></div>
          </div>
        </div>
      )}
    </div>
  );
}

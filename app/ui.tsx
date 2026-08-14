"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export type IconName =
  | "analytics"
  | "building"
  | "calendar"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "database"
  | "edit"
  | "external"
  | "export"
  | "filter"
  | "message"
  | "more"
  | "plus"
  | "refresh"
  | "search"
  | "settings"
  | "spark"
  | "threads"
  | "trash"
  | "whatsapp";

export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    analytics: (
      <>
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19H2" />
      </>
    ),
    building: (
      <>
        <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
        <path d="M16 9h2a2 2 0 0 1 2 2v10" />
        <path d="M8 7h4M8 11h4M8 15h4M3 21h18" />
      </>
    ),
    calendar: (
      <>
        <path d="M6 2v4M18 2v4M3 10h18" />
        <rect x="3" y="4" width="18" height="17" rx="2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7" />
        <path d="m10 14 11-11" />
        <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
      </>
    ),
    export: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2" />
      </>
    ),
    filter: <path d="M4 5h16l-6.5 7.2V19l-3 1.5v-8.3Z" />,
    message: (
      <>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M6.1 8A7 7 0 0 1 18.7 6L20 12M4 12l1.3 6A7 7 0 0 0 17.9 16" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8Z" />
        <path d="m19 15 .7 2.1L22 18l-2.3.9L19 21l-.7-2.1L16 18l2.3-.9Z" />
      </>
    ),
    threads: (
      <>
        <path d="M16.6 8.7c-.5-3.2-2.5-5-5.5-5-3.7 0-6.1 2.7-6.1 7.9 0 5.4 2.7 8.7 7.1 8.7 3.3 0 5.9-1.8 5.9-4.8 0-2.8-2.1-4.4-5.4-4.4-2.7 0-4.5 1.2-4.5 3.2 0 1.6 1.3 2.8 3.2 2.8 2.8 0 5.1-2.3 5.3-5.4" />
        <path d="M14.8 8.4c2.8.8 4.7 2.3 5.2 4.7" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" />
      </>
    ),
    whatsapp: (
      <>
        <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.7a8.5 8.5 0 1 1 16.2-4.1Z" />
        <path d="M8.3 7.7c.3-.4.7-.4 1-.1l1.1 1.5c.2.3.2.6 0 .9l-.7.9c.9 1.8 2.3 3.1 4.1 3.9l.8-.8c.3-.3.6-.3.9-.1l1.6 1c.4.2.4.7.2 1-.5.8-1.4 1.3-2.3 1.2-4.4-.5-7.9-4-8.4-8.3-.1-.4.8-1.1 1.7-1.1Z" />
      </>
    ),
  };

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`brand-symbol ${compact ? "compact" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 40 40" role="img">
        <path className="brand-symbol-base" d="M8 6h11v7h-4v14h12v7H8Z" />
        <path
          className="brand-symbol-route"
          d="M19 6h7.2C32.7 6 36 9.7 36 15.3c0 4.8-2.6 8.2-7.7 9.1L23 19.8c4-.2 6-1.4 6-4.3 0-2.5-1.4-3.6-4.4-3.6H19Z"
        />
        <path className="brand-symbol-signal" d="m18 14 9 5-9 5Z" />
      </svg>
    </span>
  );
}

type AppShellProps = {
  active: "leads" | "threads";
  children: ReactNode;
  onTemplate?: () => void;
  onExport?: () => void;
};

export function AppShell({
  active,
  children,
  onTemplate,
  onExport,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const scope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Read the persisted preference after hydration to keep server markup stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(
      window.localStorage.getItem("leadpilot-sidebar-collapsed") === "true",
    );
  }, []);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          "[data-page-reveal]",
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.22,
            ease: "power2.out",
            clearProps: "transform,opacity",
          },
        );
      });
      return () => media.revert();
    },
    { scope },
  );

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("leadpilot-sidebar-collapsed", String(next));
      return next;
    });
  }

  const templateControl = onTemplate ? (
    <button className="nav-item" onClick={onTemplate} title="Шаблон сообщения">
      <Icon name="message" />
      <span>Шаблон сообщения</span>
    </button>
  ) : (
    <Link className="nav-item" href="/?panel=template" title="Шаблон сообщения">
      <Icon name="message" />
      <span>Шаблон сообщения</span>
    </Link>
  );
  const exportControl = onExport ? (
    <button className="nav-item" onClick={onExport} title="Экспорт базы">
      <Icon name="export" />
      <span>Экспорт базы</span>
    </button>
  ) : (
    <Link className="nav-item" href="/?action=export" title="Экспорт базы">
      <Icon name="export" />
      <span>Экспорт базы</span>
    </Link>
  );

  return (
    <div
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}
      ref={scope}
    >
      <a className="skip-link" href="#main-content">
        К основному содержанию
      </a>
      <aside className="sidebar" aria-label="Основная навигация">
        <Link
          className="brand"
          href="/"
          aria-label="LeadPilot KZ, база заведений"
        >
          <BrandMark />
          <span className="brand-copy">
            <strong>LeadPilot</strong>
            <small>KZ</small>
          </span>
        </Link>
        <nav className="primary-nav" aria-label="Разделы LeadPilot">
          <Link
            className={`nav-item ${active === "leads" ? "active" : ""}`}
            href="/"
            aria-current={active === "leads" ? "page" : undefined}
            title="База заведений"
          >
            <Icon name="database" />
            <span>База заведений</span>
          </Link>
          <Link
            className={`nav-item ${active === "threads" ? "active" : ""}`}
            href="/threads"
            aria-current={active === "threads" ? "page" : undefined}
            title="Threads"
          >
            <Icon name="threads" />
            <span>Threads</span>
          </Link>
        </nav>
        <div className="nav-separator" />
        <nav className="secondary-nav" aria-label="Инструменты базы">
          {templateControl}
          {exportControl}
        </nav>
        <div className="sidebar-context">
          <span className="sidebar-context-dot" />
          <div>
            <strong>Рабочий режим</strong>
            <small>Все отправки требуют подтверждения</small>
          </div>
        </div>
        <button
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-expanded={!collapsed}
          aria-label={
            collapsed ? "Развернуть боковую панель" : "Свернуть боковую панель"
          }
        >
          <Icon name={collapsed ? "chevron-right" : "chevron-left"} />
          <span>Свернуть</span>
        </button>
      </aside>

      <main className="main" id="main-content" tabIndex={-1} data-page-reveal>
        {children}
      </main>

      <nav className="mobile-nav" aria-label="Мобильная навигация">
        <Link
          className={active === "leads" ? "active" : ""}
          href="/"
          aria-current={active === "leads" ? "page" : undefined}
        >
          <Icon name="database" />
          <span>База</span>
        </Link>
        <Link
          className={active === "threads" ? "active" : ""}
          href="/threads"
          aria-current={active === "threads" ? "page" : undefined}
        >
          <Icon name="threads" />
          <span>Threads</span>
        </Link>
        {onTemplate ? (
          <button onClick={onTemplate}>
            <Icon name="message" />
            <span>Шаблон</span>
          </button>
        ) : (
          <Link href="/?panel=template">
            <Icon name="message" />
            <span>Шаблон</span>
          </Link>
        )}
        {onExport ? (
          <button onClick={onExport}>
            <Icon name="export" />
            <span>Экспорт</span>
          </button>
        ) : (
          <Link href="/?action=export">
            <Icon name="export" />
            <span>Экспорт</span>
          </Link>
        )}
      </nav>
    </div>
  );
}

type DialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "medium" | "large" | "editor";
};

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "medium",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeBeforeOpen = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    activeBeforeOpen.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const controls = dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    controls?.[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      activeBeforeOpen.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  const descriptionId = description ? "active-dialog-description" : undefined;
  return (
    <div className="modal-backdrop">
      <button
        type="button"
        className="modal-dismiss"
        aria-label="Закрыть окно"
        onClick={onClose}
      />
      <div
        className={`modal modal-${size}`}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-dialog-title"
        aria-describedby={descriptionId}
      >
        <header className="modal-header">
          <div>
            <h2 id="active-dialog-title">{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-scroll">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
    >
      <div className="confirm-actions">
        <button className="button" onClick={onClose}>
          Отмена
        </button>
        <button
          className="button danger-filled"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Выполняю…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

export function FeedbackBanner({
  tone,
  children,
  onClose,
}: {
  tone: "error" | "info" | "warning";
  children: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className={`feedback-banner ${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <span className="feedback-indicator">
        <Icon
          name={
            tone === "error" ? "close" : tone === "warning" ? "filter" : "check"
          }
          size={16}
        />
      </span>
      <div>{children}</div>
      {onClose && (
        <button
          className="feedback-close"
          onClick={onClose}
          aria-label="Скрыть уведомление"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

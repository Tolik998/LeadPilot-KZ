# LeadPilot KZ — Master Design System

## 1. Brand foundation

LeadPilot KZ is a private sales operating system for finding qualified hospitality leads, managing contact stages, and turning research into deliberate conversations. It should feel like a precise editorial tool, not a generic admin template.

- Brand promise: make the next useful sales action obvious.
- Personality: assured, observant, practical, calm, locally grounded.
- Core metaphor: a guided route from signal to qualified conversation.
- Tagline: **Сигнал. Контакт. Результат.**
- Visual mode: light editorial workspace with a dark operator sidebar.
- Avoid: purple/blue AI gradients, neon glow, decorative glass, excessive pills, oversized landing-page spacing, stock imagery, animated spectacle.

### Mark

The LeadPilot mark combines an `L`-shaped route frame with a forward `P`/directional notch. It should be implemented as an inline SVG so it remains crisp, themeable, and accessible. The mark may appear alone only when the adjacent product name is hidden by a collapsed navigation state.

## 2. Color system

All component colors must reference semantic tokens.

| Token                    | Value     | Role                                        |
| ------------------------ | --------- | ------------------------------------------- |
| `--color-canvas`         | `#F3F1EB` | application background                      |
| `--color-surface`        | `#FBFAF7` | primary cards and panels                    |
| `--color-surface-raised` | `#FFFFFF` | modals, menus and focused rows              |
| `--color-surface-subtle` | `#ECEAE3` | grouped controls and quiet states           |
| `--color-ink`            | `#17201D` | primary text                                |
| `--color-ink-secondary`  | `#59635F` | secondary text; must retain AA contrast     |
| `--color-ink-tertiary`   | `#747D79` | metadata only, never essential instructions |
| `--color-border`         | `#D9D7CF` | standard boundary                           |
| `--color-border-strong`  | `#B9BDB6` | hover and emphasized separators             |
| `--color-sidebar`        | `#202522` | navigation background                       |
| `--color-sidebar-muted`  | `#AEB7B2` | inactive navigation labels                  |
| `--color-accent`         | `#E6A92D` | signature signal/primary action accent      |
| `--color-accent-strong`  | `#925607` | accessible accent text and pressed states   |
| `--color-accent-soft`    | `#FFF2CD` | selected and highlighted background         |
| `--color-focus`          | `#96630A` | keyboard focus outline                      |
| `--color-success`        | `#26734E` | completed/connected states                  |
| `--color-success-soft`   | `#E4F3EA` | success surface                             |
| `--color-warning`        | `#8A5D11` | warnings/pending states                     |
| `--color-warning-soft`   | `#FFF3D8` | warning surface                             |
| `--color-danger`         | `#A63E38` | destructive/error text and controls         |
| `--color-danger-soft`    | `#FBE9E7` | error surface                               |
| `--color-info`           | `#3E6254` | neutral informational state                 |
| `--color-info-soft`      | `#E7EFEB` | informational surface                       |

Accent yellow is the ownable brand signal. It marks priority, discovery, and the primary path. Green is semantic support, not the primary brand color.

## 3. Status colors

Status meaning must always be conveyed by label plus color.

| Status  | Foreground | Background | Intent               |
| ------- | ---------- | ---------- | -------------------- |
| Новый   | `#7A520E`  | `#FFF0C6`  | unprocessed signal   |
| Написал | `#315B72`  | `#E6F0F5`  | outreach sent        |
| Ответил | `#425493`  | `#EAEDFA`  | conversation started |
| Показ   | `#70508A`  | `#F0EAF5`  | demonstration stage  |
| Клиент  | `#216544`  | `#E1F1E7`  | converted            |
| Отказ   | `#6D625D`  | `#ECE9E6`  | closed/lost          |

## 4. Typography

Primary family: **Geist Sans**, with system sans-serif fallback. Use Geist Mono only for numeric metadata or IDs when tabular alignment helps.

| Role              | Size / line-height | Weight | Use                                |
| ----------------- | ------------------ | ------ | ---------------------------------- |
| Display           | `40–48 / 1.02`     | 620    | desktop page title only            |
| Page title mobile | `32 / 1.08`        | 620    | top-level title                    |
| Section title     | `22–26 / 1.2`      | 620    | page sections and modal headings   |
| Card title        | `16–18 / 1.3`      | 620    | entities and panels                |
| Body              | `14–16 / 1.5`      | 430    | interface copy                     |
| Label             | `12–13 / 1.35`     | 600    | field labels and controls          |
| Metadata          | `11–12 / 1.4`      | 520    | dates, counts, secondary context   |
| Metric            | `28–34 / 1`        | 650    | dashboard numbers; tabular figures |

Rules:

- Never use body text below 12px.
- Long names and user content wrap naturally with `overflow-wrap: anywhere`.
- Use truncation only when full text remains available by title/expanded view.
- Short headings may use balanced wrapping; do not force non-breaking phrases.

## 5. Grid and spacing

- Base unit: 4px; primary rhythm: 8px.
- Component gaps: `4, 8, 12, 16`.
- Panel padding: `16` compact, `20` default, `24` comfortable.
- Section gaps: `16–24` in CRM screens.
- Desktop content gutter: `24–32`; tablet: `20–24`; mobile: `14–16`.
- Maximum content width: none for dense tables; allow the workspace to use the full viewport after sidebar allocation.
- Sidebar: 232px expanded, 76px collapsed.
- Breakpoints: 375, 768, 1024, 1440.

## 6. Shape and elevation

- Radius 6px: micro controls, tags.
- Radius 9px: buttons, inputs, row actions.
- Radius 12px: cards and grouped controls.
- Radius 16px: large panels and modals.
- Fully rounded shapes are reserved for compact statuses or connection indicators.
- Shadow 1: `0 1px 2px rgba(23, 32, 29, .06)`.
- Shadow 2: `0 14px 40px rgba(23, 32, 29, .10)` for menus/modals only.
- Borders create structure; shadows do not replace hierarchy.

## 7. Controls and states

### Buttons

- Minimum pointer target: 40px desktop, 44px touch.
- Primary: ink background with white text; accent strip/icon may use signal yellow.
- WhatsApp: success foreground/surface, visually prominent within row actions.
- Secondary: surface background, clear border.
- Destructive: danger foreground; filled danger only in final confirmation.
- Disabled: native `disabled`, 45% opacity, no hover movement.
- Pressed: stable bounds with background/elevation change; never move surrounding layout.

### Fields

- Visible label for every form field.
- Height: 40px desktop, at least 44px mobile.
- Focus: 2px `--color-focus` outline with 2px offset or equivalent 3:1 ring.
- Error: inline field message connected via `aria-describedby`; also announce form error summary when multiple fields fail.
- Helper copy persists under complex inputs.

### Motion

- Fast state: 160ms.
- Standard panels: 220ms.
- Complex sheet/modal: 260ms.
- Use opacity and transform only.
- Entrance decelerates; exit is about 65% of entrance duration.
- Animations are interruptible and never required for state correctness.
- `prefers-reduced-motion: reduce` removes non-essential transitions and animation.

## 8. Navigation

### Desktop

- Fixed dark sidebar with icon and visible label.
- Active destination uses signal-yellow marker, brighter text, and quiet surface—not glow.
- Collapse button exposes `aria-expanded`; collapsed items retain tooltips and accessible names.
- Primary destinations: База заведений, Threads.
- Secondary actions: Шаблон сообщения, Экспорт базы.

### Mobile

- Compact top brand bar plus fixed bottom navigation with no more than four labeled destinations/actions.
- Reserve bottom safe-area padding so content is never hidden.
- No horizontal main-page overflow; local tab lists may scroll with visible continuation cues.

## 9. Dashboard and CRM patterns

### Metrics

- Six sales stages: total, new, contacted, replied, demo, client.
- Compact grid: six columns at 1440, three/two columns as space reduces.
- Highlight one useful relationship through typography, not decorative charts.

### Filters

- Search is primary and widest.
- Filters form a compact responsive grid.
- Active filters appear as removable chips below the controls.
- One visible “Сбросить” control clears all deviations from defaults.
- Result count is explicit and screen-reader-friendly.

### Lead table

- Desktop table is optimized for scanning: row number, identity, contact, signal, stage, note, actions.
- Sticky header may be used only when it does not obscure keyboard focus.
- Notes clamp to two/three lines and expose full content through title/editing.
- Icon-only actions have consistent SVG icons, names, tooltips, and 40px targets.
- On screens below 768px, render entity cards instead of shrinking or horizontally scrolling the desktop table.

### Lead card

- Header: row number, avatar, name, status.
- Body: category/city/address, rating/reviews, site signal, contact.
- Footer: WhatsApp primary, open/edit secondary, delete in overflow or separated danger action.

## 10. Feedback, empty and loading states

- Error: cause plus recovery action, role `alert`.
- Success/info: non-blocking `role=status`, dismissible, no focus theft.
- Empty states explain why the list is empty and offer one relevant action.
- Loading uses stable skeleton blocks for data regions; avoid layout shift.
- No result is not an API error.

## 11. Modals, drawers and forms

- Desktop modal max height: `calc(100dvh - 32px)`; header/footer remain visible and body scrolls.
- Mobile uses a full-height bottom sheet/full-screen panel with safe-area padding.
- Close via explicit button, Escape and backdrop when safe.
- Focus moves into the modal and returns to the opener; Tab is trapped within the active dialog.
- Body scroll locks while open.
- If form data differs from its opening snapshot, Escape/backdrop/close asks before discarding.
- Destructive confirmations are custom accessible dialogs; no native `window.confirm` for product actions.

## 12. Threads workspace

- Shares navigation, typography, surfaces, controls, feedback and motion tokens.
- Route-level tabs stay compact and wrap/scroll without clipping active labels.
- Content cards prioritize topic, status, schedule and next action.
- Editor uses a two-pane desktop layout and a single-column mobile flow.
- Published content is read-only by both semantics and styling.
- Analytics use direct numeric cards and accessible tables; never rely on color alone.

## 13. Accessibility and verification

- WCAG AA contrast for normal text; 3:1 for component boundaries and focus states.
- Provide a skip link and logical heading order.
- All functionality works by keyboard.
- Use inline SVG icons; decorative icons beside labels are `aria-hidden`.
- No interaction relies on hover, drag, color, or animation alone.
- Support browser zoom at 125% and 150% without lost controls.
- Verify at 375, 768, 1024 and 1440 widths, including long names, addresses, phone numbers and notes.

## 14. Brand board

The generated art-direction reference is saved at `artifacts/brand/leadpilot-brand-board.png`. It guides the mark, palette and editorial rhythm; production UI remains code-native and does not embed the board.

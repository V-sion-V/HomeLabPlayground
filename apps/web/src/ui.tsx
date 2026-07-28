import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode
} from "react";
import {
  productConfig,
  type ThemePalette
} from "@party/contracts";

export type ThemeMode = "light" | "dark";
export type ThemeScope = "main" | "poker";

function systemTheme(): ThemeMode {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function storedTheme(): ThemeMode {
  const stored = localStorage.getItem("party-theme");
  return stored === "light" || stored === "dark" ? stored : systemTheme();
}

const paletteVariables: Record<keyof ThemePalette, string> = {
  canvas: "--color-canvas",
  surface: "--color-surface",
  surfaceRaised: "--color-surface-raised",
  surfaceMuted: "--color-surface-muted",
  text: "--color-text",
  textMuted: "--color-text-muted",
  border: "--color-border",
  accent: "--color-accent",
  accentHover: "--color-accent-hover",
  accentPressed: "--color-accent-pressed",
  accentText: "--color-accent-text",
  danger: "--color-danger",
  dangerHover: "--color-danger-hover",
  dangerPressed: "--color-danger-pressed",
  dangerText: "--color-danger-text",
  success: "--color-success",
  warning: "--color-warning",
  focus: "--color-focus",
  shadow: "--color-shadow",
  table: "--color-table",
  tableRail: "--color-table-rail",
  tableText: "--color-table-text"
};

export function applyProductTheme(scope: ThemeScope, mode: ThemeMode): void {
  const palette = productConfig.themes[scope][mode];
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.dataset.themeScope = scope;
  for (const [key, variable] of Object.entries(paletteVariables) as Array<
    [keyof ThemePalette, string]
  >) {
    root.style.setProperty(variable, palette[key]);
  }
  root.style.setProperty("--suit-standard-clubs", productConfig.suits.standard.clubs);
  root.style.setProperty("--suit-standard-diamonds", productConfig.suits.standard.diamonds);
  root.style.setProperty("--suit-standard-hearts", productConfig.suits.standard.hearts);
  root.style.setProperty("--suit-standard-spades", productConfig.suits.standard.spades);
  root.style.setProperty(
    "--suit-contrast-clubs",
    productConfig.suits["high-contrast"].clubs
  );
  root.style.setProperty(
    "--suit-contrast-diamonds",
    productConfig.suits["high-contrast"].diamonds
  );
  root.style.setProperty(
    "--suit-contrast-hearts",
    productConfig.suits["high-contrast"].hearts
  );
  root.style.setProperty(
    "--suit-contrast-spades",
    productConfig.suits["high-contrast"].spades
  );
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", palette.canvas);
}

export function ThemeToggle({
  scope,
  lightLabel,
  darkLabel,
  groupLabel
}: {
  scope: ThemeScope;
  lightLabel: string;
  darkLabel: string;
  groupLabel: string;
}) {
  const [mode, setMode] = useState<ThemeMode>(storedTheme);

  useEffect(() => {
    applyProductTheme(scope, mode);
  }, [mode, scope]);

  const select = (next: ThemeMode) => {
    localStorage.setItem("party-theme", next);
    setMode(next);
  };

  return (
    <div className="theme-toggle" aria-label={groupLabel}>
      <button
        type="button"
        className={mode === "light" ? "active" : ""}
        aria-label={lightLabel}
        aria-pressed={mode === "light"}
        onClick={() => select("light")}
      >
        ☀
      </button>
      <button
        type="button"
        className={mode === "dark" ? "active" : ""}
        aria-label={darkLabel}
        aria-pressed={mode === "dark"}
        onClick={() => select("dark")}
      >
        ◐
      </button>
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  };
  const move = (offset: number) => {
    setActiveIndex((current) =>
      (current + offset + options.length) % options.length
    );
  };
  const onOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(index);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="select-field">
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        className="select-trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(selectedIndex);
            setOpen(true);
          }
        }}
      >
        <span id={`${id}-value`}>{options[selectedIndex]?.label}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          className="select-options"
          role="listbox"
          aria-labelledby={`${id}-label`}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? "selected" : ""}
              tabIndex={activeIndex === index ? 0 : -1}
              onFocus={() => setActiveIndex(index)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CollapsibleCard({
  title,
  summary,
  expanded,
  onToggle,
  children
}: {
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const regionId = useId();
  return (
    <section className={`settings-card${expanded ? " expanded" : ""}`}>
      <button
        type="button"
        className="settings-card-toggle"
        aria-expanded={expanded}
        aria-controls={regionId}
        onClick={onToggle}
      >
        <span>
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <span className="settings-card-indicator" aria-hidden="true">
          {expanded ? "−" : "+"}
        </span>
      </button>
      <div id={regionId} className="settings-card-body" hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={onCancel}>
      <section
        className="modal narrow confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-title">
          <h2 id="confirm-dialog-title">{title}</h2>
        </div>
        <p id="confirm-dialog-description">{description}</p>
        <div className="modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

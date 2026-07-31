import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import {
  productConfig,
  type ThemeMode,
  type ThemePalette
} from "@party/contracts";

export type { ThemeMode } from "@party/contracts";
export type ThemeScope = "main" | "poker" | "avalon";

type ContextMenuGestureProps = Pick<
  HTMLAttributes<HTMLElement>,
  | "onClickCapture"
  | "onContextMenu"
  | "onKeyDown"
  | "onPointerCancel"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
>;

const contextMenuTargetSelector = "[data-context-menu-id]";
const contextMenuLongPressMs = 540;
const contextMenuMoveTolerance = 12;

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

export function useContextMenuGesture(
  onOpen: (targetId: string, anchor: HTMLElement) => void
): ContextMenuGestureProps {
  const onOpenRef = useRef(onOpen);
  const pressRef = useRef<{
    anchor: HTMLElement;
    pointerId: number;
    startX: number;
    startY: number;
    timer: number;
  } | null>(null);
  const suppressedClickRef = useRef<{
    anchor: HTMLElement;
    expiresAt: number;
  } | null>(null);
  onOpenRef.current = onOpen;

  const clearPress = useCallback(() => {
    if (pressRef.current) {
      window.clearTimeout(pressRef.current.timer);
      pressRef.current = null;
    }
  }, []);

  const targetForEvent = useCallback(
    (eventTarget: EventTarget | null, boundary: HTMLElement) => {
      if (!(eventTarget instanceof Element)) return null;
      const target = eventTarget.closest<HTMLElement>(
        contextMenuTargetSelector
      );
      return target && boundary.contains(target) ? target : null;
    },
    []
  );

  const openTarget = useCallback((anchor: HTMLElement) => {
    const targetId = anchor.dataset.contextMenuId;
    if (targetId) onOpenRef.current(targetId, anchor);
  }, []);

  useEffect(() => clearPress, [clearPress]);

  return {
    onContextMenu: (event: ReactMouseEvent<HTMLElement>) => {
      const anchor = targetForEvent(event.target, event.currentTarget);
      if (!anchor) return;
      event.preventDefault();
      clearPress();
      const suppressed = suppressedClickRef.current;
      if (
        suppressed?.anchor === anchor &&
        suppressed.expiresAt > performance.now()
      ) {
        return;
      }
      openTarget(anchor);
    },
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" || event.button !== 0) return;
      const anchor = targetForEvent(event.target, event.currentTarget);
      if (!anchor) return;
      clearPress();
      const press = {
        anchor,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        timer: 0
      };
      press.timer = window.setTimeout(() => {
        if (pressRef.current !== press) return;
        suppressedClickRef.current = {
          anchor,
          expiresAt: performance.now() + 1_000
        };
        openTarget(anchor);
        pressRef.current = null;
      }, contextMenuLongPressMs);
      pressRef.current = press;
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      if (
        Math.hypot(
          event.clientX - press.startX,
          event.clientY - press.startY
        ) > contextMenuMoveTolerance
      ) {
        clearPress();
      }
    },
    onPointerUp: clearPress,
    onPointerCancel: clearPress,
    onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
      const suppressed = suppressedClickRef.current;
      if (
        !suppressed ||
        suppressed.expiresAt <= performance.now() ||
        !(event.target instanceof Node) ||
        !suppressed.anchor.contains(event.target)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      suppressedClickRef.current = null;
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (
        event.key !== "ContextMenu" &&
        !(event.shiftKey && event.key === "F10")
      ) {
        return;
      }
      const anchor = targetForEvent(event.target, event.currentTarget);
      if (!anchor) return;
      event.preventDefault();
      openTarget(anchor);
    }
  };
}

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
  mode,
  onChange,
  lightLabel,
  darkLabel,
  groupLabel
}: {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
  lightLabel: string;
  darkLabel: string;
  groupLabel: string;
}) {
  return (
    <div className="theme-toggle" aria-label={groupLabel}>
      <button
        type="button"
        className={mode === "light" ? "active" : ""}
        aria-label={lightLabel}
        aria-pressed={mode === "light"}
        onClick={() => onChange("light")}
      >
        ☀
      </button>
      <button
        type="button"
        className={mode === "dark" ? "active" : ""}
        aria-label={darkLabel}
        aria-pressed={mode === "dark"}
        onClick={() => onChange("dark")}
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
        <ArrowIcon direction="down" />
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
          <ArrowIcon direction={expanded ? "down" : "left"} />
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

  return createPortal(
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
        <div className="modal-scroll-region">
          <p id="confirm-dialog-description">{description}</p>
        </div>
        <div className="modal-footer">
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
        </div>
      </section>
    </div>,
    document.body
  );
}

export function ArrowIcon({
  direction,
  className = ""
}: {
  direction: "left" | "down" | "right";
  className?: string;
}) {
  const path =
    direction === "left"
      ? "M14.5 5 7.5 12l7 7"
      : direction === "right"
        ? "m9.5 5 7 7-7 7"
        : "m5 9.5 7 7 7-7";
  return (
    <svg
      aria-hidden="true"
      className={`arrow-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg
      aria-hidden="true"
      className="room-action-icon"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M10 5H5v14h5M13 8l4 4-4 4M8 12h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseRoomIcon() {
  return (
    <svg
      aria-hidden="true"
      className="room-action-icon"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="m7 7 10 10M17 7 7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RoomHeader({
  roomName,
  gameLabel,
  phaseLabel,
  backLabel,
  leaveLabel,
  closeLabel,
  onBack,
  onLeave,
  onClose,
  leaveDisabled = false,
  titleButtonLabel,
  onTitleClick,
  titleExpanded,
  titleControls
}: {
  roomName: string;
  gameLabel: string;
  phaseLabel: string;
  backLabel: string;
  leaveLabel: string;
  closeLabel: string;
  onBack: () => void;
  onLeave: () => void;
  onClose?: () => void;
  leaveDisabled?: boolean;
  titleButtonLabel?: string;
  onTitleClick?: () => void;
  titleExpanded?: boolean;
  titleControls?: string;
}) {
  const title = (
    <>
      <h1>{roomName}</h1>
      <span>
        {gameLabel} · {phaseLabel}
      </span>
    </>
  );
  return (
    <header className="shared-room-header">
      <div className="shared-room-header-actions">
        <button
          type="button"
          className="secondary shared-room-action"
          aria-label={backLabel}
          onClick={onBack}
        >
          <ArrowIcon direction="left" />
          <span className="shared-room-action-label">{backLabel}</span>
        </button>
        <button
          type="button"
          className="secondary shared-room-action"
          aria-label={leaveLabel}
          disabled={leaveDisabled}
          onClick={onLeave}
        >
          <ExitIcon />
          <span className="shared-room-action-label">{leaveLabel}</span>
        </button>
      </div>
      {onTitleClick ? (
        <button
          type="button"
          className="shared-room-title shared-room-title-button"
          aria-label={titleButtonLabel ?? roomName}
          aria-expanded={titleExpanded}
          aria-controls={titleControls}
          onClick={onTitleClick}
        >
          {title}
        </button>
      ) : (
        <div className="shared-room-title">{title}</div>
      )}
      <div className="shared-room-header-danger">
        {onClose && (
          <button
            type="button"
            className="danger shared-room-action"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <CloseRoomIcon />
            <span className="shared-room-action-label">{closeLabel}</span>
          </button>
        )}
      </div>
    </header>
  );
}

export function FixedPanel({
  as = "section",
  className = "",
  header,
  footer,
  children,
  ...landmarkProps
}: {
  as?: "main" | "section";
  className?: string;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  role?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const Component = as;
  return (
    <Component
      className={`fixed-panel ${className}`.trim()}
      {...landmarkProps}
    >
      <div className="fixed-panel-header">{header}</div>
      <div className="fixed-panel-scroll">{children}</div>
      {footer !== undefined && (
        <div className="fixed-panel-footer">{footer}</div>
      )}
    </Component>
  );
}

export function AnchoredMenu({
  anchor,
  open,
  label,
  onClose,
  children
}: {
  anchor: HTMLElement | null;
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const lastAnchorRef = useRef<HTMLElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({
    visibility: "hidden"
  });

  const position = useCallback(() => {
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gutter = 8;
    const width = Math.min(menuRect.width, window.innerWidth - gutter * 2);
    const left = Math.max(
      gutter,
      Math.min(
        anchorRect.left + anchorRect.width / 2 - width / 2,
        window.innerWidth - width - gutter
      )
    );
    const below = anchorRect.bottom + gutter;
    const top =
      below + menuRect.height <= window.innerHeight - gutter
        ? below
        : Math.max(gutter, anchorRect.top - menuRect.height - gutter);
    setStyle({
      visibility: "visible",
      left,
      top,
      width,
      maxHeight: Math.max(96, window.innerHeight - top - gutter)
    });
  }, [anchor]);

  useLayoutEffect(() => {
    if (!open) return;
    lastAnchorRef.current = anchor;
    position();
    const frame = requestAnimationFrame(() => {
      position();
      menuRef.current
        ?.querySelector<HTMLButtonElement>(
          '[role="menuitem"]:not(:disabled)'
        )
        ?.focus();
    });
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [anchor, open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !anchor?.contains(target)
      ) {
        onClose();
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor, onClose, open]);

  useEffect(() => {
    if (!open && lastAnchorRef.current?.isConnected) {
      lastAnchorRef.current.focus();
    }
  }, [open]);

  if (!open || !anchor) return null;
  return createPortal(
    <div
      ref={menuRef}
      className="anchored-menu"
      role="menu"
      aria-label={label}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
}

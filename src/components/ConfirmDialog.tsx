import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  busy,
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", closeFromKeyboard);
    return () => window.removeEventListener("keydown", closeFromKeyboard);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop confirm-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) onCancel();
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <header className="confirm-dialog__header">
          <span className="confirm-dialog__icon">
            <AlertTriangle size={18} />
          </span>
          <div>
            <small>Agent Signal</small>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={cancelLabel}
            disabled={busy}
            onClick={onCancel}
          >
            <X size={17} />
          </button>
        </header>

        <p id="confirm-dialog-description">{description}</p>

        <footer className="confirm-dialog__footer">
          <button
            className="button button--secondary"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="button button--danger-solid"
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

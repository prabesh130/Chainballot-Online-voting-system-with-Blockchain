import React from "react";

export type NoticeKind = "success" | "error" | "info" | "warning";

export type NoticeItem = {
  id: number;
  kind: NoticeKind;
  title: string;
  message?: string;
};

type NotificationStackProps = {
  notices: NoticeItem[];
  onDismiss: (id: number) => void;
};

const noticeStyles: Record<NoticeKind, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export const NotificationStack: React.FC<NotificationStackProps> = ({
  notices,
  onDismiss,
}) => {
  if (!notices.length) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[70] w-[92vw] max-w-sm space-y-3">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className={`rounded-xl border p-4 shadow-lg backdrop-blur-sm ${noticeStyles[notice.kind]}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{notice.title}</p>
              {notice.message ? (
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  {notice.message}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(notice.id)}
              className="rounded-md px-2 py-1 text-xs font-semibold hover:bg-black/5"
              aria-label="Dismiss notification"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirm-dialog-title"
          className="text-lg font-bold text-slate-800"
        >
          {title}
        </h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

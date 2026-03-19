import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
} from "lucide-react";

export type NoticeKind = "success" | "error" | "info" | "warning";

export type NoticeItem = {
  id: number;
  kind: NoticeKind;
  title: string;
  message?: string;
};

const noticeStyles: Record<
  NoticeKind,
  { container: string; icon: any; iconColor: string }
> = {
  success: {
    container:
      "border-emerald-100 bg-white text-emerald-900 shadow-emerald-100/50",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
  },
  error: {
    container: "border-rose-100 bg-white text-rose-900 shadow-rose-100/50",
    icon: AlertCircle,
    iconColor: "text-rose-500",
  },
  info: {
    container: "border-blue-100 bg-white text-blue-900 shadow-blue-100/50",
    icon: Info,
    iconColor: "text-blue-500",
  },
  warning: {
    container: "border-amber-100 bg-white text-amber-900 shadow-amber-100/50",
    icon: AlertTriangle,
    iconColor: "text-amber-500",
  },
};

export const NotificationStack: React.FC<{
  notices: NoticeItem[];
  onDismiss: (id: number) => void;
}> = ({ notices, onDismiss }) => {
  return (
    <div className="fixed top-4 right-4 z-[100] w-[92vw] max-w-sm space-y-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notices.map((notice) => {
          const {
            container,
            icon: Icon,
            iconColor,
          } = noticeStyles[notice.kind];
          return (
            <motion.div
              key={notice.id}
              layout
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`pointer-events-auto rounded-2xl border p-4 shadow-xl backdrop-blur-md flex items-start gap-3 ${container}`}
              role="status"
              aria-live="polite"
            >
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold tracking-tight">
                  {notice.title}
                </p>
                {notice.message && (
                  <p className="mt-1 text-xs leading-relaxed opacity-80 break-words">
                    {notice.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(notice.id)}
                className="rounded-full p-1 hover:bg-slate-100 transition-colors shrink-0"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export const InlineAlert: React.FC<{
  kind: NoticeKind;
  title: string;
  message?: string;
  className?: string;
}> = ({ kind, title, message, className = "" }) => {
  const { container, icon: Icon, iconColor } = noticeStyles[kind];

  return (
    <div
      className={`rounded-xl border p-4 flex gap-3 ${container} ${className}`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold tracking-tight">{title}</p>
        {message && (
          <p className="mt-1 text-xs leading-relaxed opacity-80 break-words">
            {message}
          </p>
        )}
      </div>
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
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-slate-900 tracking-tight">
          {title}
        </h3>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {message}
        </p>
        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

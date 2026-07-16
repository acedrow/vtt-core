import { ref } from "vue";

export type ToastKind = "error" | "info" | "success";

export type Toast = {
  id: string;
  message: string;
  kind: ToastKind;
};

const toasts = ref<Toast[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_DURATION_MS = 4500;

export function showToast(message: string, kind: ToastKind = "error", durationMs = DEFAULT_DURATION_MS) {
  const id = crypto.randomUUID();
  toasts.value = [...toasts.value, { id, message, kind }];
  const timer = setTimeout(() => dismissToast(id), durationMs);
  timers.set(id, timer);
}

export function dismissToast(id: string) {
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

export function useToasts() {
  return { toasts, showToast, dismissToast };
}

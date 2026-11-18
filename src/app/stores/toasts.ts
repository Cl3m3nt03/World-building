import { create } from "zustand";

/** What a notification's button does, e.g. undo what was just done. */
export type ToastAction = {
  label: string;
  /** Read by screen readers instead of `label`: says what it does. */
  altText: string;
  run: () => void;
};

/** A notification at the bottom of the window (#604). */
export type Toast = {
  id: number;
  message: string;
  /** `error`: something failed, shown with the destructive colour. */
  tone: "default" | "error";
  action?: ToastAction | undefined;
};

/** Most notifications shown at once: a new one pushes the oldest out. */
export const MAX_TOASTS = 3;

type ToastState = {
  toasts: Toast[];
  /** Shows a notification; gives its id. */
  show: (toast: { message: string; tone?: Toast["tone"]; action?: ToastAction }) => number;
  dismiss: (id: number) => void;
  /** Every notification gone (the world closes). */
  clear: () => void;
};

let nextId = 1;

/** The notifications of the open world, oldest first (`Toaster` shows them). */
export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  show: ({ message, tone = "default", action }) => {
    const id = nextId++;
    set((state) => ({
      toasts: [...state.toasts, { id, message, tone, action }].slice(-MAX_TOASTS),
    }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

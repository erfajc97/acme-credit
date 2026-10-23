import { toast } from 'sonner';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

/** Errors stay longer: the reader needs time to understand what failed and what to do. */
const DURATION_MS: Record<ToastKind, number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 8000,
};

/** The only door to the toaster (W5); mutations pass an already translated message. */
export function sonnerResponse(message: string, kind: ToastKind): void {
  toast[kind](message, { duration: DURATION_MS[kind] });
}

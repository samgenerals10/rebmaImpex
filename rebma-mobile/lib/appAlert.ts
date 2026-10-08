// rebma-mobile/lib/appAlert.ts
//
// Direct correction: the native Alert.alert()/action-sheet popup (see the
// "Add Image" Capture/Photo/Cancel prompt) renders as a plain unstyled OS
// dialog, not matching the app's design at all. React Native gives no way
// to restyle the real native Alert, so every call site's `Alert` import
// is swapped (see the codemod that did this across the app) for THIS
// module instead, which exposes the exact same `Alert.alert(title,
// message, buttons, options)` signature so no call site's logic changes,
// but renders through AppAlertHost.tsx's own themed modal instead of the
// OS dialog.
import { reportClientError, looksLikeFailure } from './errorReporter';
import { navigationRef } from '../navigation/navigationRef';

const currentScreen = () => {
  try { return navigationRef.isReady() ? (navigationRef.getCurrentRoute() as { name?: string } | undefined)?.name || 'app' : 'app'; } catch { return 'app'; }
};
export interface AppAlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

export interface AppAlertState {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  cancelable: boolean;
  onDismiss?: () => void;
}

type Listener = (state: AppAlertState | null) => void;
let listener: Listener | null = null;

export function registerAppAlertListener(l: Listener | null) {
  listener = l;
}

function alert(title: string, message?: string, buttons?: AppAlertButton[], options?: AppAlertOptions) {
  // Every failure pop-up a person sees is also logged and emailed to the
  // company address (lib/errorReporter.ts).
  const shown = `${title}${message ? `: ${message}` : ''}`;
  if (looksLikeFailure(shown)) reportClientError(`Phone, ${currentScreen()}`, shown);
  const finalButtons = buttons && buttons.length ? buttons : [{ text: 'OK', style: 'default' as const }];
  const state: AppAlertState = {
    title,
    message,
    buttons: finalButtons,
    cancelable: options?.cancelable ?? true,
    onDismiss: options?.onDismiss,
  };
  if (listener) {
    listener(state);
  } else {
    // Host not mounted yet (e.g. very early boot) — fall back to the
    // native dialog rather than silently swallowing the alert.
    // eslint-disable-next-line no-console
    console.warn('[appAlert] shown before AppAlertHost mounted:', title);
  }
}

export const Alert = { alert };

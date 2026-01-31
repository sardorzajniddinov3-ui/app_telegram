export type TelegramWebAppUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramWebApp = {
  initDataUnsafe?: { user?: TelegramWebAppUser };
  ready?: () => void;
  expand?: () => void;
  colorScheme?: 'light' | 'dark';
  themeParams?: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };
};

export function getTelegramWebAppSafe(): TelegramWebApp | null {
  try {
    const w = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
    return w?.Telegram?.WebApp ?? null;
  } catch {
    return null;
  }
}

export function getTelegramUserSafe(): TelegramWebAppUser {
  const tg = getTelegramWebAppSafe();
  const unsafeUser = tg?.initDataUnsafe?.user;
  if (unsafeUser?.id) return unsafeUser;

  // Fallback для Telegram Desktop/браузера, где initDataUnsafe.user может быть undefined.
  // Стабильный id в рамках браузера, чтобы не плодить "user_..." на каждый запуск.
  const key = 'tg_fallback_user_id';
  const existing = Number(localStorage.getItem(key));
  const id = Number.isFinite(existing) && existing > 0 ? existing : Date.now();
  localStorage.setItem(key, String(id));
  return { id };
}

export function initTelegramWebAppSafe(): TelegramWebAppUser {
  const tg = getTelegramWebAppSafe();
  try {
    tg?.ready?.();
  } catch {
    // ignore
  }
  try {
    tg?.expand?.();
  } catch {
    // ignore
  }
  return getTelegramUserSafe();
}

export function getTelegramColorScheme(): 'light' | 'dark' {
  const tg = getTelegramWebAppSafe();
  if (tg?.colorScheme) {
    return tg.colorScheme;
  }
  // Fallback: проверяем системную тему
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

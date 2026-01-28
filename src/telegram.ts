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


import { supabase } from '../supabase'
import localforage from 'localforage'

const imageCacheStore = localforage.createInstance({
  name: 'TelegramQuizApp',
  storeName: 'imageCache',
  description: 'Cached question images'
});

function normalizeImagePath(imagePath) {
  return imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
}

function getProjectIdFromEnv() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const parsed = new URL(supabaseUrl);
    return parsed.hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

async function getImageBlobFromIndexedDb(imagePath) {
  const keysToTry = [imagePath, normalizeImagePath(imagePath)];

  for (const key of keysToTry) {
    try {
      const cached = await imageCacheStore.getItem(key);
      if (!cached) continue;

      if (cached instanceof Blob) return cached;
      if (cached?.blob instanceof Blob) return cached.blob;
      if (cached?.data instanceof Blob) return cached.data;
    } catch (error) {
      console.warn('⚠️ [IMAGE] Ошибка чтения изображения из IndexedDB:', error);
    }
  }

  return null;
}

async function saveImageBlobToIndexedDb(imagePath, blob) {
  if (!(blob instanceof Blob)) return;

  const normalizedPath = normalizeImagePath(imagePath);
  await Promise.allSettled([
    imageCacheStore.setItem(imagePath, blob),
    imageCacheStore.setItem(normalizedPath, blob)
  ]);
}

function buildSupabasePublicUrl(imagePath) {
  const cleanPath = normalizeImagePath(imagePath);
  const projectId = getProjectIdFromEnv();

  if (projectId) {
    return `https://${projectId}.supabase.co/storage/v1/object/public/${cleanPath}`;
  }

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (!supabaseUrl) return cleanPath;
  return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
}

/**
 * Resolves image source by priority:
 * 1) data:image/... => return as is
 * 2) IndexedDB cached blob => URL.createObjectURL(blob)
 * 3) Public Supabase Storage URL
 *
 * @param {string|null|undefined} imagePath
 * @returns {Promise<string|null>}
 */
export async function resolveImageSrc(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    return null;
  }

  if (imagePath.startsWith('data:image')) {
    return imagePath;
  }

  const cachedBlob = await getImageBlobFromIndexedDb(imagePath);
  if (cachedBlob) {
    return URL.createObjectURL(cachedBlob);
  }

  const remoteUrl = imagePath.startsWith('http://') || imagePath.startsWith('https://')
    ? imagePath
    : buildSupabasePublicUrl(imagePath);

  try {
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    await saveImageBlobToIndexedDb(imagePath, blob);

    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn('⚠️ [IMAGE] Не удалось кешировать изображение, используем удаленный URL:', remoteUrl, error);
    return remoteUrl;
  }
}

/**
 * Универсальная функция для разрешения путей к изображениям
 * Поддерживает два формата:
 * 1. Base64 (data:image/...) - возвращает как есть
 * 2. Путь к Supabase Storage (questions/123.webp или question-images/questions/123.webp) - возвращает публичный URL
 * 
 * @param {string|null|undefined} path - Путь к изображению
 * @returns {string|null} - Полный URL изображения или null, если путь не указан
 */
export function resolveImage(path) {
  // Если путь не указан, возвращаем null
  if (!path || typeof path !== 'string') {
    return null;
  }

  // Если путь начинается с data:image, это base64 - возвращаем как есть
  if (path.startsWith('data:image/')) {
    console.log('✅ [IMAGE] Base64 изображение:', path.substring(0, 50) + '...');
    return path;
  }

  // Если путь уже является полным URL (http:// или https://), проверяем и возвращаем
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // Проверяем, не от старого ли проекта URL
    const oldProjects = ['rjfchznkmulatifulele', 'memoqljluizvccomaind'];
    const currentProject = 'psjtbcotmnfvgulziara';
    
    for (const oldProject of oldProjects) {
      if (path.includes(oldProject + '.supabase.co')) {
        console.warn('⚠️ [IMAGE] Обнаружен URL от старого проекта:', oldProject);
        console.warn('⚠️ [IMAGE] Старый URL:', path);
        // Заменяем на новый проект
        const newUrl = path.replace(
          new RegExp(oldProject + '\\.supabase\\.co', 'g'),
          currentProject + '.supabase.co'
        );
        console.log('✅ [IMAGE] Обновлен URL на новый проект:', newUrl);
        return newUrl;
      }
    }
    
    // Если это URL от текущего проекта или другого валидного URL, возвращаем как есть
    console.log('✅ [IMAGE] Полный URL (возвращаем как есть):', path);
    return path;
  }

  // Иначе это путь к Supabase Storage - формируем публичный URL
  console.log('🔍 [IMAGE] Обработка пути к Storage:', path);
  
  // Убираем слеш в начале пути, если есть
  let cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // Определяем bucket и путь к файлу
  // Если путь уже содержит bucket name (question-images/...), используем его
  // Иначе добавляем bucket name
  let bucketName = 'question-images';
  let filePath = cleanPath;
  
  if (cleanPath.startsWith('question-images/')) {
    // Путь уже содержит bucket name, убираем его
    filePath = cleanPath.replace(/^question-images\//, '');
    console.log('🔍 [IMAGE] Путь содержит bucket name, убран:', { cleanPath, filePath });
  }
  
  // Используем getPublicUrl из Supabase клиента для правильного формирования URL
  try {
    console.log('🔍 [IMAGE] Формирование URL через getPublicUrl:', { bucketName, filePath });
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    if (data?.publicUrl) {
      console.log('✅ [IMAGE] URL сформирован через getPublicUrl:', {
        originalPath: path,
        filePath: filePath,
        publicUrl: data.publicUrl
      });
      return data.publicUrl;
    } else {
      console.warn('⚠️ [IMAGE] getPublicUrl вернул пустой URL для пути:', path);
      // Fallback: формируем URL вручную
      return fallbackImageUrl(bucketName, filePath, cleanPath);
    }
  } catch (error) {
    console.error('❌ [IMAGE] Ошибка при формировании URL:', error, 'для пути:', path);
    // Fallback: формируем URL вручную
    return fallbackImageUrl(bucketName, filePath, cleanPath);
  }
}

/**
 * Резервная функция для формирования URL вручную (если getPublicUrl не работает)
 */
function fallbackImageUrl(bucketName, filePath, originalPath) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  if (!supabaseUrl) {
    console.warn('⚠️ [IMAGE] VITE_SUPABASE_URL не установлен, не могу сформировать URL для изображения:', originalPath);
    return originalPath; // Возвращаем путь как есть, если URL не установлен
  }

  // Убираем слеш в конце URL, если есть
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  
  // Формируем публичный URL Supabase Storage
  // Формат: https://PROJECT_ID.supabase.co/storage/v1/object/public/question-images/${filePath}
  const imageUrl = `${baseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
  
  console.log('⚠️ [IMAGE] Использован fallback URL:', {
    bucketName,
    filePath,
    imageUrl
  });
  
  return imageUrl;
}

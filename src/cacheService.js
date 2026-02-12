import localforage from 'localforage';

// Конфигурация localforage для IndexedDB
const cacheStore = localforage.createInstance({
  name: 'TelegramQuizApp',
  storeName: 'quizCache',
  description: 'Cache for quiz topics and questions'
});

// Ключи для хранения данных
const CACHE_KEYS = {
  TOPICS: 'topics',
  TOPICS_TIMESTAMP: 'topics_timestamp',
  QUESTIONS: 'questions',
  QUESTIONS_TIMESTAMP: 'questions_timestamp'
};

// Максимальный возраст кэша (7 дней в миллисекундах)
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Проверяет, не устарел ли кэш
 * @param {number} timestamp - Временная метка кэша
 * @returns {boolean} - true если кэш валиден, false если устарел
 */
const isCacheValid = (timestamp) => {
  if (!timestamp) return false;
  const cacheAge = Date.now() - timestamp;
  return cacheAge < MAX_CACHE_AGE;
};

/**
 * Валидирует структуру данных тем
 * @param {Array} topics - Массив тем
 * @returns {boolean} - true если данные валидны
 */
const validateTopics = (topics) => {
  if (!Array.isArray(topics)) return false;
  if (topics.length === 0) return false;
  // Проверяем, что хотя бы одна тема имеет необходимые поля
  return topics.some(topic => topic && (topic.id || topic.name));
};

/**
 * Валидирует структуру данных вопросов
 * @param {Array} questions - Массив вопросов
 * @returns {boolean} - true если данные валидны
 */
const validateQuestions = (questions) => {
  if (!Array.isArray(questions)) return false;
  if (questions.length === 0) return false;
  
  // Проверяем валидность кэша - проверяем несколько вопросов на наличие answer_* полей
  let validQuestionsCount = 0;
  const sampleSize = Math.min(10, questions.length);
  
  for (let i = 0; i < sampleSize; i++) {
    const q = questions[i];
    if (q && (q.answer_a || q.answer_b || q.answer_c || q.answer_d)) {
      validQuestionsCount++;
    }
  }
  
  // Если хотя бы 80% вопросов имеют опции, считаем кэш валидным
  return validQuestionsCount >= sampleSize * 0.8;
};

/**
 * Сохраняет темы в IndexedDB
 * @param {Array} topics - Массив тем для сохранения
 * @returns {Promise<void>}
 */
export const saveTopics = async (topics) => {
  try {
    if (!validateTopics(topics)) {
      console.warn('[CACHE] Попытка сохранить невалидные темы');
      return;
    }
    
    await cacheStore.setItem(CACHE_KEYS.TOPICS, topics);
    await cacheStore.setItem(CACHE_KEYS.TOPICS_TIMESTAMP, Date.now());
    console.log(`[CACHE] Сохранено ${topics.length} тем в IndexedDB`);
  } catch (error) {
    console.error('[CACHE] Ошибка сохранения тем в IndexedDB:', error);
    throw error;
  }
};

/**
 * Загружает темы из IndexedDB
 * @returns {Promise<Array|null>} - Массив тем или null если кэш отсутствует/невалиден
 */
export const loadTopics = async () => {
  try {
    const [topics, timestamp] = await Promise.all([
      cacheStore.getItem(CACHE_KEYS.TOPICS),
      cacheStore.getItem(CACHE_KEYS.TOPICS_TIMESTAMP)
    ]);
    
    if (!topics || !timestamp) {
      console.log('[CACHE] Кэш тем не найден');
      return null;
    }
    
    if (!isCacheValid(timestamp)) {
      console.log('[CACHE] Кэш тем устарел');
      return null;
    }
    
    if (!validateTopics(topics)) {
      console.warn('[CACHE] Кэш тем невалиден');
      return null;
    }
    
    console.log(`[CACHE] Загружено ${topics.length} тем из IndexedDB`);
    return topics;
  } catch (error) {
    console.error('[CACHE] Ошибка загрузки тем из IndexedDB:', error);
    return null;
  }
};

/**
 * Сохраняет вопросы в IndexedDB
 * @param {Array} questions - Массив вопросов для сохранения
 * @returns {Promise<void>}
 */
export const saveQuestions = async (questions) => {
  try {
    if (!validateQuestions(questions)) {
      console.warn('[CACHE] Попытка сохранить невалидные вопросы');
      return;
    }
    
    // Проверяем размер данных перед сохранением
    const cacheData = JSON.stringify(questions);
    const cacheSize = new Blob([cacheData]).size;
    const maxCacheSize = 50 * 1024 * 1024; // 50MB лимит для IndexedDB (намного больше чем localStorage)
    
    if (cacheSize > maxCacheSize) {
      console.warn(`[CACHE] Размер кэша слишком большой (${(cacheSize / 1024 / 1024).toFixed(2)}MB), пропускаем сохранение`);
      return;
    }
    
    await cacheStore.setItem(CACHE_KEYS.QUESTIONS, questions);
    await cacheStore.setItem(CACHE_KEYS.QUESTIONS_TIMESTAMP, Date.now());
    console.log(`[CACHE] Сохранено ${questions.length} вопросов в IndexedDB (${(cacheSize / 1024).toFixed(2)}KB)`);
  } catch (error) {
    console.error('[CACHE] Ошибка сохранения вопросов в IndexedDB:', error);
    // IndexedDB может иметь ограничения, но это не критично
    if (error.name === 'QuotaExceededError') {
      console.warn('[CACHE] Превышен лимит IndexedDB, очищаем старый кэш');
      await clearCache();
    }
    throw error;
  }
};

/**
 * Загружает вопросы из IndexedDB
 * @returns {Promise<Array|null>} - Массив вопросов или null если кэш отсутствует/невалиден
 */
export const loadQuestions = async () => {
  try {
    const [questions, timestamp] = await Promise.all([
      cacheStore.getItem(CACHE_KEYS.QUESTIONS),
      cacheStore.getItem(CACHE_KEYS.QUESTIONS_TIMESTAMP)
    ]);
    
    if (!questions || !timestamp) {
      console.log('[CACHE] Кэш вопросов не найден');
      return null;
    }
    
    if (!isCacheValid(timestamp)) {
      console.log('[CACHE] Кэш вопросов устарел');
      return null;
    }
    
    if (!validateQuestions(questions)) {
      console.warn('[CACHE] Кэш вопросов невалиден');
      // Очищаем невалидный кэш
      await clearQuestionsCache();
      return null;
    }
    
    console.log(`[CACHE] Загружено ${questions.length} вопросов из IndexedDB`);
    return questions;
  } catch (error) {
    console.error('[CACHE] Ошибка загрузки вопросов из IndexedDB:', error);
    return null;
  }
};

/**
 * Очищает кэш вопросов
 * @returns {Promise<void>}
 */
export const clearQuestionsCache = async () => {
  try {
    await Promise.all([
      cacheStore.removeItem(CACHE_KEYS.QUESTIONS),
      cacheStore.removeItem(CACHE_KEYS.QUESTIONS_TIMESTAMP)
    ]);
    console.log('[CACHE] Кэш вопросов очищен');
  } catch (error) {
    console.error('[CACHE] Ошибка очистки кэша вопросов:', error);
  }
};

/**
 * Очищает кэш тем
 * @returns {Promise<void>}
 */
export const clearTopicsCache = async () => {
  try {
    await Promise.all([
      cacheStore.removeItem(CACHE_KEYS.TOPICS),
      cacheStore.removeItem(CACHE_KEYS.TOPICS_TIMESTAMP)
    ]);
    console.log('[CACHE] Кэш тем очищен');
  } catch (error) {
    console.error('[CACHE] Ошибка очистки кэша тем:', error);
  }
};

/**
 * Очищает весь кэш
 * @returns {Promise<void>}
 */
export const clearCache = async () => {
  try {
    await Promise.all([
      clearQuestionsCache(),
      clearTopicsCache()
    ]);
    console.log('[CACHE] Весь кэш очищен');
  } catch (error) {
    console.error('[CACHE] Ошибка очистки кэша:', error);
  }
};

/**
 * Проверяет доступность IndexedDB (оффлайн режим)
 * @returns {Promise<boolean>}
 */
export const isCacheAvailable = async () => {
  try {
    // Пробуем выполнить простую операцию
    await cacheStore.getItem('__test__');
    return true;
  } catch (error) {
    console.warn('[CACHE] IndexedDB недоступен:', error);
    return false;
  }
};

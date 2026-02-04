import { useState, useEffect, useRef, Suspense, lazy, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import './App.css'
import { initTelegramWebAppSafe, getTelegramColorScheme } from './telegram'
import { supabase } from './supabase'
import StatisticsScreen from './StatisticsScreen'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://apptelegram-production-4131.up.railway.app';

// Компонент экрана загрузки
const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-spinner-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Загрузка...</p>
      </div>
    </div>
  );
};

// Компонент для анимации печатания текста (Typewriter)
const Typewriter = ({ text }) => {
  const [display, setDisplay] = useState('');
  
  useEffect(() => {
    setDisplay(''); // Clear previous text instantly
    let i = 0;
    const interval = setInterval(() => {
      if (!text) return;
      setDisplay(text.slice(0, i + 1)); // Show characters 0 to i
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 25); // 25ms delay per letter
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="ai-explanation-text">
      <span>{display}</span>
      <span className="typewriter-cursor">|</span>
    </div>
  );
};

function App() {
  // Загружаем темы из localStorage или используем дефолтные
  const defaultTopics = [
    { id: 1, name: "Термины", questionCount: 2 },
    { id: 2, name: "Обязанности участников дорожного движения", questionCount: 5 },
    { id: 3, name: "Сигналы светофора и регулировщика", questionCount: 42 },
    { id: 4, name: "Предупредительные и аварийные сигналы", questionCount: 20 },
    { id: 5, name: "Опознавательные знаки транспортных средств", questionCount: 10 },
    { id: 6, name: "Предупреждающие знаки", questionCount: 46 },
    { id: 7, name: "Знаки приоритета", questionCount: 16 },
    { id: 8, name: "Запрещающие знаки", questionCount: 69 },
    { id: 9, name: "Предписывающие знаки", questionCount: 26 },
    { id: 10, name: "Информационно указательные, сервисные и доп. знаки", questionCount: 76 },
    { id: 11, name: "Дорожные разметки", questionCount: 54 }
  ];
  
  const [topics, setTopics] = useState(defaultTopics);

  const questionsData = {
    1: []
  }

  const [userRole, setUserRole] = useState(null)
  const [userId, setUserId] = useState(null) // ID пользователя Telegram
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('topics') // 'topics', 'topicDetail', 'quiz', 'admin', 'fullReview', 'examSelect', 'examResult', 'examFullReview', 'registration', 'analytics'
  // Загружаем сохраненную тему из localStorage при инициализации
  const getSavedTheme = () => {
    try {
      const saved = localStorage.getItem('app_theme');
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch (e) {
      console.error('Ошибка чтения темы из localStorage:', e);
    }
    return null;
  };

  const [isDarkMode, setIsDarkMode] = useState(false) // Состояние темы
  const [manualTheme, setManualTheme] = useState(getSavedTheme) // Ручное переключение темы (null = авто, 'light' или 'dark')
  const [isAdmin, setIsAdmin] = useState(false) // Состояние админ-доступа из таблицы admins
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [selectedResult, setSelectedResult] = useState(null) // Выбранный результат для просмотра
  const [selectedExamResult, setSelectedExamResult] = useState(null) // Выбранный результат экзамена для просмотра
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [results, setResults] = useState({})
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0)
  const [testStartTime, setTestStartTime] = useState(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [userAnswers, setUserAnswers] = useState([]) // Сохраняем все ответы пользователя
  const userAnswersRef = useRef([]) // Референс для синхронного доступа к ответам
  const [testQuestions, setTestQuestions] = useState([]) // Сохраняем вопросы теста
  
  // ========== ЭКЗАМЕН: Состояния для режима экзамена ==========
  const [activeMode, setActiveMode] = useState('topic') // 'topic' или 'exam'
  const [examQuestionCount, setExamQuestionCount] = useState(null) // Выбранное количество вопросов для экзамена
  const [isExamMode, setIsExamMode] = useState(false) // Флаг, что сейчас идет экзамен (не тест по теме)
  const [examTimeLimit, setExamTimeLimit] = useState(null) // Лимит времени для экзамена в секундах
  const [examTimeRemaining, setExamTimeRemaining] = useState(null) // Оставшееся время экзамена в секундах
  
  // Admin panel state
  const [adminScreen, setAdminScreen] = useState('list') // 'list', 'add', 'edit', 'topicQuestions', 'addTopic', 'users', 'admins'
  const [adminSelectedTopic, setAdminSelectedTopic] = useState(null) // Выбранная тема в админ-панели
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [savedQuestions, setSavedQuestions] = useState([])
  const [questionForm, setQuestionForm] = useState({
    text: '',
    answers: [
      { id: 'a', text: '', correct: false },
      { id: 'b', text: '', correct: false },
      { id: 'c', text: '', correct: false },
      { id: 'd', text: '', correct: false }
    ],
    correct: 'a',
    imageUrl: '',
    imageFile: null, // Файл изображения
    topicId: 1
  })
  
  // Состояние для добавления темы
  const [newTopicName, setNewTopicName] = useState('')
  const [editingTopicId, setEditingTopicId] = useState(null) // ID редактируемой темы
  const [editingTopicName, setEditingTopicName] = useState('') // Название редактируемой темы
  const [draggedTopicIndex, setDraggedTopicIndex] = useState(null) // Индекс перетаскиваемой темы
  const [dragOverIndex, setDragOverIndex] = useState(null) // Индекс темы, над которой перетаскивают
  
  // Состояние для регистрации пользователя
  const [userData, setUserData] = useState(null) // Данные текущего пользователя
  const [registrationForm, setRegistrationForm] = useState({
    name: '',
    phone: ''
  })
  const [usersList, setUsersList] = useState([]) // Список всех пользователей для админ-панели
  const [usersLoading, setUsersLoading] = useState(false) // Загрузка пользователей из Supabase
  const [usersError, setUsersError] = useState(null) // Ошибка загрузки пользователей
  const [dbActiveSubs, setDbActiveSubs] = useState([]) // Активные подписки из БД (backend)
  const [dbSubsLoading, setDbSubsLoading] = useState(false)
  const [dbSubsError, setDbSubsError] = useState(null)
  const [grantForm, setGrantForm] = useState({ telegramId: '', days: '30' })
  const [grantLoading, setGrantLoading] = useState(false)
  
  // ========== ИИ-ОБЪЯСНЕНИЕ ОШИБОК: Состояния ==========
  const [explanations, setExplanations] = useState({}) // { questionId: { explanation: string, loading: boolean, error: string } }
  
  // ========== ИИ-ОБЪЯСНЕНИЕ ОШИБОК: Функция для получения объяснения с эффектом печатания ==========
  // Система автоматического переключения моделей реализована в Edge Function
  // При ошибке 429 или 404 система автоматически переключается на следующую модель
  const getExplanation = async (questionId, question, wrongAnswer, correctAnswer, isHintInTest = false) => {
    // Если объяснение уже загружено, не запрашиваем снова
    if (explanations[questionId]?.explanation) {
      return;
    }
    
    // Проверяем лимит ИИ перед использованием
    const limitCheck = await checkAILimit(isHintInTest);
    console.log('[AI_LIMIT] Проверка лимита для объяснения:', limitCheck, 'isHintInTest:', isHintInTest);
    
    // СТРОГАЯ ПРОВЕРКА: блокируем если allowed === false ИЛИ remaining === 0
    if (!limitCheck.allowed || limitCheck.remaining === 0) {
      console.log('[AI_LIMIT] ⛔⛔⛔ БЛОКИРУЕМ ЗАПРОС ОБЪЯСНЕНИЯ - ЛИМИТ ИСЧЕРПАН!');
      console.log('[AI_LIMIT] Детали блокировки:', { allowed: limitCheck.allowed, remaining: limitCheck.remaining });
      const limitMessage = limitCheck.remaining === 0 
        ? 'Лимит использования ИИ исчерпан. Оформите подписку для увеличения лимита.'
        : `Осталось ${limitCheck.remaining} использований ИИ. Оформите подписку для увеличения лимита.`;
      console.log('[AI_LIMIT] Лимит исчерпан, блокируем запрос:', limitMessage);
      setExplanations(prev => ({
        ...prev,
        [questionId]: { loading: false, explanation: null, error: limitMessage, streaming: false }
      }));
      return; // ВАЖНО: выходим из функции, не отправляем запрос
    }
    
    console.log('[AI_LIMIT] Лимит позволяет использовать ИИ, отправляем запрос');
    
    // Устанавливаем состояние загрузки
    setExplanations(prev => ({
      ...prev,
      [questionId]: { loading: true, explanation: null, error: null, streaming: false }
    }));
    
    try {
      console.log('Запрос объяснения для вопроса:', { questionId, question, wrongAnswer, correctAnswer });
      
      // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ПЕРЕД ОТПРАВКОЙ ЗАПРОСА
      const finalLimitCheck = await checkAILimit(isHintInTest);
      console.log('[AI_LIMIT] Финальная проверка перед отправкой объяснения:', finalLimitCheck);
      
      // СТРОГАЯ ПРОВЕРКА: если allowed === false ИЛИ remaining === 0, блокируем
      if (!finalLimitCheck.allowed || finalLimitCheck.remaining === 0) {
        console.log('[AI_LIMIT] ⛔⛔⛔ БЛОКИРУЕМ ЗАПРОС ОБЪЯСНЕНИЯ ПЕРЕД ОТПРАВКОЙ - ЛИМИТ ИСЧЕРПАН!');
        const limitMessage = finalLimitCheck.remaining === 0 
          ? 'Лимит использования ИИ исчерпан. Оформите подписку для увеличения лимита.'
          : `Осталось ${finalLimitCheck.remaining} использований ИИ. Оформите подписку для увеличения лимита.`;
        setExplanations(prev => ({
          ...prev,
          [questionId]: { loading: false, explanation: null, error: limitMessage, streaming: false }
        }));
        return; // ВАЖНО: выходим из функции, не отправляем запрос
      }
      
      const { data, error } = await supabase.functions.invoke('explain-answer', {
        body: {
          question: question,
          wrongAnswer: wrongAnswer,
          correctAnswer: correctAnswer
        }
      });
      
      console.log('Ответ от функции:', { data, error });
      
      if (error) {
        console.error('Ошибка от Supabase:', error);
        throw new Error(error.message || JSON.stringify(error));
      }
      
      if (!data || !data.explanation) {
        console.error('Нет данных или объяснения в ответе:', data);
        throw new Error('Функция вернула пустой ответ');
      }
      
      // Проверяем, не является ли ответ финальным сообщением об исчерпании всех лимитов
      // Если это сообщение "Все лимиты ИИ временно исчерпаны", значит все модели не сработали
      if (data.explanation && data.explanation.includes('Все лимиты ИИ временно исчерпаны')) {
        // Все модели исчерпали лимиты - показываем ошибку
        setExplanations(prev => ({
          ...prev,
          [questionId]: { loading: false, explanation: null, error: data.explanation, streaming: false }
        }));
        console.log('[AI] Все модели исчерпали лимиты');
        return;
      }
      
      // Если это сообщение об ошибке одной модели, система fallback уже попробовала другие
      // Показываем ошибку только если это финальное сообщение
      
      // Получаем полный текст объяснения
      const fullExplanation = data.explanation;
      
      // Увеличиваем счетчик использования ИИ после успешного запроса
      console.log('[AI_COUNTER] Перед вызовом incrementAIUsage для объяснения, isHintInTest:', isHintInTest);
      await incrementAIUsage(isHintInTest);
      console.log('[AI_COUNTER] После вызова incrementAIUsage для объяснения');
      
      // Начинаем эффект печатания: показываем текст посимвольно
      setExplanations(prev => ({
        ...prev,
        [questionId]: { loading: false, explanation: '', error: null, streaming: true, fullText: fullExplanation }
      }));
      
      // Печатаем текст посимвольно с задержкой
      let currentIndex = 0;
      const typeInterval = setInterval(() => {
        currentIndex++;
        const displayedText = fullExplanation.slice(0, currentIndex);
        
        setExplanations(prev => {
          const current = prev[questionId];
          if (!current || current.fullText !== fullExplanation) {
            // Если состояние изменилось (например, пользователь переключил экран), останавливаем
            clearInterval(typeInterval);
            return prev;
          }
          
          if (currentIndex >= fullExplanation.length) {
            // Текст полностью напечатан
            clearInterval(typeInterval);
            return {
              ...prev,
              [questionId]: { 
                loading: false, 
                explanation: fullExplanation, 
                error: null, 
                streaming: false,
                fullText: undefined // Удаляем fullText после завершения
              }
            };
          }
          
          return {
            ...prev,
            [questionId]: { 
              loading: false, 
              explanation: displayedText, 
              error: null, 
              streaming: true,
              fullText: fullExplanation
            }
          };
        });
      }, 20); // 20ms задержка между символами (можно настроить скорость)
      
    } catch (err) {
      console.error('Ошибка при получении объяснения:', err);
      let errorMessage = err?.message || err?.toString() || 'Неизвестная ошибка';
      
      // Обработка ошибок
      // Система fallback в Edge Function автоматически переключается между моделями
      // Если все модели исчерпали лимиты, показываем соответствующее сообщение
      if (errorMessage.includes('Все лимиты ИИ временно исчерпаны')) {
        // Все модели не сработали - это финальное сообщение
        errorMessage = errorMessage;
      } else if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('перегружен')) {
        // Ошибка одной модели - система fallback попробует другие автоматически
        // Показываем сообщение о попытке переключения
        errorMessage = `⏳ Переключение на другую модель ИИ...`;
      } else {
        errorMessage = `Ошибка: ${errorMessage}. Проверьте, что функция explain-answer создана в Supabase Dashboard.`;
      }
      
      setExplanations(prev => ({
        ...prev,
        [questionId]: { 
          loading: false, 
          explanation: null, 
          error: errorMessage,
          streaming: false
        }
      }));
    }
  };
  const [grantMessage, setGrantMessage] = useState(null)
  const [subscriptionInfo, setSubscriptionInfo] = useState(null) // /api/subscription/me
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false) // Модальное окно подписки
  const [showTariffSelection, setShowTariffSelection] = useState(false) // Показать выбор тарифов в модальном окне
  const [selectedTariff, setSelectedTariff] = useState(null) // Выбранный тариф для оплаты
  const [paymentSenderInfo, setPaymentSenderInfo] = useState('') // Информация об отправителе платежа
  const [showPaymentModal, setShowPaymentModal] = useState(false) // Видимость модального окна оплаты
  const [showWelcomeModal, setShowWelcomeModal] = useState(false) // Модальное окно поздравления с регистрацией
  const [trialDays, setTrialDays] = useState(0) // Количество дней пробной подписки
  const [showConfetti, setShowConfetti] = useState(false) // Показать конфетти
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(() => {
    // Загружаем статус обработки из localStorage при инициализации
    try {
      const saved = localStorage.getItem('payment_processing');
      return saved === 'true';
    } catch (e) {
      return false;
    }
  }) // Статус обработки платежа
  const [paymentModalAnimated, setPaymentModalAnimated] = useState(false) // Флаг, что анимация уже была показана
  const [adminsList, setAdminsList] = useState([]) // Список администраторов
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [adminsError, setAdminsError] = useState(null)
  const [adminForm, setAdminForm] = useState({ telegramId: '' }) // Форма добавления админа
  const [adminFormLoading, setAdminFormLoading] = useState(false)
  const [adminFormMessage, setAdminFormMessage] = useState(null)
  const [userSearchQuery, setUserSearchQuery] = useState('') // Поиск пользователей
  const [selectedUser, setSelectedUser] = useState(null) // Выбранный пользователь для модального окна
  const [showUserModal, setShowUserModal] = useState(false) // Показать модальное окно пользователя

  // ========== ПЕРСОНАЛЬНЫЙ ИИ-ТРЕНЕР ==========
  const [userPerformance, setUserPerformance] = useState(null) // Средний % по всем темам
  const [problematicQuizzes, setProblematicQuizzes] = useState([]) // Проблемные темы
  const [aiTrainerAdvice, setAiTrainerAdvice] = useState(null) // Совет от ИИ после теста
  const [showAiAdvice, setShowAiAdvice] = useState(false) // Показать блок с советом ИИ
  
  // ========== ЭКРАН СТАТИСТИКИ ==========
  const [analyticsData, setAnalyticsData] = useState(null) // Статистика по темам
  const [analyticsLoading, setAnalyticsLoading] = useState(false) // Загрузка статистики
  const [analyticsAiVerdict, setAnalyticsAiVerdict] = useState(null) // AI-вердикт для статистики

  // ========== ФУНКЦИИ ПЕРСОНАЛЬНОГО ИИ-ТРЕНЕРА ==========
  
  // 1. Анализ производительности пользователя
  const analyzeUserPerformance = async () => {
    if (!userId) return null;
    
    try {
      console.log('[AI TRAINER] Анализ производительности пользователя:', userId);
      
      // Получаем средний процент успеваемости по всем темам
      const { data: avgData, error: avgError } = await supabase
        .rpc('get_user_average_performance', { p_user_id: userId });
      
      if (!avgError && avgData !== null) {
        setUserPerformance(avgData);
        console.log('[AI TRAINER] Средняя успеваемость:', avgData + '%');
      }
      
      // Получаем 3 самые проблемные темы
      const { data: problemsData, error: problemsError } = await supabase
        .rpc('get_problematic_topics', { p_user_id: userId, p_limit: 3 });
      
      if (!problemsError && problemsData && problemsData.length > 0) {
        setProblematicQuizzes(problemsData);
        console.log('[AI TRAINER] Проблемные темы:', problemsData);
        return problemsData;
      }
      
      return [];
    } catch (error) {
      console.error('[AI TRAINER] Ошибка анализа производительности:', error);
      return [];
    }
  };
  
  // 2. Адаптивный подбор вопросов (40% из ошибок пользователя)
  const getAdaptiveQuestions = async (topicId, totalQuestions = 20) => {
    if (!userId) return [];
    
    try {
      console.log('[AI TRAINER] Адаптивный подбор вопросов для темы:', topicId);
      
      // Получаем вопросы с ошибками пользователя
      const { data: errorQuestions, error: errorQuestionsError } = await supabase
        .rpc('get_user_error_questions', { p_user_id: userId, p_topic_id: String(topicId) });
      
      if (errorQuestionsError) {
        console.warn('[AI TRAINER] Ошибка получения ошибочных вопросов:', errorQuestionsError);
      }
      
      // Получаем все вопросы темы (используем getMergedQuestions как fallback)
      const allQuestions = getMergedQuestions(topicId);
      
      if (!allQuestions || allQuestions.length === 0) {
        console.warn('[AI TRAINER] Нет вопросов для темы');
        return [];
      }
      
      // Если нет ошибок или их мало, возвращаем случайные вопросы
      if (!errorQuestions || errorQuestions.length === 0) {
        console.log('[AI TRAINER] Нет ошибок пользователя, возвращаем случайные вопросы');
        return shuffleArray(allQuestions).slice(0, totalQuestions);
      }
      
      // Вычисляем 40% от общего количества
      const errorQuestionCount = Math.ceil(totalQuestions * 0.4);
      const regularQuestionCount = totalQuestions - errorQuestionCount;
      
      console.log('[AI TRAINER] Подбор: 40% ошибочных (${errorQuestionCount}), 60% обычных (${regularQuestionCount})');
      
      // Получаем вопросы с ошибками
      const errorQuestionIds = errorQuestions.map(eq => eq.question_id);
      const questionsWithErrors = allQuestions.filter(q => errorQuestionIds.includes(q.id));
      const questionsWithoutErrors = allQuestions.filter(q => !errorQuestionIds.includes(q.id));
      
      // Выбираем случайные вопросы с ошибками
      const selectedErrorQuestions = shuffleArray(questionsWithErrors).slice(0, errorQuestionCount);
      
      // Дополняем обычными вопросами
      const selectedRegularQuestions = shuffleArray(questionsWithoutErrors).slice(0, regularQuestionCount);
      
      // Объединяем и перемешиваем
      const finalQuestions = shuffleArray([...selectedErrorQuestions, ...selectedRegularQuestions]);
      
      console.log('[AI TRAINER] Итого вопросов:', finalQuestions.length);
      return finalQuestions.slice(0, totalQuestions);
      
    } catch (error) {
      console.error('[AI TRAINER] Ошибка адаптивного подбора:', error);
      return [];
    }
  };
  
  // Вспомогательная функция для перемешивания массива
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  
  // 3. Получить совет от ИИ после теста
  const getAITrainerAdvice = async (testResult) => {
    // Получаем userId напрямую из Telegram (надежнее, чем полагаться на состояние)
    const tgUser = initTelegramWebAppSafe();
    const currentUserId = tgUser?.id ? String(tgUser.id) : userId; // Используем состояние как fallback
    
    if (!currentUserId) {
      console.log('[AI TRAINER] Пропуск - userId не установлен (ни из Telegram, ни из состояния)');
      return;
    }
    
    // Проверяем лимит ИИ перед использованием (это не подсказка в тесте, а другой тип использования)
    const limitCheck = await checkAILimit(false);
    console.log('[AI_LIMIT] Проверка лимита для совета:', limitCheck);
    console.log('[AI_LIMIT] limitCheck.allowed:', limitCheck.allowed, 'limitCheck.remaining:', limitCheck.remaining);
    
    // СТРОГАЯ ПРОВЕРКА: блокируем если allowed === false ИЛИ remaining === 0
    if (!limitCheck.allowed || limitCheck.remaining === 0) {
      console.log('[AI_LIMIT] ⛔⛔⛔ БЛОКИРУЕМ ЗАПРОС СОВЕТА - ЛИМИТ ИСЧЕРПАН!');
      console.log('[AI_LIMIT] Детали блокировки:', { allowed: limitCheck.allowed, remaining: limitCheck.remaining });
      const limitMessage = limitCheck.remaining === 0 
        ? 'Лимит использования ИИ исчерпан. Оформите подписку для увеличения лимита.'
        : `Осталось ${limitCheck.remaining} использований ИИ. Оформите подписку для увеличения лимита.`;
      console.log('[AI_LIMIT] Лимит исчерпан, блокируем запрос совета:', limitMessage);
      setAiTrainerAdvice({ loading: false, text: null, error: limitMessage });
      setShowAiAdvice(true);
      return; // ВАЖНО: выходим из функции, не отправляем запрос
    }
    
    console.log('[AI_LIMIT] Лимит позволяет использовать ИИ для совета, отправляем запрос');
    
    try {
      console.log('[AI TRAINER] Запрос совета от ИИ для результата:', {
        correct: testResult.correct,
        total: testResult.total,
        hasQuestions: !!testResult.questions,
        hasUserAnswers: !!testResult.userAnswers,
        userId: currentUserId
      });
      
      // Сначала показываем блок с загрузкой
      setAiTrainerAdvice({ loading: true, text: null, error: null });
      setShowAiAdvice(true);
      console.log('[AI TRAINER] Блок показан, состояние:', { showAiAdvice: true, loading: true });
      
      // Формируем список ошибок
      const errors = [];
      if (testResult.questions && testResult.userAnswers) {
        testResult.questions.forEach((question, index) => {
          const userAnswer = testResult.userAnswers[index];
          if (userAnswer && !userAnswer.isCorrect) {
            const wrongAnswer = question.answers.find(a => {
              const normalizeId = (id) => {
                if (id === null || id === undefined) return null;
                const num = Number(id);
                if (!isNaN(num)) return num;
                return String(id);
              };
              return normalizeId(a.id) === normalizeId(userAnswer.selectedAnswerId);
            });
            const correctAnswer = question.answers.find(a => a.correct === true);
            
            if (wrongAnswer && correctAnswer) {
              errors.push({
                question: question.text || question.question || 'Вопрос',
                wrong: wrongAnswer.text || wrongAnswer.option_text || 'Выбранный ответ',
                correct: correctAnswer.text || correctAnswer.option_text || 'Правильный ответ'
              });
            }
          }
        });
      }
      
      console.log('[AI TRAINER] Сформировано ошибок:', errors.length);
      
      // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ПЕРЕД ОТПРАВКОЙ ЗАПРОСА
      const finalLimitCheck = await checkAILimit(false);
      console.log('[AI_LIMIT] Финальная проверка перед отправкой совета:', finalLimitCheck);
      
      // СТРОГАЯ ПРОВЕРКА: если allowed === false ИЛИ remaining === 0, блокируем
      if (!finalLimitCheck.allowed || finalLimitCheck.remaining === 0) {
        console.log('[AI_LIMIT] ⛔⛔⛔ БЛОКИРУЕМ ЗАПРОС СОВЕТА ПЕРЕД ОТПРАВКОЙ - ЛИМИТ ИСЧЕРПАН!');
        const limitMessage = finalLimitCheck.remaining === 0 
          ? 'Лимит использования ИИ исчерпан. Оформите подписку для увеличения лимита.'
          : `Осталось ${finalLimitCheck.remaining} использований ИИ. Оформите подписку для увеличения лимита.`;
        setAiTrainerAdvice({ loading: false, text: null, error: limitMessage });
        setShowAiAdvice(true);
        return; // ВАЖНО: выходим из функции, не отправляем запрос
      }
      
      // Вызываем Edge Function
      const { data, error } = await supabase.functions.invoke('ai-trainer-advice', {
        body: {
          userId: currentUserId,
          errors: errors,
          correctCount: testResult.correct || 0,
          totalCount: testResult.total || 0
        }
      });
      
      if (error) {
        console.error('[AI TRAINER] Ошибка получения совета:', error);
        // При ошибке просто скрываем блок, не показываем ошибку пользователю
        setShowAiAdvice(false);
        setAiTrainerAdvice({ 
          loading: false, 
          text: null, 
          error: null
        });
        return;
      }
      
      if (data && data.advice) {
        console.log('[AI TRAINER] Получен совет:', data.advice);
        // Увеличиваем счетчик использования ИИ после успешного запроса
        console.log('[AI_COUNTER] Перед вызовом incrementAIUsage для совета');
        await incrementAIUsage(false);
        console.log('[AI_COUNTER] После вызова incrementAIUsage для совета');
        setAiTrainerAdvice({ 
          loading: false, 
          text: data.advice, 
          error: null
        });
      } else {
        // Если нет совета, скрываем блок
        setShowAiAdvice(false);
        setAiTrainerAdvice({ 
          loading: false, 
          text: null, 
          error: null
        });
      }
      
    } catch (error) {
      console.error('[AI TRAINER] Ошибка запроса совета:', error);
      // При ошибке скрываем блок
      setShowAiAdvice(false);
      setAiTrainerAdvice({ 
        loading: false, 
        text: null, 
        error: null
      });
    }
  };
  
  // 4. Сохранение результатов теста в базу данных
  const saveTestResultsToDatabase = async (testResult) => {
    // Получаем userId напрямую из Telegram
    const tgUser = initTelegramWebAppSafe();
    const currentUserId = tgUser?.id ? String(tgUser.id) : userId;
    
    if (!currentUserId || !selectedTopic) {
      console.log('[AI TRAINER] Пропуск сохранения в БД - нет userId или selectedTopic');
      return null;
    }
    
    try {
      console.log('[AI TRAINER] Сохранение результатов теста в БД');
      
      // Сохраняем результаты теста
      const { data: resultData, error: resultError } = await supabase
        .from('test_results')
        .insert([{
          user_id: Number(currentUserId), // Преобразуем в число для БД
          topic_id: String(selectedTopic.id), // Преобразуем в строку для совместимости
          is_exam: isExamMode || false,
          total_questions: testResult.total,
          correct_answers: testResult.correct,
          percentage: testResult.percentage,
          time_spent: testResult.time
        }])
        .select()
        .single();
      
      if (resultError) {
        console.error('[AI TRAINER] Ошибка сохранения результатов:', resultError);
        return null;
      }
      
      console.log('[AI TRAINER] Результаты сохранены, ID:', resultData.id);
      
      // Сохраняем ошибки пользователя
      if (testResult.questions && testResult.userAnswers) {
        const errors = [];
        testResult.questions.forEach((question, index) => {
          const userAnswer = testResult.userAnswers[index];
          if (userAnswer && !userAnswer.isCorrect) {
            const correctAnswer = question.answers.find(a => a.correct === true);
            errors.push({
              user_id: Number(currentUserId), // Преобразуем в число для БД
              topic_id: String(selectedTopic.id), // Преобразуем в строку
              question_id: String(question.id), // Преобразуем в строку
              selected_option_id: String(userAnswer.selectedAnswerId), // Преобразуем в строку
              correct_option_id: correctAnswer ? String(correctAnswer.id) : null // Преобразуем в строку
            });
          }
        });
        
        if (errors.length > 0) {
          // Используем upsert для обновления существующих ошибок
          for (const error of errors) {
            await supabase
              .from('user_errors')
              .upsert(error, {
                onConflict: 'user_id,question_id',
                ignoreDuplicates: false
              });
          }
          console.log('[AI TRAINER] Сохранено ошибок:', errors.length);
        }
      }
      
      return resultData;
      
    } catch (error) {
      console.error('[AI TRAINER] Ошибка сохранения в БД:', error);
      return null;
    }
  };

  // ========== ФУНКЦИИ ДЛЯ ЭКРАНА СТАТИСТИКИ ==========
  
  // Загрузка статистики по темам из test_results и user_errors
  const loadAnalyticsData = async () => {
    const tgUser = initTelegramWebAppSafe();
    const currentUserId = tgUser?.id ? String(tgUser.id) : userId;
    
    if (!currentUserId) {
      console.log('[ANALYTICS] Пропуск загрузки - нет userId');
      return null;
    }
    
    setAnalyticsLoading(true);
    
    try {
      console.log('[ANALYTICS] Загрузка статистики для пользователя:', currentUserId);
      
      // Загружаем результаты тестов, сгруппированные по темам
      const { data: testResults, error: testResultsError } = await supabase
        .from('test_results')
        .select('topic_id, total_questions, correct_answers, percentage')
        .eq('user_id', Number(currentUserId))
        .order('created_at', { ascending: false })
        .limit(10000); // Большой лимит для всех результатов
      
      if (testResultsError) {
        console.error('[ANALYTICS] Ошибка загрузки результатов тестов:', testResultsError);
      }
      
      // Загружаем ошибки пользователя, сгруппированные по темам
      const { data: userErrors, error: userErrorsError } = await supabase
        .from('user_errors')
        .select('topic_id, question_id, error_count')
        .eq('user_id', Number(currentUserId))
        .limit(10000); // Большой лимит для всех ошибок
      
      if (userErrorsError) {
        console.error('[ANALYTICS] Ошибка загрузки ошибок:', userErrorsError);
      }
      
      // Группируем результаты по темам
      const topicStats = new Map();
      
      // Обрабатываем результаты тестов
      if (testResults && testResults.length > 0) {
        testResults.forEach(result => {
          const topicId = String(result.topic_id);
          if (!topicStats.has(topicId)) {
            topicStats.set(topicId, {
              topicId: topicId,
              totalTests: 0,
              totalQuestions: 0,
              totalCorrect: 0,
              averagePercentage: 0,
              errorCount: 0
            });
          }
          
          const stats = topicStats.get(topicId);
          stats.totalTests += 1;
          stats.totalQuestions += result.total_questions || 0;
          stats.totalCorrect += result.correct_answers || 0;
          
          // Вычисляем средний процент
          const currentAvg = stats.averagePercentage;
          const newPercentage = result.percentage || 0;
          stats.averagePercentage = ((currentAvg * (stats.totalTests - 1)) + newPercentage) / stats.totalTests;
        });
      }
      
      // Обрабатываем ошибки
      if (userErrors && userErrors.length > 0) {
        const errorCountsByTopic = new Map();
        userErrors.forEach(error => {
          const topicId = String(error.topic_id);
          errorCountsByTopic.set(topicId, (errorCountsByTopic.get(topicId) || 0) + (error.error_count || 1));
        });
        
        // Добавляем количество ошибок к статистике тем
        errorCountsByTopic.forEach((count, topicId) => {
          if (!topicStats.has(topicId)) {
            topicStats.set(topicId, {
              topicId: topicId,
              totalTests: 0,
              totalQuestions: 0,
              totalCorrect: 0,
              averagePercentage: 0,
              errorCount: 0
            });
          }
          topicStats.get(topicId).errorCount = count;
        });
      }
      
      // Преобразуем Map в массив и добавляем информацию о теме
      const analyticsArray = Array.from(topicStats.values()).map(stats => {
        const topic = topics.find(t => String(t.id) === stats.topicId);
        return {
          ...stats,
          topicName: topic ? topic.name : `Тема ${stats.topicId}`,
          color: stats.averagePercentage < 50 ? 'red' : stats.averagePercentage < 80 ? 'yellow' : 'green'
        };
      });
      
      // Сортируем по количеству ошибок (для слабых мест)
      const weakTopics = [...analyticsArray]
        .sort((a, b) => b.errorCount - a.errorCount)
        .slice(0, 3);
      
      setAnalyticsData({
        topics: analyticsArray,
        weakTopics: weakTopics,
        totalTopics: analyticsArray.length
      });
      
      console.log('[ANALYTICS] Статистика загружена:', analyticsArray.length, 'тем');
      
      return {
        topics: analyticsArray,
        weakTopics: weakTopics
      };
      
    } catch (error) {
      console.error('[ANALYTICS] Ошибка загрузки статистики:', error);
      return null;
    } finally {
      setAnalyticsLoading(false);
    }
  };
  
  // Загрузка AI-вердикта для статистики
  const loadAnalyticsAiVerdict = async () => {
    const tgUser = initTelegramWebAppSafe();
    const currentUserId = tgUser?.id ? String(tgUser.id) : userId;
    
    if (!currentUserId || !analyticsData) {
      return;
    }
    
    // Устанавливаем состояние загрузки
    setAnalyticsAiVerdict({
      loading: true,
      text: null,
      error: null
    });
    
    try {
      console.log('[ANALYTICS] Загрузка AI-вердикта для статистики');
      console.log('[ANALYTICS] Данные статистики:', {
        topicsCount: analyticsData.topics.length,
        weakTopicsCount: analyticsData.weakTopics?.length || 0
      });
      
      // Формируем данные для AI
      const userErrorsArray = analyticsData.weakTopics && analyticsData.weakTopics.length > 0
        ? analyticsData.weakTopics.map(topic => ({
            topic_id: String(topic.topicId),
            topic_name: String(topic.topicName),
            error_count: Number(topic.errorCount) || 0,
            percentage: Number(topic.averagePercentage) || 0
          }))
        : [];
      
      const avgScore = analyticsData.topics.length > 0
        ? analyticsData.topics.reduce((sum, t) => sum + (Number(t.averagePercentage) || 0), 0) / analyticsData.topics.length
        : 0;
      
      const requestData = {
        userId: String(currentUserId),
        userErrors: userErrorsArray,
        totalScore: Math.round(avgScore * 100) / 100 // Округляем до 2 знаков
      };
      
      console.log('[ANALYTICS] Отправка запроса:', {
        userId: requestData.userId,
        userErrorsCount: requestData.userErrors.length,
        totalScore: requestData.totalScore
      });
      
      // Проверяем лимит ИИ перед использованием (это другой тип использования)
      const limitCheck = await checkAILimit(false);
      console.log('[AI_LIMIT] Проверка лимита для вердикта в статистике:', limitCheck);
      
      // СТРОГАЯ ПРОВЕРКА: блокируем если allowed === false ИЛИ remaining === 0
      if (!limitCheck.allowed || limitCheck.remaining === 0) {
        console.log('[AI_LIMIT] ⛔⛔⛔ БЛОКИРУЕМ ЗАПРОС ВЕРДИКТА - ЛИМИТ ИСЧЕРПАН!');
        console.log('[AI_LIMIT] Детали блокировки:', { allowed: limitCheck.allowed, remaining: limitCheck.remaining });
        const limitMessage = limitCheck.remaining === 0 
          ? 'Лимит использования ИИ исчерпан. Оформите подписку для увеличения лимита.'
          : `Осталось ${limitCheck.remaining} использований ИИ. Оформите подписку для увеличения лимита.`;
        console.log('[AI_LIMIT] Лимит исчерпан, блокируем запрос вердикта:', limitMessage);
        setAnalyticsAiVerdict({
          loading: false,
          text: null,
          error: limitMessage
        });
        return; // ВАЖНО: выходим из функции, не отправляем запрос
      }
      
      console.log('[AI_LIMIT] Лимит позволяет использовать ИИ для вердикта, отправляем запрос');
      
      // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ПЕРЕД ОТПРАВКОЙ ЗАПРОСА
      const finalLimitCheck = await checkAILimit(false);
      console.log('[AI_LIMIT] Финальная проверка перед отправкой вердикта (App.jsx):', finalLimitCheck);
      
      // СТРОГАЯ ПРОВЕРКА: если allowed === false ИЛИ remaining === 0, блокируем
      if (!finalLimitCheck.allowed || finalLimitCheck.remaining === 0) {
        console.log('[AI_LIMIT] ⛔⛔⛔ БЛОКИРУЕМ ЗАПРОС ВЕРДИКТА ПЕРЕД ОТПРАВКОЙ - ЛИМИТ ИСЧЕРПАН!');
        const limitMessage = finalLimitCheck.remaining === 0 
          ? 'Лимит использования ИИ исчерпан. Оформите подписку для увеличения лимита.'
          : `Осталось ${finalLimitCheck.remaining} использований ИИ. Оформите подписку для увеличения лимита.`;
        setAnalyticsAiVerdict({
          loading: false,
          text: null,
          error: limitMessage
        });
        return; // ВАЖНО: выходим из функции, не отправляем запрос
      }
      
      const { data, error } = await supabase.functions.invoke('ai-trainer-advice', {
        body: requestData
      });
      
      console.log('[ANALYTICS] Ответ от Edge Function:', { data, error });
      
      if (error) {
        console.error('[ANALYTICS] Ошибка запроса AI-вердикта:', error);
        setAnalyticsAiVerdict({
          loading: false,
          text: null,
          error: 'Не удалось получить вердикт ИИ'
        });
        return;
      }
      
      if (data && data.advice) {
        // Увеличиваем счетчик использования ИИ после успешного запроса
        console.log('[AI_COUNTER] Перед вызовом incrementAIUsage для вердикта в статистике');
        await incrementAIUsage(false);
        console.log('[AI_COUNTER] После вызова incrementAIUsage для вердикта в статистике');
        
        setAnalyticsAiVerdict({
          loading: false,
          text: data.advice.substring(0, 200), // Ограничиваем до 200 символов
          error: null
        });
      } else {
        setAnalyticsAiVerdict({
          loading: false,
          text: null,
          error: null
        });
      }
      
    } catch (error) {
      console.error('[ANALYTICS] Ошибка загрузки AI-вердикта:', error);
      setAnalyticsAiVerdict({
        loading: false,
        text: null,
        error: 'Ошибка загрузки вердикта'
      });
    }
  };

  // ========== ФУНКЦИИ ДЛЯ РАБОТЫ С SUPABASE (ТЕМЫ И ВОПРОСЫ) ==========
  
  // Загрузка квизов (тем) из Supabase
  const loadTopicsFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(10000); // Большой лимит для загрузки всех тем

      if (error) {
        console.error('Ошибка загрузки квизов из Supabase:', error);
        // Fallback на localStorage или дефолтные темы
        const saved = localStorage.getItem('dev_topics');
        if (saved) {
          try {
            setTopics(JSON.parse(saved));
          } catch (e) {
            setTopics(defaultTopics);
          }
        } else {
          setTopics(defaultTopics);
        }
        return;
      }

      if (data && data.length > 0) {
        // Оптимизация: загружаем все вопросы одним запросом и считаем количество для каждой темы
        const { data: allQuestions, error: questionsError } = await supabase
              .from('questions')
          .select('quiz_id')
          .limit(100000); // Большой лимит для загрузки всех вопросов

        // Создаем Map для подсчета вопросов по темам
        const questionCounts = new Map();
        if (!questionsError && allQuestions) {
          allQuestions.forEach(q => {
            const quizId = q.quiz_id;
            questionCounts.set(quizId, (questionCounts.get(quizId) || 0) + 1);
          });
        }

        // Формируем темы с количеством вопросов
        const topicsWithCounts = data.map((quiz, index) => ({
              id: quiz.id, // UUID, но в коде может использоваться как строка
              name: quiz.title || quiz.name || 'Без названия',
          questionCount: questionCounts.get(quiz.id) || 0,
          order: index + 1 // Используем порядок из массива
        }));

        setTopics(topicsWithCounts);
        console.log(`✅ Загружено тем из Supabase: ${topicsWithCounts.length} (без лимитов)`);
      } else {
        // Если нет квизов в Supabase, используем дефолтные
        setTopics(defaultTopics);
      }
    } catch (err) {
      console.error('Ошибка загрузки квизов:', err);
      // Fallback на localStorage или дефолтные темы
      const saved = localStorage.getItem('dev_topics');
      if (saved) {
        try {
          setTopics(JSON.parse(saved));
        } catch (e) {
          setTopics(defaultTopics);
        }
      } else {
        setTopics(defaultTopics);
      }
    }
  };

  // Загрузка вопросов из Supabase с опциями (оптимизированная версия)
  const loadQuestionsFromSupabase = async (useCache = true) => {
    try {
      // Сначала загружаем из кэша для мгновенного отображения
      if (useCache) {
        try {
          const cached = localStorage.getItem('dev_questions_cache');
          const cacheTime = localStorage.getItem('dev_questions_cache_time');
          if (cached && cacheTime) {
            const cacheAge = Date.now() - parseInt(cacheTime, 10);
            // Используем кэш, если он не старше 7 дней (для мгновенной загрузки)
            if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
              try {
                const cachedQuestions = JSON.parse(cached);
                setSavedQuestions(cachedQuestions);
                console.log('✅ Используем кэшированные вопросы для мгновенной загрузки:', cachedQuestions.length, 'вопросов');
                // Обновляем в фоне (не блокируем интерфейс) - через 10 секунд после загрузки страницы
                setTimeout(() => {
                  loadQuestionsFromSupabase(false).catch(() => {});
                }, 10000);
                return;
              } catch (e) {
                console.error('Ошибка парсинга кэша:', e);
                // Продолжаем загрузку из БД
              }
            }
          }
        } catch (e) {
          // Игнорируем ошибки кэша
        }
      }

      // Загружаем вопросы с опциями через вложенный select
      // ОПТИМИЗАЦИЯ: загружаем только нужные поля для ускорения запроса
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('id, quiz_id, question_text, image_url, created_at, options(id, option_text, is_correct, created_at)')
        .order('created_at', { ascending: true })
        .limit(100000); // Большой лимит для загрузки всех вопросов

      if (questionsError) {
        console.error('❌ Ошибка загрузки вопросов из Supabase:', questionsError);
        
        // Пробуем альтернативный запрос без вложенного select
        console.log('🔄 Пробуем альтернативный запрос...');
        const { data: questionsDataAlt, error: questionsErrorAlt } = await supabase
          .from('questions')
          .select('id, quiz_id, question_text, image_url, created_at')
          .order('created_at', { ascending: true })
          .limit(100000); // Большой лимит для загрузки всех вопросов

        if (questionsErrorAlt) {
          console.error('❌ Альтернативный запрос тоже не удался:', questionsErrorAlt);
        // Fallback на localStorage
        const saved = JSON.parse(localStorage.getItem('dev_questions') || '[]');
        setSavedQuestions(saved);
        return;
      }

        // Если альтернативный запрос успешен, загружаем опции отдельно
        if (questionsDataAlt && questionsDataAlt.length > 0) {
          const questionIds = questionsDataAlt.map(q => q.id);
        const { data: optionsData, error: optionsError } = await supabase
          .from('options')
            .select('question_id, option_text, is_correct, created_at')
          .in('question_id', questionIds)
          .order('created_at', { ascending: true })
          .limit(100000); // Большой лимит для загрузки всех опций

          // Объединяем вопросы с опциями
          const questionsWithOptions = questionsDataAlt.map(q => ({
            ...q,
            options: (optionsData || []).filter(opt => opt.question_id === q.id)
          }));

          // Продолжаем обработку с объединенными данными
          const optionsByQuestion = new Map();
          questionsWithOptions.forEach(q => {
            if (q.options && Array.isArray(q.options) && q.options.length > 0) {
              optionsByQuestion.set(q.id, q.options);
            }
          });

          // Обрабатываем данные
          const formattedQuestions = questionsWithOptions.map(q => {
            const options = (optionsByQuestion.get(q.id) || []).sort((a, b) => {
              return (a.created_at || '').localeCompare(b.created_at || '');
            });

            const answerMap = {};
            let correctKey = 'a';
            const answerKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            
            options.forEach((option, index) => {
              if (index < answerKeys.length) {
                const key = answerKeys[index];
                answerMap[`answer_${key}`] = option.option_text || '';
                if (option.is_correct) {
                  correctKey = key;
                }
              }
            });

            return {
              id: q.id,
              quiz_id: q.quiz_id, // Используем quiz_id вместо topic_id
              topic_id: q.quiz_id, // Оставляем для обратной совместимости
              question: q.question_text || q.question || '',
              ...answerMap,
              correct: correctKey,
              image_url: q.image_url || '',
              answers_count: options.length || 0,
              created_at: q.created_at
            };
          });

          setSavedQuestions(formattedQuestions);
          console.log(`✅ Загружено вопросов из Supabase (альтернативный запрос): ${formattedQuestions.length} (без лимитов)`);
          
          try {
            localStorage.setItem('dev_questions_cache', JSON.stringify(formattedQuestions));
            localStorage.setItem('dev_questions_cache_time', String(Date.now()));
          } catch (e) {
            // Игнорируем ошибки localStorage
          }
          
          return;
        }

        // Fallback на localStorage
        const saved = JSON.parse(localStorage.getItem('dev_questions') || '[]');
        setSavedQuestions(saved);
        return;
      }

      if (questionsData && questionsData.length > 0) {
        // Оптимизация: сразу обрабатываем опции из вложенного select
        // Используем Map для быстрого доступа
        const optionsByQuestion = new Map();
        questionsData.forEach(q => {
          if (q.options && Array.isArray(q.options) && q.options.length > 0) {
            optionsByQuestion.set(q.id, q.options);
          }
        });

        // Если опций нет в вложенном формате, загружаем отдельно (редкий случай)
        if (optionsByQuestion.size === 0 && questionsData.length > 0) {
          const questionIds = questionsData.map(q => q.id);
          const { data: optionsData, error: optionsError } = await supabase
            .from('options')
            .select('question_id, option_text, is_correct, created_at')
            .in('question_id', questionIds)
            .order('created_at', { ascending: true })
            .limit(100000); // Большой лимит для загрузки всех опций

          if (!optionsError && optionsData) {
            optionsData.forEach(option => {
              const existing = optionsByQuestion.get(option.question_id) || [];
              existing.push(option);
              optionsByQuestion.set(option.question_id, existing);
            });
          }
        }

        // Оптимизированное преобразование данных (используем предварительно отсортированные опции)
        const formattedQuestions = questionsData.map(q => {
          const options = (optionsByQuestion.get(q.id) || []).sort((a, b) => {
            return (a.created_at || '').localeCompare(b.created_at || '');
          });

          const answerMap = {};
          let correctKey = 'a';
          const answerKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          
          options.forEach((option, index) => {
            if (index < answerKeys.length) {
              const key = answerKeys[index];
            answerMap[`answer_${key}`] = option.option_text || '';
            if (option.is_correct) {
              correctKey = key;
              }
            }
          });

          return {
            id: q.id,
            quiz_id: q.quiz_id, // Используем quiz_id вместо topic_id
            topic_id: q.quiz_id, // Оставляем для обратной совместимости
            question: q.question_text || q.question || '',
            ...answerMap,
            correct: correctKey,
            image_url: q.image_url || '',
            answers_count: options.length || 0,
            created_at: q.created_at
          };
        });
        
        // Сохраняем в состояние и кэш
        setSavedQuestions(formattedQuestions);
        console.log(`✅ Загружено вопросов из Supabase: ${formattedQuestions.length} (без лимитов)`);
        
        // Кэшируем для быстрой загрузки в следующий раз
        try {
          localStorage.setItem('dev_questions_cache', JSON.stringify(formattedQuestions));
          localStorage.setItem('dev_questions_cache_time', String(Date.now()));
        } catch (e) {
          // Игнорируем ошибки localStorage
        }
      } else {
        // Если база возвращает 0 вопросов, не делаем повторный запрос
        console.log('[QUIZ] Вопросы для ID не найдены в БД (база вернула пустой результат)');
        setSavedQuestions([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки вопросов:', err);
      // Fallback на localStorage
      const saved = JSON.parse(localStorage.getItem('dev_questions') || '[]');
      setSavedQuestions(saved);
    }
  };

  // Загрузка вопросов только при открытии админки (не при каждом изменении экрана)
  useEffect(() => {
    if (userRole === 'admin' && (adminScreen === 'list' || adminScreen === 'topicQuestions' || adminScreen === 'add' || adminScreen === 'edit')) {
    loadQuestionsFromSupabase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminScreen, userRole]);

  // Вспомогательная функция: строим массив ответов из сохранённого вопроса
  const buildAnswersFromSavedQuestion = (q) => {
    // Кол-во ответов, по умолчанию 4, но если сохранено меньше — используем меньше
    const answersCountRaw = q.answers_count !== undefined && q.answers_count !== null
      ? Number(q.answers_count)
      : 4;
    const answersCount = Number.isNaN(answersCountRaw) || answersCountRaw <= 0
      ? 4
      : answersCountRaw;

    const answers = [];
    const answerKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    // Проверяем все возможные ключи ответов
    answerKeys.forEach((key, i) => {
      const answerKey = `answer_${key}`;
      const text = q[answerKey];
      const id = i + 1;

      // Пропускаем пустые ответы, чтобы в тесте не было «3.» и «4.» без текста
      if (text && String(text).trim() !== '') {
      answers.push({
        id,
          text: String(text).trim(),
        // Пока логика одна: один правильный ответ по букве в q.correct
        correct: q.correct === key
      });
    }
    });

    return answers;
  };

  // Function to get merged questions (static + saved from Supabase)
  const getMergedQuestions = (topicId) => {
    const staticQuestions = questionsData[topicId] || [];
    
    // Нормализуем topicId для сравнения (приводим к строке и убираем пробелы)
    const normalizedTopicId = String(topicId).trim();
    
    // Используем savedQuestions из состояния (загружены из Supabase)
    let debugCount = 0;
    const savedForTopic = savedQuestions
      .filter(q => {
        // Используем quiz_id как основной идентификатор (синхронизация с БД)
        const qQuizId = String(q.quiz_id || q.topic_id || '').trim();
        const matches = qQuizId === normalizedTopicId;
        
        // Отладочное логирование только в dev режиме (первые 3 вопроса)
        if (process.env.NODE_ENV === 'development' && debugCount < 3) {
          console.log(`🔍 Сравнение: qQuizId="${qQuizId}" === normalizedTopicId="${normalizedTopicId}" = ${matches}`);
          debugCount++;
        }
        
        return matches;
      })
      .map(q => {
        const answers = buildAnswersFromSavedQuestion(q);
        return {
        id: q.id,
        text: q.question,
        image: q.image_url,
          answers: answers
        };
      });
    
    const allQuestions = [...staticQuestions, ...savedForTopic];
    
    // Логируем только если нет вопросов (для отладки)
    if (allQuestions.length === 0) {
      console.warn(`[QUIZ] Вопросы для ID ${normalizedTopicId} не найдены в БД`, {
        staticQuestionsCount: staticQuestions.length,
        savedQuestionsTotal: savedQuestions.length,
        topicId: normalizedTopicId,
        sampleQuizIds: savedQuestions.slice(0, 3).map(q => ({
          id: q.id,
          quiz_id: q.quiz_id,
          topic_id: q.topic_id // для обратной совместимости
        }))
      });
    }
    
    return allQuestions;
  };

  // ========== ЭКЗАМЕН: Функция для сбора всех вопросов из всех тем ==========
  // Использует существующую структуру данных, не дублирует вопросы
  const getAllQuestions = () => {
    const allQuestions = [];
    
    // Собираем вопросы из всех тем
    topics.forEach(topic => {
      // Статические вопросы из questionsData (если topic.id - число)
      if (typeof topic.id === 'number') {
        const staticQuestions = questionsData[topic.id] || [];
        staticQuestions.forEach(q => {
          allQuestions.push({
            ...q,
            sourceTopicId: topic.id,
            sourceTopicName: topic.name
          });
        });
      }
      
      // Сохраненные вопросы из Supabase для этого квиза
      const savedForTopic = savedQuestions.filter(q => q.topic_id === topic.id);
      savedForTopic.forEach(q => {
        allQuestions.push({
          id: q.id,
          text: q.question,
          image: q.image_url,
          answers: buildAnswersFromSavedQuestion(q),
          sourceTopicId: topic.id,
          sourceTopicName: topic.name
        });
      });
    });
    
    return allQuestions;
  };

  // ========== ЭКЗАМЕН: Функция для случайного выбора N уникальных вопросов ==========
  // Использует алгоритм Fisher-Yates для перемешивания
  const getRandomQuestions = (allQuestions, count) => {
    if (allQuestions.length === 0) return [];
    
    // Ограничиваем количество доступными вопросами
    const maxCount = Math.min(count, allQuestions.length);
    
    // Создаем копию массива для перемешивания
    const shuffled = [...allQuestions];
    
    // Алгоритм Fisher-Yates для случайного перемешивания
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Берем первые N уникальных вопросов
    // Используем Set для отслеживания уникальности по ID
    const uniqueQuestions = [];
    const seenIds = new Set();
    
    for (const question of shuffled) {
      if (uniqueQuestions.length >= maxCount) break;
      
      // Проверяем уникальность по ID вопроса
      const questionId = question.id || `${question.sourceTopicId}_${question.text}`;
      if (!seenIds.has(questionId)) {
        seenIds.add(questionId);
        uniqueQuestions.push(question);
      }
    }
    
    return uniqueQuestions;
  };

  // Функция для обработки регистрации пользователя
  const handleRegistration = async (e) => {
    e.preventDefault();
    
    if (!registrationForm.name.trim() || !registrationForm.phone.trim()) {
      alert('Пожалуйста, заполните все поля');
      return;
    }
    
    const tgUser = initTelegramWebAppSafe();
    const userId = tgUser?.id ? tgUser.id : Date.now();
    const telegramUsername = tgUser?.username || null;
    
    try {
      // Сохраняем в Supabase
      const { data: existingData } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', Number(userId))
        .single();

      const now = new Date().toISOString();
      const baseUpsertData = {
        id: Number(userId),
        first_name: registrationForm.name.trim(),
        username: telegramUsername || null,
        is_premium: false,
        premium_until: null
      };

      // Если колонка phone отсутствует, повторим без нее
      let upsertData = { ...baseUpsertData, phone: registrationForm.phone.trim() };
      if (!existingData) {
        upsertData.created_at = now;
      }

      let { data, error } = await supabase
        .from('profiles')
        .upsert(upsertData, { onConflict: 'id' })
        .select()
        .single();

      if (error && /column .*phone/i.test(error.message || '')) {
        // Повторная попытка без phone
        upsertData = { ...baseUpsertData };
        if (!existingData) {
          upsertData.created_at = now;
        }
        const retry = await supabase
          .from('profiles')
          .upsert(upsertData, { onConflict: 'id' })
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Ошибка сохранения в Supabase:', error);
        alert('Ошибка сохранения данных. Проверьте таблицу profiles в Supabase.');
        return;
      }

      // Обновляем состояние
      const newUser = {
        userId: String(userId),
        telegramUsername,
        name: registrationForm.name.trim(),
        phone: registrationForm.phone.trim(),
        registrationDate: data?.created_at || now,
        subscription: {
          active: false,
          startDate: null,
          endDate: null
        },
        lastVisit: now
      };

      setUserData(newUser);
      setUserRole('user');
      
      // Всегда создаем пробную подписку после регистрации через форму
      console.log('✅ Пользователь зарегистрирован через форму, создаем пробную подписку на 3 дня');
      const trialCreated = await createTrialSubscription(userId);
      
      // Устанавливаем данные для окна поздравления
      setTrialDays(3);
      
      // Переходим на экран topics (это закроет экран регистрации)
      setScreen('topics');
      
      // ВСЕГДА показываем окно поздравления после регистрации через форму,
      // независимо от того, была ли создана пробная подписка или уже существовала
      setTimeout(() => {
        console.log('🎉 Показываем окно поздравления с бесплатной подпиской на 3 дня');
        setShowConfetti(true);
        setShowWelcomeModal(true);
        // Автоматически скрываем конфетти через 3 секунды
        setTimeout(() => {
          console.log('Скрываем конфетти');
          setShowConfetti(false);
        }, 3000);
      }, 300);
      
      if (trialCreated) {
        console.log('✅ Пробная подписка успешно создана');
      } else {
        console.log('ℹ️ Пробная подписка уже была создана ранее или не удалось создать');
      }
      
      // Загружаем подписку из таблицы subscriptions (не блокируем отображение)
      // Если пробная подписка была создана, она будет загружена здесь
      loadMySubscription().catch(err => console.error('Ошибка загрузки подписки:', err));
    } catch (err) {
      console.error('Ошибка регистрации:', err);
      alert('Ошибка регистрации. Попробуйте еще раз.');
    }
  };

  // Функция для загрузки пользователей из Supabase (для админки)
  const loadUsersFromSupabase = async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      // Загружаем пользователей из profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Ошибка загрузки пользователей из Supabase:', profilesError);
        setUsersError(profilesError.message || 'Ошибка загрузки пользователей');
        setUsersList([]);
        return;
      }

      // Загружаем все подписки из таблицы subscriptions
      const now = new Date().toISOString();
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from('subscriptions')
        .select('*')
        .gt('end_date', now); // Только активные подписки

      if (subscriptionsError) {
        console.warn('Ошибка загрузки подписок из Supabase:', subscriptionsError);
        // Не прерываем загрузку, просто продолжаем без подписок
      }

      // Создаем Map для быстрого поиска подписок по telegram_id
      const subscriptionsMap = new Map();
      (subscriptionsData || []).forEach(sub => {
        const telegramId = String(sub.telegram_id || sub.user_id);
        subscriptionsMap.set(telegramId, sub);
      });

      // Форматируем пользователей с правильными подписками
      const formattedUsers = (profilesData || []).map(profile => {
        const userId = String(profile.id);
        const subscription = subscriptionsMap.get(userId);
        
        // Определяем активную подписку
        let hasActiveSubscription = false;
        let subscriptionEndDate = null;
        
        if (subscription && subscription.end_date) {
          const endDate = new Date(subscription.end_date);
          hasActiveSubscription = endDate > new Date();
          subscriptionEndDate = subscription.end_date;
        }

        return {
          userId: userId,
        telegramUsername: profile.username || null,
        name: profile.first_name || 'Без имени',
        phone: profile.phone || 'Не указан',
        registrationDate: profile.created_at || new Date().toISOString(),
        lastVisit: profile.created_at || new Date().toISOString(),
        subscription: {
            active: hasActiveSubscription,
            startDate: subscription?.start_date || null,
            endDate: subscriptionEndDate
          }
        };
      });

      console.log('Загружено пользователей:', formattedUsers.length);
      console.log('Активных подписок:', formattedUsers.filter(u => u.subscription.active).length);

      setUsersList(formattedUsers);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
      setUsersError('Ошибка загрузки пользователей');
      setUsersList([]);
    } finally {
      setUsersLoading(false);
    }
  };

  // Применяем сохраненную тему сразу при первой загрузке
  useEffect(() => {
    if (manualTheme !== null) {
      document.body.setAttribute('data-theme', manualTheme);
      setIsDarkMode(manualTheme === 'dark');
    }
  }, []); // Только при первой загрузке

  // Определение и применение темы Telegram
  // ========== УПРАВЛЕНИЕ ТЕМНОЙ ТЕМОЙ ==========
  useEffect(() => {
    // Функция для применения темы
    const applyTheme = () => {
      // Если тема установлена вручную (включая сохраненную из localStorage), используем её
      if (manualTheme !== null) {
        document.body.setAttribute('data-theme', manualTheme);
        setIsDarkMode(manualTheme === 'dark');
        return;
      }

      // Иначе определяем автоматически из Telegram
      const tg = window.Telegram?.WebApp;
      let theme = 'light'; // По умолчанию светлая тема
      
      if (tg) {
        // Используем colorScheme из Telegram WebApp
        const colorScheme = tg.colorScheme || getTelegramColorScheme();
        theme = colorScheme === 'dark' ? 'dark' : 'light';
        
        // Также можно использовать themeParams для более точной настройки
        if (tg.themeParams?.bg_color) {
          // Если фон темный, считаем темной темой
          const bgColor = tg.themeParams.bg_color;
          // Проверяем яркость цвета (простая эвристика)
          if (bgColor.startsWith('#') && bgColor.length === 7) {
            const r = parseInt(bgColor.substr(1, 2), 16);
            const g = parseInt(bgColor.substr(3, 2), 16);
            const b = parseInt(bgColor.substr(5, 2), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness < 128) {
              theme = 'dark';
            }
          }
        }
      } else {
        // Fallback: используем системную тему
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          theme = 'dark';
        }
      }
      
      // Устанавливаем атрибут data-theme на body
      document.body.setAttribute('data-theme', theme);
      setIsDarkMode(theme === 'dark');
      
      console.log('Тема применена:', theme);
    };

    // Применяем тему сразу при загрузке
    applyTheme();

    // Инициализируем Telegram WebApp
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      
      // Слушаем изменения темы через событие themeChanged
      if (tg.onEvent) {
        tg.onEvent('themeChanged', applyTheme);
      }
      
      // Также слушаем изменения системной темы (fallback)
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', applyTheme);
      } else if (mediaQuery.addListener) {
        // Для старых браузеров
        mediaQuery.addListener(applyTheme);
      }
      
      return () => {
        if (tg.offEvent) {
          tg.offEvent('themeChanged', applyTheme);
        }
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', applyTheme);
        } else if (mediaQuery.removeListener) {
          mediaQuery.removeListener(applyTheme);
        }
      };
    }
  }, [manualTheme]); // Добавляем manualTheme в зависимости

  useEffect(() => {
    let timeoutId = null;
    const init = async () => {
      try {
        const tgUser = initTelegramWebAppSafe();

        // Получаем ID пользователя из Telegram (или фоллбек)
        const userId = tgUser?.id ? String(tgUser.id) : null;
        setUserId(userId); // Сохраняем userId в состоянии для использования в других функциях
        const telegramUsername = tgUser?.username || null;
        void telegramUsername;

        // Загружаем данные ПАРАЛЛЕЛЬНО для быстрой загрузки
        // Сначала загружаем из кэша для мгновенного отображения
        const loadDataPromise = Promise.all([
          loadTopicsFromSupabase(),
          loadQuestionsFromSupabase(true) // Используем кэш для мгновенной загрузки
        ]).catch(err => {
          console.error('Ошибка загрузки данных:', err);
        });
        
        // Проверяем админ-статус (быстрый запрос)
        const adminStatus = await checkAdminStatus(userId);
        
        // Ждем загрузки данных из кэша (быстро) перед показом интерфейса
        await loadDataPromise;
        
        // Показываем интерфейс после загрузки данных из кэша
        timeoutId = setTimeout(() => setLoading(false), 100);

        if (adminStatus) {
          console.log('✅ Пользователь является администратором (из таблицы admins)');
              setUserRole('admin');
              setScreen('topics');
          // Вопросы уже загружены параллельно при инициализации
          setLoading(false);
          if (timeoutId) clearTimeout(timeoutId);
              return;
        }

        // Проверяем, зарегистрирован ли пользователь в Supabase
        if (userId) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', Number(userId))
            .single();

          if (!error && data) {
            // Проверяем, заполнена ли форма регистрации (есть ли имя и телефон)
            // Если пользователь зарегистрирован, но не заполнил форму, показываем экран регистрации
            const hasRegistrationData = data.first_name && data.first_name.trim() && 
                                       (data.phone && data.phone.trim() || data.phone === null);
            
            // Если пользователь уже полностью зарегистрирован (есть имя и телефон), переходим на topics
            // Если данных нет или они неполные, показываем экран регистрации
            if (hasRegistrationData && data.phone && data.phone.trim()) {
            setUserData({
              userId: String(data.id),
              telegramUsername: data.username || null,
              name: data.first_name || 'Без имени',
              phone: data.phone || 'Не указан',
              registrationDate: data.created_at || new Date().toISOString(),
              lastVisit: data.created_at || new Date().toISOString(),
              subscription: {
                active: data.is_premium && data.premium_until && new Date(data.premium_until) > new Date(),
                startDate: null,
                endDate: data.premium_until || null
              }
            });
            setUserRole('user');
            setScreen('topics');
              // Загружаем подписку в фоне (вопросы уже загружены параллельно при инициализации)
              loadMySubscription().catch(err => console.error('Ошибка загрузки подписки:', err));
              setLoading(false);
              if (timeoutId) clearTimeout(timeoutId);
            return;
            } else {
              // Пользователь есть в базе, но форма регистрации не заполнена - показываем экран регистрации
              console.log('Пользователь найден, но форма регистрации не заполнена - показываем экран регистрации');
              // Не переходим на topics, продолжаем показывать экран регистрации
            }
          }
        }

        // Новый пользователь: создаем через upsert (без телефона) и просим регистрацию один раз
        if (userId) {
          const now = new Date().toISOString();
          const baseUpsert = {
            id: Number(userId),
            first_name: tgUser?.first_name || 'Без имени',
            username: telegramUsername || null,
            is_premium: false,
            premium_until: null,
            created_at: now
          };

          // Пытаемся сохранить с phone (если колонка есть)
          let upsertData = { ...baseUpsert, phone: null };
          let { error: upsertError } = await supabase
            .from('profiles')
            .upsert(upsertData, { onConflict: 'id' });

          if (upsertError && /column .*phone/i.test(upsertError.message || '')) {
            // Повторная попытка без phone
            upsertData = { ...baseUpsert };
            await supabase
              .from('profiles')
              .upsert(upsertData, { onConflict: 'id' });
          }

          // Проверяем, является ли пользователь новым (нет подписок в subscriptions)
          // Это более надежный способ, чем проверка времени создания профиля
          const telegramIdAsNumber = Math.floor(Number(userId));
          if (telegramIdAsNumber && Number.isFinite(telegramIdAsNumber) && telegramIdAsNumber > 0) {
            const { data: existingSubscriptions, error: subCheckError } = await supabase
              .from('subscriptions')
              .select('id')
              .eq('telegram_id', telegramIdAsNumber)
              .limit(1);

            // Если ошибка не "не найдено", значит что-то пошло не так
            if (subCheckError && subCheckError.code !== 'PGRST116') {
              console.error('Ошибка проверки подписок при инициализации:', subCheckError);
            } else if (!existingSubscriptions || existingSubscriptions.length === 0) {
              // У пользователя нет подписок - это новый пользователь
              console.log('Новый пользователь обнаружен при инициализации, создаем пробную подписку на 3 дня');
              // Создаем пробную подписку асинхронно, не блокируя инициализацию
              // НЕ показываем окно поздравления при инициализации - оно покажется только после регистрации через форму
              createTrialSubscription(userId).then(trialCreated => {
                if (trialCreated) {
                  console.log('Пробная подписка создана при инициализации (окно поздравления покажется после регистрации)');
                }
              }).catch(err => 
                console.error('Ошибка создания пробной подписки при инициализации:', err)
              );
            }
          }
        }

        // Сбрасываем окно поздравления при переходе на экран регистрации
        setShowWelcomeModal(false);
        setShowConfetti(false);
        setScreen('registration');
        setUserRole('user');
      } catch (_) {
        // Никогда не зависаем на лоадере
        // Сбрасываем окно поздравления при переходе на экран регистрации
        setShowWelcomeModal(false);
        setShowConfetti(false);
        setScreen('registration');
        setUserRole('user');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    init();
  }, []);

  // Автозагрузка пользователей при открытии экрана админки "Пользователи"
  useEffect(() => {
    if (userRole === 'admin' && adminScreen === 'users' && usersList.length === 0 && !usersLoading) {
      loadUsersFromSupabase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminScreen, userRole]);

  // Автозагрузка администраторов при открытии экрана админки "Администраторы"
  useEffect(() => {
    if (userRole === 'admin' && adminScreen === 'admins' && adminsList.length === 0 && !adminsLoading) {
      loadAdmins();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminScreen, userRole]);

  // Автоматическая загрузка подписки при открытии экрана topics (один раз)
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  useEffect(() => {
    if (screen === 'topics' && userRole === 'user' && !loading && !subscriptionLoaded) {
      // Загружаем подписку один раз при открытии экрана topics
      loadMySubscription()
        .then(() => setSubscriptionLoaded(true))
        .catch(err => {
          console.error('Ошибка загрузки подписки:', err);
          setSubscriptionLoaded(true); // Помечаем как загруженную, чтобы не повторять
        });
    }
    // Сбрасываем флаг при смене экрана
    if (screen !== 'topics') {
      setSubscriptionLoaded(false);
    }
  }, [screen, userRole, loading, subscriptionLoaded]);

  // Автоматическая загрузка статистики при открытии экрана analytics
  useEffect(() => {
    if (screen === 'analytics' && userId && !analyticsLoading) {
      if (!analyticsData) {
        loadAnalyticsData().then(data => {
          if (data && data.topics && data.topics.length > 0) {
            // Загружаем AI-вердикт после загрузки статистики
            setTimeout(() => {
              loadAnalyticsAiVerdict();
            }, 500);
          }
        });
      } else if (analyticsData && !analyticsAiVerdict) {
        // Если данные уже загружены, но вердикт нет, загружаем вердикт
        loadAnalyticsAiVerdict();
      }
    }
  }, [screen, userId, analyticsLoading, analyticsData, analyticsAiVerdict]);

  const getUserHeaders = () => {
    try {
      const tgUser = initTelegramWebAppSafe();
      const userId = tgUser && tgUser.id ? Number(tgUser.id) : 0;
      const safeUserId = Number.isFinite(userId) && userId > 0 ? String(Math.floor(userId)) : '0';

      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('x-telegram-user-id', safeUserId);
      return headers;
    } catch (error) {
      console.error('Ошибка создания заголовков:', error);
      return {
        'Content-Type': 'application/json',
        'x-telegram-user-id': '0'
      };
    }
  };

  // Функция для создания пробной подписки на 3 дня для новых пользователей
  const createTrialSubscription = async (telegramId) => {
    try {
      const telegramIdAsNumber = Math.floor(Number(telegramId));
      
      if (!telegramIdAsNumber || !Number.isFinite(telegramIdAsNumber) || telegramIdAsNumber <= 0) {
        console.warn('Невалидный ID пользователя для создания пробной подписки:', telegramId);
        return false;
      }

      // Проверяем, есть ли у пользователя какие-либо подписки (включая истекшие)
      const { data: existingSubscriptions, error: checkError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('telegram_id', telegramIdAsNumber)
        .limit(1);

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Ошибка проверки существующих подписок:', checkError);
        return false;
      }

      // Если у пользователя уже были подписки, не создаем пробную
      if (existingSubscriptions && existingSubscriptions.length > 0) {
        console.log('У пользователя уже были подписки, пробная подписка не создается');
        return false;
      }

      // Создаем пробную подписку на 3 дня
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 3); // 3 дня пробного периода
      const endDateISO = endDate.toISOString();

      console.log('Создание пробной подписки на 3 дня для нового пользователя:', telegramIdAsNumber);

      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          telegram_id: telegramIdAsNumber,
          end_date: endDateISO
        })
        .select()
        .single();

      if (error) {
        console.error('Ошибка создания пробной подписки:', error);
        return false;
      }

      console.log('Пробная подписка успешно создана:', data);
      return true;
    } catch (err) {
      console.error('Исключение при создании пробной подписки:', err);
      return false;
    }
  };

  const loadMySubscription = async () => {
    try {
      const tgUser = initTelegramWebAppSafe();
      const userIdRaw = tgUser?.id;
      
      // Приводим ID к числу и проверяем, что это валидное число
      const currentUserId = userIdRaw ? Number(userIdRaw) : null;
      
      if (!currentUserId || !Number.isFinite(currentUserId) || currentUserId <= 0) {
        console.warn('Не удалось получить валидный ID пользователя для проверки подписки:', userIdRaw);
        setSubscriptionInfo({ active: false, subscriptionExpiresAt: null });
        return;
      }
      
      // Убеждаемся, что это целое число (BigInt в БД)
      const telegramIdAsNumber = Math.floor(currentUserId);
      
      console.log('Проверка подписки для пользователя:', telegramIdAsNumber, '(тип:', typeof telegramIdAsNumber, ')');
      
      // Проверяем подписку в таблице subscriptions
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('telegram_id', telegramIdAsNumber)
        .gt('end_date', now)
        .order('end_date', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        // Если ошибка - "не найдено", это нормально (нет активной подписки)
        if (error.code === 'PGRST116') {
          console.log('Активная подписка не найдена для пользователя:', currentUserId);
          setSubscriptionInfo({ active: false, subscriptionExpiresAt: null });
          
          // Проверяем наличие pending платежей
          if (currentUserId) {
            const { data: pendingPayments, error: paymentError } = await supabase
              .from('payment_requests')
              .select('*')
              .eq('user_id', currentUserId)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (!paymentError && pendingPayments && pendingPayments.length > 0) {
              // Есть pending платеж, устанавливаем статус обработки
              setIsPaymentProcessing(true);
              try {
                localStorage.setItem('payment_processing', 'true');
              } catch (e) {
                console.error('Ошибка сохранения статуса обработки:', e);
              }
            } else {
              // Нет pending платежей, сбрасываем статус
              setIsPaymentProcessing(false);
              try {
                localStorage.removeItem('payment_processing');
              } catch (e) {
                console.error('Ошибка удаления статуса обработки:', e);
              }
            }
          } else {
            // Если не удалось получить ID пользователя, сбрасываем статус
            setIsPaymentProcessing(false);
            try {
              localStorage.removeItem('payment_processing');
            } catch (e) {
              console.error('Ошибка удаления статуса обработки:', e);
            }
          }
          return;
        }
        console.error('Ошибка загрузки подписки из Supabase:', error);
        setSubscriptionInfo({ active: false, subscriptionExpiresAt: null });
        return;
      }
      
      if (data && data.end_date) {
        console.log('Найдена активная подписка:', data);
        const endDate = new Date(data.end_date);
        const isActive = endDate > new Date();
        
        // Проверяем, изменилась ли подписка (новая подписка)
        const previousEndDate = subscriptionInfo?.subscriptionExpiresAt;
        const isNewSubscription = previousEndDate !== data.end_date;
        
        setSubscriptionInfo({
          active: isActive,
          subscriptionExpiresAt: data.end_date
        });
        
        // Если обнаружена новая подписка, сбрасываем счетчик ИИ
        if (isActive && isNewSubscription) {
          console.log('Обнаружена новая подписка, сбрасываем счетчик ИИ');
          try {
            saveAIUsageCount({ hints: 0, other: 0 }, data.end_date);
            setAiUsageCount({ hints: 0, other: 0 });
          } catch (e) {
            console.error('Ошибка сброса счетчика ИИ:', e);
          }
        } else if (isActive) {
          // Обновляем счетчик при загрузке подписки (проверяем актуальность)
          const updatedCount = loadAIUsageCount(data.end_date);
          setAiUsageCount(updatedCount);
        }
        
        // Если подписка активна, сбрасываем статус обработки платежа
        if (isActive) {
          setIsPaymentProcessing(false);
          // Удаляем статус из localStorage
          try {
            localStorage.removeItem('payment_processing');
          } catch (e) {
            console.error('Ошибка удаления статуса обработки:', e);
          }
        }
      } else {
        console.log('Подписка не найдена или истекла');
        setSubscriptionInfo({ active: false, subscriptionExpiresAt: null });
        
        // Если подписка неактивна, проверяем наличие pending платежей
        const tgUser = initTelegramWebAppSafe();
        const userId = tgUser?.id ? Number(tgUser.id) : null;
        if (userId) {
          const { data: pendingPayments, error: paymentError } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (!paymentError && pendingPayments && pendingPayments.length > 0) {
            // Есть pending платеж, устанавливаем статус обработки
            setIsPaymentProcessing(true);
            try {
              localStorage.setItem('payment_processing', 'true');
            } catch (e) {
              console.error('Ошибка сохранения статуса обработки:', e);
            }
          } else {
            // Нет pending платежей, сбрасываем статус
            setIsPaymentProcessing(false);
            try {
              localStorage.removeItem('payment_processing');
            } catch (e) {
              console.error('Ошибка удаления статуса обработки:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки подписки:', error);
      setSubscriptionInfo({ active: false, subscriptionExpiresAt: null });
      
      // При ошибке проверяем pending платежи
      const tgUser = initTelegramWebAppSafe();
      const userId = tgUser?.id ? Number(tgUser.id) : null;
      if (userId) {
        try {
          const { data: pendingPayments, error: paymentError } = await supabase
            .from('payment_requests')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (!paymentError && pendingPayments && pendingPayments.length > 0) {
            setIsPaymentProcessing(true);
            try {
              localStorage.setItem('payment_processing', 'true');
            } catch (e) {
              console.error('Ошибка сохранения статуса обработки:', e);
            }
          } else {
            setIsPaymentProcessing(false);
            try {
              localStorage.removeItem('payment_processing');
            } catch (e) {
              console.error('Ошибка удаления статуса обработки:', e);
            }
          }
        } catch (checkError) {
          console.error('Ошибка проверки pending платежей:', checkError);
          // При ошибке проверки сбрасываем статус
          setIsPaymentProcessing(false);
          try {
            localStorage.removeItem('payment_processing');
          } catch (e) {
            console.error('Ошибка удаления статуса обработки:', e);
          }
        }
      } else {
        // Если не удалось получить ID, сбрасываем статус
        setIsPaymentProcessing(false);
        try {
          localStorage.removeItem('payment_processing');
        } catch (e) {
          console.error('Ошибка удаления статуса обработки:', e);
        }
      }
    }
  };

  const hasActiveSubscription = () => {
    const s = subscriptionInfo;
    if (!s) return false;
    
    // Проверяем, что подписка активна и дата окончания в будущем
    const end = s.subscriptionExpiresAt ? new Date(s.subscriptionExpiresAt).getTime() : null;
    const isActive = Boolean(s.active && end && end > Date.now());
    
    // Дополнительная проверка: если active = false, но end_date в будущем, считаем активной
    // (на случай, если данные не синхронизированы)
    if (!isActive && end && end > Date.now()) {
      return true;
    }
    
    return isActive;
  };

  const getSubscriptionTimeRemaining = () => {
    if (!subscriptionInfo || !subscriptionInfo.subscriptionExpiresAt) return null;
    
    try {
      // Получаем текущую дату и дату окончания подписки
      const now = new Date();
      const expires = new Date(subscriptionInfo.subscriptionExpiresAt);
      
      // Проверяем, что дата окончания в будущем
      if (expires <= now) return null;
      
      // Вычисляем разницу в миллисекундах
      const remaining = expires.getTime() - now.getTime();
    if (remaining <= 0) return null;

      // Вычисляем количество полных дней (используем Math.floor для точного подсчета)
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

      // Если дней больше 0, показываем дни
    if (days > 0) {
        // Правильное склонение для русского языка
        let dayWord;
        const lastDigit = days % 10;
        const lastTwoDigits = days % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
          dayWord = 'дней';
        } else if (lastDigit === 1) {
          dayWord = 'день';
        } else if (lastDigit >= 2 && lastDigit <= 4) {
          dayWord = 'дня';
        } else {
          dayWord = 'дней';
        }
        return `${days} ${dayWord}`;
      }
      
      // Если дней нет, вычисляем часы
      const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours > 0) {
        let hourWord;
        const lastDigit = hours % 10;
        const lastTwoDigits = hours % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
          hourWord = 'часов';
        } else if (lastDigit === 1) {
          hourWord = 'час';
        } else if (lastDigit >= 2 && lastDigit <= 4) {
          hourWord = 'часа';
        } else {
          hourWord = 'часов';
        }
        return `${hours} ${hourWord}`;
      }
      
      // Если часов нет, вычисляем минуты
      const minutes = Math.floor(remaining / (1000 * 60));
      if (minutes > 0) {
        let minuteWord;
        const lastDigit = minutes % 10;
        const lastTwoDigits = minutes % 100;
        
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
          minuteWord = 'минут';
        } else if (lastDigit === 1) {
          minuteWord = 'минута';
        } else if (lastDigit >= 2 && lastDigit <= 4) {
          minuteWord = 'минуты';
        } else {
          minuteWord = 'минут';
        }
        return `${minutes} ${minuteWord}`;
      }
      
      return null;
    } catch (error) {
      console.error('Ошибка вычисления оставшегося времени подписки:', error);
      return null;
    }
  };

  const handlePayment = () => {
    alert('Функция оплаты будет доступна позже. Обратитесь к администратору.');
  };

  const getAdminHeaders = () => {
    try {
      const tgUser = initTelegramWebAppSafe();
      const userId = tgUser && tgUser.id ? Number(tgUser.id) : 0;
      const safeUserId = Number.isFinite(userId) && userId > 0 ? String(Math.floor(userId)) : '0';

      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('x-telegram-user-id', safeUserId);
      return headers;
    } catch (error) {
      console.error('Ошибка создания заголовков:', error);
      const headers = new Headers();
      headers.set('Content-Type', 'application/json');
      headers.set('x-telegram-user-id', '0');
      return headers;
    }
  };

  const loadSubscriptions = async () => {
    setDbSubsLoading(true);
    setDbSubsError(null);
    try {
      console.log('Загрузка активных подписок из Supabase...');
      
      // Получаем текущую дату в ISO формате
      const now = new Date().toISOString();
      
      // Загружаем все активные подписки (где end_date > текущей даты)
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .gt('end_date', now)
        .order('end_date', { ascending: true });

      if (error) {
        console.error('Ошибка загрузки подписок из Supabase:', error);
        throw new Error(error.message || JSON.stringify(error));
      }

      console.log('Активные подписки из Supabase:', data);
      
      // Преобразуем данные в формат, который ожидает компонент
      const formattedSubs = (data || []).map(sub => ({
        telegramId: sub.telegram_id || sub.user_id,
        name: sub.name || 'Без имени',
        subscriptionStatus: 'active',
        subscriptionExpiresAt: sub.end_date || sub.expires_at
      }));
      
      setDbActiveSubs(formattedSubs);
    } catch (e) {
      const errorMsg = e?.message || e?.toString() || JSON.stringify(e) || 'Ошибка загрузки подписок';
      console.error('Ошибка загрузки подписок:', e);
        setDbSubsError(errorMsg);
      setDbActiveSubs([]);
      alert('Ошибка загрузки подписок: ' + errorMsg);
    } finally {
      setDbSubsLoading(false);
    }
  };

  const handleGrantSubscription = async (e) => {
    e.preventDefault();
    setGrantMessage(null);
    const telegramId = Number(grantForm.telegramId);
    const days = Number(grantForm.days);
    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      setGrantMessage('Введите корректный Telegram ID');
      return;
    }
    
    const subscriptionDays = Number.isFinite(days) && days > 0 ? days : 30;
    
    setGrantLoading(true);
    try {
      console.log('Выдача подписки в Supabase:', { telegramId, days: subscriptionDays });
      
      // Вычисляем дату окончания подписки
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + subscriptionDays);
      const endDateISO = endDate.toISOString();
      
      // Убеждаемся, что telegramId - это целое число (BigInt в БД)
      const telegramIdAsNumber = Math.floor(telegramId);
      console.log('Выдача подписки для пользователя:', telegramIdAsNumber, '(тип:', typeof telegramIdAsNumber, ')');
      
      // Проверяем, есть ли уже подписка у пользователя
      const { data: existing, error: checkError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('telegram_id', telegramIdAsNumber)
        .single();
      
      let result;
      if (existing && !checkError) {
        // Обновляем существующую подписку
        console.log('Обновление существующей подписки');
        const { data, error } = await supabase
          .from('subscriptions')
          .update({
            end_date: endDateISO
          })
          .eq('telegram_id', telegramIdAsNumber)
          .select()
          .single();
        
        if (error) {
          throw new Error(error.message || JSON.stringify(error));
        }
        result = data;
      } else {
        // Создаем новую подписку
        console.log('Создание новой подписки');
        const { data, error } = await supabase
          .from('subscriptions')
          .insert({
            telegram_id: telegramIdAsNumber,
            end_date: endDateISO
          })
          .select()
          .single();
        
        if (error) {
          throw new Error(error.message || JSON.stringify(error));
        }
        result = data;
      }
      
      console.log('Подписка выдана в Supabase:', result);
      const endDateFormatted = new Date(result.end_date).toLocaleString('ru-RU');
      setGrantMessage(`Подписка выдана: до ${endDateFormatted}`);
      
      // Удаляем запись из payment_requests после успешной выдачи подписки
      try {
        console.log('🗑️ Удаление записи из payment_requests для пользователя:', {
          telegramId: telegramIdAsNumber,
          telegramIdType: typeof telegramIdAsNumber
        });

        // Сначала проверяем, есть ли записи для удаления
        const { data: existingRequests, error: checkError } = await supabase
          .from('payment_requests')
          .select('*')
          .eq('user_id', telegramIdAsNumber);

        if (checkError) {
          console.warn('⚠️ Ошибка проверки записей в payment_requests:', checkError);
        } else {
          console.log('📋 Найдено записей в payment_requests:', existingRequests?.length || 0, existingRequests);
        }

        // Удаляем все записи для пользователя (не только pending, на случай если статус изменился)
        // Пробуем удалить и по числовому, и по строковому значению (на случай разных типов в БД)
        let deletedRequests = null;
        let deleteError = null;

        // Сначала пробуем удалить по числовому значению
        const deleteResult = await supabase
          .from('payment_requests')
          .delete()
          .eq('user_id', telegramIdAsNumber)
          .select();

        deletedRequests = deleteResult.data;
        deleteError = deleteResult.error;

        // Если не удалось и есть ошибка, пробуем по строковому значению
        if (deleteError || !deletedRequests || deletedRequests.length === 0) {
          console.log('🔄 Пробуем удалить по строковому значению user_id:', String(telegramIdAsNumber));
          const deleteResultString = await supabase
            .from('payment_requests')
            .delete()
            .eq('user_id', String(telegramIdAsNumber))
            .select();

          if (!deleteResultString.error && deleteResultString.data && deleteResultString.data.length > 0) {
            deletedRequests = deleteResultString.data;
            deleteError = null;
            console.log('✅ Удаление по строковому значению успешно');
          } else if (!deleteError) {
            // Если первая попытка не дала ошибки, но и не удалила, используем её результат
            deleteError = deleteResultString.error;
          }
        }

        if (deleteError) {
          console.error('❌ Ошибка удаления записи из payment_requests:', {
            error: deleteError,
            message: deleteError.message,
            details: deleteError.details,
            hint: deleteError.hint,
            code: deleteError.code,
            telegramId: telegramIdAsNumber
          });
          // Не блокируем процесс, если не удалось удалить запрос
      } else {
          const deletedCount = deletedRequests?.length || 0;
          if (deletedCount > 0) {
            console.log('✅ Успешно удалено записей из payment_requests:', deletedCount, deletedRequests);
          } else {
            console.warn('⚠️ Записи не найдены для удаления. Возможно, они уже были удалены или не существуют.');
          }
        }
      } catch (deleteErr) {
        console.error('❌ Критическая ошибка при удалении записи из payment_requests:', {
          error: deleteErr,
          message: deleteErr?.message,
          stack: deleteErr?.stack,
          telegramId: telegramIdAsNumber
        });
        // Не блокируем процесс, если не удалось удалить запрос
      }
      
      // Обновляем список активных подписок
      await loadSubscriptions();
      // Обновляем список пользователей, чтобы отобразить актуальный статус подписки
      if (adminScreen === 'users') {
        await loadUsersFromSupabase();
      }
    } catch (e2) {
      const errorMsg = e2?.message || e2?.toString() || JSON.stringify(e2) || 'Ошибка выдачи подписки';
      console.error('Ошибка выдачи подписки:', e2);
        setGrantMessage(errorMsg);
      alert('Ошибка выдачи подписки: ' + errorMsg);
    } finally {
      setGrantLoading(false);
    }
  };

  // Функция для отзыва (забирания) подписки
  const handleRevokeSubscription = async (telegramId) => {
    if (!confirm(`Забрать подписку у пользователя с ID ${telegramId}?`)) {
      return;
    }

    try {
      const telegramIdAsNumber = Math.floor(Number(telegramId));
      
      if (!Number.isFinite(telegramIdAsNumber) || telegramIdAsNumber <= 0) {
        alert('Некорректный ID пользователя');
        return;
      }

      console.log('Отзыв подписки для пользователя:', telegramIdAsNumber);

      // Устанавливаем дату окончания подписки в прошлое (вчера)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toISOString();

      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          end_date: yesterdayISO
        })
        .eq('telegram_id', telegramIdAsNumber)
        .select()
        .single();

      if (error) {
        // Если ошибка - "не найдено", значит подписки уже нет
        if (error.code === 'PGRST116') {
          alert('Подписка не найдена или уже отозвана');
          await loadSubscriptions();
          // Обновляем список пользователей, если мы на экране пользователей
          if (adminScreen === 'users') {
            await loadUsersFromSupabase();
          }
          return;
        }
        throw new Error(error.message || JSON.stringify(error));
      }

      console.log('Подписка отозвана в Supabase:', data);
      alert(`Подписка успешно отозвана у пользователя ${telegramIdAsNumber}`);
      
      // Обновляем список активных подписок
      await loadSubscriptions();
      
      // Обновляем список пользователей, если мы на экране пользователей
      if (adminScreen === 'users') {
        await loadUsersFromSupabase();
      }
    } catch (e) {
      const errorMsg = e?.message || e?.toString() || JSON.stringify(e) || 'Ошибка отзыва подписки';
      console.error('Ошибка отзыва подписки:', e);
      alert('Ошибка отзыва подписки: ' + errorMsg);
    }
  };

  // ========== ПРОВЕРКА АДМИН-СТАТУСА ==========
  const checkAdminStatus = async (userId) => {
    if (!userId) {
      setIsAdmin(false);
      return false;
    }

    const userIdNumber = Number(userId);
    if (!Number.isFinite(userIdNumber) || userIdNumber <= 0) {
      setIsAdmin(false);
      return false;
    }

    // Проверяем главного админа (запасной вариант)
    const MAIN_ADMIN_TELEGRAM_ID = 473842863;
    if (userIdNumber === MAIN_ADMIN_TELEGRAM_ID) {
      console.log('✅ Главный администратор обнаружен (ID: 473842863)');
      setIsAdmin(true);
      return true;
    }

    try {
      // Проверяем в таблице admins
      const telegramIdAsNumber = Math.floor(userIdNumber);
      console.log('🔍 Проверка админ-статуса в Supabase для пользователя:', telegramIdAsNumber);

      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('telegram_id', telegramIdAsNumber)
        .single();

      if (error) {
        // Если ошибка - "не найдено", это нормально (не админ)
        if (error.code === 'PGRST116') {
          console.log('❌ Пользователь не найден в таблице admins');
          setIsAdmin(false);
          return false;
        }
        console.error('Ошибка проверки админ-статуса из Supabase:', error);
        setIsAdmin(false);
        return false;
      }

      if (data) {
        console.log('✅ Пользователь найден в таблице admins:', data);
        setIsAdmin(true);
        return true;
      }

      setIsAdmin(false);
      return false;
    } catch (err) {
      console.error('Ошибка проверки админ-статуса:', err);
      setIsAdmin(false);
      return false;
    }
  };

  // Функции для управления администраторами
  const loadAdmins = async () => {
    setAdminsLoading(true);
    setAdminsError(null);
    try {
      console.log('Загрузка администраторов из Supabase...');
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Ошибка загрузки администраторов из Supabase:', error);
        throw new Error(error.message || JSON.stringify(error));
      }

      console.log('Данные администраторов из Supabase:', data);
      
      // Преобразуем данные в формат, который ожидает компонент
      const formattedAdmins = (data || []).map(admin => ({
        telegramId: admin.telegram_id,
        createdAt: admin.created_at,
        createdBy: admin.created_by
      }));
      
      setAdminsList(formattedAdmins);
    } catch (e) {
      const errorMessage = e?.message || e?.toString() || JSON.stringify(e) || 'Ошибка загрузки администраторов';
      console.error('Ошибка загрузки администраторов:', e);
      setAdminsError(errorMessage);
      setAdminsList([]);
      alert('Ошибка загрузки администраторов: ' + errorMessage);
    } finally {
      setAdminsLoading(false);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setAdminFormMessage(null);
    const telegramId = Number(adminForm.telegramId);
    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      setAdminFormMessage('Введите корректный Telegram ID');
      return;
    }
    
    // Получаем текущего пользователя для created_by
    const tgUser = initTelegramWebAppSafe();
    const currentUserIdRaw = tgUser?.id;
    const currentUserId = currentUserIdRaw ? Number(currentUserIdRaw) : null;
    const createdBy = (currentUserId && Number.isFinite(currentUserId) && currentUserId > 0) 
      ? Math.floor(currentUserId) 
      : 473842863; // Используем главного админа как fallback
    
    // Убеждаемся, что telegramId - это целое число (BigInt в БД)
    const telegramIdAsNumber = Math.floor(telegramId);
    
    setAdminFormLoading(true);
    try {
      console.log('Добавление администратора в Supabase:', telegramIdAsNumber, '(тип:', typeof telegramIdAsNumber, ')');
      
      // Проверяем, не является ли уже админом
      const { data: existing, error: checkError } = await supabase
        .from('admins')
        .select('telegram_id')
        .eq('telegram_id', telegramIdAsNumber)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found, это нормально
        throw new Error(checkError.message || 'Ошибка проверки существующего администратора');
      }
      
      if (existing) {
        throw new Error('Пользователь уже является администратором');
      }
      
      // Добавляем администратора
      const { data, error } = await supabase
        .from('admins')
        .insert({
          telegram_id: telegramIdAsNumber,
          created_by: createdBy
        })
        .select()
        .single();
      
      if (error) {
        console.error('Ошибка добавления администратора в Supabase:', error);
        throw new Error(error.message || JSON.stringify(error));
      }
      
      console.log('Администратор добавлен в Supabase:', data);
      setAdminFormMessage('Администратор успешно добавлен');
      setAdminForm({ telegramId: '' });
      await loadAdmins();
      
      // Если добавлен текущий пользователь, обновляем его админ-статус
      const tgUser = initTelegramWebAppSafe();
      const currentUserId = tgUser?.id ? String(tgUser.id) : null;
      if (currentUserId && Number(currentUserId) === telegramIdAsNumber) {
        const adminStatus = await checkAdminStatus(currentUserId);
        if (adminStatus) {
          setUserRole('admin');
        }
      }
    } catch (e2) {
      const errorMessage = e2?.message || e2?.toString() || JSON.stringify(e2) || 'Ошибка добавления администратора';
      console.error('Ошибка добавления администратора:', e2);
      setAdminFormMessage(errorMessage);
      alert('Ошибка добавления администратора: ' + errorMessage);
    } finally {
      setAdminFormLoading(false);
    }
  };

  const handleRemoveAdmin = async (telegramId) => {
    if (!confirm(`Удалить администратора с ID ${telegramId}?`)) {
      return;
    }
    try {
      // Убеждаемся, что telegramId - это целое число (BigInt в БД)
      const telegramIdAsNumber = Math.floor(Number(telegramId));
      
      if (!Number.isFinite(telegramIdAsNumber) || telegramIdAsNumber <= 0) {
        alert('Некорректный ID администратора');
        return;
      }
      
      console.log('Удаление администратора из Supabase:', telegramIdAsNumber, '(тип:', typeof telegramIdAsNumber, ')');
      
      const { data, error } = await supabase
        .from('admins')
        .delete()
        .eq('telegram_id', telegramIdAsNumber)
        .select();
      
      if (error) {
        console.error('Ошибка удаления администратора из Supabase:', error);
        throw new Error(error.message || JSON.stringify(error));
      }
      
      console.log('Администратор удален из Supabase:', data);
      await loadAdmins();
    } catch (e) {
      const errorMessage = e?.message || e?.toString() || JSON.stringify(e) || 'Ошибка удаления администратора';
      console.error('Ошибка удаления администратора:', e);
      alert('Ошибка удаления администратора: ' + errorMessage);
    }
  };

  const handleTopicClick = (topic) => {
    // Проверяем подписку для не-админов
    if (userRole !== 'admin' && !isAdmin) {
      if (!hasActiveSubscription()) {
        alert('Для решения тестов необходима активная подписка. Пожалуйста, оформите подписку.');
        setShowSubscriptionModal(true);
        return;
      }
    }
    setSelectedTopic(topic)
    setScreen('topicDetail')
  }

  // Функция для открытия экрана добавления темы
  const handleOpenAddTopic = () => {
    setNewTopicName('');
    setEditingTopicId(null);
    setEditingTopicName('');
    setAdminScreen('addTopic');
  }

  // Функция для добавления новой темы (квиза)
  const handleAddTopic = async (e) => {
    if (e) {
      e.preventDefault();
    }
    
    const topicName = newTopicName.trim();
    
    if (!topicName) {
      return;
    }
    
    try {
      // Получаем текущие темы
      const currentTopics = Array.isArray(topics) && topics.length > 0 ? topics : [];
      
      // Сохраняем в Supabase (quizzes использует UUID, генерируется автоматически)
      const { data, error } = await supabase
        .from('quizzes')
        .insert({
          title: topicName,
          description: null
        })
        .select()
        .single();

      if (error) {
        console.error('Ошибка сохранения квиза в Supabase:', error);
        const errorMsg = error.message || 'Неизвестная ошибка';
        // Проверяем, не является ли это ошибкой подключения к Supabase
        if (errorMsg.includes('404') || errorMsg.includes('Failed to fetch')) {
          alert('Ошибка подключения к базе данных. Проверьте настройки Supabase.');
        } else {
          alert('Ошибка при добавлении темы: ' + errorMsg);
        }
        return;
      }

      // Создаем новую тему для локального состояния
      const newTopic = {
        id: data.id, // UUID
        name: data.title,
        questionCount: 0,
        order: currentTopics.length + 1
      };
      
      // Добавляем новую тему к списку
      const updatedTopics = [...currentTopics, newTopic];
      
      // Обновляем состояние
      setTopics(updatedTopics);
      
      // Также сохраняем в localStorage как fallback
      localStorage.setItem('dev_topics', JSON.stringify(updatedTopics));
      
      // Очищаем форму
      setNewTopicName('');
    } catch (error) {
      console.error('Ошибка при добавлении темы:', error);
      const errorMsg = error.message || 'Неизвестная ошибка';
      if (errorMsg.includes('404') || errorMsg.includes('Failed to fetch')) {
        alert('Ошибка подключения к базе данных. Проверьте настройки Supabase.');
      } else {
        alert('Произошла ошибка при добавлении темы: ' + errorMsg);
      }
    }
  }

  // Функция для начала редактирования темы
  const handleStartEditTopic = (topic) => {
    setEditingTopicId(topic.id);
    setEditingTopicName(topic.name);
    setNewTopicName('');
  }

  // Функция для сохранения изменений темы (квиза)
  const handleSaveEditTopic = async () => {
    const topicName = editingTopicName.trim();
    
    if (!topicName) {
      alert('Название темы не может быть пустым!');
      return;
    }
    
    try {
      // Обновляем в Supabase (quizzes)
      const { error } = await supabase
        .from('quizzes')
        .update({ title: topicName })
        .eq('id', editingTopicId);

      if (error) {
        console.error('Ошибка обновления квиза в Supabase:', error);
        alert('Ошибка при сохранении темы: ' + error.message);
        return;
      }

      const currentTopics = Array.isArray(topics) && topics.length > 0 ? topics : [];
      const updatedTopics = currentTopics.map(t => 
        t.id === editingTopicId 
          ? { ...t, name: topicName }
          : t
      );
      
      setTopics(updatedTopics);
      // Также сохраняем в localStorage как fallback
      localStorage.setItem('dev_topics', JSON.stringify(updatedTopics));
      
      setEditingTopicId(null);
      setEditingTopicName('');
    } catch (error) {
      console.error('Ошибка при сохранении темы:', error);
      alert('Произошла ошибка при сохранении темы: ' + error.message);
    }
  }

  // Функция для отмены редактирования
  const handleCancelEditTopic = () => {
    setEditingTopicId(null);
    setEditingTopicName('');
  }

  // Функция для удаления темы (квиза)
  const handleDeleteTopic = async (topic) => {
    if (!confirm(`Вы уверены, что хотите удалить тему "${topic.name}"?`)) {
      return;
    }
    
    try {
      // Удаляем из Supabase (quizzes) - вопросы и опции удалятся автоматически через CASCADE
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', topic.id);

      if (error) {
        console.error('Ошибка удаления квиза из Supabase:', error);
        alert('Ошибка при удалении темы: ' + error.message);
        return;
      }

      const currentTopics = Array.isArray(topics) && topics.length > 0 ? topics : [];
      const updatedTopics = currentTopics.filter(t => t.id !== topic.id);
      setTopics(updatedTopics);
      // Также обновляем localStorage как fallback
      localStorage.setItem('dev_topics', JSON.stringify(updatedTopics));
      
      // Перезагружаем вопросы, так как некоторые могли быть удалены
      await loadQuestionsFromSupabase();
      
      if (editingTopicId === topic.id) {
        handleCancelEditTopic();
      }
    } catch (error) {
      console.error('Ошибка при удалении темы:', error);
      alert('Произошла ошибка при удалении темы: ' + error.message);
    }
  }

  // Функции для drag and drop
  const handleDragStart = (e, index) => {
    setDraggedTopicIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
    e.currentTarget.style.opacity = '0.5';
  }

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedTopicIndex(null);
    setDragOverIndex(null);
  }

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedTopicIndex !== null && draggedTopicIndex !== index) {
      setDragOverIndex(index);
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null);
  }

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedTopicIndex === null || draggedTopicIndex === dropIndex) {
      setDraggedTopicIndex(null);
      setDragOverIndex(null);
      return;
    }
    
    try {
      const currentTopics = [...topics];
      const draggedTopic = currentTopics[draggedTopicIndex];
      
      // Удаляем тему из старой позиции
      currentTopics.splice(draggedTopicIndex, 1);
      
      // Вставляем тему в новую позицию
      currentTopics.splice(dropIndex, 0, draggedTopic);
      
      // Обновляем порядок в Supabase
      const updates = currentTopics.map((topic, index) => ({
        id: topic.id,
        order: index + 1
      }));

      // Обновляем все темы в Supabase
      for (const update of updates) {
        await supabase
          .from('topics')
          .update({ order: update.order })
          .eq('id', update.id);
      }

      // Обновляем локальное состояние
      const updatedTopics = currentTopics.map((topic, index) => ({
        ...topic,
        order: index + 1
      }));
      
      setTopics(updatedTopics);
      // Также сохраняем в localStorage как fallback
      localStorage.setItem('dev_topics', JSON.stringify(updatedTopics));
      
      setDraggedTopicIndex(null);
      setDragOverIndex(null);
    } catch (error) {
      console.error('Ошибка при перемещении темы:', error);
      setDraggedTopicIndex(null);
      setDragOverIndex(null);
    }
  }

  const handleStartTest = () => {
    // Проверяем подписку для не-админов
    if (userRole !== 'admin' && !isAdmin) {
      if (!hasActiveSubscription()) {
        alert('Для решения тестов необходима активная подписка. Пожалуйста, оформите подписку.');
        setShowSubscriptionModal(true);
        return;
      }
    }
    
    if (!selectedTopic || !selectedTopic.id) {
      alert('Ошибка: не выбрана тема для теста.');
      return;
    }
    
    const questions = getMergedQuestions(selectedTopic.id);
    
    if (!questions || questions.length === 0) {
      alert('В этой теме пока нет вопросов. Пожалуйста, попробуйте другую тему или обратитесь к администратору.');
      console.error('Нет вопросов для темы:', selectedTopic.id, selectedTopic.name);
      return;
    }
    
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setIsAnswered(false)
    setCorrectAnswersCount(0)
    setTestStartTime(Date.now())
    setElapsedTime(0)
    setUserAnswers([]) // Сбрасываем ответы
    userAnswersRef.current = [] // Сбрасываем референс
    setTestQuestions(questions) // Сохраняем вопросы теста
    setIsExamMode(false) // Это тест по теме, не экзамен
    setExplanations({}) // Очищаем объяснения при перезапуске теста
    setScreen('quiz')
  }

  // ========== ЭКЗАМЕН: Обработчик выбора количества вопросов ==========
  const handleExamQuestionCountSelect = (count) => {
    // Проверяем подписку для не-админов
    if (userRole !== 'admin' && !isAdmin) {
      if (!hasActiveSubscription()) {
        alert('Для прохождения экзамена необходима активная подписка. Пожалуйста, оформите подписку.');
        setShowSubscriptionModal(true);
        return;
      }
    }
    
    setExamQuestionCount(count);
    
    // Собираем все вопросы из всех тем
    const allQuestions = getAllQuestions();
    
    if (allQuestions.length === 0) {
      alert('Нет доступных вопросов для экзамена. Пожалуйста, добавьте вопросы в разделе "Тема".');
      return;
    }
    
    // Выбираем случайные уникальные вопросы
    const examQuestions = getRandomQuestions(allQuestions, count);
    
    if (examQuestions.length < count) {
      alert(`Доступно только ${examQuestions.length} вопросов из ${count} запрошенных.`);
    }
    
    // Экзамен: Устанавливаем лимит времени в зависимости от количества вопросов
    // 20 вопросов = 20 минут, 50 вопросов = 50 минут, 100 вопросов = 100 минут
    const timeLimitMinutes = count;
    const timeLimitSeconds = timeLimitMinutes * 60;
    setExamTimeLimit(timeLimitSeconds);
    setExamTimeRemaining(timeLimitSeconds);
    
    // Инициализируем экзамен
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setCorrectAnswersCount(0);
    setTestStartTime(Date.now());
    setElapsedTime(0);
    setUserAnswers([]);
    userAnswersRef.current = [];
    setTestQuestions(examQuestions);
    setIsExamMode(true); // Устанавливаем флаг экзамена
    setExplanations({}); // Очищаем объяснения при перезапуске экзамена
    setScreen('quiz'); // Используем тот же экран quiz
  }

  // ========== ЭКЗАМЕН: Обработчик переключения режима (тема/экзамен) ==========
  const handleModeSwitch = (mode) => {
    if (mode === 'exam' && userRole !== 'admin') {
      if (!hasActiveSubscription()) {
        alert('Экзамен доступен только при активной подписке.');
        return;
      }
    }
    
    // Сначала устанавливаем режим, затем переключаем экран
    if (mode === 'topic') {
      setActiveMode('topic');
      setScreen('topics');
      setIsExamMode(false);
    } else if (mode === 'exam') {
      setActiveMode('exam');
      setScreen('examSelect');
      setIsExamMode(false);
    }
  }

  // Синхронизация activeMode с текущим экраном
  useEffect(() => {
    if (screen === 'topics') {
      setActiveMode('topic');
    } else if (screen === 'examSelect') {
      setActiveMode('exam');
    }
  }, [screen]);

  const handleBackToTopics = () => {
    if (isExamMode) {
      // Если это экзамен, возвращаемся к выбору количества вопросов
      setScreen('examSelect');
      setIsExamMode(false);
      setExamTimeLimit(null);
      setExamTimeRemaining(null);
      setExamQuestionCount(null);
    } else {
      // Если это тест по теме, возвращаемся к списку тем
      setScreen('topics');
      setSelectedTopic(null);
    }
  }

  // ========== ЭКЗАМЕН: Таймер с поддержкой обратного отсчета для экзамена ==========
  useEffect(() => {
    let interval = null;
    if (screen === 'quiz' && testStartTime) {
      interval = setInterval(() => {
        if (isExamMode && examTimeLimit !== null && examTimeRemaining !== null) {
          // Экзамен: обратный отсчет времени
          const elapsed = Math.floor((Date.now() - testStartTime) / 1000);
          const remaining = Math.max(0, examTimeLimit - elapsed);
          setExamTimeRemaining(remaining);
          setElapsedTime(elapsed);
          
          // Экзамен: автоматическое завершение при истечении времени
          if (remaining === 0) {
            clearInterval(interval);
            // Блокируем ответы и завершаем экзамен
            setIsAnswered(true);
            // Автоматически завершаем экзамен без подтверждения
            setTimeout(() => {
              saveTestResults();
            }, 1000);
          }
        } else {
          // Обычный тест по теме: прямой отсчет времени
          setElapsedTime(Math.floor((Date.now() - testStartTime) / 1000));
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [screen, testStartTime, isExamMode, examTimeLimit, examTimeRemaining]);

  // Автоматически запрашиваем объяснения для неправильных ответов в режиме полного обзора
  useEffect(() => {
    // Выполняем только если мы на экране fullReview
    if (screen !== 'fullReview') return;
    
    // Получаем результат: сначала из selectedResult, затем из results по selectedTopic, затем из всех results
    let reviewResult = selectedResult;
    
    if (!reviewResult && selectedTopic && selectedTopic.id) {
      reviewResult = (results[selectedTopic.id] || [])[0];
    }
    
    // Если все еще нет результата, ищем в всех results
    if (!reviewResult) {
      for (const topicId in results) {
        if (results[topicId] && results[topicId].length > 0) {
          reviewResult = results[topicId][0];
          break;
        }
      }
    }
    
    // Проверяем, что есть данные для обработки
    if (!reviewResult || !reviewResult.questions || !reviewResult.userAnswers) {
      return;
    }
    
    const questions = reviewResult.questions;
    const userAnswers = reviewResult.userAnswers;
    
    // Автоматически запрашиваем объяснения для неправильных ответов
    // Система fallback в Edge Function автоматически переключается между моделями
    questions.forEach((question, index) => {
      const userAnswer = userAnswers[index];
      if (!userAnswer) return;
      
      const userSelectedId = userAnswer?.selectedAnswerId;
      const correctAnswer = question.answers.find(a => a.correct === true);
      const userSelectedAnswer = question.answers.find(a => {
        const normalizeId = (id) => {
          if (id === null || id === undefined) return null;
          const num = Number(id);
          if (!isNaN(num)) return num;
          return String(id);
        };
        return normalizeId(a.id) === normalizeId(userSelectedId);
      });
      
      const isIncorrect = userSelectedAnswer && !userSelectedAnswer.correct;
      const questionId = question.id || `q-${index}`;
      
      if (isIncorrect && correctAnswer && userSelectedAnswer && !explanations[questionId]?.explanation && !explanations[questionId]?.loading) {
        getExplanation(questionId, question.text, userSelectedAnswer.text, correctAnswer.text);
      }
    });
  }, [screen, selectedResult, selectedTopic, results, explanations, getExplanation]);

  // Форматирование времени для обычного теста (HH:MM:SS)
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // ========== ЭКЗАМЕН: Форматирование времени для экзамена (MM:SS) ==========
  const formatExamTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const saveTestResults = () => {
    try {
      // ========== ЭКЗАМЕН: Используем сохраненные вопросы теста ==========
      // Для экзамена используем testQuestions, для теста по теме - из selectedTopic
      let questions = [];
      if (isExamMode) {
        // В режиме экзамена обязательно используем testQuestions
        questions = testQuestions && testQuestions.length > 0 ? testQuestions : [];
        if (questions.length === 0) {
          console.error('Экзамен: нет вопросов для сохранения результатов');
          alert('Ошибка: нет вопросов для сохранения результатов');
          return;
        }
      } else {
        // Для теста по теме используем вопросы из selectedTopic
        if (!selectedTopic || !selectedTopic.id) {
          console.error('Тест: selectedTopic не определен');
          alert('Ошибка: не выбрана тема для сохранения результатов');
          return;
        }
        try {
          questions = getMergedQuestions(selectedTopic.id);
        } catch (error) {
          console.error('Ошибка при получении вопросов:', error);
          alert('Ошибка при получении вопросов теста');
          return;
        }
        if (!questions || questions.length === 0) {
          console.error('Тест: нет вопросов для сохранения результатов');
          alert('Ошибка: нет вопросов для сохранения результатов');
          return;
        }
      }
    
    // Используем референс для получения актуальных ответов (синхронный доступ)
    const currentUserAnswers = (userAnswersRef.current && Array.isArray(userAnswersRef.current) && userAnswersRef.current.length > 0) 
      ? userAnswersRef.current 
      : (Array.isArray(userAnswers) ? userAnswers : []);
    
    // Отладочная информация - проверяем состояние userAnswers
    console.log('saveTestResults - userAnswers state:', {
      userAnswersLength: userAnswers.length,
      refLength: userAnswersRef.current.length,
      usingRef: userAnswersRef.current.length > 0,
      userAnswers: currentUserAnswers.map((a, i) => ({
        index: i,
        answer: a,
        hasSelectedId: a ? (a.selectedAnswerId !== undefined && a.selectedAnswerId !== null) : false,
        selectedId: a ? a.selectedAnswerId : null,
        selectedIdType: a ? typeof a.selectedAnswerId : null
      })),
      questionsLength: questions.length,
      testQuestionsLength: testQuestions.length
    });
    
    // Пересчитываем правильные ответы на основе сохраненных вопросов
    let correctCount = 0;
    let answeredCount = 0;
    
    // Функция нормализации ID для сравнения
    const normalizeId = (id) => {
      if (id === null || id === undefined) return null;
      const num = Number(id);
      if (!isNaN(num)) return num;
      return String(id);
    };
    
    questions.forEach((question, index) => {
      // Проверяем, что вопрос существует и имеет ответы
      if (!question || !question.answers || !Array.isArray(question.answers) || question.answers.length === 0) {
        console.warn(`Question ${index + 1} не имеет ответов или некорректна:`, question);
        return;
      }
      
      const userAnswer = currentUserAnswers[index];
      
      if (userAnswer && userAnswer.selectedAnswerId !== undefined && userAnswer.selectedAnswerId !== null) {
        answeredCount++;
        
        // Находим выбранный ответ в вопросе
        const userSelectedId = userAnswer.selectedAnswerId;
        const selectedAnswer = question.answers.find(a => {
          if (!a || a.id === undefined || a.id === null) return false;
          const answerId = a.id;
          // Нормализуем и сравниваем
          const normalizedUser = normalizeId(userSelectedId);
          const normalizedAnswer = normalizeId(answerId);
          return normalizedUser !== null && normalizedAnswer !== null && normalizedUser === normalizedAnswer;
        });
        
        // Отладочная информация
        console.log(`Question ${index + 1} check:`, {
          questionId: question.id,
          userSelectedId: userSelectedId,
          userSelectedIdType: typeof userSelectedId,
          questionAnswers: question.answers.map(a => ({ 
            id: a.id, 
            idType: typeof a.id, 
            text: a.text.substring(0, 20),
            correct: a.correct 
          })),
          selectedAnswer: selectedAnswer ? {
            id: selectedAnswer.id,
            text: selectedAnswer.text.substring(0, 20),
            correct: selectedAnswer.correct
          } : null,
          isCorrect: selectedAnswer && selectedAnswer.correct === true
        });
        
        // Проверяем правильность
        if (selectedAnswer && selectedAnswer.correct === true) {
          correctCount++;
        }
      } else {
        console.log(`Question ${index + 1}: No answer`, {
          questionId: question.id,
          userAnswer: userAnswer
        });
      }
    });
    
    console.log('Final count:', {
      correctCount,
      answeredCount,
      totalQuestions: questions.length,
      percentage: questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0
    });
    
    const percentage = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    // ========== ЭКЗАМЕН: Для экзамена используем другой формат ID, для теста по теме - стандартный ==========
    const resultId = isExamMode 
      ? `EXAM${examQuestionCount || '0'}_${String(Date.now()).slice(-6)}`
      : (selectedTopic ? `ID${selectedTopic.id}${String(Date.now()).slice(-6)}` : `ID0${String(Date.now()).slice(-6)}`);
    const now = new Date();
    const dateTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const formatTimeSpent = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (mins > 0 && secs > 0) {
        return `${mins} ${mins === 1 ? 'минута' : mins < 5 ? 'минуты' : 'минут'} ${secs} ${secs === 1 ? 'секунда' : secs < 5 ? 'секунды' : 'секунд'}`;
      } else if (mins > 0) {
        return `${mins} ${mins === 1 ? 'минута' : mins < 5 ? 'минуты' : 'минут'}`;
      } else {
        return `${secs} ${secs === 1 ? 'секунда' : secs < 5 ? 'секунды' : 'секунд'}`;
      }
    };
    
    // Глубокое копирование вопросов и ответов для сохранения
    const questionsCopy = questions.map(q => {
      if (!q || !q.answers || !Array.isArray(q.answers)) {
        console.warn('Некорректный вопрос при копировании:', q);
        return {
          ...q,
          answers: []
        };
      }
      return {
        ...q,
        answers: q.answers.map(a => ({ ...a }))
      };
    });
    
    // Глубокое копирование ответов пользователя (используем currentUserAnswers вместо userAnswers)
    const userAnswersCopy = Array.isArray(currentUserAnswers) 
      ? currentUserAnswers.map(a => a ? { ...a } : null)
      : [];
    
    // Проверяем, что testStartTime не null перед вычислением времени
    const finalTime = testStartTime ? Math.floor((Date.now() - testStartTime) / 1000) : 0;
    
    const newResult = {
      id: resultId,
      correct: correctCount,
      total: questions.length,
      answered: answeredCount,
      percentage: percentage,
      time: finalTime,
      timeFormatted: formatTime(finalTime),
      timeSpent: formatTimeSpent(finalTime),
      dateTime: dateTime,
      userAnswers: userAnswersCopy, // Глубокое копирование (используем актуальные ответы)
      questions: questionsCopy // Глубокое копирование
    };
    
    console.log('Saving test results:', {
      correctCount,
      total: questions.length,
      answeredCount,
      percentage,
      userAnswersCount: userAnswersCopy.length,
      questionsCount: questionsCopy.length,
      firstQuestion: questionsCopy[0] ? {
        id: questionsCopy[0].id,
        text: questionsCopy[0].text.substring(0, 30),
        answers: questionsCopy[0].answers.map(a => ({ id: a.id, idType: typeof a.id, correct: a.correct }))
      } : null,
      firstUserAnswer: userAnswersCopy[0]
    });

    // ========== ЭКЗАМЕН: Для экзамена сохраняем результаты отдельно, для теста по теме - в results[selectedTopic.id] ==========
    if (isExamMode) {
      console.log('Сохранение результатов экзамена:', {
        isExamMode,
        examQuestionCount,
        questionsCount: questions.length,
        result: newResult
      });
      
      // Сохраняем результаты экзамена в отдельный ключ
      const examResults = results['exam'] || [];
      const updatedExamResults = [newResult, ...examResults].slice(0, 5);
      
      setResults({ 
        ...results, 
        'exam': updatedExamResults
      });
      
      // Сбрасываем все состояния экзамена
      setTestStartTime(null);
      setElapsedTime(0);
      setExamTimeLimit(null);
      setExamTimeRemaining(null);
      setIsExamMode(false); // Сбрасываем флаг экзамена
      setSelectedExamResult(newResult); // Сохраняем результат для отображения
      
      console.log('Переход на экран результатов экзамена');
      // Показываем экран результатов экзамена
      setScreen('examResult');
    } else {
      // Сохраняем результаты теста по теме (существующая логика)
      // Проверяем, что selectedTopic существует перед использованием
      if (!selectedTopic || !selectedTopic.id) {
        console.error('Ошибка: selectedTopic не определен');
        alert('Ошибка: не выбрана тема для сохранения результатов');
        return;
      }
      
      const topicResults = results[selectedTopic.id] || [];
      const updatedResults = [newResult, ...topicResults].slice(0, 5);
      
      setResults({ 
        ...results, 
        [selectedTopic.id]: updatedResults
      });
      
      setTestStartTime(null);
      setElapsedTime(0);
      setScreen('topicDetail');
      
      // ========== ИИ-ТРЕНЕР: Сохраняем результаты в БД ==========
      // Сохраняем результаты в БД (асинхронно, не блокируем UI)
      saveTestResultsToDatabase(newResult).then(() => {
        console.log('[AI TRAINER] Результаты сохранены в БД');
      }).catch(err => {
        console.error('[AI TRAINER] Ошибка сохранения в БД:', err);
      });
      
      // Сохраняем результат для возможного запроса совета (по кнопке)
      // Не вызываем getAITrainerAdvice автоматически - только по нажатию кнопки
    }
    } catch (error) {
      console.error('Критическая ошибка в saveTestResults:', error);
      alert('Произошла ошибка при сохранении результатов теста. Попробуйте еще раз.');
      // Сбрасываем состояния даже при ошибке, чтобы пользователь мог продолжить работу
      setTestStartTime(null);
      setElapsedTime(0);
      if (isExamMode) {
        setIsExamMode(false);
        setExamTimeLimit(null);
        setExamTimeRemaining(null);
        setScreen('examSelect');
      } else {
        setScreen('topics');
      }
    }
  }

  const handleExitTest = () => {
    // ========== ЭКЗАМЕН: Разные сообщения для экзамена и теста ==========
    const message = isExamMode 
      ? 'Вы уверены, что хотите выйти из экзамена? Результаты будут сохранены.'
      : 'Вы уверены, что хотите выйти из теста? Результаты будут сохранены.';
    
    if (confirm(message)) {
      try {
        saveTestResults();
      } catch (error) {
        console.error('Ошибка при выходе из теста:', error);
        alert('Произошла ошибка при сохранении результатов. Попробуйте еще раз.');
      }
    }
  }

  const handleFinishTest = () => {
    // ========== ЭКЗАМЕН: Разные сообщения для экзамена и теста ==========
    const message = isExamMode 
      ? 'Завершить экзамен? Результаты будут сохранены.'
      : 'Завершить тест? Результаты будут сохранены.';
    
    if (confirm(message)) {
      try {
        saveTestResults();
      } catch (error) {
        console.error('Ошибка при завершении теста:', error);
        alert('Произошла ошибка при сохранении результатов. Попробуйте еще раз.');
      }
    }
  }

  const handleAnswerClick = (answerId) => {
    // ========== ЭКЗАМЕН: Блокируем ответы, если время истекло ==========
    if (isExamMode && examTimeRemaining !== null && examTimeRemaining === 0) {
      return;
    }
    if (isAnswered) return
    setSelectedAnswer(answerId)
    setIsAnswered(true)
    
    // Используем сохраненные вопросы теста
    const questions = testQuestions.length > 0 ? testQuestions : getMergedQuestions(selectedTopic.id)
    const question = questions[currentQuestionIndex]
    
    if (!question) return
    
    // Находим выбранный ответ
    const answer = question.answers.find(a => {
      // Сравниваем с учетом возможных различий типов
      return a.id === answerId || 
             String(a.id) === String(answerId) ||
             (Number(a.id) === Number(answerId) && !isNaN(Number(a.id)) && !isNaN(Number(answerId)))
    })
    
    if (!answer) {
      console.error('Answer not found!', {
        answerId: answerId,
        answerIdType: typeof answerId,
        questionAnswers: question.answers.map(a => ({ id: a.id, idType: typeof a.id }))
      });
      return;
    }
    
    // Используем ID из найденного ответа, чтобы гарантировать правильный тип
    const savedAnswerId = answer.id;
    
    // Проверяем правильность ответа
    const isCorrect = answer.correct === true;
    
    if (isCorrect) {
      setCorrectAnswersCount(prev => prev + 1)
    }
    
    // Сохраняем ответ пользователя с ID из объекта ответа
    const updatedAnswers = [...userAnswers];
    updatedAnswers[currentQuestionIndex] = {
      questionId: question.id,
      selectedAnswerId: savedAnswerId, // Используем ID из объекта ответа
      isCorrect: isCorrect
    };
    
    // Отладочная информация
    console.log('Answer clicked:', {
      questionIndex: currentQuestionIndex,
      questionId: question.id,
      clickedAnswerId: answerId,
      clickedAnswerIdType: typeof answerId,
      savedAnswerId: savedAnswerId,
      savedAnswerIdType: typeof savedAnswerId,
      answer: {
        id: answer.id,
        idType: typeof answer.id,
        text: answer.text.substring(0, 30),
        correct: answer.correct
      },
      allAnswerIds: question.answers.map(a => ({ id: a.id, idType: typeof a.id, correct: a.correct })),
      isCorrect: isCorrect,
      savedAnswer: updatedAnswers[currentQuestionIndex]
    });
    
    setUserAnswers(updatedAnswers);
    // Обновляем референс синхронно
    userAnswersRef.current = updatedAnswers;
    
    // Дополнительная отладка - проверяем, что ответ действительно сохранился
    console.log('After saving answer - updatedAnswers:', {
      currentIndex: currentQuestionIndex,
      savedAnswer: updatedAnswers[currentQuestionIndex],
      allAnswers: updatedAnswers.map((a, i) => ({
        index: i,
        answer: a,
        hasData: a !== undefined && a !== null
      }))
    });
    
    // Автоматический переход к следующему вопросу ТОЛЬКО при правильном ответе
    // Если ответ неправильный, тест не переходит к следующему вопросу
    if (isCorrect) {
    const isLastQuestion = currentQuestionIndex + 1 >= questions.length;
    
    if (!isLastQuestion) {
        // Небольшая пауза, чтобы пользователь успел увидеть подсветку правильного ответа
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
      }, 400);
    } else {
      // Если это был последний вопрос, проверяем, все ли вопросы отвечены,
      // и при желании пользователя завершаем тест
      setTimeout(() => {
        const allAnswered = questions.every((q, idx) => 
          updatedAnswers[idx] !== undefined && updatedAnswers[idx] !== null
        );
        
        if (allAnswered) {
          setTimeout(() => {
            if (confirm('Все вопросы отвечены! Завершить тест?')) {
              saveTestResults();
            }
          }, 400);
        }
      }, 150);
    }
    }
    // Если ответ неправильный, тест остается на текущем вопросе
  }

  const handleNext = () => {
    const questions = getMergedQuestions(selectedTopic.id)
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setSelectedAnswer(null)
      setIsAnswered(false)
    } else {
      const finalTime = Math.floor((Date.now() - testStartTime) / 1000);
      const percentage = Math.round((correctAnswersCount / questions.length) * 100);
      const resultId = `ID${selectedTopic.id}${String(Date.now()).slice(-6)}`;
      const dateTime = new Date().toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).replace(',', '');
      
      const formatTimeSpent = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0 && secs > 0) {
          return `${mins} ${mins === 1 ? 'минута' : mins < 5 ? 'минуты' : 'минут'} ${secs} ${secs === 1 ? 'секунда' : secs < 5 ? 'секунды' : 'секунд'}`;
        } else if (mins > 0) {
          return `${mins} ${mins === 1 ? 'минута' : mins < 5 ? 'минуты' : 'минут'}`;
        } else {
          return `${secs} ${secs === 1 ? 'секунда' : secs < 5 ? 'секунды' : 'секунд'}`;
        }
      };
      
      const newResult = {
        id: resultId,
        correct: correctAnswersCount,
        total: questions.length,
        percentage: percentage,
        time: finalTime,
        timeFormatted: formatTime(finalTime),
        timeSpent: formatTimeSpent(finalTime),
        dateTime: dateTime,
        userAnswers: userAnswers, // Сохраняем все ответы пользователя
        questions: questions // Сохраняем вопросы для просмотра
      };

      // Сохраняем максимум 5 результатов
      const topicResults = results[selectedTopic.id] || [];
      const updatedResults = [newResult, ...topicResults].slice(0, 5);
      
      setResults({ 
        ...results, 
        [selectedTopic.id]: updatedResults
      })
      setTestStartTime(null);
      setElapsedTime(0);
      setScreen('topicDetail')
    }
  }

  const getButtonClass = (answerId) => {
    if (!isAnswered) return 'answer-button'
    const questions = getMergedQuestions(selectedTopic.id)
    const question = questions[currentQuestionIndex]
    const answer = question.answers.find(a => a.id === answerId)
    if (answer && answer.correct) {
      return 'answer-button correct'
    } else if (answerId === selectedAnswer) {
      return 'answer-button incorrect'
    }
    return 'answer-button disabled'
  }

  // Admin functions
  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    
    // Валидация формы
    if (!questionForm.text.trim()) {
      alert('Пожалуйста, введите текст вопроса');
      return;
    }
    
    // Проверяем, что есть минимум 2 ответа
    if (questionForm.answers.length < 2) {
      alert('Минимум должно быть 2 варианта ответа!');
      return;
    }
    
    // Проверяем, что все ответы заполнены
    const emptyAnswers = questionForm.answers.filter(a => !a.text.trim());
    if (emptyAnswers.length > 0) {
      alert('Пожалуйста, заполните все варианты ответов');
      return;
    }
    
    // Проверяем, что выбран правильный ответ
    const hasCorrectAnswer = questionForm.answers.some(a => a.id === questionForm.correct);
    if (!hasCorrectAnswer) {
      alert('Пожалуйста, выберите правильный ответ');
      return;
    }
    
    // Обрабатываем изображение
    let imageUrl = questionForm.imageUrl || null;
    
    // Если загружен новый файл, загружаем его в Supabase Storage
    if (questionForm.imageFile) {
      try {
        // Загружаем изображение в Storage
        const uploadedUrl = await uploadImageToStorage(questionForm.imageFile, editingQuestion?.id);
        imageUrl = uploadedUrl;
        
        // Если обновляем вопрос и было старое изображение, удаляем его
        if (editingQuestion && editingQuestion.image_url && editingQuestion.image_url !== imageUrl) {
          await deleteImageFromStorage(editingQuestion.image_url);
        }
      } catch (error) {
        console.error('Ошибка загрузки изображения:', error);
        alert('Ошибка при загрузке изображения. Вопрос будет сохранен без изображения.');
        imageUrl = null;
      }
    } else if (editingQuestion && !imageUrl && editingQuestion.image_url) {
      // Если удалили изображение при редактировании, удаляем из Storage
      await deleteImageFromStorage(editingQuestion.image_url);
      imageUrl = null;
    }
    
    // Сохраняем вопрос с URL изображения из Storage
    saveQuestion(imageUrl);
  };

  // Функция для сохранения вопроса (imageUrl теперь всегда URL из Storage)
  const saveQuestion = (imageUrl) => {
    const questionData = buildQuestionData(imageUrl);
    saveQuestionToStorage(questionData);
  };

  // Функция для построения данных вопроса
  const buildQuestionData = (imageUrl) => {
    // Преобразуем массив answers в формат для сохранения
    const answersMap = {};
    questionForm.answers.forEach((answer, index) => {
      const key = String.fromCharCode(97 + index); // a, b, c, d, e...
      const answerText = answer.text ? answer.text.trim() : '';
      if (answerText) {
        answersMap[`answer_${key}`] = answerText;
      }
    });
    
    const questionData = {
      question: questionForm.text.trim(),
      ...answersMap,
      correct: questionForm.correct,
      image_url: imageUrl,
      topic_id: questionForm.topicId,
      answers_count: questionForm.answers.filter(a => a.text && a.text.trim()).length
    };
    
    console.log('buildQuestionData: созданы данные вопроса:', {
      question: questionData.question,
      answersMap: answersMap,
      correct: questionData.correct,
      answers_count: questionData.answers_count
    });
    
    return questionData;
  };

  // Функция для сохранения вопроса в Supabase (с опциями)
  const saveQuestionToStorage = async (questionData) => {
    console.log('Сохранение вопроса в Supabase:', questionData);

    try {
      // Проверяем и преобразуем topic_id
      let quizId = questionData.topic_id;
      
      // Если topic_id это число, но база ожидает UUID, нужно найти UUID темы
      if (typeof quizId === 'number' || (typeof quizId === 'string' && /^\d+$/.test(quizId))) {
        console.warn('⚠️ topic_id это число, но база может ожидать UUID. Ищем тему...');
        // Ищем тему по ID
        const topic = topics.find(t => t.id === quizId || String(t.id) === String(quizId));
        if (topic) {
          quizId = topic.id; // Используем ID темы как есть (может быть UUID)
          console.log('✅ Найдена тема, используем ID:', quizId, typeof quizId);
        } else {
          console.error('❌ Тема не найдена для topic_id:', questionData.topic_id);
          alert('Ошибка: Тема не найдена. Пожалуйста, выберите тему из списка.');
          return;
        }
      }
      
      // Подготавливаем данные для таблицы questions
      const questionSupabaseData = {
        quiz_id: quizId, // Используем правильный ID (UUID или число)
        question_text: questionData.question,
        image_url: questionData.image_url || null,
        explanation: null // Можно добавить позже
      };
      
      console.log('Данные для сохранения вопроса:', questionSupabaseData);

      let questionId;
      if (editingQuestion) {
        // Обновляем существующий вопрос
        const { data, error } = await supabase
          .from('questions')
          .update(questionSupabaseData)
          .eq('id', editingQuestion.id)
          .select()
          .single();

        if (error) {
          console.error('Ошибка обновления вопроса в Supabase:', error);
          alert('Ошибка при обновлении вопроса: ' + error.message);
          return;
        }
        questionId = data.id;
        
        // Удаляем старые опции
        await supabase
          .from('options')
          .delete()
          .eq('question_id', questionId);
      } else {
        // Создаем новый вопрос
        const { data, error } = await supabase
          .from('questions')
          .insert(questionSupabaseData)
          .select()
          .single();

        if (error) {
          console.error('Ошибка добавления вопроса в Supabase:', error);
          alert('Ошибка при добавлении вопроса: ' + error.message);
          return;
        }
        questionId = data.id;
      }

      // Сохраняем опции (ответы)
      const optionsToInsert = [];
      const answerKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      
      console.log('🔍 Проверка данных вопроса для сохранения опций:', {
        questionId: questionId,
        questionDataKeys: Object.keys(questionData),
        answerKeys: answerKeys.map(key => ({
          key: key,
          value: questionData[`answer_${key}`],
          exists: questionData.hasOwnProperty(`answer_${key}`),
          isCorrect: questionData.correct === key
        }))
      });
      
      answerKeys.forEach((key, index) => {
        const answerText = questionData[`answer_${key}`];
        if (answerText && String(answerText).trim() !== '') {
          const option = {
            question_id: questionId,
            option_text: String(answerText).trim(),
            is_correct: questionData.correct === key
          };
          optionsToInsert.push(option);
          console.log(`  ✅ Добавлена опция ${key}:`, option);
        } else {
          console.log(`  ⚠️ Опция ${key} пустая или отсутствует`);
        }
      });

      console.log('💾 Сохранение опций для вопроса:', questionId, 'Количество опций:', optionsToInsert.length);
      console.log('📦 Опции для сохранения:', JSON.stringify(optionsToInsert, null, 2));

      if (optionsToInsert.length > 0) {
        const { data: insertedOptions, error: optionsError } = await supabase
          .from('options')
          .insert(optionsToInsert)
          .select();

        if (optionsError) {
          console.error('❌ Ошибка сохранения опций в Supabase:', optionsError);
          console.error('Детали ошибки:', {
            message: optionsError.message,
            details: optionsError.details,
            hint: optionsError.hint,
            code: optionsError.code
          });
          alert('Вопрос сохранен, но произошла ошибка при сохранении ответов: ' + optionsError.message);
        } else {
          console.log('✅ Опции успешно сохранены:', insertedOptions);
          console.log('📊 Сохранено опций:', insertedOptions ? insertedOptions.length : 0);
          if (insertedOptions && insertedOptions.length > 0) {
            console.log('📋 Сохраненные опции:', insertedOptions.map(opt => ({
              id: opt.id,
              question_id: opt.question_id,
              option_text: opt.option_text,
              is_correct: opt.is_correct
            })));
            
            // Проверяем, что опции действительно сохранены в базе
            const { data: verifyOptions, error: verifyError } = await supabase
              .from('options')
              .select('*')
              .eq('question_id', questionId)
              .limit(100); // Лимит для опций одного вопроса (обычно не больше 8)
            
            if (verifyError) {
              console.error('❌ Ошибка проверки сохраненных опций:', verifyError);
            } else {
              console.log('✅ Проверка: в базе данных найдено опций для вопроса:', verifyOptions ? verifyOptions.length : 0);
              if (verifyOptions && verifyOptions.length > 0) {
                console.log('📋 Опции в базе данных:', verifyOptions.map(opt => ({
                  id: opt.id,
                  question_id: opt.question_id,
                  option_text: opt.option_text,
                  is_correct: opt.is_correct
                })));
              } else {
                console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Опции не найдены в базе данных после сохранения!');
              }
            }
          }
        }
      } else {
        console.error('❌ Нет опций для сохранения для вопроса:', questionId);
        console.error('🔍 Данные вопроса:', questionData);
        console.error('📝 Форма вопроса:', {
          answers: questionForm.answers,
          correct: questionForm.correct
        });
        alert('Ошибка: Вопрос сохранен, но варианты ответов не были найдены! Проверьте консоль для деталей.');
      }

      console.log('✅ Вопрос успешно сохранен в Supabase:', questionId);
      
      // Небольшая задержка, чтобы база данных успела обработать запрос
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Перезагружаем вопросы из Supabase
      console.log('🔄 Перезагрузка вопросов из Supabase...');
      await loadQuestionsFromSupabase();
      
      // Обновляем количество вопросов в квизе
      await updateTopicQuestionCount(quizId);
      
      alert(editingQuestion ? 'Вопрос успешно обновлен!' : 'Вопрос успешно добавлен!');
      
      // Если редактировали вопрос, возвращаемся к списку
      if (editingQuestion) {
      resetQuestionForm();
      setEditingQuestion(null);
        if (adminSelectedTopic) {
        setAdminScreen('topicQuestions');
      } else {
        setAdminScreen('list');
        }
      } else {
        // Если добавляли новый вопрос, очищаем форму, но оставляем её открытой
        // Сохраняем текущую тему перед сбросом
        const currentTopicId = questionForm.topicId;
        resetQuestionForm();
        // Восстанавливаем тему после сброса
        setQuestionForm(prev => ({
          ...prev,
          topicId: currentTopicId
        }));
        // Форма остается открытой (adminScreen остается 'add')
        // Фокус на текстовое поле вопроса для удобства
        setTimeout(() => {
          const textarea = document.querySelector('textarea[placeholder*="Текст вопроса"]');
          if (textarea) {
            textarea.focus();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Ошибка сохранения вопроса:', error);
      alert('Произошла ошибка при сохранении вопроса: ' + error.message);
    }
  };

  // Функция для обновления количества вопросов в квизе
  const updateTopicQuestionCount = async (quizId) => {
    try {
      const { count, error } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('quiz_id', quizId);

      if (!error && count !== null && count !== undefined) {
        // Обновляем локальное состояние (в таблице quizzes нет поля question_count, но мы обновляем локально)
        setTopics(prevTopics => 
          prevTopics.map(t => 
            t.id === quizId ? { ...t, questionCount: count } : t
          )
        );
      }
    } catch (err) {
      console.error('Ошибка обновления количества вопросов:', err);
    }
  };

  const handleFormChange = (field, value) => {
    setQuestionForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Сохраняем последнюю выбранную тему в localStorage
    if (field === 'topicId') {
      try {
        localStorage.setItem('lastSelectedTopicId', String(value));
      } catch (e) {
        console.error('Ошибка сохранения последней темы:', e);
      }
    }
  };

  // Функция для изменения ответа в массиве
  const handleAnswerChange = (index, field, value) => {
    setQuestionForm(prev => {
      const newAnswers = [...prev.answers];
      newAnswers[index] = { ...newAnswers[index], [field]: value };
      return { ...prev, answers: newAnswers };
    });
  };

  // Функция для добавления нового варианта ответа
  const handleAddAnswer = () => {
    setQuestionForm(prev => {
      const newId = String.fromCharCode(97 + prev.answers.length); // a, b, c, d, e, f...
      return {
        ...prev,
        answers: [...prev.answers, { id: newId, text: '', correct: false }]
      };
    });
  };

  // Функция для удаления варианта ответа
  const handleRemoveAnswer = (index) => {
    if (questionForm.answers.length <= 2) {
      alert('Минимум должно быть 2 варианта ответа!');
      return;
    }
    
    setQuestionForm(prev => {
      const newAnswers = prev.answers.filter((_, i) => i !== index);
      // Обновляем ID ответов
      const updatedAnswers = newAnswers.map((answer, i) => ({
        ...answer,
        id: String.fromCharCode(97 + i)
      }));
      
      // Если удалили правильный ответ, выбираем первый
      let newCorrect = prev.correct;
      if (prev.correct === prev.answers[index].id) {
        newCorrect = updatedAnswers[0].id;
      } else {
        // Обновляем correct на новый ID
        const oldIndex = prev.answers.findIndex(a => a.id === prev.correct);
        if (oldIndex > index) {
          newCorrect = updatedAnswers[oldIndex - 1].id;
        } else {
          newCorrect = updatedAnswers[oldIndex].id;
        }
      }
      
      return {
        ...prev,
        answers: updatedAnswers,
        correct: newCorrect
      };
    });
  };

  // Функция для оптимизации изображения (сжатие и конвертация)
  const optimizeImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Вычисляем новые размеры с сохранением пропорций
            if (width > height) {
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
              }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Пытаемся конвертировать в WebP, если не поддерживается - используем JPEG
            const tryWebP = () => {
              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    resolve(blob);
                  } else {
                    // Fallback на JPEG, если WebP не поддерживается
                    canvas.toBlob(
                      (jpegBlob) => {
                        if (jpegBlob) {
                          resolve(jpegBlob);
                        } else {
                          reject(new Error('Ошибка оптимизации изображения'));
                        }
                      },
                      'image/jpeg',
                      quality
                    );
                  }
                },
                'image/webp',
                quality
              );
            };

            tryWebP();
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  };

  // Функция для загрузки изображения в Supabase Storage
  const uploadImageToStorage = async (file, questionId = null) => {
    try {
      // Оптимизируем изображение перед загрузкой
      const optimizedBlob = await optimizeImage(file);
      
      // Определяем расширение файла на основе типа blob
      const fileExt = optimizedBlob.type === 'image/webp' ? 'webp' : 'jpg';
      
      // Генерируем уникальное имя файла
      const fileName = questionId 
        ? `questions/${questionId}.${fileExt}`
        : `questions/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Загружаем в Supabase Storage (bucket: 'question-images')
      const { data, error } = await supabase.storage
        .from('question-images')
        .upload(fileName, optimizedBlob, {
          cacheControl: '3600',
          upsert: true, // Перезаписываем, если файл существует
          contentType: optimizedBlob.type
        });

      if (error) {
        console.error('Ошибка загрузки изображения в Storage:', error);
        throw error;
      }

      // Получаем публичный URL изображения
      const { data: urlData } = supabase.storage
        .from('question-images')
        .getPublicUrl(fileName);

      console.log('✅ Изображение загружено в Storage:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (err) {
      console.error('Ошибка при загрузке изображения:', err);
      throw err;
    }
  };

  // Функция для удаления изображения из Storage
  const deleteImageFromStorage = async (imageUrl) => {
    try {
      // Не удаляем base64 изображения (старые данные)
      if (!imageUrl || imageUrl.startsWith('data:image/') || imageUrl.startsWith('blob:')) {
        return;
      }

      // Проверяем, что это URL из нашего Storage
      if (!imageUrl.includes('/storage/v1/object/public/question-images/')) {
        return;
      }

      // Извлекаем путь к файлу из URL
      // URL формат: https://xxx.supabase.co/storage/v1/object/public/question-images/questions/xxx.webp
      const urlParts = imageUrl.split('/question-images/');
      if (urlParts.length < 2) return;

      const filePath = urlParts[1].split('?')[0]; // Убираем query параметры
      if (!filePath) return;

      const { error } = await supabase.storage
        .from('question-images')
        .remove([filePath]);

      if (error) {
        console.warn('Ошибка удаления изображения из Storage:', error);
      } else {
        console.log('✅ Изображение удалено из Storage:', filePath);
      }
    } catch (err) {
      console.warn('Ошибка при удалении изображения:', err);
    }
  };

  // Функция для загрузки изображения
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверяем тип файла
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите файл изображения!');
        return;
      }
      
      // Проверяем размер файла (макс 10MB до оптимизации)
      if (file.size > 10 * 1024 * 1024) {
        alert('Размер файла не должен превышать 10MB!');
        return;
      }
      
      // Создаем URL для предпросмотра
      const imageUrl = URL.createObjectURL(file);
      
      setQuestionForm(prev => ({
        ...prev,
        imageFile: file,
        imageUrl: imageUrl
      }));
    }
  };

  // Функция для удаления изображения
  const handleRemoveImage = () => {
    if (questionForm.imageUrl && questionForm.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(questionForm.imageUrl);
    }
    setQuestionForm(prev => ({
      ...prev,
      imageFile: null,
      imageUrl: ''
    }));
  };

  // Функция для сброса формы вопроса
  const resetQuestionForm = () => {
    if (questionForm.imageUrl && questionForm.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(questionForm.imageUrl);
    }
    
    // Загружаем последнюю выбранную тему из localStorage
    let savedTopicId = null;
    try {
      const saved = localStorage.getItem('lastSelectedTopicId');
      if (saved) {
        // Проверяем, что сохраненная тема существует в списке тем
        const topicExists = topics && topics.some(t => String(t.id) === String(saved));
        if (topicExists) {
          savedTopicId = saved;
        }
      }
    } catch (e) {
      console.error('Ошибка чтения последней темы:', e);
    }
    
    // Используем сохраненную тему или первую доступную
    const defaultTopicId = savedTopicId 
      ? (typeof savedTopicId === 'string' && /^\d+$/.test(savedTopicId) ? Number(savedTopicId) : savedTopicId)
      : (topics && topics.length > 0 ? topics[0].id : 1);
    
    setQuestionForm({
      text: '',
      answers: [
        { id: 'a', text: '', correct: false },
        { id: 'b', text: '', correct: false },
        { id: 'c', text: '', correct: false },
        { id: 'd', text: '', correct: false }
      ],
      correct: 'a',
      imageUrl: '',
      imageFile: null,
      topicId: defaultTopicId
    });
  };

  // Инициализация формы при переходе на экран добавления вопроса
  useEffect(() => {
    if (adminScreen === 'add' && !editingQuestion) {
      // Проверяем, что форма не инициализирована или имеет старый формат
      if (!Array.isArray(questionForm.answers) || questionForm.answers.length === 0) {
        // Загружаем последнюю выбранную тему из localStorage
        let savedTopicId = null;
        try {
          const saved = localStorage.getItem('lastSelectedTopicId');
          if (saved) {
            // Проверяем, что сохраненная тема существует в списке тем
            const topicExists = topics && topics.some(t => String(t.id) === String(saved));
            if (topicExists) {
              savedTopicId = saved;
            }
          }
        } catch (e) {
          console.error('Ошибка чтения последней темы:', e);
        }
        
        // Используем сохраненную тему или первую доступную
        const defaultTopicId = savedTopicId 
          ? (typeof savedTopicId === 'string' && /^\d+$/.test(savedTopicId) ? Number(savedTopicId) : savedTopicId)
          : (topics && topics.length > 0 ? topics[0].id : 1);
        
        setQuestionForm({
          text: '',
          answers: [
            { id: 'a', text: '', correct: false },
            { id: 'b', text: '', correct: false },
            { id: 'c', text: '', correct: false },
            { id: 'd', text: '', correct: false }
          ],
          correct: 'a',
          imageUrl: '',
          imageFile: null,
          topicId: defaultTopicId
        });
      } else {
        // Если форма уже инициализирована, но мы открыли форму добавления,
        // загружаем последнюю выбранную тему
        let savedTopicId = null;
        try {
          const saved = localStorage.getItem('lastSelectedTopicId');
          if (saved) {
            const topicExists = topics && topics.some(t => String(t.id) === String(saved));
            if (topicExists) {
              savedTopicId = saved;
            }
          }
        } catch (e) {
          console.error('Ошибка чтения последней темы:', e);
        }
        
        if (savedTopicId) {
          const topicId = typeof savedTopicId === 'string' && /^\d+$/.test(savedTopicId) 
            ? Number(savedTopicId) 
            : savedTopicId;
          setQuestionForm(prev => ({
            ...prev,
            topicId: topicId
          }));
        }
      }
    }
  }, [adminScreen, editingQuestion, topics]);

  // Функция для переключения темы вручную
  const toggleTheme = () => {
    let newTheme;
    if (manualTheme === null) {
      // Если был авто-режим, переключаем на противоположный текущему
      newTheme = isDarkMode ? 'light' : 'dark';
    } else {
      // Переключаем между light и dark
      newTheme = manualTheme === 'dark' ? 'light' : 'dark';
    }
    
    // Сохраняем выбранную тему в localStorage
    try {
      localStorage.setItem('app_theme', newTheme);
    } catch (e) {
      console.error('Ошибка сохранения темы в localStorage:', e);
    }
    
    setManualTheme(newTheme);
    document.body.setAttribute('data-theme', newTheme);
    setIsDarkMode(newTheme === 'dark');
  };

  // Компонент переключения темы
  const ThemeToggleButton = () => {
    // Используем React Portal для рендеринга кнопки напрямую в body
    const buttonElement = (
      <button
        className="theme-toggle-button"
        onClick={toggleTheme}
        title={isDarkMode ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
        aria-label={isDarkMode ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 10001,
          pointerEvents: 'auto'
        }}
      >
        <div className="theme-icon-container">
          {/* Sun icon */}
          <svg
            className={`theme-icon theme-icon-sun ${isDarkMode ? 'hidden' : 'visible'}`}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          {/* Moon icon */}
          <svg
            className={`theme-icon theme-icon-moon ${isDarkMode ? 'visible' : 'hidden'}`}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </div>
      </button>
    );
    
    // Рендерим кнопку напрямую в body через Portal, чтобы она была закреплена относительно viewport
    if (typeof document !== 'undefined' && document.body) {
      return createPortal(buttonElement, document.body);
    }
    
    return buttonElement;
  };

  // Определение тарифов
  const tariffs = [
    {
      id: 'test',
      name: 'Тест',
      price: 15000,
      days: 7,
      features: ['Доступ ко всем вопросам', 'Без рекламы', 'ИИ: 7 запросов в любом режиме'],
      aiLimits: {
        hintsInTests: 7, // Лимит подсказок в тестах
        otherUsage: 7, // Лимит использования в других местах
        unlimited: false
      },
      color: 'border-gray-600'
    },
    {
      id: 'standard',
      name: 'Базовый',
      price: 35000,
      days: 20,
      features: ['Выгоднее на 15%', 'Полная статистика', 'ИИ: подсказки в тестах без лимита', 'ИИ: 10 запросов в других местах'],
      aiLimits: {
        hintsInTests: -1, // -1 означает без ограничений
        otherUsage: 10,
        unlimited: false
      },
      color: 'border-blue-500'
    },
    {
      id: 'pro',
      name: 'PRO Максимум',
      price: 49000,
      days: 45,
      features: ['ХИТ ПРОДАЖ 🔥', 'Максимальная выгода', 'Приоритетная поддержка', 'ИИ: без ограничений'],
      aiLimits: {
        hintsInTests: -1,
        otherUsage: -1,
        unlimited: true
      },
      isRecommended: true,
      color: 'border-yellow-500 shadow-yellow-900/20'
    }
  ];

  // ========== СИСТЕМА ЛИМИТОВ ИИ ==========
  // Получение текущего тарифа пользователя
  const getCurrentTariff = () => {
    // Проверяем активную подписку и определяем тариф
    if (!subscriptionInfo || !subscriptionInfo.active) {
      return null; // Нет активной подписки
    }
    
    // Получаем информацию о подписке из payment_requests для определения тарифа
    // Пока используем дефолтный тариф "test" если не можем определить
    // TODO: Добавить поле tariff_id в таблицу subscriptions
    return tariffs.find(t => t.id === 'test') || null;
  };

  // Проверка, является ли подписка пробной (3 дня и создана недавно)
  const isTrialSubscription = () => {
    if (!subscriptionInfo || !subscriptionInfo.active || !subscriptionInfo.subscriptionExpiresAt) {
      return false;
    }
    
    const endDate = new Date(subscriptionInfo.subscriptionExpiresAt);
    const now = new Date();
    const daysDiff = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    // Пробная подписка: 3 дня и создана недавно (в течение последних 3 дней)
    // Проверяем, что до окончания подписки осталось примерно 3 дня или меньше
    return daysDiff <= 3 && daysDiff > 0;
  };

  // Получение лимитов ИИ для текущего тарифа
  const getAILimits = () => {
    // Сначала проверяем, является ли подписка пробной
    if (isTrialSubscription()) {
      // Для пробного периода: 4 запроса ИИ в любом режиме
      return { hintsInTests: 4, otherUsage: 4, unlimited: false };
    }
    
    const tariff = getCurrentTariff();
    if (!tariff || !tariff.aiLimits) {
      // Если нет подписки, лимиты очень строгие
      return { hintsInTests: 0, otherUsage: 0, unlimited: false };
    }
    return tariff.aiLimits;
  };

  // Загрузка счетчика использования ИИ из базы данных (с fallback на localStorage)
  // Лимиты привязаны к подписке и не обновляются до окончания подписки
  const loadAIUsageCount = async (subscriptionEndDate = null) => {
    try {
      // Используем переданный subscriptionEndDate или берем из состояния
      const currentSubscriptionEndDate = subscriptionEndDate || subscriptionInfo?.subscriptionExpiresAt || null;
      
      // Если нет userId, используем localStorage как fallback
      if (!userId) {
        console.log('[AI_COUNTER] Нет userId, используем localStorage');
        const saved = localStorage.getItem('ai_usage_count');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (!currentSubscriptionEndDate || parsed.subscriptionEndDate !== currentSubscriptionEndDate) {
            return { hints: 0, other: 0 };
          }
          return { hints: parsed.hints || 0, other: parsed.other || 0 };
        }
        return { hints: 0, other: 0 };
      }
      
      // Если нет активной подписки, возвращаем 0
      if (!currentSubscriptionEndDate) {
        console.log('[AI_COUNTER] Нет активной подписки, возвращаем 0');
        return { hints: 0, other: 0 };
      }
      
      // Загружаем из базы данных
      const { data, error } = await supabase
        .from('ai_usage_counter')
        .select('hints_count, other_count, subscription_end_date')
        .eq('user_id', userId)
        .eq('subscription_end_date', currentSubscriptionEndDate)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('[AI_COUNTER] Ошибка загрузки из БД:', error);
        // Fallback на localStorage
        const saved = localStorage.getItem('ai_usage_count');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.subscriptionEndDate === currentSubscriptionEndDate) {
            return { hints: parsed.hints || 0, other: parsed.other || 0 };
          }
        }
        return { hints: 0, other: 0 };
      }
      
      if (data) {
        console.log('[AI_COUNTER] Загружено из БД:', data);
        // Проверяем, не истекла ли подписка
        const subscriptionEnd = new Date(currentSubscriptionEndDate);
        const now = new Date();
        if (subscriptionEnd < now) {
          console.log('[AI_COUNTER] Подписка истекла, возвращаем 0');
          return { hints: 0, other: 0 };
        }
        return { hints: data.hints_count || 0, other: data.other_count || 0 };
      }
      
      // Если записи нет в БД, проверяем localStorage
      console.log('[AI_COUNTER] Записи нет в БД, проверяем localStorage');
      const saved = localStorage.getItem('ai_usage_count');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.subscriptionEndDate === currentSubscriptionEndDate) {
          // Мигрируем данные из localStorage в БД
          await saveAIUsageCount({ hints: parsed.hints || 0, other: parsed.other || 0 }, currentSubscriptionEndDate);
          return { hints: parsed.hints || 0, other: parsed.other || 0 };
        }
      }
      
      return { hints: 0, other: 0 };
    } catch (e) {
      console.error('[AI_COUNTER] Ошибка загрузки счетчика ИИ:', e);
      // Fallback на localStorage
      const saved = localStorage.getItem('ai_usage_count');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { hints: parsed.hints || 0, other: parsed.other || 0 };
      }
      return { hints: 0, other: 0 };
    }
  };

  // Сохранение счетчика использования ИИ в базу данных (с fallback на localStorage)
  // Сохраняем вместе с end_date подписки для проверки актуальности
  const saveAIUsageCount = async (count, subscriptionEndDate = null) => {
    try {
      const currentSubscriptionEndDate = subscriptionEndDate || subscriptionInfo?.subscriptionExpiresAt || null;
      const dataToSave = {
        subscriptionEndDate: currentSubscriptionEndDate,
        hints: count.hints || 0,
        other: count.other || 0
      };
      
      // Сохраняем в localStorage как fallback
      localStorage.setItem('ai_usage_count', JSON.stringify(dataToSave));
      console.log('[AI_COUNTER] Сохранено в localStorage:', dataToSave);
      
      // Если нет userId, только localStorage
      if (!userId) {
        console.log('[AI_COUNTER] Нет userId, сохраняем только в localStorage');
        return;
      }
      
      // Если нет активной подписки, только localStorage
      if (!currentSubscriptionEndDate) {
        console.log('[AI_COUNTER] Нет активной подписки, сохраняем только в localStorage');
        return;
      }
      
      // Сохраняем в базу данных (upsert - обновляем если есть, создаем если нет)
      const { data, error } = await supabase
        .from('ai_usage_counter')
        .upsert({
          user_id: userId,
          subscription_end_date: currentSubscriptionEndDate,
          hints_count: count.hints || 0,
          other_count: count.other || 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,subscription_end_date'
        })
        .select()
        .single();
      
      if (error) {
        console.error('[AI_COUNTER] Ошибка сохранения в БД:', error);
        // Продолжаем работу с localStorage
      } else {
        console.log('[AI_COUNTER] Сохранено в БД:', data);
      }
    } catch (e) {
      console.error('[AI_COUNTER] Ошибка сохранения счетчика ИИ:', e);
      // Продолжаем работу с localStorage
    }
  };

  // Проверка лимита ИИ перед использованием
  const checkAILimit = async (isHintInTest = false) => {
    // ВАЖНО: Принудительно загружаем актуальные данные из БД перед проверкой
    // Не используем состояние, так как оно может быть устаревшим
    const limits = getAILimits();
    
    // Загружаем данные напрямую из БД, не используя кэш
    const currentSubscriptionEndDate = subscriptionInfo?.subscriptionExpiresAt || null;
    let usage = { hints: 0, other: 0 };
    
    if (userId && currentSubscriptionEndDate) {
      try {
        // Загружаем напрямую из БД
        const { data, error } = await supabase
          .from('ai_usage_counter')
          .select('hints_count, other_count, subscription_end_date')
          .eq('user_id', userId)
          .eq('subscription_end_date', currentSubscriptionEndDate)
          .maybeSingle(); // Используем maybeSingle вместо single, чтобы не было ошибки если записи нет
        
        if (!error && data) {
          usage = { hints: data.hints_count || 0, other: data.other_count || 0 };
          console.log('[AI_LIMIT] Загружено из БД для проверки:', usage);
        } else if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows returned, это нормально
          console.error('[AI_LIMIT] Ошибка загрузки из БД:', error);
        } else {
          // Записи нет в БД (PGRST116) - это нормально, используем fallback
          console.log('[AI_LIMIT] Записи нет в БД, используем fallback');
          // Fallback на localStorage
          const saved = localStorage.getItem('ai_usage_count');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.subscriptionEndDate === currentSubscriptionEndDate) {
              usage = { hints: parsed.hints || 0, other: parsed.other || 0 };
              console.log('[AI_LIMIT] Загружено из localStorage для проверки:', usage);
            }
          }
        }
      } catch (e) {
        console.error('[AI_LIMIT] Ошибка загрузки для проверки:', e);
        // Fallback на localStorage
        const saved = localStorage.getItem('ai_usage_count');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.subscriptionEndDate === currentSubscriptionEndDate) {
            usage = { hints: parsed.hints || 0, other: parsed.other || 0 };
          }
        }
      }
    } else {
      // Fallback на localStorage
      const saved = localStorage.getItem('ai_usage_count');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.subscriptionEndDate === currentSubscriptionEndDate) {
          usage = { hints: parsed.hints || 0, other: parsed.other || 0 };
        }
      }
    }
    
    console.log('[AI_LIMIT] checkAILimit вызван:', {
      isHintInTest,
      limits,
      usage,
      isTrial: isTrialSubscription(),
      subscriptionEndDate: currentSubscriptionEndDate
    });
    
    // PRO Максимум - без ограничений
    if (limits.unlimited) {
      console.log('[AI_LIMIT] Без ограничений (PRO)');
      return { allowed: true, remaining: -1 };
    }
    
    // Для пробной подписки: общий лимит 4 запроса (суммируем все использования)
    if (isTrialSubscription()) {
      const totalUsed = usage.hints + usage.other;
      const remaining = 4 - totalUsed;
      
      // СТРОГАЯ ПРОВЕРКА: если remaining <= 0, то НЕ разрешаем
      if (remaining <= 0) {
        console.log('[AI_LIMIT] ⛔ ЛИМИТ ИСЧЕРПАН ДЛЯ ПРОБНОЙ ПОДПИСКИ! Блокируем запрос.');
        console.log('[AI_LIMIT] Детали:', { 
          totalUsed, 
          remaining, 
          allowed: false,
          willBlock: true,
          hints: usage.hints,
          other: usage.other
        });
        return { allowed: false, remaining: 0 };
      }
      
      const allowed = true; // remaining > 0, значит разрешено
      console.log('[AI_LIMIT] Пробная подписка:', { 
        totalUsed, 
        remaining, 
        allowed,
        willBlock: false,
        hints: usage.hints,
        other: usage.other
      });
      
      return { allowed: true, remaining: Math.max(0, remaining) };
    }
    
    if (isHintInTest) {
      // Подсказка в тесте
      if (limits.hintsInTests === -1) {
        // Без ограничений для подсказок в тестах (Базовый тариф)
        console.log('[AI_LIMIT] Без ограничений для подсказок в тестах');
        return { allowed: true, remaining: -1 };
      }
      const remaining = limits.hintsInTests - usage.hints;
      
      // СТРОГАЯ ПРОВЕРКА: если remaining <= 0, то НЕ разрешаем
      if (remaining <= 0) {
        console.log('[AI_LIMIT] ⛔ ЛИМИТ ИСЧЕРПАН ДЛЯ ПОДСКАЗОК В ТЕСТЕ! Блокируем запрос.');
        console.log('[AI_LIMIT] Детали:', { 
          limit: limits.hintsInTests, 
          used: usage.hints, 
          remaining,
          willBlock: true
        });
        return { allowed: false, remaining: 0 };
      }
      
      const allowed = true; // remaining > 0, значит разрешено
      console.log('[AI_LIMIT] Подсказка в тесте:', { 
        limit: limits.hintsInTests, 
        used: usage.hints, 
        remaining, 
        allowed,
        willBlock: false
      });
      
      return { allowed: true, remaining: Math.max(0, remaining) };
    } else {
      // Использование в других местах
      if (limits.otherUsage === -1) {
        console.log('[AI_LIMIT] Без ограничений для других использований');
        return { allowed: true, remaining: -1 };
      }
      const remaining = limits.otherUsage - usage.other;
      
      // СТРОГАЯ ПРОВЕРКА: если remaining <= 0, то НЕ разрешаем
      if (remaining <= 0) {
        console.log('[AI_LIMIT] ⛔ ЛИМИТ ИСЧЕРПАН! Блокируем запрос.');
        console.log('[AI_LIMIT] Детали:', { 
          limit: limits.otherUsage, 
          used: usage.other, 
          remaining,
          willBlock: true
        });
        return { allowed: false, remaining: 0 };
      }
      
      const allowed = true; // remaining > 0, значит разрешено
      console.log('[AI_LIMIT] Другие использования:', { 
        limit: limits.otherUsage, 
        used: usage.other, 
        remaining, 
        allowed,
        willBlock: false
      });
      
      return { allowed: true, remaining: Math.max(0, remaining) };
    }
  };

  // Увеличение счетчика использования ИИ
  const incrementAIUsage = async (isHintInTest = false) => {
    console.log('[AI_COUNTER] ========== incrementAIUsage вызван ==========');
    console.log('[AI_COUNTER] Параметры: isHintInTest =', isHintInTest);
    console.log('[AI_COUNTER] subscriptionInfo:', subscriptionInfo);
    
    const usage = await loadAIUsageCount();
    console.log('[AI_COUNTER] Загруженное использование:', usage);
    const beforeCount = { ...usage };
    
    if (isHintInTest) {
      usage.hints += 1;
      console.log('[AI_COUNTER] Увеличиваем hints:', beforeCount.hints, '->', usage.hints);
    } else {
      usage.other += 1;
      console.log('[AI_COUNTER] Увеличиваем other:', beforeCount.other, '->', usage.other);
    }
    
    const subscriptionEndDate = subscriptionInfo?.subscriptionExpiresAt || null;
    console.log('[AI_COUNTER] subscriptionEndDate:', subscriptionEndDate);
    
    await saveAIUsageCount(usage, subscriptionEndDate);
    
    // Обновляем состояние сразу после сохранения
    // Создаем новый объект, чтобы React увидел изменение
    const newState = { hints: Number(usage.hints), other: Number(usage.other) };
    console.log('[AI_COUNTER] Обновляем состояние aiUsageCount на:', newState);
    
    // Обновляем состояние с помощью функционального обновления для гарантии
    setAiUsageCount(prev => {
      const updated = { hints: Number(usage.hints), other: Number(usage.other) };
      console.log('[AI_COUNTER] setAiUsageCount callback: обновляем с', JSON.stringify(prev), 'на', JSON.stringify(updated));
      return updated;
    });
    
    // Принудительно обновляем состояние через setTimeout для гарантии
    setTimeout(async () => {
      const updated = await loadAIUsageCount();
      console.log('[AI_COUNTER] Проверка после обновления, загружено из БД/localStorage:', updated);
      setAiUsageCount(prev => {
        const newUpdated = { hints: Number(updated.hints) || 0, other: Number(updated.other) || 0 };
        console.log('[AI_COUNTER] setTimeout setAiUsageCount: обновляем с', prev, 'на', newUpdated);
        return newUpdated;
      });
    }, 50);
    console.log('[AI_COUNTER] Сохранено:', usage, 'для подписки:', subscriptionEndDate);
    console.log('[AI_COUNTER] ========== incrementAIUsage завершен ==========');
    
    return usage;
  };

  // Инициализация счетчика использования ИИ
  const [aiUsageCount, setAiUsageCount] = useState({ hints: 0, other: 0 });
  
  // Загружаем счетчик при инициализации и изменении подписки
  useEffect(() => {
    const loadCounter = async () => {
      const count = await loadAIUsageCount();
      console.log('[AI_COUNTER] Загрузка счетчика (useEffect):', count);
      setAiUsageCount(count);
    };
    
    if (subscriptionInfo || userId) {
      loadCounter();
    }
  }, [subscriptionInfo?.subscriptionExpiresAt, userId]);

  // Функция для сохранения запроса на оплату в Supabase
  const handlePaymentRequest = async (tariff, senderInfo) => {
    try {
      const tgUser = initTelegramWebAppSafe();
      const userId = tgUser?.id ? Number(tgUser.id) : null;

      if (!userId) {
        alert('Ошибка: не удалось получить ID пользователя');
        return;
      }

      // Устанавливаем статус обработки и открываем модальное окно подписки сразу
      setIsPaymentProcessing(true);
      // Сохраняем статус в localStorage
      try {
        localStorage.setItem('payment_processing', 'true');
      } catch (e) {
        console.error('Ошибка сохранения статуса обработки:', e);
      }
      setShowPaymentModal(false);
      setShowSubscriptionModal(true);
      setShowTariffSelection(false);

      const { error } = await supabase
        .from('payment_requests')
        .insert({
          user_id: userId,
          tariff_name: tariff.name,
          amount: String(tariff.price),
          sender_info: senderInfo,
          status: 'pending'
        });

      if (error) {
        console.error('Ошибка сохранения запроса на оплату:', error);
        alert('Ошибка при сохранении запроса на оплату: ' + error.message);
        setIsPaymentProcessing(false);
        // Удаляем статус из localStorage при ошибке
        try {
          localStorage.removeItem('payment_processing');
        } catch (e) {
          console.error('Ошибка удаления статуса обработки:', e);
        }
        return;
      }

      // Отправляем уведомление в Telegram (не блокируем процесс, если не удалось)
      try {
        const notifyUrl = `${BACKEND_URL}/api/notify/payment`;
        const requestBody = {
          amount: tariff.price,
          tariffName: tariff.name,
          userInfo: senderInfo,
          userId: userId
        };
        
        console.log('📤 Отправка уведомления в Telegram:', {
          url: notifyUrl,
          backendUrl: BACKEND_URL,
          tariffId: tariff.id,
          tariffName: tariff.name,
          amount: tariff.price,
          userId: userId,
          requestBody: requestBody
        });

        const notifyResponse = await fetch(notifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        console.log('📥 Ответ от сервера уведомлений:', {
          status: notifyResponse.status,
          statusText: notifyResponse.statusText,
          ok: notifyResponse.ok,
          headers: Object.fromEntries(notifyResponse.headers.entries())
        });

        if (!notifyResponse.ok) {
          const errorText = await notifyResponse.text();
          console.error('❌ Ошибка отправки уведомления:', {
            status: notifyResponse.status,
            statusText: notifyResponse.statusText,
            error: errorText,
            tariffId: tariff.id,
            tariffName: tariff.name
          });
          // Показываем предупреждение в консоли, но не блокируем процесс
          console.warn('⚠️ Уведомление не отправлено, но запрос на оплату сохранен');
        } else {
          const result = await notifyResponse.json();
          console.log('✅ Уведомление отправлено успешно:', {
            result: result,
            tariffId: tariff.id,
            tariffName: tariff.name
          });
        }
      } catch (notifyError) {
        console.error('❌ Критическая ошибка отправки уведомления:', {
          error: notifyError,
          message: notifyError?.message,
          stack: notifyError?.stack,
          tariffId: tariff.id,
          tariffName: tariff.name,
          userId: userId
        });
        // Не блокируем процесс оплаты из-за ошибки уведомления
        // Но логируем детально для отладки
      }

      alert('Запрос на оплату успешно отправлен! Мы проверим платеж и активируем подписку в ближайшее время.');
      setSelectedTariff(null);
      setPaymentSenderInfo('');
      // Статус обработки остается true, чтобы показывать "Данные в обработке" в статусе подписки
    } catch (err) {
      console.error('Ошибка при сохранении запроса на оплату:', err);
      alert('Произошла ошибка при отправке запроса на оплату');
      setIsPaymentProcessing(false);
      // Удаляем статус из localStorage при ошибке
      try {
        localStorage.removeItem('payment_processing');
      } catch (e) {
        console.error('Ошибка удаления статуса обработки:', e);
      }
    }
  };

  // Компонент модального окна оплаты
  const PaymentModal = () => {
    const inputRef = useRef(null);
    const overlayRef = useRef(null);
    const isInputFocusedRef = useRef(false);
    const [localPaymentSenderInfo, setLocalPaymentSenderInfo] = useState('');

    // Синхронизируем локальное состояние с глобальным при открытии модального окна
    useEffect(() => {
      if (showPaymentModal && selectedTariff) {
        setLocalPaymentSenderInfo(paymentSenderInfo || '');
      }
    }, [showPaymentModal, selectedTariff]);

    if (!selectedTariff || !showPaymentModal) return null;

    const handleCopyCardNumber = () => {
      navigator.clipboard.writeText('9860 3501 4622 7235').then(() => {
        alert('Номер карты скопирован!');
      }).catch(() => {
        alert('Не удалось скопировать номер карты');
      });
    };

    const handleInputChange = useCallback((e) => {
      const value = e.target.value;
      setLocalPaymentSenderInfo(value);
      // НЕ обновляем глобальное состояние при каждом изменении, только при отправке
    }, []);

    const handleInputFocus = () => {
      isInputFocusedRef.current = true;
    };

    const handleInputBlur = () => {
      // Небольшая задержка, чтобы проверить, не перешел ли фокус на другой элемент модального окна
      setTimeout(() => {
        if (document.activeElement !== inputRef.current) {
          isInputFocusedRef.current = false;
        }
      }, 100);
    };

    const handleOverlayClick = useCallback((e) => {
      // Закрываем модальное окно только если клик был именно на overlay (e.target === e.currentTarget)
      // НЕ закрываем, если input в фокусе (пользователь вводит текст)
      if (e.target === e.currentTarget && !isInputFocusedRef.current && document.activeElement !== inputRef.current) {
        setSelectedTariff(null);
        setPaymentSenderInfo('');
        setShowPaymentModal(false);
      setPaymentModalAnimated(false); // Сбрасываем флаг анимации при закрытии
      }
    }, []);

    return (
      <div 
        ref={overlayRef}
        className="payment-modal-overlay" 
        onClick={handleOverlayClick}
        onMouseDown={(e) => {
          // Предотвращаем закрытие при клике на overlay во время ввода
          if (e.target === e.currentTarget && document.activeElement === inputRef.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div 
          className="payment-modal-content"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="payment-modal-header">
            <h2 className="payment-modal-title">Оплата тарифа {selectedTariff.name}</h2>
            <button className="payment-modal-close" onClick={() => {
              setSelectedTariff(null);
              setPaymentSenderInfo('');
              setShowPaymentModal(false);
            }}>
              ✕
            </button>
          </div>

          <div className="payment-modal-body">
            <p className="payment-modal-text">
              Переведите <strong>{(selectedTariff.price / 1000).toFixed(0)} 000 сум</strong> на карту:
            </p>
            
            <div className="payment-card-number-container">
              <div className="payment-card-number" onClick={handleCopyCardNumber}>
                9860 3501 4622 7235
              </div>
              <button className="payment-copy-button" onClick={handleCopyCardNumber}>
                Копировать
              </button>
            </div>

            <div className="payment-input-group">
              <label className="payment-input-label">
                Ваше имя или последние 4 цифры карты
              </label>
              <input
                ref={inputRef}
                type="text"
                className="payment-input"
                placeholder="Введите имя или 4 цифры карты"
                value={localPaymentSenderInfo}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                autoFocus
              />
            </div>

            <div className="payment-modal-actions">
              <button
                className="payment-confirm-button"
                onClick={async () => {
                  console.log('🔘 Кнопка "Я оплатил" нажата:', {
                    tariffId: selectedTariff?.id,
                    tariffName: selectedTariff?.name,
                    price: selectedTariff?.price,
                    senderInfo: localPaymentSenderInfo
                  });
                  setPaymentSenderInfo(localPaymentSenderInfo);
                  try {
                    await handlePaymentRequest(selectedTariff, localPaymentSenderInfo);
                  } catch (error) {
                    console.error('❌ Ошибка в handlePaymentRequest:', error);
                    alert('Произошла ошибка при отправке запроса на оплату. Проверьте консоль для деталей.');
                  }
                }}
                disabled={!localPaymentSenderInfo.trim()}
              >
                ✅ Я оплатил
              </button>
              <button
                className="payment-cancel-button"
                onClick={() => {
                  setSelectedTariff(null);
                  setPaymentSenderInfo('');
                  setShowPaymentModal(false);
      setPaymentModalAnimated(false); // Сбрасываем флаг анимации при закрытии
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Компонент выбора тарифа
  const TariffSelection = () => {
    return (
      <div className="tariff-selection-container-compact">
        <div className="tariff-carousel">
          {tariffs.map((tariff) => (
            <div
              key={tariff.id}
              className={`tariff-card-compact ${tariff.isRecommended ? 'tariff-card-pro' : ''}`}
              onClick={() => {
                setSelectedTariff(tariff);
                setShowTariffSelection(false);
                setTimeout(() => {
                  setShowSubscriptionModal(false);
                  setShowPaymentModal(true);
                }, 50);
              }}
            >
              {tariff.isRecommended && (
                <div className="tariff-badge-compact">ХИТ 🔥</div>
              )}
              <div className="tariff-name-compact">{tariff.name}</div>
              <div className="tariff-price-compact">
                {(tariff.price / 1000).toFixed(0)} 000
              </div>
              <div className="tariff-currency">сум</div>
              <div className="tariff-duration-compact">за {tariff.days} дней</div>
              <ul className="tariff-features-compact">
                {tariff.features.map((feature, index) => (
                  <li key={index} className="tariff-feature-compact">
                    <span className="tariff-feature-icon-compact">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button className={`tariff-button-compact ${tariff.isRecommended ? 'tariff-button-pro' : ''}`}>
                Купить
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Компонент статуса подписки (глобальный)
  const SubscriptionStatusBadge = () => {
    if (userRole === 'admin' || loading || userRole === null) return null;

    const isActive = hasActiveSubscription();
    // Используем состояние напрямую из aiUsageCount
    // Создаем ключ для отслеживания изменений
    const usageKey = `${aiUsageCount?.hints || 0}-${aiUsageCount?.other || 0}`;
    const [renderKey, setRenderKey] = useState(0);
    
    // Синхронизируем при изменении aiUsageCount
    // Используем отдельные значения для отслеживания изменений
    const hintsValue = aiUsageCount?.hints || 0;
    const otherValue = aiUsageCount?.other || 0;
    
    useEffect(() => {
      console.log('[AI_COUNTER] ========== SubscriptionStatusBadge useEffect ==========');
      console.log('[AI_COUNTER] aiUsageCount изменился:', aiUsageCount);
      console.log('[AI_COUNTER] hintsValue:', hintsValue, 'otherValue:', otherValue);
      console.log('[AI_COUNTER] usageKey:', usageKey);
      console.log('[AI_COUNTER] Текущий renderKey:', renderKey);
      // Принудительно обновляем компонент
      const newKey = renderKey + 1;
      console.log('[AI_COUNTER] Устанавливаем новый renderKey:', newKey);
      setRenderKey(newKey);
    }, [hintsValue, otherValue]);
    
    // Используем состояние напрямую
    const currentUsage = aiUsageCount;
    
    // Отладочная информация
    console.log('[AI_COUNTER] ========== SubscriptionStatusBadge render ==========');
    console.log('[AI_COUNTER] currentUsage (localUsage):', currentUsage);
    console.log('[AI_COUNTER] aiUsageCount state:', aiUsageCount);
    const loadedFromStorage = loadAIUsageCount();
    console.log('[AI_COUNTER] Загружено из localStorage:', loadedFromStorage);
    
    // Определяем, что показывать: корона, часы или замок
    const showCrown = isActive;
    const showClock = !isActive && isPaymentProcessing;
    const showLock = !isActive && !isPaymentProcessing;

    const fullElement = (
      <>
        <div
          key={`subscription-badge-${usageKey}-${renderKey}`}
          className="subscription-status-badge"
          onClick={() => setShowSubscriptionModal(true)}
          title={(() => {
            if (!isActive) return 'Подписка неактивна';
            const limits = getAILimits();
            const usage = currentUsage;
            if (limits.unlimited) return 'ИИ: без ограничений';
            const totalLimit = isTrialSubscription() ? 4 : (limits.hintsInTests === -1 ? limits.otherUsage : limits.hintsInTests);
            const totalUsed = isTrialSubscription() ? (usage.hints + usage.other) : (limits.hintsInTests === -1 ? usage.other : usage.hints);
            const remaining = totalLimit - totalUsed;
            return `ИИ: ${remaining} из ${totalLimit}`;
          })()}
        >
          {showCrown ? (
            <div className="subscription-badge-active" style={{ position: 'relative' }}>
              <svg
                className="subscription-badge-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Crown icon */}
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
                <path d="M12 18l-1-4 1-4 1 4-1 4z" />
              </svg>
              {(() => {
                const limits = getAILimits();
                const usage = currentUsage;
                if (limits.unlimited) return null;
                const totalLimit = isTrialSubscription() ? 4 : (limits.hintsInTests === -1 ? limits.otherUsage : limits.hintsInTests);
                const totalUsed = isTrialSubscription() ? (usage.hints + usage.other) : (limits.hintsInTests === -1 ? usage.other : usage.hints);
                const remaining = totalLimit - totalUsed;
                if (remaining <= 0) return null;
                return (
                  <span style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    backgroundColor: remaining <= 2 ? '#f44336' : '#4CAF50',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    minWidth: '20px',
                    textAlign: 'center',
                    lineHeight: '1.2',
                    zIndex: 10000
                  }}>
                    {remaining}
                  </span>
                );
              })()}
            </div>
          ) : showClock ? (
            <div className="subscription-badge-inactive">
              <svg
                className="subscription-badge-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Clock icon */}
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          ) : showLock ? (
            <div className="subscription-badge-inactive">
              <svg
                className="subscription-badge-icon"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Lock icon for no subscription */}
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          ) : null}
        </div>

        {showSubscriptionModal && (
          <div className="subscription-modal-overlay" onClick={() => {
            setShowSubscriptionModal(false);
            setShowTariffSelection(false);
          }}>
            <div className="subscription-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="subscription-modal-header">
                <h2 className="subscription-modal-title">Статус подписки</h2>
                <button className="subscription-modal-close" onClick={() => {
                  setShowSubscriptionModal(false);
                  setShowTariffSelection(false);
                }}>
                  ✕
                </button>
              </div>

              <div className="subscription-modal-body">
                {showTariffSelection ? (
                  <>
                    <button 
                      className="tariff-back-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTariffSelection(false);
                      }}
                    >
                      ← Назад
                    </button>
                    <TariffSelection />
                  </>
                ) : isPaymentProcessing ? (
                  <>
                    <div className="subscription-status-card processing">
                      <div className="subscription-status-icon-large">
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {/* Clock icon */}
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <h3 className="subscription-status-title">Данные в обработке</h3>
                      <p className="subscription-status-description">
                        Ваш запрос на оплату обрабатывается. Мы проверим платеж и активируем подписку в ближайшее время.
                      </p>
                    </div>
                  </>
                ) : hasActiveSubscription() ? (
                  <>
                    <div className="subscription-status-card active">
                      <div className="subscription-status-icon-large">
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {/* Crown icon */}
                          <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z" />
                          <path d="M12 18l-1-4 1-4 1 4-1 4z" />
                        </svg>
                      </div>
                      <h3 className="subscription-status-title">Подписка активна</h3>
                      <div className="subscription-details">
                        <div className="subscription-detail-item">
                          <span className="subscription-detail-label">Действует до:</span>
                          <span className="subscription-detail-value">
                            {subscriptionInfo?.subscriptionExpiresAt
                              ? new Date(subscriptionInfo.subscriptionExpiresAt).toLocaleDateString('ru-RU', {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric'
                                })
                              : '—'}
                          </span>
                        </div>
                        {getSubscriptionTimeRemaining() && (
                          <div className="subscription-detail-item">
                            <span className="subscription-detail-label">Осталось:</span>
                            <span className="subscription-detail-value highlight">
                              {getSubscriptionTimeRemaining()}
                            </span>
                          </div>
                        )}
                        {(() => {
                          const limits = getAILimits();
                          const usage = aiUsageCount;
                          if (limits.unlimited) {
                            return (
                              <div className="subscription-detail-item">
                                <span className="subscription-detail-label">ИИ запросы:</span>
                                <span className="subscription-detail-value highlight" style={{ color: '#4CAF50' }}>
                                  Без ограничений
                                </span>
                      </div>
                            );
                          }
                          // Для пробной подписки и других тарифов показываем общий лимит
                          const totalLimit = isTrialSubscription() ? 4 : (limits.hintsInTests === -1 ? limits.otherUsage : limits.hintsInTests);
                          const totalUsed = isTrialSubscription() ? (usage.hints + usage.other) : (limits.hintsInTests === -1 ? usage.other : usage.hints);
                          const remaining = totalLimit - totalUsed;
                          return (
                            <div className="subscription-detail-item">
                              <span className="subscription-detail-label">ИИ запросы:</span>
                              <span className="subscription-detail-value highlight" style={{ color: remaining > 0 ? '#4CAF50' : '#f44336' }}>
                                {remaining > 0 ? `Осталось ${remaining} из ${totalLimit}` : `Лимит исчерпан (${totalLimit})`}
                              </span>
                    </div>
                          );
                        })()}
                      </div>
                    </div>
                    <button className="subscription-renew-button" onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      // Показываем секцию выбора тарифов
                      setShowTariffSelection(true);
                    }}>
                      Продлить подписку
                    </button>
                  </>
                ) : (
                  <>
                    <div className="subscription-status-card inactive">
                      <div className="subscription-status-icon-large">⚠</div>
                      <h3 className="subscription-status-title">Подписка неактивна</h3>
                      <p className="subscription-status-description">
                        Для прохождения тестов и экзаменов необходима активная подписка.
                      </p>
                    </div>
                    <TariffSelection />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Модальное окно оплаты - рендерится везде, где есть SubscriptionStatusBadge */}
        <PaymentModal />
      </>
    );
    
    // Рендерим бейдж напрямую в body через Portal, чтобы он был закреплен относительно viewport
    if (typeof document !== 'undefined' && document.body) {
      return createPortal(fullElement, document.body);
    }
    
    return fullElement;
  };

  // Компонент модального окна поздравления (рендерится через Portal)
  const WelcomeModal = () => {
    // Проверяем, что мы в браузере и document.body доступен
    if (typeof document === 'undefined' || !document.body) {
      return null;
    }
    
    // Всегда рендерим через Portal, чтобы окно было доступно на всех экранах
    try {
      return createPortal(
        <>
          {showWelcomeModal && (
            <div className="welcome-modal-overlay" onClick={() => {
              console.log('Закрываем окно поздравления');
              setShowWelcomeModal(false);
            }}>
              <div className="welcome-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="welcome-modal-header">
                  <h2 className="welcome-modal-title">🎉 Поздравляем!</h2>
                  <button className="welcome-modal-close" onClick={() => {
                    console.log('Закрываем окно поздравления через кнопку');
                    setShowWelcomeModal(false);
                  }}>
                    ✕
                  </button>
        </div>
                <div className="welcome-modal-body">
                  <div className="welcome-icon">🎊</div>
                  <h3 className="welcome-subtitle">Регистрация успешна!</h3>
                  <p className="welcome-description">
                    Вам предоставлена <strong>бесплатная</strong> пробная подписка на <strong>{trialDays} {trialDays === 1 ? 'день' : trialDays < 5 ? 'дня' : 'дней'}</strong>
                  </p>
                  <p className="welcome-description">
                    Начните изучать правила дорожного движения прямо сейчас!
                  </p>
                  <button 
                    className="welcome-button"
                    onClick={() => {
                      console.log('Закрываем окно поздравления через кнопку "Начать обучение"');
                      setShowWelcomeModal(false);
                    }}
                  >
                    Начать обучение
                  </button>
      </div>
              </div>
            </div>
          )}
          {showConfetti && <Confetti />}
        </>,
        document.body
      );
    } catch (error) {
      console.error('Ошибка при рендеринге WelcomeModal:', error);
      return null;
    }
  };

  // Компонент конфетти
  const Confetti = () => {
    useEffect(() => {
      if (!showConfetti) return;
      
      // Проверяем, что document и window доступны
      if (typeof document === 'undefined' || typeof window === 'undefined') return;
      
      const canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '10000';
      
      if (!document.body) return;
      
      document.body.appendChild(canvas);
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        document.body.removeChild(canvas);
        return;
      }
      
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const confetti = [];
      const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
      
      // Создаем конфетти с двух сторон
      for (let i = 0; i < 100; i++) {
        confetti.push({
          x: Math.random() < 0.5 ? Math.random() * 200 : window.innerWidth - Math.random() * 200, // Слева или справа
          y: -10,
          r: Math.random() * 6 + 4,
          d: Math.random() * 100 + 50,
          color: colors[Math.floor(Math.random() * colors.length)],
          tilt: Math.random() * 10 - 5,
          tiltAngleIncrement: Math.random() * 0.07 + 0.05,
          tiltAngle: 0
        });
      }
      
      let animationId;
      const animate = () => {
        if (!ctx || !canvas) return;
        
        try {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          confetti.forEach((c, i) => {
            ctx.beginPath();
            ctx.lineWidth = c.r / 2;
            ctx.strokeStyle = c.color;
            ctx.moveTo(c.x + c.tilt + c.r, c.y);
            ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r);
            ctx.stroke();
            
            c.tiltAngle += c.tiltAngleIncrement;
            c.y += (Math.cos(c.d) + 1 + c.r / 2) / 2;
            c.x += Math.sin(c.d);
            c.tilt = Math.sin(c.tiltAngle) * 15;
            
            if (c.y > canvas.height) {
              confetti[i] = {
                x: Math.random() < 0.5 ? Math.random() * 200 : window.innerWidth - Math.random() * 200,
                y: -10,
                r: c.r,
                d: c.d,
                color: c.color,
                tilt: Math.random() * 10 - 5,
                tiltAngleIncrement: c.tiltAngleIncrement,
                tiltAngle: 0
              };
            }
          });
          
          animationId = requestAnimationFrame(animate);
        } catch (error) {
          console.error('Ошибка в анимации конфетти:', error);
          if (animationId) {
            cancelAnimationFrame(animationId);
          }
        }
      };
      
      animate();
      
      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        if (canvas && document.body && document.body.contains(canvas)) {
          try {
            document.body.removeChild(canvas);
          } catch (error) {
            console.error('Ошибка при удалении canvas:', error);
          }
        }
      };
    }, [showConfetti]);
    
    return null;
  };

  if (loading || userRole === null) {
    return <LoadingScreen />;
  }

  // Show admin panel only for admin users (when screen is 'admin')
  if ((userRole === 'admin' || isAdmin) && screen === 'admin') {
    // Экран управления темами
    if (adminScreen === 'addTopic') {
      return (
        <div className="admin-container">
          <div className="admin-content">
            <div className="admin-header">
              <button 
                className="back-button"
                onClick={() => {
                  setAdminScreen('list');
                  setNewTopicName('');
                  handleCancelEditTopic();
                }}
              >
                ← Назад
              </button>
              <h1 className="admin-title">Управление темами</h1>
            </div>

            {/* Форма добавления новой темы */}
            <div className="topic-form-section">
              <h3 className="topic-form-title">Добавить новую тему</h3>
              <form onSubmit={handleAddTopic} className="admin-form">
                <div className="form-group">
                  <label>Название темы *</label>
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    className="form-input"
                    placeholder="Введите название темы"
                    required
                  />
                </div>
                <button type="submit" className="admin-submit-button">
                  Добавить тему
                </button>
              </form>
            </div>

            {/* Список существующих тем */}
            <div className="topics-management-section">
              <h3 className="topics-management-title">Существующие темы ({topics.length}):</h3>
              {topics.length === 0 ? (
                <p className="no-topics-message">Темы не добавлены</p>
              ) : (
                <div className="topics-management-list">
                  {topics.map((topic, index) => (
                    <div key={topic.id} className="topic-management-item">
                      {editingTopicId === topic.id ? (
                        // Режим редактирования
                        <div className="topic-edit-form">
                          <input
                            type="text"
                            className="topic-edit-input"
                            value={editingTopicName}
                            onChange={(e) => setEditingTopicName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEditTopic();
                              } else if (e.key === 'Escape') {
                                handleCancelEditTopic();
                              }
                            }}
                            autoFocus
                          />
                          <div className="topic-edit-actions">
                            <button 
                              className="topic-action-button topic-save-button"
                              onClick={handleSaveEditTopic}
                              title="Сохранить"
                            >
                              ✓
                            </button>
                            <button 
                              className="topic-action-button topic-cancel-button"
                              onClick={handleCancelEditTopic}
                              title="Отмена"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Обычный режим отображения
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                          className={`topic-management-item-draggable ${draggedTopicIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                        >
                          <div className="topic-management-info">
                            <div className="topic-drag-handle">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="9" cy="5" r="1" fill="currentColor"/>
                                <circle cx="9" cy="12" r="1" fill="currentColor"/>
                                <circle cx="9" cy="19" r="1" fill="currentColor"/>
                                <circle cx="15" cy="5" r="1" fill="currentColor"/>
                                <circle cx="15" cy="12" r="1" fill="currentColor"/>
                                <circle cx="15" cy="19" r="1" fill="currentColor"/>
                              </svg>
                            </div>
                            <span className="topic-management-number">{index + 1}.</span>
                            <span className="topic-management-name">{topic.name}</span>
                          </div>
                          <div className="topic-management-actions">
                            <button 
                              className="topic-action-button topic-edit-button"
                              onClick={() => handleStartEditTopic(topic)}
                              title="Редактировать"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button 
                              className="topic-action-button topic-delete-button"
                              onClick={() => handleDeleteTopic(topic)}
                              title="Удалить"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    // Admin topic questions screen
    if (adminScreen === 'topicQuestions' && adminSelectedTopic) {
      const staticQuestions = questionsData[adminSelectedTopic.id] || [];
      const topicSavedQuestions = savedQuestions.filter(q => q.topic_id === adminSelectedTopic.id);
      const allQuestions = [
        ...staticQuestions.map(q => ({ ...q, isStatic: true })),
        ...topicSavedQuestions.map(q => ({
          id: q.id,
          text: q.question,
          image: q.image_url,
          answers: [
            { id: 1, text: q.answer_a, correct: q.correct === 'a' },
            { id: 2, text: q.answer_b, correct: q.correct === 'b' },
            { id: 3, text: q.answer_c, correct: q.correct === 'c' },
            { id: 4, text: q.answer_d, correct: q.correct === 'd' }
          ],
          isStatic: false,
          savedData: q
        }))
      ];

      return (
        <div className="admin-container">
          <div className="admin-content">
            <div className="admin-header">
              <button 
                className="back-button"
                onClick={() => {
                  // Если редактировали вопрос из темы, возвращаемся к списку вопросов темы
        if (adminSelectedTopic && editingQuestion) {
          setAdminScreen('topicQuestions');
        } else {
          setAdminScreen('list');
        }
                  setAdminSelectedTopic(null);
                }}
              >
                ← Назад к темам
              </button>
              <h1 className="admin-title">{adminSelectedTopic.name}</h1>
            </div>

            <div className="admin-stats">
              <p>Всего вопросов: {allQuestions.length}</p>
              <p>Статических: {staticQuestions.length}</p>
              <p>Добавленных: {topicSavedQuestions.length}</p>
            </div>

            <div className="admin-topics-list">
              <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>Вопросы:</h3>
              {allQuestions.length === 0 ? (
                <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  В этой теме пока нет вопросов
                </p>
              ) : (
                allQuestions.map((question, index) => (
                  <div 
                    key={question.id} 
                    className="admin-topic-item" 
                    style={{ 
                      backgroundColor: question.isStatic ? '#f5f5f5' : '#fff3cd', 
                      borderColor: question.isStatic ? '#e0e0e0' : '#ffc107',
                      marginBottom: '10px'
                    }}
                  >
                    <div className="admin-topic-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '10px' }}>
                        <span className="admin-topic-number">{index + 1}.</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600', marginBottom: '5px' }}>
                            {question.text || question.question || 'Вопрос без текста'}
                          </div>
                          {question.image && (
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                              📷 Есть изображение
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                            {question.isStatic ? 'Статический вопрос' : 'Добавленный вопрос'}
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '10px' }}>
                        {!question.isStatic && (
                          <>
                            <button
                              onClick={() => {
                                const savedQ = question.savedData;
                                setEditingQuestion(savedQ);
                                
                                // Преобразуем старый формат в новый (массив answers)
                                const answers = [];
                                const answerKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                                answerKeys.forEach((key, index) => {
                                  const answerText = savedQ[`answer_${key}`];
                                  if (answerText) {
                                    answers.push({
                                      id: key,
                                      text: answerText,
                                      correct: savedQ.correct === key
                                    });
                                  }
                                });
                                
                                // Если нет ответов в старом формате, создаем пустые
                                if (answers.length === 0) {
                                  answers.push(
                                    { id: 'a', text: '', correct: false },
                                    { id: 'b', text: '', correct: false },
                                    { id: 'c', text: '', correct: false },
                                    { id: 'd', text: '', correct: false }
                                  );
                                }
                                
                                setQuestionForm({
                                  text: savedQ.question || '',
                                  answers: answers,
                                  correct: savedQ.correct || answers[0]?.id || 'a',
                                  imageUrl: savedQ.image_url || '',
                                  imageFile: null,
                                  topicId: savedQ.topic_id || adminSelectedTopic.id
                                });
                                setAdminScreen('edit');
                              }}
                              style={{
                                padding: '8px 15px',
                                fontSize: '14px',
                                background: '#2196F3',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                flex: 1
                              }}
                            >
                              Редактировать
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Удалить этот вопрос?')) {
                                  try {
                                    // Удаляем из Supabase
                                    const { error } = await supabase
                                      .from('questions')
                                      .delete()
                                      .eq('id', question.id);

                                    if (error) {
                                      console.error('Ошибка удаления вопроса из Supabase:', error);
                                      alert('Ошибка при удалении вопроса: ' + error.message);
                                      return;
                                    }

                                    // Перезагружаем вопросы из Supabase
                                    await loadQuestionsFromSupabase();
                                    
                                    // Обновляем количество вопросов в теме
                                    if (adminSelectedTopic) {
                                      await updateTopicQuestionCount(adminSelectedTopic.id);
                                    }
                                  } catch (err) {
                                    console.error('Ошибка удаления вопроса:', err);
                                    alert('Произошла ошибка при удалении вопроса');
                                  }
                                }
                              }}
                              style={{
                                padding: '8px 15px',
                                fontSize: '14px',
                                background: '#f44336',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                flex: 1
                              }}
                            >
                              Удалить
                            </button>
                          </>
                        )}
                        {question.isStatic && (
                          <div style={{ padding: '8px 15px', fontSize: '14px', color: '#666', fontStyle: 'italic' }}>
                            Статический вопрос нельзя редактировать
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      );
    }

    if (adminScreen === 'add' || adminScreen === 'edit') {
      // Убеждаемся, что questionForm.answers существует и является массивом
      const safeQuestionForm = {
        ...questionForm,
        answers: Array.isArray(questionForm.answers) && questionForm.answers.length > 0 
          ? questionForm.answers 
          : [
              { id: 'a', text: '', correct: false },
              { id: 'b', text: '', correct: false },
              { id: 'c', text: '', correct: false },
              { id: 'd', text: '', correct: false }
            ],
        correct: questionForm.correct || 'a',
        text: questionForm.text || '',
        imageUrl: questionForm.imageUrl || '',
        imageFile: questionForm.imageFile || null,
        topicId: questionForm.topicId || (topics && topics.length > 0 ? topics[0].id : 1)
      };

      return (
        <div className="admin-container">
          <div className="admin-content">
            <div className="admin-header">
              <button className="back-button" onClick={() => setAdminScreen('list')}>
                ← Назад
              </button>
              <h2 className="admin-title">{adminScreen === 'add' ? 'Добавить вопрос' : 'Редактировать вопрос'}</h2>
            </div>

            <form onSubmit={handleAdminSubmit} className="admin-form">
              <div className="form-group">
                <label>Тема</label>
                <select
                  value={safeQuestionForm.topicId}
                  onChange={(e) => {
                    // Сохраняем значение как есть (может быть UUID или число)
                    const topicId = e.target.value;
                    handleFormChange('topicId', topicId);
                  }}
                  className="form-input"
                >
                  {topics && topics.length > 0 ? topics.map(topic => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  )) : (
                    <option value={1}>Нет тем</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Текст вопроса *</label>
                <textarea
                  value={safeQuestionForm.text}
                  onChange={(e) => handleFormChange('text', e.target.value)}
                  className="form-input"
                  rows="3"
                  required
                />
              </div>

              <div className="form-group">
                <label>Варианты ответов *</label>
                <div className="answers-list">
                  {safeQuestionForm.answers.map((answer, index) => (
                    <div key={answer.id} className="answer-item-form">
                      <div className="answer-letter">{String.fromCharCode(65 + index)}.</div>
                      <div className="answer-content">
                          <input
                            type="text"
                            value={answer.text}
                            onChange={(e) => handleAnswerChange(index, 'text', e.target.value)}
                          className="answer-input"
                            placeholder={`Вариант ответа ${String.fromCharCode(65 + index)}`}
                            required
                          />
                          <label className="correct-answer-checkbox">
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={safeQuestionForm.correct === answer.id}
                              onChange={() => handleFormChange('correct', answer.id)}
                            />
                            <span>Правильный</span>
                          </label>
                      </div>
                          {safeQuestionForm.answers.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveAnswer(index)}
                              className="remove-answer-button"
                              title="Удалить вариант ответа"
                            >
                              ✕
                            </button>
                          )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAddAnswer}
                  className="add-answer-button"
                >
                  + Добавить вариант ответа
                </button>
              </div>

              <div className="form-group">
                <label>Изображение (необязательно)</label>
                {safeQuestionForm.imageUrl ? (
                  <div className="image-preview-container">
                    <img 
                      src={safeQuestionForm.imageUrl} 
                      alt="Предпросмотр" 
                      className="image-preview"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="remove-image-button"
                    >
                      ✕ Удалить изображение
                    </button>
                  </div>
                ) : (
                  <div className="image-upload-container">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="image-file-input"
                      id="image-upload"
                    />
                    <label htmlFor="image-upload" className="image-upload-button">
                      📷 Выбрать изображение из галереи
                    </label>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="admin-submit-button" style={{ flex: 1 }}>
                {adminScreen === 'add' ? 'Добавить вопрос' : 'Сохранить изменения'}
              </button>
                {adminScreen === 'add' && (
                  <button 
                    type="button" 
                    className="admin-submit-button" 
                    onClick={() => {
                      resetQuestionForm();
                      setAdminScreen('list');
                    }}
                    style={{ 
                      flex: 1, 
                      backgroundColor: '#9E9E9E',
                      minWidth: '120px'
                    }}
                  >
                    Готово
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      );
    }

    // Экран просмотра пользователей
    if (adminScreen === 'users') {
      // Функция для получения инициалов
      const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
          return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
      };

      // Функция для получения цвета аватарки
      const getAvatarColor = (userId) => {
        const colors = [
          '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336',
          '#00BCD4', '#8BC34A', '#FF5722', '#673AB7', '#E91E63'
        ];
        const index = parseInt(userId) % colors.length;
        return colors[Math.abs(index)];
      };

      // Фильтрация пользователей по поисковому запросу
      const filteredUsers = usersList.filter(user => {
        if (!userSearchQuery.trim()) return true;
        const query = userSearchQuery.toLowerCase();
        return (
          user.name?.toLowerCase().includes(query) ||
          user.userId?.toString().includes(query) ||
          user.phone?.includes(query) ||
          user.telegramUsername?.toLowerCase().includes(query)
        );
      });

      // Функция для открытия модального окна пользователя
      const handleUserClick = (user) => {
        setSelectedUser(user);
        setShowUserModal(true);
      };

      // Функция для копирования ID
      const handleCopyId = (userId) => {
        navigator.clipboard.writeText(userId.toString());
        alert('ID скопирован в буфер обмена');
      };

      // Функция для выдачи подписки из модального окна
      const handleGrantFromModal = async () => {
        if (!selectedUser) return;
        const days = prompt('Введите количество дней подписки:', '30');
        if (!days || isNaN(Number(days))) return;
        
        setGrantForm({ telegramId: selectedUser.userId, days: days });
        // Имитируем отправку формы
        const fakeEvent = { preventDefault: () => {} };
        await handleGrantSubscription(fakeEvent);
        setShowUserModal(false);
      };
      
      return (
        <div className="admin-container">
          <div className="admin-content">
            <div className="admin-header">
              <button 
                className="back-button"
                onClick={() => setAdminScreen('list')}
              >
                ← Назад
              </button>
              <h1 className="admin-title">Пользователи</h1>
            </div>

            <div className="admin-stats" style={{ marginBottom: '16px' }}>
              <p>Всего: {usersList.length} | С подпиской: {usersList.filter(u => {
                const hasActive = u.subscription?.active && u.subscription.endDate && new Date(u.subscription.endDate) > new Date();
                return hasActive;
              }).length}</p>
            </div>

            {/* Форма выдачи подписки - перемещена наверх */}
            <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--border-color, #e0e0e0)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '600' }}>Выдать подписку</h3>
              <form onSubmit={handleGrantSubscription} className="admin-form" style={{ maxWidth: '100%' }}>
                <div className="form-group">
                  <label>Telegram ID *</label>
                  <input
                    value={grantForm.telegramId}
                    onChange={(ev) => setGrantForm({ ...grantForm, telegramId: ev.target.value })}
                    placeholder="например 473842863"
                  />
                </div>
                <div className="form-group">
                  <label>Дней (по умолчанию 30)</label>
                  <input
                    value={grantForm.days}
                    onChange={(ev) => setGrantForm({ ...grantForm, days: ev.target.value })}
                    placeholder="30"
                  />
                </div>
                <button type="submit" className="admin-submit-button" disabled={grantLoading}>
                  {grantLoading ? 'Выдача...' : 'Выдать подписку'}
                </button>
                {grantMessage && (
                  <p style={{ marginTop: '10px', color: grantMessage.startsWith('Подписка выдана') ? '#2e7d32' : '#f44336' }}>
                    {grantMessage}
                  </p>
                )}
              </form>
            </div>

            {/* Поиск */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="🔍 Поиск по имени, ID, телефону..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="user-search-input"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: 'none',
                  borderRadius: '12px',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="admin-users-button"
                onClick={loadUsersFromSupabase}
                disabled={usersLoading}
                style={{ maxWidth: '200px' }}
              >
                {usersLoading ? 'Загрузка...' : '↻ Обновить'}
              </button>
              {usersError && (
                <p style={{ color: '#f44336', margin: 0, fontSize: '14px' }}>
                  {usersError}
                </p>
              )}
            </div>

            {/* Компактный список пользователей */}
            <div className="users-list-telegram">
              {usersLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Загрузка пользователей...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {userSearchQuery ? 'Пользователи не найдены' : 'Пользователей пока нет'}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const hasActiveSubscription = user.subscription?.active && 
                    user.subscription.endDate && 
                    new Date(user.subscription.endDate) > new Date();
                  const avatarColor = getAvatarColor(user.userId);
                  const initials = getInitials(user.name);

                  return (
                    <div
                      key={user.userId}
                      className="user-list-item"
                      onClick={() => handleUserClick(user)}
                    >
                      <div className="user-avatar" style={{ backgroundColor: avatarColor }}>
                        {initials}
                        </div>
                      <div className="user-info">
                        <div className="user-name">{user.name || 'Без имени'}</div>
                        <div className="user-id">ID: {user.userId}</div>
                        {/* Статус подписки внутри элемента */}
                        <div className="user-subscription-status" style={{ marginTop: '6px', fontSize: '13px' }}>
                          {hasActiveSubscription ? (
                            <span style={{ color: '#4CAF50', fontWeight: '600' }}>
                              ✓ Подписка активна до {new Date(user.subscription.endDate).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
                              Подписка неактивна
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="user-status">
                        {hasActiveSubscription ? (
                            <>
                            <span className="subscription-badge active">PRO</span>
                            <button
                              className="user-revoke-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevokeSubscription(user.userId);
                              }}
                              style={{
                                marginTop: '8px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: '#f44336',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              🗑️ Забрать
                            </button>
                            </>
                          ) : (
                          <span className="subscription-badge inactive">—</span>
                          )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Модальное окно пользователя */}
            {showUserModal && selectedUser && (
              <div className="user-modal-overlay" onClick={() => setShowUserModal(false)}>
                <div className="user-modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="user-modal-header">
                    <div className="user-modal-avatar-large" style={{ backgroundColor: getAvatarColor(selectedUser.userId) }}>
                      {getInitials(selectedUser.name)}
              </div>
                    <h2 className="user-modal-name">{selectedUser.name || 'Без имени'}</h2>
                    <button className="user-modal-close" onClick={() => setShowUserModal(false)}>✕</button>
              </div>

                  <div className="user-modal-body">
                    <div className="user-detail-grid">
                      <div className="user-detail-item">
                        <span className="user-detail-label">Telegram ID</span>
                        <span className="user-detail-value">{selectedUser.userId}</span>
                        </div>
                      <div className="user-detail-item">
                        <span className="user-detail-label">Телефон</span>
                        <span className="user-detail-value">{selectedUser.phone || 'Не указан'}</span>
                        </div>
                      <div className="user-detail-item">
                        <span className="user-detail-label">Дата регистрации</span>
                        <span className="user-detail-value">
                          {new Date(selectedUser.registrationDate).toLocaleDateString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="user-detail-item">
                        <span className="user-detail-label">Последний визит</span>
                        <span className="user-detail-value">
                          {selectedUser.lastVisit 
                            ? new Date(selectedUser.lastVisit).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Не заходил'}
                        </span>
                    </div>
                      <div className="user-detail-item">
                        <span className="user-detail-label">Статус подписки</span>
                        <span className="user-detail-value">
                          {selectedUser.subscription?.active && 
                           selectedUser.subscription.endDate && 
                           new Date(selectedUser.subscription.endDate) > new Date() ? (
                            <span style={{ color: '#4CAF50', fontWeight: '600' }}>
                              Активна до {new Date(selectedUser.subscription.endDate).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Неактивна</span>
                          )}
                        </span>
                  </div>
                  </div>
                  </div>

                  <div className="user-modal-actions">
                    <button
                      className="user-action-button secondary"
                      onClick={() => handleCopyId(selectedUser.userId)}
                    >
                      📋 Копировать ID
                  </button>
                    <button
                      className="user-action-button primary"
                      onClick={handleGrantFromModal}
                    >
                      ✨ Выдать подписку
                    </button>
                    {selectedUser.subscription?.active && 
                     selectedUser.subscription.endDate && 
                     new Date(selectedUser.subscription.endDate) > new Date() && (
                      <button
                        className="user-action-button danger"
                        onClick={() => {
                          if (confirm('Забрать подписку у этого пользователя?')) {
                            handleRevokeSubscription(selectedUser.userId);
                            setShowUserModal(false);
                          }
                        }}
                      >
                        🗑️ Забрать подписку
                      </button>
                    )}
              </div>
            </div>
              </div>
            )}

          </div>
        </div>
      );
    }

    // Экран управления администраторами
    if (adminScreen === 'admins') {
      const tgUser = initTelegramWebAppSafe();
      const currentUserId = tgUser?.id ? Number(tgUser.id) : null;
      const isMainAdmin = currentUserId === 473842863;

      return (
        <div className="admin-container">
          <div className="admin-content">
            <div className="admin-header">
              <button 
                className="back-button"
                onClick={() => setAdminScreen('list')}
              >
                ← Назад
              </button>
              <h1 className="admin-title">Администраторы</h1>
            </div>

            <div className="admin-stats">
              <p>Всего администраторов: {adminsList.length}</p>
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="admin-users-button"
                onClick={loadAdmins}
                disabled={adminsLoading}
                style={{ maxWidth: '200px' }}
              >
                {adminsLoading ? 'Загрузка...' : '↻ Обновить список'}
              </button>
              {adminsError && (
                <p style={{ color: '#f44336', margin: 0, fontSize: '14px' }}>
                  {adminsError}
                </p>
              )}
            </div>

            <div style={{ 
              marginBottom: '32px', 
              padding: '24px', 
              backgroundColor: 'var(--card-bg, #ffffff)', 
              borderRadius: '16px', 
              border: '2px solid var(--border-color, #e0e0e0)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '12px', 
                  backgroundColor: '#2196F3', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '24px'
                }}>
                  👑
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700', color: 'var(--text-color, #1a1a1a)' }}>
                    Добавить администратора
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary, #666)' }}>
                    Введите Telegram ID пользователя для выдачи прав администратора
                  </p>
                </div>
              </div>
              <form onSubmit={handleAddAdmin} className="admin-form" style={{ maxWidth: '100%' }}>
                <div className="form-group">
                  <label style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px', display: 'block', color: 'var(--text-color, #1a1a1a)' }}>
                    Telegram ID *
                  </label>
                  <input
                    value={adminForm.telegramId}
                    onChange={(ev) => setAdminForm({ ...adminForm, telegramId: ev.target.value })}
                    placeholder="например 123456789"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: '16px',
                      border: '2px solid var(--input-border, #E0E0E0)',
                      borderRadius: '12px',
                      backgroundColor: 'var(--input-bg, #F5F5F5)',
                      color: 'var(--text-color, #1a1a1a)',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#2196F3';
                      e.target.style.backgroundColor = 'var(--bg-card, #ffffff)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--input-border, #E0E0E0)';
                      e.target.style.backgroundColor = 'var(--input-bg, #F5F5F5)';
                    }}
                  />
                </div>
                <button 
                  type="submit" 
                  className="admin-submit-button" 
                  disabled={adminFormLoading}
                  style={{
                    marginTop: '16px',
                    width: '100%',
                    padding: '16px',
                    fontSize: '17px',
                    fontWeight: '700',
                    backgroundColor: adminFormLoading ? '#90CAF9' : '#2196F3',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: adminFormLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: adminFormLoading ? 'none' : '0 4px 12px rgba(33, 150, 243, 0.3)'
                  }}
                >
                  {adminFormLoading ? '⏳ Добавление...' : '✨ Добавить администратора'}
                </button>
                {adminFormMessage && (
                  <div style={{ 
                    marginTop: '16px', 
                    padding: '12px 16px', 
                    borderRadius: '10px',
                    backgroundColor: adminFormMessage.startsWith('Администратор успешно') ? '#E8F5E9' : '#FFEBEE',
                    border: `2px solid ${adminFormMessage.startsWith('Администратор успешно') ? '#4CAF50' : '#f44336'}`,
                    color: adminFormMessage.startsWith('Администратор успешно') ? '#2e7d32' : '#f44336',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {adminFormMessage.startsWith('Администратор успешно') ? '✅' : '❌'} {adminFormMessage}
                  </div>
                )}
              </form>
            </div>

            {adminsLoading && adminsList.length === 0 ? (
              <p>Загрузка администраторов...</p>
            ) : adminsList.length === 0 ? (
              <p>Нет администраторов</p>
            ) : (
              <div className="admin-users-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {adminsList.map((admin) => {
                  const isMainAdminUser = Number(admin.telegramId) === 473842863;
                  const isCurrentUser = currentUserId && Number(admin.telegramId) === currentUserId;
                  const canDelete = !isMainAdminUser && !isCurrentUser;

                  return (
                    <div 
                      key={admin.telegramId} 
                      style={{
                        padding: '20px',
                        backgroundColor: isMainAdminUser 
                          ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' 
                          : isCurrentUser
                          ? 'var(--card-bg, #ffffff)'
                          : 'var(--card-bg, #ffffff)',
                        background: isMainAdminUser 
                          ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.15) 100%)' 
                          : 'var(--card-bg, #ffffff)',
                        border: isMainAdminUser 
                          ? '2px solid #FFD700' 
                          : isCurrentUser
                          ? '2px solid #2196F3'
                          : '2px solid var(--border-color, #e0e0e0)',
                        borderRadius: '16px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '14px',
                          backgroundColor: isMainAdminUser 
                            ? '#FFD700' 
                            : isCurrentUser
                            ? '#2196F3'
                            : '#9E9E9E',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '28px',
                          flexShrink: 0,
                          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)'
                        }}>
                          {isMainAdminUser ? '👑' : isCurrentUser ? '👤' : '🛡️'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px', 
                            marginBottom: '12px',
                            flexWrap: 'wrap'
                          }}>
                            <h3 style={{ 
                              margin: 0, 
                              fontSize: '18px', 
                              fontWeight: '700', 
                              color: 'var(--text-color, #1a1a1a)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                            ID: {String(admin.telegramId)}
                              {isMainAdminUser && (
                                <span style={{
                                  padding: '4px 10px',
                                  backgroundColor: '#FFD700',
                                  color: '#1a1a1a',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: '700'
                                }}>
                                  👑 Главный админ
                          </span>
                              )}
                              {isCurrentUser && (
                                <span style={{
                                  padding: '4px 10px',
                                  backgroundColor: '#2196F3',
                                  color: '#ffffff',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: '700'
                                }}>
                                  Вы
                                </span>
                              )}
                            </h3>
                        </div>
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '8px',
                            marginBottom: '12px'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              fontSize: '14px',
                              color: 'var(--text-secondary, #666)'
                            }}>
                              <span style={{ fontWeight: '600', color: 'var(--text-color, #1a1a1a)' }}>📅 Добавлен:</span>
                              <span>{admin.createdAt
                                ? new Date(admin.createdAt).toLocaleString('ru-RU', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : '—'}</span>
                            </div>
                          {admin.createdBy && (
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px',
                                fontSize: '14px',
                                color: 'var(--text-secondary, #666)'
                              }}>
                                <span style={{ fontWeight: '600', color: 'var(--text-color, #1a1a1a)' }}>👤 Добавил:</span>
                                <span style={{
                                  padding: '4px 10px',
                                  backgroundColor: 'var(--bg-secondary, #f5f5f5)',
                                  borderRadius: '8px',
                                  fontFamily: 'monospace',
                                  fontWeight: '600',
                                  color: 'var(--text-color, #1a1a1a)'
                                }}>
                                  ID {String(admin.createdBy)}
                                </span>
                              </div>
                          )}
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAdmin(admin.telegramId)}
                              style={{
                                padding: '10px 16px',
                                fontSize: '14px',
                                fontWeight: '600',
                                backgroundColor: '#f44336',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                width: 'fit-content'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#d32f2f';
                                e.target.style.transform = 'translateY(-2px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(244, 67, 54, 0.3)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#f44336';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = 'none';
                              }}
                          >
                            🗑️ Удалить
                          </button>
                        )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Admin list screen
    return (
      <div className="admin-container">
        <div className="admin-content">
          <div className="admin-header">
            <button 
              className="back-button"
              onClick={() => {
                setScreen('topics');
              }}
            >
              ← Назад к тестам
            </button>
            <h1 className="admin-title">Панель администратора</h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                className="admin-add-topic-button"
                onClick={handleOpenAddTopic}
                type="button"
              >
                + Добавить тему
              </button>
              <button
                className="admin-add-button"
                onClick={() => {
                  setEditingQuestion(null);
                  resetQuestionForm();
                  setAdminScreen('add');
                }}
              >
                + Добавить вопрос
              </button>
              <button
                className="admin-users-button"
                onClick={async () => {
                  await loadUsersFromSupabase();
                  setAdminScreen('users');
                  // сразу подгружаем активные подписки из БД
                  loadSubscriptions();
                }}
              >
                👥 Пользователи
              </button>
              <button
                className="admin-users-button"
                onClick={async () => {
                  await loadAdmins();
                  setAdminScreen('admins');
                }}
              >
                👑 Администраторы
              </button>
            </div>
          </div>

          <div className="admin-stats">
            <p>Всего тем: {topics.length}</p>
            <p>Всего вопросов: {Object.values(questionsData).flat().length + savedQuestions.length}</p>
          </div>

          <div className="admin-topics-list">
            <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>Темы:</h3>
            {topics.map((topic, index) => {
              const staticCount = questionsData[topic.id]?.length || 0;
              const savedCount = savedQuestions.filter(q => q.quiz_id === topic.id).length;
              const questionCount = staticCount + savedCount;
              const topicSavedQuestions = savedQuestions.filter(q => q.quiz_id === topic.id);
              
              return (
                <div key={topic.id}>
                  <div 
                    className="admin-topic-item"
                    onClick={() => {
                      setAdminSelectedTopic(topic);
                      setAdminScreen('topicQuestions');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="admin-topic-info">
                      <span className="admin-topic-number">{index + 1}.</span>
                      <span className="admin-topic-name">{topic.name}</span>
                      <span className="admin-topic-count">
                        {questionCount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Registration screen (shown only once for new users)
  if (screen === 'registration') {
    return (
      <>
        <WelcomeModal />
      <div className="registration-screen-container">
        <div className="registration-card">
          <div className="registration-icon-wrapper">
            <div className="registration-icon">👤</div>
          </div>
          
          <h1 className="registration-title">Добро пожаловать!<br />avto_GO</h1>

          <form onSubmit={handleRegistration} className="registration-form">
            <div className="registration-form-group">
              <label className="registration-label">
                <span className="registration-label-icon">✏️</span>
                Имя
              </label>
              <input
                type="text"
                className="registration-input"
                value={registrationForm.name}
                onChange={(e) => setRegistrationForm({ ...registrationForm, name: e.target.value })}
                placeholder="Введите ваше имя"
                required
              />
            </div>
            
            <div className="registration-form-group">
              <label className="registration-label">
                <span className="registration-label-icon">📱</span>
                Телефон
              </label>
              <input
                type="tel"
                className="registration-input"
                value={registrationForm.phone}
                onChange={(e) => {
                  let value = e.target.value;
                  
                  // Разрешаем только цифры и + в начале
                  if (value.startsWith('+')) {
                    // Если начинается с +, разрешаем цифры после него
                    const digits = value.slice(1).replace(/\D/g, '');
                    value = '+' + digits;
                  } else {
                    // Если не начинается с +, разрешаем только цифры
                    value = value.replace(/\D/g, '');
                  }
                  
                  // Форматируем номер с разделителями
                  let formatted = value;
                  if (value.startsWith('+')) {
                    const digits = value.slice(1);
                    if (digits.length > 0) {
                      // Формат: +998 90 123 45 67
                      if (digits.length <= 3) {
                        formatted = '+' + digits;
                      } else if (digits.length <= 5) {
                        formatted = '+' + digits.slice(0, 3) + ' ' + digits.slice(3);
                      } else if (digits.length <= 8) {
                        formatted = '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5);
                      } else if (digits.length <= 10) {
                        formatted = '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
                      } else {
                        formatted = '+' + digits.slice(0, 3) + ' ' + digits.slice(3, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8, 10) + ' ' + digits.slice(10, 12);
                      }
                    }
                  } else if (value.length > 0) {
                    // Формат без +: 998 90 123 45 67
                    if (value.length <= 3) {
                      formatted = value;
                    } else if (value.length <= 5) {
                      formatted = value.slice(0, 3) + ' ' + value.slice(3);
                    } else if (value.length <= 8) {
                      formatted = value.slice(0, 3) + ' ' + value.slice(3, 5) + ' ' + value.slice(5);
                    } else if (value.length <= 10) {
                      formatted = value.slice(0, 3) + ' ' + value.slice(3, 5) + ' ' + value.slice(5, 8) + ' ' + value.slice(8);
                    } else {
                      formatted = value.slice(0, 3) + ' ' + value.slice(3, 5) + ' ' + value.slice(5, 8) + ' ' + value.slice(8, 10) + ' ' + value.slice(10, 12);
                    }
                  }
                  
                  setRegistrationForm({ ...registrationForm, phone: formatted });
                }}
                inputMode="tel"
                placeholder="+998 90 123 45 67"
                required
              />
            </div>
            
            <button type="submit" className="registration-submit-button">
              <span>Продолжить</span>
              <span className="registration-button-arrow">→</span>
            </button>
          </form>
        </div>
      </div>
      </>
    );
  }

  // ========== ЭКЗАМЕН: Экран выбора количества вопросов ==========
  if (screen === 'examSelect') {
    const allQuestions = getAllQuestions();
    const totalQuestionsAvailable = allQuestions.length;
    
    return (
      <>
        <ThemeToggleButton />
        <SubscriptionStatusBadge />
        <div className="topics-container exam-container">
          <div className="exam-select-container">
            {/* Логотип avto_GO */}
            <div className="app-logo">
              <div className="app-logo-text">
                <span className="app-logo-avto">avto_</span>
                <span className="app-logo-go">GO</span>
              </div>
            </div>
            
        {/* Панель переключения между Тема и Экзамен */}
        <div className="mode-switch-panel">
          <button
            className={`mode-switch-button ${activeMode === 'topic' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('topic')}
          >
            Тема
          </button>
          <button
            className={`mode-switch-button ${activeMode === 'exam' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('exam')}
          >
            Экзамен
          </button>
        </div>
        
            <h1 className="exam-title">Экзамен</h1>
        
          <p className="exam-description">
            Выберите количество вопросов для экзамена. Вопросы будут выбраны случайным образом из всех тем.
          </p>
          {totalQuestionsAvailable > 0 && (
            <p className="exam-available-questions">
              Доступно вопросов: {totalQuestionsAvailable}
            </p>
          )}
          
          <div className="exam-options-list">
            <button
              className="exam-option-button"
              onClick={() => handleExamQuestionCountSelect(20)}
              disabled={totalQuestionsAvailable < 20}
            >
              <span className="exam-option-count">20 вопросов</span>
              {totalQuestionsAvailable < 20 && (
                <span className="exam-option-disabled">(недостаточно вопросов)</span>
              )}
            </button>
            
            <button
              className="exam-option-button"
              onClick={() => handleExamQuestionCountSelect(50)}
              disabled={totalQuestionsAvailable < 50}
            >
              <span className="exam-option-count">50 вопросов</span>
              {totalQuestionsAvailable < 50 && (
                <span className="exam-option-disabled">(недостаточно вопросов)</span>
              )}
            </button>
            
            <button
              className="exam-option-button"
              onClick={() => handleExamQuestionCountSelect(100)}
              disabled={totalQuestionsAvailable < 100}
            >
              <span className="exam-option-count">100 вопросов</span>
              {totalQuestionsAvailable < 100 && (
                <span className="exam-option-disabled">(недостаточно вопросов)</span>
              )}
            </button>
          </div>
          
          {totalQuestionsAvailable === 0 && (
            <div className="exam-no-questions">
              <p>Нет доступных вопросов для экзамена.</p>
              <p>Пожалуйста, добавьте вопросы в разделе "Тема".</p>
            </div>
          )}
        </div>
        </div>
      </>
    );
  }

  // Regular user quiz screens
  if (screen === 'topics') {
    return (
      <>
        <ThemeToggleButton />
        <SubscriptionStatusBadge />
        <WelcomeModal />
        <div className="topics-container">
          {/* Логотип avto_GO */}
          <div className="app-logo">
            <div className="app-logo-text">
              <span className="app-logo-avto">avto_</span>
              <span className="app-logo-go">GO</span>
            </div>
          </div>
          
        {/* Панель переключения между Тема и Экзамен */}
        <div className="mode-switch-panel">
          <button
            className={`mode-switch-button ${activeMode === 'topic' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('topic')}
          >
            Тема
          </button>
          <button
            className={`mode-switch-button ${activeMode === 'exam' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('exam')}
          >
            Экзамен
          </button>
        </div>
        
        <div className="topics-header">
          <div className="topics-header-top">
          <h1 className="topics-title">Темы</h1>
            <button
              onClick={() => {
                setScreen('statistics');
              }}
              className="analytics-button"
              title="Статистика"
            >
              📊 Статистика
            </button>
          </div>
          {(userRole === 'admin' || isAdmin) && (
            <button
              onClick={() => {
                setScreen('admin');
                // Если редактировали вопрос из темы, возвращаемся к списку вопросов темы
        if (adminSelectedTopic && editingQuestion) {
          setAdminScreen('topicQuestions');
        } else {
          setAdminScreen('list');
        }
              }}
              className="admin-access-button"
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                fontSize: '14px',
                background: '#18ec23',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              🔧 Админ-панель
            </button>
          )}
        </div>
        <div className="topics-list">
          {topics.map((topic, index) => {
            // Используем questionCount из темы (загружено из Supabase)
            let questionCount = topic.questionCount || 0;
            
            // Если questionCount не установлен, вычисляем из savedQuestions
            if (!questionCount || questionCount === 0) {
            const staticCount = questionsData[topic.id]?.length || 0;
              const savedCount = savedQuestions.filter(q => {
                // Сравниваем topic_id с учетом возможных различий типов (UUID vs число)
                return q.topic_id === topic.id || 
                       String(q.topic_id) === String(topic.id) ||
                       (Number(q.topic_id) === Number(topic.id) && !isNaN(Number(q.topic_id)) && !isNaN(Number(topic.id)));
              }).length;
              questionCount = staticCount + savedCount;
            }
            
            return (
              <button
                key={topic.id}
                className="topic-item"
                onClick={() => handleTopicClick(topic)}
              >
                <span className="topic-number">{index + 1}.</span>
                <span className="topic-name">{topic.name}</span>
                <span className="topic-count">{questionCount}</span>
              </button>
            )
          })}
        </div>
        </div>
      </>
    )
  }

  if (screen === 'topicDetail') {
    const topicResults = results[selectedTopic.id] || [];
    const latestResult = topicResults[0];
    const questions = getMergedQuestions(selectedTopic.id);
    const totalQuestions = questions.length;

    return (
      <>
        <div className="topic-detail-container">
        {/* Панель переключения между Тема и Экзамен */}
        <div className="mode-switch-panel">
          <button
            className={`mode-switch-button ${activeMode === 'topic' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('topic')}
          >
            Тема
          </button>
          <button
            className={`mode-switch-button ${activeMode === 'exam' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('exam')}
          >
            Экзамен
          </button>
        </div>
        <div className="topic-detail-header">
          <button className="back-button" onClick={handleBackToTopics}>← Назад</button>
          <button className="start-test-button-header" onClick={handleStartTest}>
            Начать тест
          </button>
        </div>
        <h2 className="topic-detail-title">{selectedTopic.name}</h2>
        <p className="topic-total-questions">Общее количество вопросов: {totalQuestions}</p>

        {latestResult ? (
          <div className="results-section">
            <div className="result-id"><span>●</span> {userData?.name || 'Пользователь'}</div>
            <div className="result-header">
              <h3 className="result-title">результаты теста</h3>
              <div className="progress-circle">
                <svg className="progress-ring" width="60" height="60">
                  <circle
                    className="progress-ring-circle-bg"
                    stroke="#e0e0e0"
                    strokeWidth="6"
                    fill="transparent"
                    r="24"
                    cx="30"
                    cy="30"
                  />
                  <circle
                    className="progress-ring-circle"
                    stroke={(() => {
                      const p = latestResult.percentage || Math.round((latestResult.correct / latestResult.total) * 100);
                      return p >= 70 ? "#18ec23" : p >= 50 ? "#ff9800" : "#f44336";
                    })()}
                    strokeWidth="6"
                    fill="transparent"
                    r="24"
                    cx="30"
                    cy="30"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    strokeDashoffset={`${2 * Math.PI * 24 * (1 - ((latestResult.percentage || Math.round((latestResult.correct / latestResult.total) * 100)) / 100))}`}
                    transform="rotate(-90 30 30)"
                  />
                </svg>
                <div 
                  className="progress-text"
                  style={{
                    color: (() => {
                      const percent = latestResult.percentage || Math.round((latestResult.correct / latestResult.total) * 100);
                      return percent >= 70 ? "#18ec23" : percent >= 50 ? "#ff9800" : "#f44336";
                    })()
                  }}
                >
                  {latestResult.percentage || Math.round((latestResult.correct / latestResult.total) * 100)}%
                </div>
              </div>
            </div>

            {/* Блок с советом от ИИ-тренера (вверху, перед результатами) */}
            <div className="ai-trainer-advice-block" style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '16px',
              padding: '20px',
              marginTop: '20px',
              marginBottom: '20px',
              color: '#ffffff',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
              animation: showAiAdvice && aiTrainerAdvice ? 'slideIn 0.5s ease-out' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontSize: '28px' }}>🤖</span>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                  Совет от ИИ-инструктора
                </h3>
              </div>
              
              {!showAiAdvice || !aiTrainerAdvice ? (
                // Показываем кнопку "Получить совет"
                <div>
                  <p style={{ margin: '0 0 16px 0', fontSize: '15px', lineHeight: '1.6', opacity: 0.9 }}>
                    Получи персональный совет на основе твоих ошибок
                  </p>
                  <button 
                    onClick={() => {
                      if (latestResult) {
                        getAITrainerAdvice(latestResult);
                      }
                    }}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '14px 20px',
                      color: '#ffffff',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                      e.target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                      e.target.style.transform = 'translateY(0)';
                    }}
                  >
                    <span>✨</span>
                    <span>Получить совет</span>
                  </button>
                </div>
              ) : aiTrainerAdvice.loading ? (
                // Показываем загрузку
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="loading-spinner-small"></div>
                  <span style={{ fontSize: '15px' }}>Инструктор анализирует твои ошибки...</span>
                </div>
              ) : aiTrainerAdvice.error ? (
                null // Скрываем блок при ошибке
              ) : aiTrainerAdvice.text ? (
                // Показываем совет
                <div>
                  <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6' }}>
                    {aiTrainerAdvice.text}
                  </p>
                  <button 
                    onClick={() => {
                      setShowAiAdvice(false);
                      setAiTrainerAdvice(null);
                    }}
                    style={{
                      marginTop: '16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    Понятно ✓
                  </button>
                </div>
              ) : null}
            </div>

            <div className="result-cards">
              <div className="result-card">
                <div className="result-card-icon green">✓</div>
                <div className="result-card-text">
                  {latestResult.correct}/{latestResult.total} из вопросов ({latestResult.percentage || Math.round((latestResult.correct / latestResult.total) * 100)}%)
                </div>
              </div>
              <div className="result-card">
                <div className="result-card-icon yellow">⏱</div>
                <div className="result-card-text">
                  {latestResult.timeSpent} потрачено
                </div>
              </div>
              <div className="result-card">
                <div className="result-card-icon purple">📅</div>
                <div className="result-card-text">
                  {latestResult.dateTime}
                </div>
              </div>
            </div>

            {topicResults.length > 1 && (
              <div className="results-history">
                <h4 className="history-title">История результатов (последние {topicResults.length - 1}):</h4>
                {topicResults.slice(1).map((result, index) => (
                  <div key={result.id} className="history-item">
                    <div className="history-item-info">
                      <span className="history-id">{userData?.name || 'Пользователь'}</span>
                      <span className="history-score">{result.correct}/{result.total} ({result.percentage || Math.round((result.correct / result.total) * 100)}%)</span>
                      <span className="history-time">{result.timeFormatted}</span>
                      <span className="history-date">{result.dateTime}</span>
                    </div>
                    <button
                      className="history-review-button"
                      onClick={() => {
                        console.log('History Full Review button clicked:', {
                          result: result ? {
                            id: result.id,
                            hasQuestions: !!result.questions,
                            hasUserAnswers: !!result.userAnswers,
                            questionsLength: result.questions?.length,
                            userAnswersLength: result.userAnswers?.length,
                            correct: result.correct,
                            total: result.total
                          } : null,
                          selectedTopic: selectedTopic ? {
                            id: selectedTopic.id,
                            name: selectedTopic.name
                          } : null
                        });
                        
                        if (!result || !result.questions || !result.userAnswers) {
                          console.error('Cannot open full review: missing data in result');
                          alert('Ошибка: данные результатов неполные. Попробуйте пройти тест снова.');
                          return;
                        }
                        
                        setSelectedResult(result);
                        setScreen('fullReview');
                      }}
                    >
                      Полный обзор
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button 
              className="full-review-button"
              onClick={() => {
                console.log('Full Review button clicked:', {
                  latestResult: latestResult ? {
                    id: latestResult.id,
                    hasQuestions: !!latestResult.questions,
                    hasUserAnswers: !!latestResult.userAnswers,
                    questionsLength: latestResult.questions?.length,
                    userAnswersLength: latestResult.userAnswers?.length,
                    correct: latestResult.correct,
                    total: latestResult.total
                  } : null,
                  selectedTopic: selectedTopic ? {
                    id: selectedTopic.id,
                    name: selectedTopic.name
                  } : null
                });
                
                if (!latestResult || !latestResult.questions || !latestResult.userAnswers) {
                  console.error('Cannot open full review: missing data in latestResult');
                  alert('Ошибка: данные результатов неполные. Попробуйте пройти тест снова.');
                  return;
                }
                
                setSelectedResult(latestResult);
                setScreen('fullReview');
              }}
            >
              Полный обзор
            </button>
          </div>
        ) : (
          <div className="results-section">
            <div className="no-results-message">
              <p>Тест ещё не пройден</p>
              <p className="no-results-hint">Нажмите "Начать тест" чтобы начать</p>
            </div>
          </div>
        )}
        </div>
      </>
    )
  }

  // Full Review Screen
  if (screen === 'fullReview') {
    // Получаем результат: сначала из selectedResult, затем из results по selectedTopic, затем из всех results
    let reviewResult = selectedResult;
    
    if (!reviewResult && selectedTopic && selectedTopic.id) {
      reviewResult = (results[selectedTopic.id] || [])[0];
    }
    
    // Если все еще нет результата, ищем в всех results
    if (!reviewResult) {
      for (const topicId in results) {
        if (results[topicId] && results[topicId].length > 0) {
          reviewResult = results[topicId][0];
          break;
        }
      }
    }
    
    if (!reviewResult || !reviewResult.questions || !reviewResult.userAnswers) {
      console.error('Full Review - Missing data:', {
        hasSelectedResult: !!selectedResult,
        hasSelectedTopic: !!selectedTopic,
        selectedTopicId: selectedTopic?.id,
        reviewResult: reviewResult ? {
          id: reviewResult.id,
          hasQuestions: !!reviewResult.questions,
          hasUserAnswers: !!reviewResult.userAnswers,
          questionsLength: reviewResult.questions?.length,
          userAnswersLength: reviewResult.userAnswers?.length
        } : null
      });
      
      return (
        <div className="topic-detail-container">
          <div className="topic-detail-header">
            <button className="back-button" onClick={() => {
              setSelectedResult(null);
              if (selectedTopic) {
              setScreen('topicDetail');
              } else {
                setScreen('topics');
              }
            }}>
              ← Назад
            </button>
            <h2 className="topic-detail-title">{selectedTopic?.name || 'Результаты теста'}</h2>
          </div>
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '10px' }}>
              Нет данных для просмотра
            </p>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary, #999)' }}>
              Результаты теста не найдены. Попробуйте пройти тест снова.
            </p>
          </div>
        </div>
      );
    }

    const questions = reviewResult.questions;
    const userAnswers = reviewResult.userAnswers;
    
    // Отладочная информация - проверяем структуру данных
    console.log('Full Review - Data structure:', {
      reviewResultId: reviewResult.id,
      questionsCount: questions.length,
      userAnswersCount: userAnswers.length,
      firstQuestion: questions[0] ? {
        id: questions[0].id,
        text: questions[0].text.substring(0, 30),
        answers: questions[0].answers.map(a => ({ id: a.id, idType: typeof a.id, correct: a.correct }))
      } : null,
      firstUserAnswer: userAnswers[0],
      allUserAnswers: userAnswers.map((a, i) => ({
        index: i,
        answer: a,
        selectedId: a?.selectedAnswerId,
        selectedIdType: typeof a?.selectedAnswerId
      }))
    });

    return (
      <>
      <div className="full-review-container">
        <div className="full-review-header">
          <button className="back-button" onClick={() => {
            setSelectedResult(null);
            if (selectedTopic) {
            setScreen('topicDetail');
            } else {
              setScreen('topics');
            }
          }}>
            ← Назад
          </button>
        </div>
          <h2 className="full-review-title">{selectedTopic?.name || 'Полный обзор результатов'}</h2>
        
        <div className="full-review-result-info">
          {userData?.name && (
            <div className="review-result-id">{userData.name}</div>
          )}
          <div className="review-result-stats">
            <div className="review-stat-item">
              <span className="review-stat-label">Правильных ответов:</span>
              <span className="review-stat-value">{reviewResult.correct}/{reviewResult.total}</span>
            </div>
            <div className="review-stat-item">
              <span className="review-stat-label">Процент:</span>
              <span className="review-stat-value">{reviewResult.percentage || Math.round((reviewResult.correct / reviewResult.total) * 100)}%</span>
            </div>
            {reviewResult.timeSpent && (
              <div className="review-stat-item">
                <span className="review-stat-label">Время:</span>
                <span className="review-stat-value">{reviewResult.timeSpent}</span>
              </div>
            )}
            {reviewResult.dateTime && (
              <div className="review-stat-item">
                <span className="review-stat-label">Дата:</span>
                <span className="review-stat-value">{reviewResult.dateTime}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="full-review-content">
          {questions.map((question, index) => {
            const userAnswer = userAnswers[index];
            
            // Определяем, был ли ответ неправильным
            const userSelectedId = userAnswer?.selectedAnswerId;
            const correctAnswer = question.answers.find(a => a.correct === true);
            const userSelectedAnswer = question.answers.find(a => {
              const normalizeId = (id) => {
                if (id === null || id === undefined) return null;
                const num = Number(id);
                if (!isNaN(num)) return num;
                return String(id);
              };
              return normalizeId(a.id) === normalizeId(userSelectedId);
            });
            const isIncorrect = userSelectedAnswer && !userSelectedAnswer.correct;
            const questionId = question.id || `q-${index}`;
            
            // Отладочная информация для первого вопроса
            if (index === 0) {
              console.log('Full Review - Question 1:', {
                questionId: question.id,
                questionText: question.text.substring(0, 30),
                questionAnswers: question.answers.map(a => ({ 
                  id: a.id, 
                  idType: typeof a.id, 
                  text: a.text.substring(0, 20),
                  correct: a.correct 
                })),
                userAnswer: userAnswer,
                userSelectedId: userAnswer?.selectedAnswerId,
                userSelectedIdType: typeof userAnswer?.selectedAnswerId
              });
            }
            
            return (
              <div key={question.id || index} className="review-question-block">
                <div className="review-question-number">
                  Вопрос {index + 1} из {questions.length}
                </div>
            {/* TODO: Ensure this image is compressed (WebP or compressed PNG under 50kb) */}
                {question.image && (
                  <img
                    src={question.image}
                    alt="question"
                    className="review-question-image"
                  />
                )}
                <h3 className="review-question-text">{question.text}</h3>
                
                <div className="review-answers">
                  {question.answers.map((answer, answerIndex) => {
                    // Проверяем, был ли выбран этот ответ
                    const userSelectedId = userAnswer?.selectedAnswerId;
                    const answerId = answer.id;
                    
                    // Используем ту же функцию нормализации, что и в saveTestResults
                    const normalizeId = (id) => {
                      if (id === null || id === undefined) return null;
                      const num = Number(id);
                      if (!isNaN(num)) return num;
                      return String(id);
                    };
                    
                    const normalizedUser = normalizeId(userSelectedId);
                    const normalizedAnswer = normalizeId(answerId);
                    
                    // Сравниваем нормализованные значения (та же логика, что в saveTestResults)
                    const isSelected = normalizedUser !== null && 
                                     normalizedAnswer !== null &&
                                     normalizedUser === normalizedAnswer;
                    
                    // Отладочная информация для всех ответов первого вопроса
                    if (index === 0) {
                      console.log(`Full Review - Answer ${answerIndex + 1} comparison:`, {
                        questionIndex: index,
                        answerIndex: answerIndex,
                        userSelectedId: userSelectedId,
                        userSelectedIdType: typeof userSelectedId,
                        normalizedUser: normalizedUser,
                        answerId: answerId,
                        answerIdType: typeof answerId,
                        normalizedAnswer: normalizedAnswer,
                        isSelected: isSelected,
                        directMatch: userSelectedId === answerId,
                        stringMatch: String(userSelectedId) === String(answerId),
                        normalizedMatch: normalizedUser === normalizedAnswer,
                        userAnswerObject: userAnswer
                      });
                    }
                    
                    // Проверяем, правильный ли это ответ
                    const isCorrect = answer.correct === true;
                    
                    let answerClass = 'review-answer';
                    let showMarker = false;
                    let markerText = '';
                    
                    // Определяем стиль и маркер
                    if (isCorrect) {
                      answerClass += ' review-answer-correct';
                      if (isSelected) {
                        markerText = 'Ваш ответ (правильно)';
                      } else {
                        markerText = 'Правильный ответ';
                      }
                      showMarker = true;
                    } else if (isSelected) {
                      answerClass += ' review-answer-incorrect';
                      markerText = 'Ваш ответ (неправильно)';
                      showMarker = true;
                    }
                    
                    return (
                      <div key={answer.id || answerIndex} className={answerClass}>
                        {showMarker && <span className={`answer-marker ${isCorrect ? 'correct' : ''}`}>{markerText}: </span>}
                        {answerIndex + 1}. {answer.text}
                        {isCorrect && <span className="correct-icon"> ✓</span>}
                        {isSelected && !isCorrect && <span className="incorrect-icon"> ✗</span>}
                      </div>
                    );
                  })}
                </div>
                
                {/* Блок с объяснением ИИ для неправильных ответов */}
                {isIncorrect && (
                  <div className="ai-explanation-block">
                    <div className="ai-explanation-header">
                      <span className="ai-explanation-icon">🤖</span>
                      <span className="ai-explanation-title">Объяснение ИИ:</span>
                    </div>
                    <div className="ai-explanation-content">
                      {explanations[questionId]?.loading ? (
                        <div className="ai-explanation-loading">
                          <span>ИИ анализирует ваш ответ...</span>
                        </div>
                      ) : explanations[questionId]?.error ? (
                        <div className="ai-explanation-error">
                          {explanations[questionId].error}
                        </div>
                      ) : explanations[questionId]?.explanation ? (
                        explanations[questionId]?.streaming ? (
                          // Показываем текст напрямую с курсором во время печатания
                          <div className="ai-explanation-text">
                            <span>{explanations[questionId].explanation}</span>
                            <span className="typewriter-cursor">|</span>
                          </div>
                        ) : (
                          // После завершения печатания показываем финальный текст
                          <div className="ai-explanation-text">
                            <span>{explanations[questionId].explanation}</span>
                          </div>
                        )
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </>
    );
  }

  // ========== ЭКЗАМЕН: Экран результатов экзамена ==========
  if (screen === 'examResult') {
    const examResult = selectedExamResult || (results['exam'] || [])[0];
    
    if (!examResult) {
      return (
        <>
        <div className="topics-container">
          <div className="topics-header">
            <button className="back-button" onClick={() => {
              setSelectedExamResult(null);
              setScreen('examSelect');
            }}>
              ← Назад
            </button>
            <h1 className="topics-title">Результаты экзамена</h1>
          </div>
          <p>Нет данных для отображения</p>
        </div>
        </>
      );
    }

    return (
      <>
      <div className="topic-detail-container">
        {/* Панель переключения между Тема и Экзамен */}
        <div className="mode-switch-panel">
          <button
            className={`mode-switch-button ${activeMode === 'topic' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('topic')}
          >
            Тема
          </button>
          <button
            className={`mode-switch-button ${activeMode === 'exam' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('exam')}
          >
            Экзамен
          </button>
        </div>
        
        <div className="topic-detail-header">
          <div className="topic-detail-buttons">
            <button className="back-button" onClick={() => {
              setSelectedExamResult(null);
              setScreen('examSelect');
            }}>← Назад</button>
          </div>
          <h2 className="topic-detail-title">Результаты экзамена</h2>
        </div>

        <div className="results-section">
          <div className="result-id"><span>●</span> {userData?.name || 'Пользователь'}</div>
          <div className="result-header">
            <h3 className="result-title">результаты экзамена</h3>
            <div className="progress-circle">
              <svg className="progress-ring" width="60" height="60">
                <circle
                  className="progress-ring-circle-bg"
                  stroke="#e0e0e0"
                  strokeWidth="6"
                  fill="transparent"
                  r="24"
                  cx="30"
                  cy="30"
                />
                <circle
                  className="progress-ring-circle"
                  stroke={examResult.percentage >= 70 ? "#18ec23" : examResult.percentage >= 50 ? "#ff9800" : "#f44336"}
                  strokeWidth="6"
                  fill="transparent"
                  r="24"
                  cx="30"
                  cy="30"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - (examResult.percentage / 100))}`}
                  transform="rotate(-90 30 30)"
                />
              </svg>
              <div 
                className="progress-text"
                style={{
                  color: examResult.percentage >= 70 ? "#18ec23" : examResult.percentage >= 50 ? "#ff9800" : "#f44336"
                }}
              >
                {examResult.percentage}%
              </div>
            </div>
          </div>

          <div className="result-cards">
            <div className="result-card">
              <div className="result-card-icon green">✓</div>
              <div className="result-card-text">
                {examResult.correct}/{examResult.total} правильных ответов ({examResult.percentage}%)
              </div>
            </div>
            <div className="result-card">
              <div className="result-card-icon yellow">⏱</div>
              <div className="result-card-text">
                {examResult.timeSpent} потрачено
              </div>
            </div>
            <div className="result-card">
              <div className="result-card-icon purple">📅</div>
              <div className="result-card-text">
                {examResult.dateTime}
              </div>
            </div>
          </div>

            {/* Блок с советом от ИИ-тренера */}
            {showAiAdvice && aiTrainerAdvice && (
              <div className="ai-trainer-advice-block" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '16px',
                padding: '20px',
                marginTop: '20px',
                color: '#ffffff',
                boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
                animation: 'slideIn 0.5s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '28px' }}>🤖</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                    Совет от ИИ-инструктора
                  </h3>
                </div>
                
                {aiTrainerAdvice.loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="loading-spinner-small"></div>
                    <span style={{ fontSize: '15px' }}>Инструктор анализирует твои ошибки...</span>
                  </div>
                ) : aiTrainerAdvice.error ? (
                  null // Скрываем блок при ошибке
                ) : aiTrainerAdvice.text ? (
                  <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6' }}>
                    {aiTrainerAdvice.text}
                  </p>
                ) : null}
                
                {!aiTrainerAdvice.loading && aiTrainerAdvice.text && (
                  <button 
                    onClick={() => setShowAiAdvice(false)}
                    style={{
                      marginTop: '16px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                    }}
                  >
                    Понятно ✓
                  </button>
                )}
              </div>
            )}

          <button 
            className="full-review-button"
            onClick={() => {
              setSelectedExamResult(examResult);
              setScreen('examFullReview');
            }}
          >
            Полный обзор
          </button>
        </div>
      </div>
      </>
    );
  }

  // ========== ЭКЗАМЕН: Экран полного обзора результатов экзамена ==========
  if (screen === 'examFullReview') {
    const reviewResult = selectedExamResult || (results['exam'] || [])[0];
    
    if (!reviewResult || !reviewResult.questions || !reviewResult.userAnswers) {
      return (
        <>
        <div className="topic-detail-container">
          <div className="topic-detail-header">
            <button className="back-button" onClick={() => {
              setSelectedExamResult(null);
              setScreen('examResult');
            }}>
              ← Назад
            </button>
            <h2 className="topic-detail-title">Результаты экзамена</h2>
          </div>
          <p>Нет данных для просмотра</p>
        </div>
        </>
      );
    }

    const questions = reviewResult.questions;
    const userAnswers = reviewResult.userAnswers;

    return (
      <>
      <div className="full-review-container">
        <div className="full-review-header">
          <button className="back-button" onClick={() => {
            setSelectedExamResult(null);
            setScreen('examResult');
          }}>
            ← Назад
          </button>
          <h2 className="full-review-title">Результаты экзамена</h2>
        </div>
        
        <div className="full-review-result-info">
          {userData?.name && (
            <div className="review-result-id">{userData.name}</div>
          )}
          <div className="review-result-stats">
            <div className="review-stat-item">
              <span className="review-stat-label">Правильных ответов:</span>
              <span className="review-stat-value">{reviewResult.correct}/{reviewResult.total}</span>
            </div>
            <div className="review-stat-item">
              <span className="review-stat-label">Процент:</span>
              <span className="review-stat-value">{reviewResult.percentage}%</span>
            </div>
            {reviewResult.timeSpent && (
              <div className="review-stat-item">
                <span className="review-stat-label">Время:</span>
                <span className="review-stat-value">{reviewResult.timeSpent}</span>
              </div>
            )}
            {reviewResult.dateTime && (
              <div className="review-stat-item">
                <span className="review-stat-label">Дата:</span>
                <span className="review-stat-value">{reviewResult.dateTime}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="full-review-content">
          {questions.map((question, index) => {
            const userAnswer = userAnswers[index];
            
            return (
              <div key={question.id || index} className="review-question-block">
                <div className="review-question-number">
                  Вопрос {index + 1} из {questions.length}
                </div>
            {/* TODO: Ensure this image is compressed (WebP or compressed PNG under 50kb) */}
                {question.image && (
                  <img
                    src={question.image}
                    alt="question"
                    className="review-question-image"
                  />
                )}
                <h3 className="review-question-text">{question.text}</h3>
                
                <div className="review-answers">
                  {question.answers.map((answer, answerIndex) => {
                    const userSelectedId = userAnswer?.selectedAnswerId;
                    const answerId = answer.id;
                    
                    const normalizeId = (id) => {
                      if (id === null || id === undefined) return null;
                      const num = Number(id);
                      if (!isNaN(num)) return num;
                      return String(id);
                    };
                    
                    const normalizedUser = normalizeId(userSelectedId);
                    const normalizedAnswer = normalizeId(answerId);
                    
                    const isSelected = normalizedUser !== null && 
                                     normalizedAnswer !== null &&
                                     normalizedUser === normalizedAnswer;
                    
                    const isCorrect = answer.correct === true;
                    
                    let answerClass = 'review-answer';
                    let showMarker = false;
                    let markerText = '';
                    
                    if (isCorrect) {
                      answerClass += ' review-answer-correct';
                      if (isSelected) {
                        markerText = 'Ваш ответ (правильно)';
                      } else {
                        markerText = 'Правильный ответ';
                      }
                      showMarker = true;
                    } else if (isSelected) {
                      answerClass += ' review-answer-incorrect';
                      markerText = 'Ваш ответ (неправильно)';
                      showMarker = true;
                    }
                    
                    // Определяем правильный ответ для объяснения
                    const correctAnswerObj = question.answers.find(a => a.correct === true);
                    const wrongAnswerText = isSelected && !isCorrect ? answer.text : null;
                    const correctAnswerText = correctAnswerObj ? correctAnswerObj.text : null;
                    const questionId = question.id || `q-${index}`;
                    const explanationData = explanations[questionId];
                    // ИИ-объяснение отключено для экзаменов (examFullReview - это экран просмотра результатов экзамена)
                    const showExplanationButton = false; // Отключено для экзаменов
                    
                    return (
                      <div key={answer.id || answerIndex}>
                        <div className={answerClass}>
                        {showMarker && <span className={`answer-marker ${isCorrect ? 'correct' : ''}`}>{markerText}: </span>}
                        {answerIndex + 1}. {answer.text}
                        {isCorrect && <span className="correct-icon"> ✓</span>}
                        {isSelected && !isCorrect && <span className="incorrect-icon"> ✗</span>}
                        </div>
                        {/* Кнопка и блок объяснения для неправильного ответа */}
                        {showExplanationButton && (
                          <div className="explanation-block">
                            {!explanationData && (
                              <button
                                className="explanation-button"
                                onClick={() => getExplanation(questionId, question.text, wrongAnswerText, correctAnswerText)}
                              >
                                🤖 Почему это неправильно?
                              </button>
                            )}
                            {explanationData?.loading && (
                              <div className="explanation-loading">Загрузка объяснения...</div>
                            )}
                            {explanationData?.error && (
                              <div className="explanation-error">{explanationData.error}</div>
                            )}
                            {explanationData?.explanation && (
                              <div className="explanation-text">{explanationData.explanation}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Блок с объяснением ИИ для неправильных ответов */}
                {(() => {
                  const userSelectedId = userAnswer?.selectedAnswerId;
                  const correctAnswer = question.answers.find(a => a.correct === true);
                  const userSelectedAnswer = question.answers.find(a => {
                    const normalizeId = (id) => {
                      if (id === null || id === undefined) return null;
                      const num = Number(id);
                      if (!isNaN(num)) return num;
                      return String(id);
                    };
                    return normalizeId(a.id) === normalizeId(userSelectedId);
                  });
                  const isIncorrect = userSelectedAnswer && !userSelectedAnswer.correct;
                  const questionId = question.id || `q-${index}`;
                  
                  if (!isIncorrect) return null;
                  
                  return (
                    <div className="ai-explanation-block">
                      <div className="ai-explanation-header">
                        <span className="ai-explanation-icon">🤖</span>
                        <span className="ai-explanation-title">Объяснение ИИ:</span>
                      </div>
                      <div className="ai-explanation-content">
                        {explanations[questionId]?.loading ? (
                          <div className="ai-explanation-loading">
                            <span>ИИ анализирует ваш ответ...</span>
                          </div>
                        ) : explanations[questionId]?.error ? (
                          <div className="ai-explanation-error">
                            {explanations[questionId].error}
                          </div>
                        ) : explanations[questionId]?.explanation ? (
                          <Typewriter 
                            key={explanations[questionId].explanation}
                            text={explanations[questionId].explanation || ''}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
      </>
    );
  }

  // ========== ЭКРАН СТАТИСТИКИ (ОБЪЕДИНЕННЫЙ) ==========
  if (screen === 'statistics') {
    return (
      <>
        <StatisticsScreen 
          onBack={() => setScreen('topics')}
          topics={topics}
          onTopicSelect={(topic) => {
            setSelectedTopic(topic);
            setScreen('topicDetail');
          }}
          checkAILimit={checkAILimit}
          incrementAIUsage={incrementAIUsage}
        />
      </>
    );
  }

  // ========== ЭКРАН АНАЛИТИКИ (УДАЛЕН) ==========
  if (screen === 'analytics') {
    return (
      <>
        <div className="analytics-container">
          <div className="analytics-header">
            <button className="back-button" onClick={() => setScreen('topics')}>
              ← Назад
            </button>
            <h1 className="analytics-title">Моя статистика</h1>
          </div>

          {analyticsLoading ? (
            <div className="analytics-loading">
              <div className="loading-spinner"></div>
              <p>Загрузка статистики...</p>
            </div>
          ) : analyticsData && analyticsData.topics.length > 0 ? (
            <div className="analytics-content">
              {/* AI-Вердикт */}
              <div className="analytics-ai-verdict">
                <div className="analytics-ai-header">
                  <span className="analytics-ai-icon">🤖</span>
                  <h3>Вердикт ИИ-тренера</h3>
                </div>
                <div className="analytics-ai-content">
                  {analyticsAiVerdict && analyticsAiVerdict.loading ? (
                    <div className="analytics-ai-loading">
                      <span>ИИ анализирует вашу статистику...</span>
                    </div>
                  ) : analyticsAiVerdict && analyticsAiVerdict.error ? (
                    <div className="analytics-ai-error">{analyticsAiVerdict.error}</div>
                  ) : analyticsAiVerdict && analyticsAiVerdict.text ? (
                    <p>{analyticsAiVerdict.text}</p>
                  ) : (
                    <button 
                      className="analytics-ai-button"
                      onClick={loadAnalyticsAiVerdict}
                    >
                      Получить вердикт ИИ
                    </button>
                  )}
                </div>
              </div>

              {/* Блок слабых мест */}
              {analyticsData.weakTopics && analyticsData.weakTopics.length > 0 && (
                <div className="analytics-weak-topics">
                  <h2 className="analytics-section-title">Слабые места</h2>
                  <p className="analytics-section-subtitle">ТОП-3 темы с наибольшим количеством ошибок</p>
                  <div className="analytics-weak-topics-list">
                    {analyticsData.weakTopics.map((topic, index) => (
                      <div key={topic.topicId} className="analytics-weak-topic-item">
                        <div className="analytics-weak-topic-info">
                          <div className="analytics-weak-topic-rank">#{index + 1}</div>
                          <div className="analytics-weak-topic-details">
                            <h3 className="analytics-weak-topic-name">{topic.topicName}</h3>
                            <div className="analytics-weak-topic-stats">
                              <span className="analytics-weak-topic-errors">
                                {topic.errorCount} ошибок
                              </span>
                              <span className="analytics-weak-topic-percentage">
                                {topic.averagePercentage.toFixed(0)}% правильных
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          className="analytics-weak-topic-button"
                          onClick={() => {
                            const foundTopic = topics.find(t => String(t.id) === topic.topicId);
                            if (foundTopic) {
                              setSelectedTopic(foundTopic);
                              setScreen('topicDetail');
                            } else {
                              alert('Тема не найдена');
                            }
                          }}
                        >
                          Подтянуть
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Визуализация по темам */}
              <div className="analytics-topics">
                <h2 className="analytics-section-title">Прогресс по темам</h2>
                <div className="analytics-topics-list">
                  {analyticsData.topics.map((topic) => (
                    <div key={topic.topicId} className="analytics-topic-item">
                      <div className="analytics-topic-header">
                        <h3 className="analytics-topic-name">{topic.topicName}</h3>
                        <span className={`analytics-topic-percentage analytics-topic-percentage-${topic.color}`}>
                          {topic.averagePercentage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="analytics-topic-progress">
                        <div 
                          className={`analytics-topic-progress-bar analytics-topic-progress-${topic.color}`}
                          style={{ width: `${Math.min(topic.averagePercentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="analytics-topic-stats">
                        <span className="analytics-topic-stat">
                          Тестов: {topic.totalTests}
                        </span>
                        <span className="analytics-topic-stat">
                          Ошибок: {topic.errorCount}
                        </span>
                        {topic.totalQuestions > 0 && (
                          <span className="analytics-topic-stat">
                            Вопросов: {topic.totalQuestions}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="analytics-empty">
              <div className="analytics-empty-icon">📊</div>
              <h3>Нет данных для отображения</h3>
              <p>Пройдите тесты, чтобы увидеть свою статистику</p>
              <button 
                className="analytics-empty-button"
                onClick={() => setScreen('topics')}
              >
                Перейти к тестам
              </button>
            </div>
          )}
        </div>
      </>
    );
  }

  if (screen === 'quiz') {
    // ========== ЭКЗАМЕН: Используем сохраненные вопросы теста ==========
    // Для экзамена используем testQuestions, для теста по теме - из selectedTopic
    let questions = testQuestions.length > 0 
      ? testQuestions 
      : (selectedTopic ? getMergedQuestions(selectedTopic.id) : []);
    
    // Преобразуем вопросы, если у них нет массива answers
    questions = questions.map((q, qIndex) => {
      console.log(`Преобразование вопроса ${qIndex + 1}/${questions.length}:`, q.id, {
        hasAnswers: !!q.answers,
        answersLength: q.answers ? q.answers.length : 0,
        hasAnswerA: !!q.answer_a,
        hasAnswerB: !!q.answer_b,
        question: q.question || q.text
      });
      
      // Если у вопроса уже есть массив answers, возвращаем как есть
      if (q.answers && Array.isArray(q.answers) && q.answers.length > 0) {
        console.log(`  ✅ Вопрос ${q.id} уже имеет ${q.answers.length} ответов`);
        return q;
      }
      
      // Если у вопроса есть answer_a, answer_b и т.д., преобразуем в массив answers
      const answerKeys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const hasAnswerFields = answerKeys.some(key => {
        const value = q[`answer_${key}`];
        return value && String(value).trim() !== '';
      });
      
      console.log(`  Проверка полей answer_*: ${hasAnswerFields ? 'найдены' : 'не найдены'}`);
      
      if (hasAnswerFields) {
        const answers = [];
        
        answerKeys.forEach((key, index) => {
          const answerText = q[`answer_${key}`];
          if (answerText && String(answerText).trim() !== '') {
            answers.push({
              id: index + 1,
              text: String(answerText).trim(),
              correct: q.correct === key
            });
            console.log(`    Ответ ${key}: "${answerText}", правильный: ${q.correct === key}`);
          }
        });
        
        if (answers.length > 0) {
          console.log(`  ✅ Преобразованы ответы для вопроса ${q.id}: ${answers.length} ответов`);
          return {
            ...q,
            answers: answers,
            text: q.question || q.text || ''
          };
        } else {
          console.warn(`  ⚠️ Поля answer_* найдены, но все пустые для вопроса ${q.id}`);
        }
      }
      
      // Если ничего не найдено, возвращаем вопрос как есть (может быть ошибка)
      console.error(`  ❌ Вопрос ${q.id} без ответов. Данные вопроса:`, {
        id: q.id,
        question: q.question || q.text,
        answer_a: q.answer_a,
        answer_b: q.answer_b,
        answer_c: q.answer_c,
        answer_d: q.answer_d,
        correct: q.correct,
        answers_count: q.answers_count,
        allKeys: Object.keys(q)
      });
      return {
        ...q,
        answers: [],
        text: q.question || q.text || ''
      };
    });
    
    const question = questions[currentQuestionIndex]

    if (!question) {
      return (
        <>
          <div className="quiz-container">
            <div className="quiz-content">
              <p>Вопрос не найден</p>
              <button className="back-button" onClick={handleBackToTopics}>← Назад</button>
            </div>
          </div>
        </>
      )
    }

    return (
      <>
        <div className="quiz-container-new">
        <div className="quiz-header-new">
          <div className="quiz-header-left">
            <button 
              className="back-button-new" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Назад нажата, isExamMode:', isExamMode);
                handleExitTest();
              }}
              style={{ zIndex: 1000, position: 'relative' }}
            >
              ← Назад
            </button>
          </div>
          <div className="quiz-header-right">
            <button 
              className="finish-button" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Финиш нажата, isExamMode:', isExamMode);
                handleFinishTest();
              }}
              style={{ zIndex: 1000, position: 'relative' }}
            >
              Финиш
            </button>
            {/* ========== ЭКЗАМЕН: Отображение таймера в зависимости от режима ========== */}
            <div className={`quiz-timer-new ${isExamMode && examTimeRemaining !== null && examTimeRemaining <= 60 ? 'quiz-timer-warning' : ''} ${isExamMode && examTimeRemaining === 0 ? 'quiz-timer-expired' : ''}`}>
              {isExamMode && examTimeRemaining !== null 
                ? formatExamTime(examTimeRemaining) 
                : formatTime(elapsedTime)}
            </div>
          </div>
        </div>
        
        <div className="quiz-content-new">
          <h2 className="quiz-topic-title">
            {isExamMode ? `Экзамен (${examQuestionCount} вопросов)` : (selectedTopic?.name || 'Тест')}
          </h2>
          
          <div className="question-box">
            {/* TODO: Ensure this image is compressed (WebP or compressed PNG under 50kb) */}
            {question.image && (
              <img
                src={question.image}
                alt="question"
                className="question-image-new"
              />
            )}
            <p className="question-text-new">{question.text}</p>
          </div>
          
          <div className="answers-list">
            {(!question.answers || question.answers.length === 0) ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                <p>Варианты ответов не найдены для этого вопроса.</p>
                <p style={{ fontSize: '12px', marginTop: '10px' }}>ID вопроса: {question.id}</p>
              </div>
            ) : (
              question.answers.map((answer, index) => {
              const answerNumber = index + 1;
              // Сравниваем с учетом возможных различий типов
              const isSelected = selectedAnswer !== null && 
                               (selectedAnswer === answer.id || 
                                String(selectedAnswer) === String(answer.id) ||
                                (Number(selectedAnswer) === Number(answer.id) && 
                                 !isNaN(Number(selectedAnswer)) && 
                                 !isNaN(Number(answer.id))));
              const isCorrect = answer.correct === true;
              let answerClass = 'answer-item';
              
              // ========== ЭКЗАМЕН: Блокируем ответы, если время истекло ==========
              const isTimeExpired = isExamMode && examTimeRemaining !== null && examTimeRemaining === 0;
              const isDisabled = isAnswered || isTimeExpired;
              
              if (isAnswered || isTimeExpired) {
                if (isCorrect) {
                  answerClass += ' answer-correct';
                } else if (isSelected && !isCorrect) {
                  answerClass += ' answer-incorrect';
                }
              } else if (isSelected) {
                answerClass += ' answer-selected';
              }
              
              // Определяем правильный ответ для объяснения
              const correctAnswerObj = question.answers.find(a => a.correct === true);
              const wrongAnswerText = (isAnswered || isTimeExpired) && isSelected && !isCorrect ? answer.text : null;
              const correctAnswerText = correctAnswerObj ? correctAnswerObj.text : null;
              const questionId = question.id || `q-${currentQuestionIndex}`;
              const explanationData = explanations[questionId];
              // ИИ-объяснение отключено в режиме экзамена
              const showExplanationButton = !isExamMode && (isAnswered || isTimeExpired) && isSelected && !isCorrect && wrongAnswerText && correctAnswerText;
              
              return (
                <div key={answer.id}>
                <div
                  className={answerClass}
                  onClick={() => !isDisabled && handleAnswerClick(answer.id)}
                  style={{ 
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isTimeExpired ? 0.6 : 1
                  }}
                >
                  {answerNumber}. {answer.text}
                  </div>
                </div>
              );
            }))}
          </div>
          
          {/* Блок с объяснением ИИ для неправильных ответов - показывается только по нажатию кнопки и остается до завершения теста */}
          {(() => {
            // Проверяем, был ли выбран неправильный ответ на текущий вопрос
            const userAnswer = userAnswers[currentQuestionIndex];
            if (!userAnswer || !isAnswered) return null;
            
            const userSelectedId = userAnswer.selectedAnswerId;
            const correctAnswerObj = question.answers.find(a => a.correct === true);
            const userSelectedAnswer = question.answers.find(a => {
              const normalizeId = (id) => {
                if (id === null || id === undefined) return null;
                const num = Number(id);
                if (!isNaN(num)) return num;
                return String(id);
              };
              return normalizeId(a.id) === normalizeId(userSelectedId);
            });
            
            const isIncorrect = userSelectedAnswer && !userSelectedAnswer.correct;
            const questionId = question.id || `q-${currentQuestionIndex}`;
            
            // ИИ-объяснение отключено в режиме экзамена
            if (isExamMode) return null;
            
            if (!isIncorrect || !correctAnswerObj) return null;
            
            const explanationData = explanations[questionId];
            
            return (
              <div className="ai-explanation-block" style={{ marginTop: '20px' }}>
                <div className="ai-explanation-header">
                  <span className="ai-explanation-icon">🤖</span>
                  <span className="ai-explanation-title">Объяснение ИИ:</span>
                </div>
                <div className="ai-explanation-content">
                  {!explanationData && (
                    <button
                      className="explanation-button"
                      onClick={() => getExplanation(questionId, question.text, userSelectedAnswer.text, correctAnswerObj.text)}
                      style={{
                        padding: '12px 20px',
                        fontSize: '15px',
                        fontWeight: '600',
                        backgroundColor: '#2196F3',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#1976D2';
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#2196F3';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.3)';
                      }}
                    >
                      🤖 Почему это неправильно?
                    </button>
                  )}
                  {explanationData?.loading && (
                    <div className="ai-explanation-loading">
                      <span>ИИ анализирует ваш ответ...</span>
                    </div>
                  )}
                  {explanationData?.error && (
                    <div className="ai-explanation-error">
                      {explanationData.error}
                    </div>
                  )}
                  {explanationData?.explanation && (
                    explanationData?.streaming ? (
                      // Показываем текст напрямую с курсором во время печатания
                      <div className="ai-explanation-text">
                        <span>{explanationData.explanation}</span>
                        <span className="typewriter-cursor">|</span>
                      </div>
                    ) : (
                      // После завершения печатания показываем финальный текст
                      <div className="ai-explanation-text">
                        <span>{explanationData.explanation}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        
        <div className="quiz-pagination">
          {questions.map((q, index) => {
            // Определяем правильность ответа для этого вопроса
            const userAnswer = userAnswers[index];
            let isCorrectAnswer = null; // null = не отвечен, true = правильный, false = неправильный
            
            if (userAnswer && userAnswer.selectedAnswerId !== undefined && userAnswer.selectedAnswerId !== null) {
              // Находим выбранный ответ в вопросе
              const question = questions[index];
              const selectedAnswer = question.answers.find(a => {
                const normalizeId = (id) => {
                  if (id === null || id === undefined) return null;
                  const num = Number(id);
                  if (!isNaN(num)) return num;
                  return String(id);
                };
                const normalizedUser = normalizeId(userAnswer.selectedAnswerId);
                const normalizedAnswer = normalizeId(a.id);
                return normalizedUser !== null && normalizedAnswer !== null && normalizedUser === normalizedAnswer;
              });
              
              isCorrectAnswer = selectedAnswer ? selectedAnswer.correct === true : false;
            }
            
            // Формируем классы для кнопки пагинации
            let paginationClass = 'pagination-dot';
            if (index === currentQuestionIndex) {
              paginationClass += ' active';
            }
            if (isCorrectAnswer === true) {
              paginationClass += ' pagination-correct';
            } else if (isCorrectAnswer === false) {
              paginationClass += ' pagination-incorrect';
            }
            
            return (
              <button
                key={index}
                className={paginationClass}
                onClick={() => {
                  // Переходим к другому вопросу
                  const targetAnswer = userAnswers[index];
                  setCurrentQuestionIndex(index);
                  setSelectedAnswer(targetAnswer ? targetAnswer.selectedAnswerId : null);
                  setIsAnswered(targetAnswer ? true : false);
                  // НЕ очищаем объяснения - они должны оставаться видимыми до завершения теста
                }}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        
        </div>
      </>
    )
  }

  // Fallback - show topics if nothing else matches
  return (
    <>
    <div className="topics-container">
        {/* Панель переключения между Тема и Экзамен */}
        <div className="mode-switch-panel">
          <button
            className={`mode-switch-button ${activeMode === 'topic' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('topic')}
          >
            Тема
          </button>
          <button
            className={`mode-switch-button ${activeMode === 'exam' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('exam')}
          >
            Экзамен
          </button>
        </div>
        
      <div className="topics-header">
        <h1 className="topics-title">Темы</h1>
      </div>
      <div className="topics-list">
        {topics.map((topic, index) => {
          // Используем questionCount из темы (загружено из Supabase)
          let questionCount = topic.questionCount || 0;
          
          // Если questionCount не установлен, вычисляем из savedQuestions
          if (!questionCount || questionCount === 0) {
            const staticCount = questionsData[topic.id]?.length || 0;
            const savedCount = savedQuestions.filter(q => {
              // Сравниваем topic_id с учетом возможных различий типов (UUID vs число)
              return q.topic_id === topic.id || 
                     String(q.topic_id) === String(topic.id) ||
                     (Number(q.topic_id) === Number(topic.id) && !isNaN(Number(q.topic_id)) && !isNaN(Number(topic.id)));
            }).length;
            questionCount = staticCount + savedCount;
          }
          
          return (
            <button
              key={topic.id}
              className="topic-item"
              onClick={() => handleTopicClick(topic)}
            >
              <span className="topic-number">{index + 1}.</span>
              <span className="topic-name">{topic.name}</span>
              <span className="topic-count">{questionCount}</span>
            </button>
          )
        })}
      </div>
    </div>
      {/* Модальное окно оплаты */}
      {showPaymentModal && selectedTariff && (
        <PaymentModal />
      )}

      {/* WelcomeModal рендерится через компонент, который использует Portal */}
      <WelcomeModal />
    </>
  )
}

export default App

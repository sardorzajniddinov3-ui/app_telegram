import { useState, useEffect, useRef } from 'react'
import './App.css'
import { initTelegramWebAppSafe } from './telegram'
import { supabase } from './supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

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
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('topics') // 'topics', 'topicDetail', 'quiz', 'admin', 'fullReview', 'examSelect', 'examResult', 'examFullReview', 'registration'
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
  const [grantMessage, setGrantMessage] = useState(null)
  const [subscriptionInfo, setSubscriptionInfo] = useState(null) // /api/subscription/me
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false) // Модальное окно подписки
  const [adminsList, setAdminsList] = useState([]) // Список администраторов
  const [adminsLoading, setAdminsLoading] = useState(false)
  const [adminsError, setAdminsError] = useState(null)
  const [adminForm, setAdminForm] = useState({ telegramId: '' }) // Форма добавления админа
  const [adminFormLoading, setAdminFormLoading] = useState(false)
  const [adminFormMessage, setAdminFormMessage] = useState(null)

  // ========== ФУНКЦИИ ДЛЯ РАБОТЫ С SUPABASE (ТЕМЫ И ВОПРОСЫ) ==========
  
  // Загрузка квизов (тем) из Supabase
  const loadTopicsFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .order('created_at', { ascending: true });

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
        // Загружаем количество вопросов для каждого квиза
        const topicsWithCounts = await Promise.all(
          data.map(async (quiz) => {
            const { count, error: countError } = await supabase
              .from('questions')
              .select('id', { count: 'exact', head: true })
              .eq('quiz_id', quiz.id);

            const questionCount = countError ? 0 : (count || 0);

            // Преобразуем UUID в число для совместимости (или используем порядковый номер)
            // Для совместимости с существующим кодом используем порядковый номер
            return {
              id: quiz.id, // UUID, но в коде может использоваться как строка
              name: quiz.title || quiz.name || 'Без названия',
              questionCount: questionCount,
              order: data.indexOf(quiz) + 1 // Используем порядок из массива
            };
          })
        );

        setTopics(topicsWithCounts);
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

  // Загрузка вопросов из Supabase с опциями
  const loadQuestionsFromSupabase = async () => {
    try {
      // Загружаем вопросы с опциями
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: true });

      if (questionsError) {
        console.error('Ошибка загрузки вопросов из Supabase:', questionsError);
        // Fallback на localStorage
        const saved = JSON.parse(localStorage.getItem('dev_questions') || '[]');
        setSavedQuestions(saved);
        return;
      }

      if (questionsData && questionsData.length > 0) {
        // Загружаем опции для всех вопросов
        const questionIds = questionsData.map(q => q.id);
        const { data: optionsData, error: optionsError } = await supabase
          .from('options')
          .select('*')
          .in('question_id', questionIds)
          .order('created_at', { ascending: true });

        if (optionsError) {
          console.error('Ошибка загрузки опций из Supabase:', optionsError);
        }

        // Группируем опции по question_id
        const optionsByQuestion = {};
        if (optionsData) {
          optionsData.forEach(option => {
            if (!optionsByQuestion[option.question_id]) {
              optionsByQuestion[option.question_id] = [];
            }
            optionsByQuestion[option.question_id].push(option);
          });
        }

        // Преобразуем формат из Supabase в формат приложения
        const formattedQuestions = questionsData.map(q => {
          const options = optionsByQuestion[q.id] || [];
          // Сортируем опции и преобразуем в формат answer_a, answer_b, etc.
          const sortedOptions = options.sort((a, b) => {
            // Сортируем по created_at или по порядку
            return new Date(a.created_at || 0) - new Date(b.created_at || 0);
          });

          const answerMap = {};
          let correctKey = 'a';
          sortedOptions.forEach((option, index) => {
            const key = String.fromCharCode(97 + index); // 'a', 'b', 'c', ...
            answerMap[`answer_${key}`] = option.option_text || '';
            if (option.is_correct) {
              correctKey = key;
            }
          });

          return {
            id: q.id,
            topic_id: q.quiz_id, // Используем quiz_id как topic_id для совместимости
            question: q.question_text || q.question || '',
            ...answerMap,
            correct: correctKey,
            image_url: q.image_url || '',
            answers_count: sortedOptions.length || 4,
            created_at: q.created_at
          };
        });
        
        setSavedQuestions(formattedQuestions);
      } else {
        setSavedQuestions([]);
      }
    } catch (err) {
      console.error('Ошибка загрузки вопросов:', err);
      // Fallback на localStorage
      const saved = JSON.parse(localStorage.getItem('dev_questions') || '[]');
      setSavedQuestions(saved);
    }
  };

  // Загрузка вопросов при открытии админки или изменении экрана
  useEffect(() => {
    loadQuestionsFromSupabase();
  }, [adminScreen]);

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

    for (let i = 0; i < answersCount; i++) {
      const key = String.fromCharCode(97 + i); // 'a', 'b', 'c', ...
      const text = q[`answer_${key}`];
      const id = i + 1;

      // Пропускаем пустые ответы, чтобы в тесте не было «3.» и «4.» без текста
      if (!text || String(text).trim() === '') continue;

      answers.push({
        id,
        text,
        // Пока логика одна: один правильный ответ по букве в q.correct
        correct: q.correct === key
      });
    }

    return answers;
  };

  // Function to get merged questions (static + saved from Supabase)
  const getMergedQuestions = (topicId) => {
    const staticQuestions = questionsData[topicId] || [];
    // Используем savedQuestions из состояния (загружены из Supabase)
    const savedForTopic = savedQuestions
      .filter(q => q.topic_id === topicId)
      .map(q => ({
        id: q.id,
        text: q.question,
        image: q.image_url,
        answers: buildAnswersFromSavedQuestion(q)
      }));
    return [...staticQuestions, ...savedForTopic];
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
      setScreen('topics');
      loadMySubscription();
      await loadUsersFromSupabase();
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Ошибка загрузки пользователей из Supabase:', error);
        setUsersError(error.message || 'Ошибка загрузки пользователей');
        setUsersList([]);
        return;
      }

      const formattedUsers = (data || []).map(profile => ({
        userId: String(profile.id),
        telegramUsername: profile.username || null,
        name: profile.first_name || 'Без имени',
        phone: profile.phone || 'Не указан',
        registrationDate: profile.created_at || new Date().toISOString(),
        lastVisit: profile.created_at || new Date().toISOString(),
        subscription: {
          active: profile.is_premium && profile.premium_until && new Date(profile.premium_until) > new Date(),
          startDate: null,
          endDate: profile.premium_until || null
        }
      }));

      setUsersList(formattedUsers);
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
      setUsersError('Ошибка загрузки пользователей');
      setUsersList([]);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    let timeoutId = null;
    const init = async () => {
      try {
        const tgUser = initTelegramWebAppSafe();

        // Получаем ID пользователя из Telegram (или фоллбек)
        const userId = tgUser?.id ? String(tgUser.id) : null;
        const telegramUsername = tgUser?.username || null;
        void telegramUsername;

        // Если где-то произойдет ошибка/ранний return — лоадер все равно снимется
        timeoutId = setTimeout(() => setLoading(false), 2500);

        // Загружаем список всех пользователей из Supabase
        await loadUsersFromSupabase();
        
        // Загружаем темы и вопросы из Supabase
        await loadTopicsFromSupabase();
        await loadQuestionsFromSupabase();

        // Проверяем админ-доступ
        const MAIN_ADMIN_TELEGRAM_ID = 473842863; // Главный админ
        const userIdNumber = userId ? Number(userId) : null;
        
        // Проверяем, является ли пользователь главным админом
        if (userIdNumber === MAIN_ADMIN_TELEGRAM_ID) {
          console.log('✅ Главный администратор обнаружен (ID: 473842863)');
          setUserRole('admin');
          setScreen('topics');
          setLoading(false);
          if (timeoutId) clearTimeout(timeoutId);
          return;
        }
        
        // Проверяем админ-доступ через API для других пользователей
        if (userId) {
          try {
            console.log('🔍 Проверка админ-доступа для userId:', userId);
            console.log('🔗 Backend URL:', BACKEND_URL);
            const checkRes = await fetch(`${BACKEND_URL}/api/admin/check`, {
              method: 'GET',
              headers: getUserHeaders()
            });
            console.log('📡 Ответ от /api/admin/check:', checkRes.status, checkRes.statusText);
            const checkData = await checkRes.json().catch(() => ({}));
            console.log('📦 Данные ответа:', checkData);
            if (checkData.isAdmin === true) {
              console.log('✅ Пользователь является администратором');
              setUserRole('admin');
              setScreen('topics');
              setLoading(false);
              if (timeoutId) clearTimeout(timeoutId);
              return;
            } else {
              console.log('❌ Пользователь НЕ является администратором');
            }
          } catch (err) {
            console.error('❌ Ошибка проверки админ-доступа:', err);
            console.error('Детали ошибки:', err.message);
            // Продолжаем как обычный пользователь
          }
        } else {
          console.log('⚠️ userId отсутствует, пропускаем проверку админ-доступа');
        }

        // Проверяем, зарегистрирован ли пользователь в Supabase
        if (userId) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', Number(userId))
            .single();

          if (!error && data) {
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
            loadMySubscription();
            return;
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
        }

        setScreen('registration');
        setUserRole('user');
      } catch (_) {
        // Никогда не зависаем на лоадере
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

  // Автоматическая загрузка подписки при открытии экрана topics
  useEffect(() => {
    if (screen === 'topics' && userRole === 'user' && !loading && subscriptionInfo === null) {
      loadMySubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, userRole, loading]);

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

  const loadMySubscription = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/subscription/me`, {
        method: 'GET',
        headers: getUserHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubscriptionInfo({ active: false, subscriptionExpiresAt: null });
        return;
      }
      setSubscriptionInfo(data);
    } catch (error) {
      console.error('Ошибка загрузки подписки:', error);
      setSubscriptionInfo({ active: false, subscriptionExpiresAt: null });
    }
  };

  const hasActiveSubscription = () => {
    const s = subscriptionInfo;
    if (!s) return false;
    const end = s.subscriptionExpiresAt ? new Date(s.subscriptionExpiresAt).getTime() : null;
    return Boolean(s.active && end && end > Date.now());
  };

  const getSubscriptionTimeRemaining = () => {
    if (!subscriptionInfo || !subscriptionInfo.subscriptionExpiresAt) return null;
    const now = Date.now();
    const expires = new Date(subscriptionInfo.subscriptionExpiresAt).getTime();
    const remaining = expires - now;
    if (remaining <= 0) return null;

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}`;
    }
    if (hours > 0) {
      return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`;
    }
    return `${minutes} ${minutes === 1 ? 'минута' : minutes < 5 ? 'минуты' : 'минут'}`;
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

  const loadDbActiveSubscriptions = async () => {
    setDbSubsLoading(true);
    setDbSubsError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/subscriptions/active`, {
        method: 'GET',
        headers: getAdminHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = data?.error || data?.message || `HTTP ${res.status}`;
        // Если 404, возможно backend не запущен или роут не найден
        if (res.status === 404) {
          throw new Error('Роут не найден. Убедитесь, что backend запущен и доступен.');
        }
        throw new Error(errorMsg);
      }
      setDbActiveSubs(Array.isArray(data.users) ? data.users : []);
    } catch (e) {
      const errorMsg = e?.message || 'Ошибка загрузки подписок';
      // Проверяем, не является ли это ошибкой сети
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        setDbSubsError('Ошибка подключения к серверу. Убедитесь, что backend запущен.');
      } else {
        setDbSubsError(errorMsg);
      }
      setDbActiveSubs([]);
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
    setGrantLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/subscriptions/grant`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          telegramId,
          days: Number.isFinite(days) && days > 0 ? days : 30
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = data?.error || data?.message || `HTTP ${res.status}`;
        // Если 404, возможно backend не запущен или роут не найден
        if (res.status === 404) {
          throw new Error('Роут не найден. Убедитесь, что backend запущен и доступен.');
        }
        throw new Error(errorMsg);
      }
      setGrantMessage(`Подписка выдана: до ${new Date(data.user.subscriptionExpiresAt).toLocaleString('ru-RU')}`);
      await loadDbActiveSubscriptions();
    } catch (e2) {
      const errorMsg = e2?.message || 'Ошибка выдачи подписки';
      // Проверяем, не является ли это ошибкой сети
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        setGrantMessage('Ошибка подключения к серверу. Убедитесь, что backend запущен.');
      } else {
        setGrantMessage(errorMsg);
      }
    } finally {
      setGrantLoading(false);
    }
  };

  // Функции для управления администраторами
  const loadAdmins = async () => {
    setAdminsLoading(true);
    setAdminsError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/admins`, {
        method: 'GET',
        headers: getAdminHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      setAdminsList(Array.isArray(data.admins) ? data.admins : []);
    } catch (e) {
      setAdminsError(e?.message || 'Ошибка загрузки администраторов');
      setAdminsList([]);
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
    setAdminFormLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/admins`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ telegramId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      setAdminFormMessage('Администратор успешно добавлен');
      setAdminForm({ telegramId: '' });
      await loadAdmins();
    } catch (e2) {
      setAdminFormMessage(e2?.message || 'Ошибка добавления администратора');
    } finally {
      setAdminFormLoading(false);
    }
  };

  const handleRemoveAdmin = async (telegramId) => {
    if (!confirm(`Удалить администратора с ID ${telegramId}?`)) {
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/admins/${telegramId}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      await loadAdmins();
    } catch (e) {
      alert(e?.message || 'Ошибка удаления администратора');
    }
  };

  const handleTopicClick = (topic) => {
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
    const questions = getMergedQuestions(selectedTopic.id);
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
    setScreen('quiz')
  }

  // ========== ЭКЗАМЕН: Обработчик выбора количества вопросов ==========
  const handleExamQuestionCountSelect = (count) => {
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
    setActiveMode(mode);
    if (mode === 'topic') {
      setScreen('topics');
      setIsExamMode(false);
    } else if (mode === 'exam') {
      setScreen('examSelect');
      setIsExamMode(false);
    }
  }

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
    
    // Автоматический переход к следующему вопросу
    const isLastQuestion = currentQuestionIndex + 1 >= questions.length;
    
    if (!isLastQuestion) {
      // Небольшая пауза, чтобы пользователь успел увидеть подсветку ответа
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
    
    // Если загружен файл, конвертируем в base64 или сохраняем URL
    if (questionForm.imageFile) {
      // Для localStorage сохраняем как base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        saveQuestionWithImage(base64String);
      };
      reader.readAsDataURL(questionForm.imageFile);
      return; // Выходим, так как сохранение произойдет в onloadend
    }
    
    saveQuestion(imageUrl);
  };

  // Функция для сохранения вопроса с изображением
  const saveQuestionWithImage = (imageBase64) => {
    const questionData = buildQuestionData(imageBase64);
    saveQuestionToStorage(questionData);
  };

  // Функция для сохранения вопроса без изображения
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
      answersMap[`answer_${key}`] = answer.text.trim();
    });
    
    return {
      question: questionForm.text.trim(),
      ...answersMap,
      correct: questionForm.correct,
      image_url: imageUrl,
      topic_id: questionForm.topicId,
      answers_count: questionForm.answers.length
    };
  };

  // Функция для сохранения вопроса в Supabase (с опциями)
  const saveQuestionToStorage = async (questionData) => {
    console.log('Сохранение вопроса в Supabase:', questionData);

    try {
      // Подготавливаем данные для таблицы questions
      const questionSupabaseData = {
        quiz_id: questionData.topic_id, // topic_id используется как quiz_id
        question_text: questionData.question,
        image_url: questionData.image_url || null,
        explanation: null // Можно добавить позже
      };

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
      answerKeys.forEach((key, index) => {
        const answerText = questionData[`answer_${key}`];
        if (answerText && answerText.trim()) {
          optionsToInsert.push({
            question_id: questionId,
            option_text: answerText.trim(),
            is_correct: questionData.correct === key
          });
        }
      });

      if (optionsToInsert.length > 0) {
        const { error: optionsError } = await supabase
          .from('options')
          .insert(optionsToInsert);

        if (optionsError) {
          console.error('Ошибка сохранения опций в Supabase:', optionsError);
          alert('Вопрос сохранен, но произошла ошибка при сохранении ответов: ' + optionsError.message);
        }
      }

      console.log('Вопрос успешно сохранен в Supabase:', questionId);
      
      // Перезагружаем вопросы из Supabase
      await loadQuestionsFromSupabase();
      
      // Обновляем количество вопросов в квизе
      await updateTopicQuestionCount(questionData.topic_id);
      
      alert(editingQuestion ? 'Вопрос успешно обновлен!' : 'Вопрос успешно добавлен!');
      resetQuestionForm();
      setEditingQuestion(null);
      
      // Если редактировали вопрос из темы, возвращаемся к списку вопросов темы
      if (adminSelectedTopic && editingQuestion) {
        setAdminScreen('topicQuestions');
      } else {
        setAdminScreen('list');
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

  // Функция для загрузки изображения
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверяем тип файла
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите файл изображения!');
        return;
      }
      
      // Проверяем размер файла (макс 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5MB!');
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
      topicId: topics && topics.length > 0 ? topics[0].id : 1
    });
  };

  // Инициализация формы при переходе на экран добавления вопроса
  useEffect(() => {
    if (adminScreen === 'add' && !editingQuestion) {
      // Проверяем, что форма не инициализирована или имеет старый формат
      if (!Array.isArray(questionForm.answers) || questionForm.answers.length === 0) {
        const firstTopicId = topics && topics.length > 0 ? topics[0].id : 1;
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
          topicId: firstTopicId
        });
      }
    }
  }, [adminScreen, editingQuestion]);

  // Компонент статуса подписки (глобальный)
  const SubscriptionStatusBadge = () => {
    if (userRole === 'admin' || loading || userRole === null) return null;

    const isActive = hasActiveSubscription();

    return (
      <>
        <div
          className="subscription-status-badge"
          onClick={() => setShowSubscriptionModal(true)}
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 99999,
            display: 'block',
            visibility: 'visible',
            opacity: 1
          }}
        >
          {isActive ? (
            <div className="subscription-badge-active">
              <span className="subscription-badge-icon">✓</span>
              <span className="subscription-badge-text">Подписка</span>
            </div>
          ) : (
            <div className="subscription-badge-inactive">
              <span className="subscription-badge-icon">⚠</span>
              <span className="subscription-badge-text">Нет подписки</span>
            </div>
          )}
        </div>

        {showSubscriptionModal && (
          <div className="subscription-modal-overlay" onClick={() => setShowSubscriptionModal(false)}>
            <div className="subscription-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="subscription-modal-header">
                <h2 className="subscription-modal-title">Статус подписки</h2>
                <button className="subscription-modal-close" onClick={() => setShowSubscriptionModal(false)}>
                  ✕
                </button>
              </div>

              <div className="subscription-modal-body">
                {isActive ? (
                  <>
                    <div className="subscription-status-card active">
                      <div className="subscription-status-icon-large">✓</div>
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
                      </div>
                    </div>
                    <button className="subscription-renew-button" onClick={handlePayment}>
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
                    <button className="subscription-purchase-button" onClick={handlePayment}>
                      Оформить подписку
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  if (loading || userRole === null) {
    return (
      <div className="quiz-container">
        <div className="quiz-content">
          <p style={{ textAlign: 'center' }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  // Show admin panel only for admin users (when screen is 'admin')
  if (userRole === 'admin' && screen === 'admin') {
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
                  onChange={(e) => handleFormChange('topicId', parseInt(e.target.value))}
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
                      <div className="answer-input-wrapper">
                        <label className="answer-label">
                          {String.fromCharCode(65 + index)}. 
                          <input
                            type="text"
                            value={answer.text}
                            onChange={(e) => handleAnswerChange(index, 'text', e.target.value)}
                            className="form-input answer-input"
                            placeholder={`Вариант ответа ${String.fromCharCode(65 + index)}`}
                            required
                          />
                        </label>
                        <div className="answer-actions">
                          <label className="correct-answer-checkbox">
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={safeQuestionForm.correct === answer.id}
                              onChange={() => handleFormChange('correct', answer.id)}
                            />
                            <span>Правильный</span>
                          </label>
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
                      </div>
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
                    <label htmlFor="image-upload" className="image-upload-label">
                      📷 Выбрать изображение из галереи
                    </label>
                  </div>
                )}
              </div>

              <button type="submit" className="admin-submit-button">
                {adminScreen === 'add' ? 'Добавить вопрос' : 'Сохранить изменения'}
              </button>
            </form>
          </div>
        </div>
      );
    }

    // Экран просмотра пользователей
    if (adminScreen === 'users') {
      const allUsers = usersList;
      
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

            <div className="admin-stats">
              <p>Всего пользователей: {allUsers.length}</p>
              <p>С активной подпиской: {allUsers.filter(u => u.subscription?.active && new Date(u.subscription.endDate) > new Date()).length}</p>
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="admin-users-button"
                onClick={loadUsersFromSupabase}
                disabled={usersLoading}
                style={{ maxWidth: '200px' }}
              >
                {usersLoading ? 'Загрузка...' : '↻ Обновить список'}
              </button>
              {usersError && (
                <p style={{ color: '#f44336', margin: 0, fontSize: '14px' }}>
                  {usersError}
                </p>
              )}
            </div>

            <div className="admin-users-list">
              {usersLoading ? (
                <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Загрузка пользователей...
                </p>
              ) : allUsers.length === 0 ? (
                <p style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  Пользователей пока нет
                </p>
              ) : (
                allUsers.map((user, index) => {
                  const hasActiveSubscription = user.subscription?.active && 
                    user.subscription.endDate && 
                    new Date(user.subscription.endDate) > new Date();
                  const subscriptionEndDate = user.subscription?.endDate 
                    ? new Date(user.subscription.endDate).toLocaleDateString('ru-RU')
                    : null;
                  const subscriptionStartDate = user.subscription?.startDate 
                    ? new Date(user.subscription.startDate).toLocaleDateString('ru-RU')
                    : null;
                  const lastVisit = user.lastVisit 
                    ? new Date(user.lastVisit).toLocaleDateString('ru-RU', { 
                        year: 'numeric', 
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : null;

                  return (
                    <div key={user.userId} className="admin-user-item">
                      <div className="admin-user-info">
                        <div className="admin-user-header">
                          <span className="admin-user-number">{index + 1}.</span>
                          <span className="admin-user-name">{user.name}</span>
                          {hasActiveSubscription && (
                            <span className="admin-user-subscription-badge">✓ Подписка активна</span>
                          )}
                        </div>
                        <div className="admin-user-details">
                          <p><strong>Телефон:</strong> {user.phone}</p>
                          {user.telegramUsername && (
                            <p><strong>Telegram:</strong> @{user.telegramUsername}</p>
                          )}
                          <p><strong>Регистрация:</strong> {new Date(user.registrationDate).toLocaleDateString('ru-RU')}</p>
                          <p><strong>Последний визит:</strong> {lastVisit || 'Не заходил'}</p>
                          {user.subscription?.active ? (
                            <>
                              <p><strong>Подписка оформлена:</strong> {subscriptionStartDate || 'Не указано'}</p>
                              <p><strong>Подписка до:</strong> {subscriptionEndDate || 'Не указано'}</p>
                              {subscriptionEndDate && new Date(user.subscription.endDate) <= new Date() && (
                                <p style={{ color: '#f44336', fontWeight: 'bold' }}>⚠ Подписка истекла</p>
                              )}
                            </>
                          ) : (
                            <p style={{ color: '#999' }}>Нет активной подписки</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
              <h3 style={{ margin: '0 0 10px' }}>Подписки (БД)</h3>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <button
                  type="button"
                  className="admin-users-button"
                  onClick={loadDbActiveSubscriptions}
                  disabled={dbSubsLoading}
                >
                  {dbSubsLoading ? 'Загрузка...' : '↻ Обновить активные'}
                </button>
              </div>

              {dbSubsError && (
                <p style={{ color: '#f44336', margin: '8px 0' }}>
                  {dbSubsError}
                </p>
              )}

              <div className="admin-stats" style={{ marginTop: '10px' }}>
                <p>Активных подписок в БД: {dbActiveSubs.length}</p>
              </div>

              {dbActiveSubs.length > 0 && (
                <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
                  {dbActiveSubs.map((u) => (
                    <div key={String(u.telegramId)} className="admin-user-item">
                      <div className="admin-user-info">
                        <div className="admin-user-header">
                          <span className="admin-user-name">
                            {u.name && String(u.name).trim() ? u.name : 'Без имени'}
                          </span>
                          <span style={{ color: '#666' }}>ID: {String(u.telegramId)}</span>
                        </div>
                        <div className="admin-user-details">
                          <p>
                            <strong>Статус:</strong> {u.subscriptionStatus}
                          </p>
                          <p>
                            <strong>До:</strong>{' '}
                            {u.subscriptionExpiresAt
                              ? new Date(u.subscriptionExpiresAt).toLocaleString('ru-RU')
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 8px' }}>Выдать подписку</h4>
                <form onSubmit={handleGrantSubscription} className="admin-form" style={{ maxWidth: '520px' }}>
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
            </div>
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

            {adminsLoading && adminsList.length === 0 ? (
              <p>Загрузка администраторов...</p>
            ) : adminsList.length === 0 ? (
              <p>Нет администраторов</p>
            ) : (
              <div className="admin-users-list">
                {adminsList.map((admin) => {
                  const isMainAdminUser = Number(admin.telegramId) === 473842863;
                  const isCurrentUser = currentUserId && Number(admin.telegramId) === currentUserId;
                  const canDelete = !isMainAdminUser && !isCurrentUser;

                  return (
                    <div key={admin.telegramId} className="admin-user-card">
                      <div className="admin-user-content">
                        <div className="admin-user-header">
                          <span className="admin-user-name">
                            ID: {String(admin.telegramId)}
                            {isMainAdminUser && ' (Главный админ)'}
                            {isCurrentUser && ' (Вы)'}
                          </span>
                        </div>
                        <div className="admin-user-details">
                          <p>
                            <strong>Добавлен:</strong>{' '}
                            {admin.createdAt
                              ? new Date(admin.createdAt).toLocaleString('ru-RU')
                              : '—'}
                          </p>
                          {admin.createdBy && (
                            <p>
                              <strong>Добавил:</strong> ID {String(admin.createdBy)}
                            </p>
                          )}
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            className="admin-delete-button"
                            onClick={() => handleRemoveAdmin(admin.telegramId)}
                            style={{ marginTop: '8px' }}
                          >
                            🗑️ Удалить
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <h4 style={{ margin: '0 0 8px' }}>Добавить администратора</h4>
              <form onSubmit={handleAddAdmin} className="admin-form" style={{ maxWidth: '520px' }}>
                <div className="form-group">
                  <label>Telegram ID *</label>
                  <input
                    value={adminForm.telegramId}
                    onChange={(ev) => setAdminForm({ ...adminForm, telegramId: ev.target.value })}
                    placeholder="например 123456789"
                  />
                </div>
                <button type="submit" className="admin-submit-button" disabled={adminFormLoading}>
                  {adminFormLoading ? 'Добавление...' : 'Добавить администратора'}
                </button>
                {adminFormMessage && (
                  <p style={{ marginTop: '10px', color: adminFormMessage.startsWith('Администратор успешно') ? '#2e7d32' : '#f44336' }}>
                    {adminFormMessage}
                  </p>
                )}
              </form>
            </div>
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
                  loadDbActiveSubscriptions();
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
              const savedCount = savedQuestions.filter(q => q.topic_id === topic.id).length;
              const questionCount = staticCount + savedCount;
              const topicSavedQuestions = savedQuestions.filter(q => q.topic_id === topic.id);
              
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
                        {questionCount} вопросов
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
                onChange={(e) => setRegistrationForm({ ...registrationForm, phone: e.target.value })}
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
    );
  }

  // ========== ЭКЗАМЕН: Экран выбора количества вопросов ==========
  if (screen === 'examSelect') {
    const allQuestions = getAllQuestions();
    const totalQuestionsAvailable = allQuestions.length;
    
    return (
      <>
        <SubscriptionStatusBadge />
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
          <h1 className="topics-title">Экзамен</h1>
        </div>
        
        <div className="exam-select-container">
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
        <SubscriptionStatusBadge />
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
          {userRole === 'admin' && (
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
            const staticCount = questionsData[topic.id]?.length || 0;
            const saved = JSON.parse(localStorage.getItem('dev_questions') || '[]');
            const savedCount = saved.filter(q => q.topic_id === topic.id).length;
            const questionCount = staticCount + savedCount;
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
        <SubscriptionStatusBadge />
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
            <div className="result-id"><span>●</span> {latestResult.id}</div>
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
                      <span className="history-id">{result.id}</span>
                      <span className="history-score">{result.correct}/{result.total} ({result.percentage || Math.round((result.correct / result.total) * 100)}%)</span>
                      <span className="history-time">{result.timeFormatted}</span>
                      <span className="history-date">{result.dateTime}</span>
                    </div>
                    <button
                      className="history-review-button"
                      onClick={() => {
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
    const reviewResult = selectedResult || (results[selectedTopic.id] || [])[0];
    
    if (!reviewResult || !reviewResult.questions || !reviewResult.userAnswers) {
      return (
        <div className="topic-detail-container">
          <div className="topic-detail-header">
            <button className="back-button" onClick={() => {
              setSelectedResult(null);
              setScreen('topicDetail');
            }}>
              ← Назад
            </button>
            <h2 className="topic-detail-title">{selectedTopic.name}</h2>
          </div>
          <p>Нет данных для просмотра</p>
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
      <div className="full-review-container">
        <div className="full-review-header">
          <button className="back-button" onClick={() => {
            setSelectedResult(null);
            setScreen('topicDetail');
          }}>
            ← Назад
          </button>
          <h2 className="full-review-title">{selectedTopic.name}</h2>
        </div>
        
        <div className="full-review-result-info">
          {reviewResult.id && (
            <div className="review-result-id">ID: {reviewResult.id}</div>
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
                {question.image && (
                  <img
                    src={question.image}
                    alt="question"
                    className="review-question-image"
                  />
                )}
                <h3 className="review-question-text">{question.text}</h3>
                
                {/* Визуальная отладка - показываем сохраненный ответ */}
                {userAnswer && (
                  <div style={{ 
                    padding: '10px', 
                    marginBottom: '10px', 
                    backgroundColor: '#f0f0f0', 
                    borderRadius: '5px',
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    <strong>Отладка:</strong> Сохраненный ID ответа: <code>{String(userAnswer.selectedAnswerId)}</code> (тип: {typeof userAnswer.selectedAnswerId})<br/>
                    Доступные ID ответов: {question.answers.map(a => `${a.id}(${typeof a.id})`).join(', ')}
                  </div>
                )}
                
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
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ========== ЭКЗАМЕН: Экран результатов экзамена ==========
  if (screen === 'examResult') {
    const examResult = selectedExamResult || (results['exam'] || [])[0];
    
    if (!examResult) {
      return (
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
      );
    }

    return (
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
          <div className="result-id"><span>●</span> {examResult.id}</div>
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
    );
  }

  // ========== ЭКЗАМЕН: Экран полного обзора результатов экзамена ==========
  if (screen === 'examFullReview') {
    const reviewResult = selectedExamResult || (results['exam'] || [])[0];
    
    if (!reviewResult || !reviewResult.questions || !reviewResult.userAnswers) {
      return (
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
      );
    }

    const questions = reviewResult.questions;
    const userAnswers = reviewResult.userAnswers;

    return (
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
          {reviewResult.id && (
            <div className="review-result-id">ID: {reviewResult.id}</div>
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
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (screen === 'quiz') {
    // ========== ЭКЗАМЕН: Используем сохраненные вопросы теста ==========
    // Для экзамена используем testQuestions, для теста по теме - из selectedTopic
    const questions = testQuestions.length > 0 
      ? testQuestions 
      : (selectedTopic ? getMergedQuestions(selectedTopic.id) : []);
    const question = questions[currentQuestionIndex]

    if (!question) {
      return (
        <>
          <SubscriptionStatusBadge />
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
        <SubscriptionStatusBadge />
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
            {question.answers.map((answer, index) => {
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
              
              return (
                <div
                  key={answer.id}
                  className={answerClass}
                  onClick={() => !isDisabled && handleAnswerClick(answer.id)}
                  style={{ 
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isTimeExpired ? 0.6 : 1
                  }}
                >
                  {answerNumber}. {answer.text}
                </div>
              );
            })}
          </div>
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
    <div className="topics-container">
      <div className="topics-header">
        <h1 className="topics-title">Темы</h1>
      </div>
      <div className="topics-list">
        {topics.map((topic, index) => {
          const questionCount = questionsData[topic.id]?.length || 0
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
  )
}

export default App

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { initTelegramWebAppSafe } from './telegram';

const StatisticsScreen = ({ onBack, topics: topicsProp, onTopicSelect, checkAILimit, incrementAIUsage }) => {
  const [statsData, setStatsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Состояния для аналитики
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsAiVerdict, setAnalyticsAiVerdict] = useState(null);
  
  // Локальное состояние для тем (если не переданы через пропсы)
  const [topics, setTopics] = useState(topicsProp || []);

  // Загружаем темы, если они не переданы через пропсы
  useEffect(() => {
    if (topicsProp && topicsProp.length > 0) {
      setTopics(topicsProp);
    } else {
      loadTopics();
    }
  }, [topicsProp]);

  // Загружаем статистику после загрузки тем
  useEffect(() => {
    if (topics && topics.length > 0) {
      loadStatistics();
      loadAnalyticsData();
    }
  }, [topics]); // Перезагружаем статистику, когда topics загружены

  // Загрузка тем из Supabase
  const loadTopics = async () => {
    try {
      console.log('[STATISTICS] Загрузка тем из Supabase...');
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, name')
        .order('created_at', { ascending: true })
        .limit(10000);

      if (error) {
        console.error('[STATISTICS] Ошибка загрузки тем:', error);
        return;
      }

      if (data && data.length > 0) {
        const topicsList = data.map(quiz => ({
          id: quiz.id,
          name: quiz.title || quiz.name || 'Без названия'
        }));
        
        console.log('[STATISTICS] Загружено тем:', topicsList.length);
        console.log('[STATISTICS] Темы:', topicsList.map(t => ({ id: t.id, name: t.name })));
        setTopics(topicsList);
      }
    } catch (err) {
      console.error('[STATISTICS] Ошибка при загрузке тем:', err);
    }
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Получаем userId из Telegram
      const tgUser = initTelegramWebAppSafe();
      const userId = tgUser?.id ? Number(tgUser.id) : null;

      if (!userId) {
        setError('Пользователь не авторизован');
        setLoading(false);
        return;
      }

      console.log('[STATISTICS] Загрузка статистики для userId:', userId);

      // Загружаем статистику из представления user_topic_stats
      const { data, error: fetchError } = await supabase
        .from('user_topic_stats')
        .select('*')
        .eq('user_id', userId)
        .order('mastery_percentage', { ascending: false });

      if (fetchError) {
        console.error('[STATISTICS] Ошибка загрузки:', fetchError);
        setError('Ошибка загрузки статистики');
        return;
      }

      console.log('[STATISTICS] Загружено записей:', data?.length || 0);
      console.log('[STATISTICS] Доступные topics:', topics?.length || 0);
      if (topics && topics.length > 0) {
        console.log('[STATISTICS] Список topics:', topics.map(t => ({ id: t.id, name: t.name, idType: typeof t.id })));
      }
      
      if (!data || data.length === 0) {
        setStatsData([]);
        setLoading(false);
        return;
      }
      
      // Логируем структуру первой записи для отладки
      if (data && data.length > 0) {
        console.log('[STATISTICS] Структура первой записи:', Object.keys(data[0]));
        console.log('[STATISTICS] Первая запись полностью:', data[0]);
      }
      
      // Обогащаем данные названиями тем из списка topics
      const enrichedData = (data || []).map(stat => {
        // Пробуем разные варианты названий полей
        const topicId = stat.topic_id || stat.quiz_id || stat.topicId || stat.quizId;
        let topicName = stat.topic_name || stat.topicName || stat.quiz_name || stat.quizName;
        
        // Пропускаем записи без topic_id
        if (!topicId || topicId === undefined || topicId === null || topicId === 'undefined' || topicId === 'null' || String(topicId).trim() === '') {
          console.warn('[STATISTICS] Пропуск записи без topic_id:', {
            stat_keys: Object.keys(stat),
            stat_values: Object.values(stat).slice(0, 5) // Первые 5 значений для отладки
          });
          return null;
        }
        
        console.log(`[STATISTICS] Обработка темы ${topicId} (тип: ${typeof topicId}):`, {
          topic_name_from_db: topicName,
          topic_name_type: typeof topicName,
          topics_available: topics?.length || 0,
          stat_keys: Object.keys(stat)
        });
        
        // Если нет названия или оно undefined/null, ищем в списке topics
        const hasValidName = topicName && 
                            topicName !== 'undefined' && 
                            topicName !== undefined && 
                            topicName !== null &&
                            String(topicName).trim() !== '' &&
                            String(topicName).trim() !== 'null';
        
        if (!hasValidName) {
          if (topics && topics.length > 0) {
            console.log(`[STATISTICS] Ищем тему ${topicId} (${typeof topicId}) в списке topics...`);
            
            // Пробуем разные варианты сравнения
            const foundTopic = topics.find(t => {
              if (!t || !t.id) {
                console.log(`[STATISTICS] Пропуск темы: нет id`, t);
                return false;
              }
              
              const topicIdStr = String(topicId).trim();
              const tIdStr = String(t.id).trim();
              
              // Прямое сравнение строк
              if (tIdStr === topicIdStr) {
                console.log(`[STATISTICS] ✅ Найдено точное совпадение строк: "${tIdStr}" === "${topicIdStr}"`);
                return true;
              }
              
              // Сравнение без учета регистра
              if (tIdStr.toLowerCase() === topicIdStr.toLowerCase()) {
                console.log(`[STATISTICS] ✅ Найдено совпадение (без учета регистра): "${tIdStr}" === "${topicIdStr}"`);
                return true;
              }
              
              // Попытка сравнения как числа
              const topicIdNum = Number(topicId);
              const tIdNum = Number(t.id);
              if (!isNaN(topicIdNum) && !isNaN(tIdNum) && topicIdNum === tIdNum) {
                console.log(`[STATISTICS] ✅ Найдено совпадение чисел: ${tIdNum} === ${topicIdNum}`);
                return true;
              }
              
              // Прямое сравнение объектов (для UUID)
              if (t.id === topicId) {
                console.log(`[STATISTICS] ✅ Найдено прямое совпадение объектов: ${t.id} === ${topicId}`);
                return true;
              }
              
              return false;
            });
            
            if (foundTopic && foundTopic.name) {
              topicName = foundTopic.name;
              console.log(`[STATISTICS] ✅ Найдено название темы для ${topicId}: "${topicName}"`);
            } else {
              console.warn(`[STATISTICS] ❌ Тема ${topicId} (${typeof topicId}) не найдена в списке topics`);
              console.warn(`[STATISTICS] Доступные ID тем:`, topics.map(t => ({ id: t.id, idType: typeof t.id, name: t.name })));
            }
          } else {
            console.warn(`[STATISTICS] Список topics пуст или не загружен`);
          }
        } else {
          console.log(`[STATISTICS] Используется название из БД: "${topicName}"`);
        }
        
        const finalTopicName = topicName && 
                              topicName !== 'undefined' && 
                              topicName !== undefined && 
                              topicName !== null &&
                              String(topicName).trim() !== '' &&
                              String(topicName).trim() !== 'null'
                              ? String(topicName).trim()
                              : `Тема ${topicId}`;
        
        return {
          ...stat,
          topic_id: topicId, // Убеждаемся, что topic_id установлен
          topic_name: finalTopicName
        };
      }).filter(item => item !== null && item.topic_id); // Убираем записи без topic_id
      
      console.log('[STATISTICS] Обогащенные данные (после фильтрации):', enrichedData.length, 'записей');
      console.log('[STATISTICS] Обогащенные данные:', enrichedData.map(d => ({ 
        topic_id: d.topic_id, 
        topic_id_type: typeof d.topic_id,
        topic_name: d.topic_name 
      })));
      
      setStatsData(enrichedData);

    } catch (err) {
      console.error('[STATISTICS] Критическая ошибка:', err);
      setError('Произошла ошибка при загрузке статистики');
    } finally {
      setLoading(false);
    }
  };

  // Функция для определения цвета прогресс-бара
  const getProgressColor = (percentage) => {
    if (percentage >= 80) return 'green';
    if (percentage >= 50) return 'yellow';
    return 'red';
  };

  // Функция для получения названия темы
  const getTopicName = (topicId, topicName) => {
    // Если есть название из БД и оно валидное, используем его
    if (topicName && 
        topicName !== 'undefined' && 
        topicName !== undefined && 
        topicName !== null &&
        String(topicName).trim() !== '' &&
        String(topicName).trim() !== 'null') {
      return String(topicName).trim();
    }
    
    // Пытаемся найти тему в списке topics
    if (topics && topics.length > 0 && topicId) {
      const foundTopic = topics.find(t => {
        if (!t || !t.id) return false;
        
        // Сравниваем как строки и как числа
        const topicIdStr = String(topicId);
        const topicIdNum = Number(topicId);
        const tIdStr = String(t.id);
        const tIdNum = Number(t.id);
        
        return tIdStr === topicIdStr || 
               tIdStr === String(topicIdNum) ||
               tIdNum === topicIdNum ||
               t.id === topicId ||
               tIdStr.toLowerCase() === topicIdStr.toLowerCase();
      });
      
      if (foundTopic && foundTopic.name) {
        console.log(`[STATISTICS] getTopicName: Найдена тема ${topicId} -> ${foundTopic.name}`);
        return foundTopic.name;
      } else {
        console.warn(`[STATISTICS] getTopicName: Тема ${topicId} не найдена в списке topics. Доступные темы:`, topics.map(t => ({ id: t.id, name: t.name })));
      }
    }
    
    // Если ничего не нашли, возвращаем ID
    console.warn(`[STATISTICS] getTopicName: Используется fallback для ${topicId}`);
    return `Тема ${topicId}`;
  };

  // Загрузка аналитики (старая функция из App.jsx)
  const loadAnalyticsData = async () => {
    const tgUser = initTelegramWebAppSafe();
    const currentUserId = tgUser?.id ? String(tgUser.id) : null;
    
    if (!currentUserId) {
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
        .limit(10000);
      
      if (testResultsError) {
        console.error('[ANALYTICS] Ошибка загрузки результатов тестов:', testResultsError);
      }
      
      // Загружаем ошибки пользователя, сгруппированные по темам
      const { data: userErrors, error: userErrorsError } = await supabase
        .from('user_errors')
        .select('topic_id, question_id, error_count')
        .eq('user_id', Number(currentUserId))
        .limit(10000);
      
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
        const topic = topics?.find(t => String(t.id) === stats.topicId);
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
      
      const result = {
        topics: analyticsArray,
        weakTopics: weakTopics,
        totalTopics: analyticsArray.length
      };
      
      // Обновляем состояние
      setAnalyticsData(result);
      
      // НЕ загружаем AI-вердикт автоматически - только по кнопке
      // if (analyticsArray.length > 0) {
      //   setTimeout(() => {
      //     loadAnalyticsAiVerdict(analyticsArray, weakTopics);
      //   }, 500);
      // }
      
      return result;
      
    } catch (error) {
      console.error('[ANALYTICS] Ошибка загрузки статистики:', error);
      return null;
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Загрузка AI-вердикта
  const loadAnalyticsAiVerdict = async (analyticsTopics, weakTopics) => {
    const tgUser = initTelegramWebAppSafe();
    const currentUserId = tgUser?.id ? String(tgUser.id) : null;
    
    if (!currentUserId) {
      setAnalyticsAiVerdict({
        loading: false,
        text: null,
        error: 'Пользователь не авторизован'
      });
      return;
    }
    
    if (!analyticsTopics || analyticsTopics.length === 0) {
      setAnalyticsAiVerdict({
        loading: false,
        text: null,
        error: 'Нет данных для анализа. Пройдите хотя бы один тест.'
      });
      return;
    }
    
    setAnalyticsAiVerdict({
      loading: true,
      text: null,
      error: null
    });
    
    try {
      console.log('[ANALYTICS] Загрузка AI-вердикта для статистики');
      console.log('[ANALYTICS] Данные:', {
        topicsCount: analyticsTopics.length,
        weakTopicsCount: weakTopics?.length || 0
      });
      
      const userErrorsArray = weakTopics && weakTopics.length > 0
        ? weakTopics.map(topic => ({
            topic_id: String(topic.topicId),
            topic_name: String(topic.topicName),
            error_count: Number(topic.errorCount) || 0,
            percentage: Number(topic.averagePercentage) || 0
          }))
        : [];
      
      const avgScore = analyticsTopics.length > 0
        ? analyticsTopics.reduce((sum, t) => sum + (Number(t.averagePercentage) || 0), 0) / analyticsTopics.length
        : 0;
      
      const requestData = {
        userId: String(currentUserId),
        userErrors: userErrorsArray,
        totalScore: Math.round(avgScore * 100) / 100
      };
      
      console.log('[ANALYTICS] Отправка запроса:', {
        userId: requestData.userId,
        userErrorsCount: requestData.userErrors.length,
        totalScore: requestData.totalScore
      });
      
      console.log('[ANALYTICS] Вызов Edge Function с данными:', JSON.stringify(requestData, null, 2));
      
      // Проверяем лимит ИИ перед использованием (это другой тип использования)
      if (checkAILimit) {
        const limitCheck = await checkAILimit(false);
        console.log('[AI_LIMIT] Проверка лимита для вердикта в статистике:', limitCheck);
        
        // СТРОГАЯ ПРОВЕРКА: если allowed === false ИЛИ remaining === 0, блокируем
        if (!limitCheck.allowed || limitCheck.remaining === 0) {
          console.log('[AI_LIMIT] ⛔⛔⛔ БЛОКИРУЕМ ЗАПРОС ВЕРДИКТА - ЛИМИТ ИСЧЕРПАН!');
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
        console.log('[AI_LIMIT] Финальная проверка перед отправкой вердикта:', finalLimitCheck);
        
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
      }
      
      let responseData = null;
      let responseError = null;
      
      try {
        const response = await supabase.functions.invoke('ai-trainer-advice', {
          body: requestData
        });
        
        responseData = response.data;
        responseError = response.error;
        
        console.log('[ANALYTICS] Ответ от Edge Function:', { 
          hasData: !!responseData, 
          hasError: !!responseError,
          dataType: typeof responseData,
          dataKeys: responseData ? Object.keys(responseData) : [],
          errorType: typeof responseError,
          errorDetails: responseError
        });
      } catch (invokeError) {
        console.error('[ANALYTICS] Исключение при вызове Edge Function:', invokeError);
        responseError = invokeError;
      }
      
      // Обрабатываем ошибку
      if (responseError) {
        console.error('[ANALYTICS] Ошибка запроса AI-вердикта:', responseError);
        
        // Генерируем fallback-совет на основе данных
        let fallbackAdvice = null;
        if (analyticsTopics && analyticsTopics.length > 0) {
          const weakTopic = weakTopics && weakTopics.length > 0 ? weakTopics[0] : null;
          if (weakTopic) {
            fallbackAdvice = `Нужно подтянуть "${weakTopic.topicName}" 📚 - там ${weakTopic.errorCount} ошибок. Удели этой теме больше внимания.`;
          } else {
            const avgScore = analyticsTopics.reduce((sum, t) => sum + (Number(t.averagePercentage) || 0), 0) / analyticsTopics.length;
            if (avgScore >= 80) {
              fallbackAdvice = "Отлично справляешься! 💪 Продолжай в том же духе.";
            } else if (avgScore >= 50) {
              fallbackAdvice = "Хороший результат! 💪 Продолжай практиковаться для идеального результата.";
            } else {
              fallbackAdvice = "Нужно больше практики 📚. Повтори темы, где было больше всего ошибок.";
            }
          }
        }
        
        // Пытаемся извлечь более детальную информацию об ошибке
        let errorMessage = 'Не удалось получить вердикт ИИ';
        
        if (responseError.message) {
          errorMessage = responseError.message;
        } else if (typeof responseError === 'string') {
          errorMessage = responseError;
        } else if (responseError.error) {
          errorMessage = responseError.error;
        } else if (responseError.toString) {
          errorMessage = responseError.toString();
        }
        
        // Если это ошибка от Edge Function, показываем fallback-совет вместо ошибки
        if (errorMessage.includes('non-2xx') || errorMessage.includes('status code')) {
          if (fallbackAdvice) {
            // Показываем fallback-совет вместо ошибки
            setAnalyticsAiVerdict({
              loading: false,
              text: fallbackAdvice,
              error: null
            });
            return;
          } else {
            errorMessage = 'Сервис ИИ временно недоступен. Убедитесь, что Edge Function развернут и GEMINI_API_KEY установлен.';
          }
        }
        
        setAnalyticsAiVerdict({
          loading: false,
          text: fallbackAdvice || null,
          error: fallbackAdvice ? null : errorMessage
        });
        return;
      }
      
      // Обрабатываем успешный ответ
      if (responseData) {
        if (responseData.advice) {
          console.log('[ANALYTICS] Получен вердикт:', responseData.advice.substring(0, 100));
          
          // Увеличиваем счетчик использования ИИ после успешного запроса
          if (incrementAIUsage) {
            console.log('[AI_COUNTER] Перед вызовом incrementAIUsage для вердикта в статистике');
            await incrementAIUsage(false);
            console.log('[AI_COUNTER] После вызова incrementAIUsage для вердикта в статистике');
          }
          
          setAnalyticsAiVerdict({
            loading: false,
            text: responseData.advice.substring(0, 200),
            error: null
          });
          return;
        } else if (responseData.error) {
          // Если Edge Function вернул ошибку в data, но статус 200
          console.warn('[ANALYTICS] Edge Function вернул ошибку в data:', responseData.error);
          
          // Генерируем fallback-совет
          let fallbackAdvice = null;
          if (analyticsTopics && analyticsTopics.length > 0) {
            const weakTopic = weakTopics && weakTopics.length > 0 ? weakTopics[0] : null;
            if (weakTopic) {
              fallbackAdvice = `Нужно подтянуть "${weakTopic.topicName}" 📚 - там ${weakTopic.errorCount} ошибок.`;
            }
          }
          
          setAnalyticsAiVerdict({
            loading: false,
            text: fallbackAdvice || null,
            error: fallbackAdvice ? null : (responseData.error || 'ИИ не вернул вердикт. Попробуйте позже.')
          });
          return;
        }
      }
      
      // Если дошли сюда, значит что-то не так с ответом
      console.warn('[ANALYTICS] Неожиданный формат ответа. Получено:', responseData);
      
      // Генерируем fallback-совет
      let fallbackAdvice = null;
      if (analyticsTopics && analyticsTopics.length > 0) {
        const weakTopic = weakTopics && weakTopics.length > 0 ? weakTopics[0] : null;
        if (weakTopic) {
          fallbackAdvice = `Нужно подтянуть "${weakTopic.topicName}" 📚 - там ${weakTopic.errorCount} ошибок.`;
        }
      }
      
      setAnalyticsAiVerdict({
        loading: false,
        text: fallbackAdvice || null,
        error: fallbackAdvice ? null : 'ИИ не вернул вердикт. Проверьте логи Edge Function в Supabase Dashboard.'
      });
      
    } catch (error) {
      console.error('[ANALYTICS] Ошибка загрузки AI-вердикта:', error);
      setAnalyticsAiVerdict({
        loading: false,
        text: null,
        error: `Ошибка загрузки вердикта: ${error.message || 'Неизвестная ошибка'}`
      });
    }
  };

  if (loading) {
    return (
      <div className="statistics-container">
        <div className="statistics-header">
          {onBack && (
            <button className="back-button" onClick={onBack}>
              ← Назад
            </button>
          )}
          <h1 className="statistics-title">Статистика</h1>
        </div>
        <div className="statistics-loading">
          <div className="loading-spinner"></div>
          <p>Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-container">
        <div className="statistics-header">
          {onBack && (
            <button className="back-button" onClick={onBack}>
              ← Назад
            </button>
          )}
          <h1 className="statistics-title">Статистика</h1>
        </div>
        <div className="statistics-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!statsData || statsData.length === 0) {
    return (
      <div className="statistics-container">
        <div className="statistics-header">
          {onBack && (
            <button className="back-button" onClick={onBack}>
              ← Назад
            </button>
          )}
          <h1 className="statistics-title">Статистика</h1>
        </div>
        <div className="statistics-empty">
          <div className="statistics-empty-icon">📊</div>
          <h3>Нет данных</h3>
          <p>Реши хотя бы один тест, чтобы увидеть свою статистику!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="statistics-container">
      <div className="statistics-header">
        {onBack && (
          <button className="back-button" onClick={onBack}>
            ← Назад
          </button>
        )}
        <h1 className="statistics-title">Статистика</h1>
      </div>

      <div className="statistics-content">
        {/* AI-Вердикт - всегда показываем блок */}
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
              <div className="analytics-ai-error">
                {analyticsAiVerdict.error}
                <button 
                  className="analytics-ai-button"
                  onClick={async () => {
                    // Если нет данных аналитики, загружаем их сначала
                    if (!analyticsData || !analyticsData.topics || analyticsData.topics.length === 0) {
                      try {
                        const data = await loadAnalyticsData();
                        if (data && data.topics && data.topics.length > 0) {
                          loadAnalyticsAiVerdict(data.topics, data.weakTopics);
                        }
                      } catch (error) {
                        console.error('[ANALYTICS] Ошибка загрузки данных:', error);
                      }
                    } else {
                      loadAnalyticsAiVerdict(analyticsData.topics, analyticsData.weakTopics);
                    }
                  }}
                  style={{ marginTop: '12px' }}
                >
                  Попробовать снова
                </button>
              </div>
            ) : analyticsAiVerdict && analyticsAiVerdict.text ? (
              <p>{analyticsAiVerdict.text}</p>
            ) : (
              <button 
                className="analytics-ai-button"
                onClick={async () => {
                  console.log('[ANALYTICS] Нажата кнопка "Получить вердикт ИИ"');
                  
                  // Если нет данных аналитики, загружаем их сначала
                  if (!analyticsData || !analyticsData.topics || analyticsData.topics.length === 0) {
                    console.log('[ANALYTICS] Загрузка данных аналитики перед запросом вердикта');
                    try {
                      const data = await loadAnalyticsData();
                      if (data && data.topics && data.topics.length > 0) {
                        console.log('[ANALYTICS] Данные загружены, запрашиваем вердикт');
                        loadAnalyticsAiVerdict(data.topics, data.weakTopics);
                      } else {
                        console.warn('[ANALYTICS] Нет данных для анализа');
                        setAnalyticsAiVerdict({
                          loading: false,
                          text: null,
                          error: 'Нет данных для анализа. Пройдите хотя бы один тест.'
                        });
                      }
                    } catch (error) {
                      console.error('[ANALYTICS] Ошибка загрузки данных:', error);
                      setAnalyticsAiVerdict({
                        loading: false,
                        text: null,
                        error: 'Ошибка загрузки данных. Попробуйте позже.'
                      });
                    }
                  } else {
                    // Используем уже загруженные данные
                    console.log('[ANALYTICS] Используем уже загруженные данные');
                    loadAnalyticsAiVerdict(analyticsData.topics, analyticsData.weakTopics);
                  }
                }}
              >
                Получить вердикт ИИ
              </button>
            )}
          </div>
        </div>

        {/* Блок слабых мест */}
        {analyticsData && analyticsData.weakTopics && analyticsData.weakTopics.length > 0 && (
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
                  {onTopicSelect && (
                    <button
                      className="analytics-weak-topic-button"
                      onClick={() => {
                        const foundTopic = topics?.find(t => String(t.id) === topic.topicId);
                        if (foundTopic) {
                          onTopicSelect(foundTopic);
                        } else {
                          alert('Тема не найдена');
                        }
                      }}
                    >
                      Подтянуть
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Статистика по темам из user_topic_stats */}
        {statsData && statsData.length > 0 && (
          <div className="statistics-section">
            <h2 className="statistics-section-title">Прогресс по темам</h2>
            <div className="statistics-cards">
              {statsData.map((stat, index) => {
                const percentage = stat.mastery_percentage || 0;
                const color = getProgressColor(percentage);
                const topicName = getTopicName(stat.topic_id, stat.topic_name);

                return (
                  <div key={stat.topic_id || index} className="statistics-card">
                    <div className="statistics-card-header">
                      <h3 className="statistics-card-title">{topicName}</h3>
                      <span className={`statistics-card-percentage statistics-card-percentage-${color}`}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>

                    <div className="statistics-card-progress">
                      <div 
                        className={`statistics-card-progress-bar statistics-card-progress-${color}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      ></div>
                    </div>

                    <div className="statistics-card-stats">
                      {stat.total_tests !== undefined && (
                        <div className="statistics-card-stat">
                          <span className="statistics-card-stat-label">Тестов:</span>
                          <span className="statistics-card-stat-value">{stat.total_tests}</span>
                        </div>
                      )}
                      {stat.total_questions !== undefined && (
                        <div className="statistics-card-stat">
                          <span className="statistics-card-stat-label">Вопросов:</span>
                          <span className="statistics-card-stat-value">{stat.total_questions}</span>
                        </div>
                      )}
                      {stat.correct_answers !== undefined && (
                        <div className="statistics-card-stat">
                          <span className="statistics-card-stat-label">Правильных:</span>
                          <span className="statistics-card-stat-value">{stat.correct_answers}</span>
                        </div>
                      )}
                      {stat.error_count !== undefined && (
                        <div className="statistics-card-stat">
                          <span className="statistics-card-stat-label">Ошибок:</span>
                          <span className="statistics-card-stat-value">{stat.error_count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsScreen;

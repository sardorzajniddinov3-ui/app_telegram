import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Массив моделей для автоматического переключения (Fallback)
const models = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemma-3-12b-it",
  "gemini-2.5-flash-lite",
  "gemini-3-pro-preview"
];

/**
 * Функция для получения совета от ИИ с автоматическим переключением между моделями
 * @param prompt - Текст промпта для ИИ
 * @param apiKey - API ключ Google Gemini
 * @returns Promise<string> - Текст совета или сообщение об ошибке
 */
async function getAIAdvice(prompt: string, apiKey: string): Promise<string> {
  const apiVersion = 'v1beta'; // Используем v1beta для поддержки новых моделей
  let lastError = '';
  
  // Проходим по всем моделям в массиве
  for (let i = 0; i < models.length; i++) {
    const modelName = models[i];
    const fullModelName = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
    
    try {
      console.log(`🔄 [${i + 1}/${models.length}] Пробую модель: ${fullModelName}`);
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/${apiVersion}/${fullModelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            generationConfig: {
              maxOutputTokens: 256, // Ограничиваем до 200 символов
              temperature: 0.7
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const advice = data.candidates?.[0]?.content?.parts?.[0]?.text || "Продолжайте практиковаться!";
        console.log(`✅ Успешно получен совет от модели: ${fullModelName}`);
        return advice.substring(0, 200); // Обрезаем до 200 символов
      }

      // Обработка ошибок
      const errorText = await response.text();
      lastError = `Модель ${fullModelName}: ${response.status} - ${errorText.substring(0, 100)}`;
      
      // Ошибка 429 (Rate Limit) - пробуем следующую модель
      if (response.status === 429 || errorText.includes('429') || errorText.includes('quota') || errorText.includes('rate limit') || errorText.includes('RESOURCE_EXHAUSTED')) {
        console.log(`[FALLBACK] Модель ${fullModelName} перегружена (429), автоматически переключаюсь на следующую...`);
        if (i < models.length - 1) {
          console.log(`➡️ Переключаюсь на модель: ${models[i + 1]}`);
        }
        continue;
      }
      
      // Ошибка 404 (модель не найдена) - пропускаем эту модель
      if (response.status === 404 || errorText.includes('404') || errorText.includes('not found') || errorText.includes('NOT_FOUND')) {
        console.log(`[FALLBACK] Модель ${fullModelName} не найдена (404), автоматически переключаюсь на следующую...`);
        if (i < models.length - 1) {
          console.log(`➡️ Переключаюсь на модель: ${models[i + 1]}`);
        }
        continue;
      }
      
      // Другие ошибки - пробуем следующую модель
      console.warn(`⚠️ Модель ${fullModelName} вернула ошибку ${response.status}, пробую следующую...`);
      if (i < models.length - 1) {
        console.log(`➡️ Переключаюсь на модель: ${models[i + 1]}`);
      }
      continue;
      
    } catch (error) {
      // Ошибка сети или другая ошибка - пробуем следующую модель
      lastError = `Модель ${fullModelName}: ${error}`;
      console.warn(`⚠️ Ошибка при запросе к модели ${fullModelName}:`, error);
      if (i < models.length - 1) {
        console.log(`➡️ Переключаюсь на модель: ${models[i + 1]}`);
      }
      continue;
    }
  }
  
  // Если все модели выдали ошибку
  console.error('❌ Все модели исчерпали лимиты или недоступны');
  console.error('Последняя ошибка:', lastError);
  return "Продолжайте практиковаться! Уделите внимание темам, где было больше всего ошибок.";
}

Deno.serve(async (req) => {
  // CORS Setup
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    // Парсим JSON с обработкой ошибок
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('❌ Ошибка парсинга JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Неверный формат запроса', details: parseError.message }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }
    
    const { userId, errors, correctCount, totalCount, userErrors, totalScore } = requestBody;
    
    console.log('📊 Получен запрос на совет:', { 
      userId, 
      errorsCount: errors?.length || 0, 
      userErrorsCount: userErrors?.length || 0,
      correctCount, 
      totalCount,
      totalScore,
      hasUserErrors: userErrors !== undefined,
      hasTotalScore: totalScore !== undefined
    });
    
    // Проверяем обязательные параметры
    if (!userId) {
      console.error('❌ userId не предоставлен');
      return new Response(
        JSON.stringify({ error: 'userId обязателен' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // ========== ПРОВЕРКА ЛИМИТА В НАЧАЛЕ ФУНКЦИИ ==========
    // Защита от обхода лимита на фронтенде
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
      
      try {
        const { data: user, error: userError } = await supabaseClient
          .from('profiles')
          .select('ai_queries_used, ai_limit_total')
          .eq('id', userId)
          .maybeSingle();

        if (!userError && user) {
          const used = Number(user.ai_queries_used) || 0;
          const total = Number(user.ai_limit_total) || 0;
          
          console.log('🔒 [EARLY LIMIT CHECK] Проверка лимита в начале функции:', { used, total });
          
          // Если лимит установлен и исчерпан - блокируем
          if (total > 0 && used >= total) {
            console.error('⛔ [EARLY LIMIT CHECK] Лимит исчерпан! used >= total:', { used, total });
            return new Response(
              JSON.stringify({ error: "Limit reached" }),
              { 
                status: 403,
                headers: { 
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                } 
              }
            );
          }
        } else if (userError) {
          console.warn('⚠️ [EARLY LIMIT CHECK] Ошибка загрузки профиля:', userError);
          // Продолжаем выполнение, если не можем проверить
        }
      } catch (earlyCheckError: any) {
        console.error('❌ [EARLY LIMIT CHECK] Ошибка проверки лимита:', earlyCheckError);
        // Продолжаем выполнение при ошибке
      }
    }
    // ========== КОНЕЦ РАННЕЙ ПРОВЕРКИ ЛИМИТА ==========

    // ========== СЕРВЕРНАЯ ПРОВЕРКА ЛИМИТА ==========
    // Проверка лимита пользователя в базе перед запросом к Gemini
    // Это защищает от обхода блокировки на фронтенде
    // АДМИНЫ ИМЕЮТ БЕЗЛИМИТНЫЙ ДОСТУП
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      try {
        // Сначала проверяем, является ли пользователь админом
        const MAIN_ADMIN_TELEGRAM_ID = 473842863;
        const userIdNumber = Number(userId);
        let isAdmin = false;

        // Проверяем главного админа
        if (userIdNumber === MAIN_ADMIN_TELEGRAM_ID) {
          isAdmin = true;
          console.log('✅ [SERVER LIMIT CHECK] Главный администратор - безлимитный доступ');
        } else {
          // Проверяем в таблице admins
          const { data: adminData, error: adminError } = await supabase
            .from('admins')
            .select('telegram_id')
            .eq('telegram_id', userIdNumber)
            .maybeSingle();

          if (!adminError && adminData) {
            isAdmin = true;
            console.log('✅ [SERVER LIMIT CHECK] Администратор обнаружен - безлимитный доступ');
          }
        }

        // Если пользователь админ - пропускаем проверку лимита
        if (isAdmin) {
          console.log('✅ [SERVER LIMIT CHECK] Админ - пропускаем проверку лимита');
        } else {
          // Проверка лимита для обычных пользователей
          // Используем ai_queries_used и ai_limit_total из profiles
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('subscription_tier, ai_queries_used, ai_limit_total')
            .eq('id', userId)
            .maybeSingle();

          if (!profileError && profile) {
            const used = Number(profile.ai_queries_used) || 0;
            const total = Number(profile.ai_limit_total) || 0;
            const isProMax = profile.subscription_tier === 'pro_max' || profile.subscription_tier === 'pro';

            console.log('🔒 [SERVER LIMIT CHECK] Проверка лимита из profiles:', {
              subscription_tier: profile.subscription_tier,
              isProMax,
              ai_queries_used: used,
              ai_limit_total: total
            });

            // Если лимит установлен (total > 0) и used >= total, блокируем
            if (total > 0 && used >= total && !isProMax) {
              console.error('⛔ [SERVER LIMIT CHECK] Лимит исчерпан! used >= total:', { used, total });
              return new Response(
                JSON.stringify({ error: 'Limit exceeded', message: 'Лимит использования ИИ исчерпан. Перейдите на тариф PRO для безлимита.' }),
                { 
                  status: 403,
                  headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                  } 
                }
              );
            }
          } else if (profileError) {
            console.warn('⚠️ [SERVER LIMIT CHECK] Ошибка загрузки профиля:', profileError);
            // Если не можем проверить лимит, продолжаем выполнение (fail-open)
          }
        }
      } catch (limitCheckError: any) {
        console.error('❌ [SERVER LIMIT CHECK] Ошибка проверки лимита:', limitCheckError);
        // В случае ошибки продолжаем выполнение (fail-open для надежности)
      }
    } else {
      console.warn('⚠️ [SERVER LIMIT CHECK] SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY не установлены, пропускаем проверку лимита');
    }
    // ========== КОНЕЦ СЕРВЕРНОЙ ПРОВЕРКИ ЛИМИТА ==========
    
    // Инициализация Gemini API
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY не установлен');
      return new Response(
        JSON.stringify({ error: 'API ключ не настроен' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Определяем тип запроса: статистика или результаты теста
    const isAnalyticsRequest = userErrors !== undefined && totalScore !== undefined;
    
    console.log('🔍 Тип запроса:', isAnalyticsRequest ? 'Статистика (Analytics)' : 'Результаты теста');
    
    let prompt = '';
    
    if (isAnalyticsRequest) {
      // Запрос для статистики (экран аналитики)
      console.log('📈 Обработка запроса статистики');
      
      const weakTopicsList = userErrors && Array.isArray(userErrors) && userErrors.length > 0
        ? userErrors.map((e: any, i: number) => {
            const topicName = e.topic_name || `Тема ${e.topic_id || i + 1}`;
            const errorCount = e.error_count || 0;
            const percentage = Math.round(e.percentage || 0);
            return `${i + 1}. "${topicName}" - ${errorCount} ошибок, ${percentage}% правильных ответов`;
          }).join('\n')
        : 'Нет проблемных тем';
      
      const avgScore = Math.round(totalScore || 0);
      
      console.log('📊 Данные статистики:', {
        avgScore,
        weakTopicsCount: userErrors?.length || 0,
        hasWeakTopics: userErrors && userErrors.length > 0
      });
      
      prompt = `Ты — дружелюбный инструктор по подготовке к экзамену по ПДД. 
Пользователь просит проанализировать его статистику по темам.

Средний результат по всем темам: ${avgScore}%.

${userErrors && Array.isArray(userErrors) && userErrors.length > 0 ? `Слабые места (ТОП-${userErrors.length}):
${weakTopicsList}

` : 'Пользователь хорошо справляется со всеми темами! '}

Дай ОДИН короткий вердикт (максимум 200 символов) с конкретным советом, на что обратить внимание.

Требования к вердикту:
- Если есть слабые места: укажи главную проблему и конкретную тему, которую нужно подтянуть
- Если результат хороший (70%+): похвали и дай совет, как закрепить успех
- Если результат средний (50-70%): мотивируй и укажи, на чем сосредоточиться
- Если результат низкий (<50%): мягко укажи на необходимость больше практики
- Общайся как друг-наставник: дружелюбно, но профессионально
- Будь конкретным: не общие фразы, а конкретные рекомендации
- Используй 1-2 эмодзи для дружелюбности
- Пиши на русском языке

Примеры хороших вердиктов:
- "Твоя главная проблема — круговое движение. Удели этому 15 минут сегодня. 🎯"
- "Отлично справляешься! 💪 Для идеального результата повтори 'Запрещающие знаки'."
- "Нужно подтянуть 'Разметку' 📚 - там больше всего ошибок. Начни с неё."`;
    } else {
      // Запрос для результатов теста (после прохождения теста)
      const errorsList = errors && errors.length > 0 
        ? errors.map((e: any, i: number) => `${i + 1}. Вопрос: "${e.question}" - выбрал "${e.wrong}", правильный "${e.correct}"`).join('\n')
        : 'Пользователь ответил правильно на все вопросы';
      
      const performance = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      
      prompt = `Ты — дружелюбный инструктор по подготовке к экзамену по ПДД. 
Пользователь только что завершил тест. Результат: ${correctCount} из ${totalCount} (${performance}%).

${errors && errors.length > 0 ? `Ошибки пользователя:
${errorsList}

` : 'Пользователь ответил правильно на все вопросы! '}

Дай ОДИН короткий совет (максимум 200 символов), на что обратить внимание, чтобы лучше сдать экзамен. 

Требования к совету:
- Если есть ошибки: укажи конкретную тему или тип вопросов, где нужно подтянуть знания
- Если результат хороший (70%+): похвали и дай совет, как закрепить успех
- Если результат средний (50-70%): мотивируй и укажи, на чем сосредоточиться
- Если результат низкий (<50%): мягко укажи на необходимость больше практики
- Общайся как друг-наставник: дружелюбно, но профессионально
- Будь конкретным: не общие фразы, а конкретные рекомендации
- Используй 1-2 эмодзи для дружелюбности
- Пиши на русском языке

Примеры хороших советов:
- "Отлично! 🎯 Обрати внимание на знаки приоритета - там было 2 ошибки. Повтори раздел 7."
- "Хороший результат! 💪 Для 100% повтори вопросы про разметку - там была ошибка."
- "Нужно подтянуть знания 📚. Больше всего ошибок в теме 'Запрещающие знаки' - изучи её подробнее."`;
    }

    console.log('📝 Промпт для ИИ (первые 200 символов):', prompt.substring(0, 200) + '...');
    console.log('📝 Длина промпта:', prompt.length, 'символов');
    
    // Получаем совет от ИИ
    let advice: string | null = null;
    let adviceError: string | null = null;
    
    try {
      advice = await getAIAdvice(prompt, apiKey);
      console.log('✅ Получен совет от ИИ (первые 100 символов):', advice.substring(0, 100) + '...');
      
      // Проверяем, что совет не является сообщением об ошибке
      if (advice && advice.includes('Все модели исчерпали лимиты')) {
        console.warn('⚠️ ИИ вернул сообщение об ошибке, генерируем fallback');
        adviceError = 'ИИ временно недоступен';
        advice = null;
      }
    } catch (aiError: any) {
      console.error('❌ Ошибка при получении совета от ИИ:', aiError);
      adviceError = aiError?.message || 'Ошибка получения совета от ИИ';
      advice = null;
    }
    
    // Генерируем fallback совет на основе данных
    let fallbackAdvice: string | null = null;
    
    if (!advice || adviceError) {
      if (isAnalyticsRequest && userErrors && userErrors.length > 0) {
        // Для статистики генерируем совет на основе слабых мест
        const topWeakTopic = userErrors[0];
        const topicName = topWeakTopic.topic_name || 'этой теме';
        const errorCount = topWeakTopic.error_count || 0;
        const percentage = Math.round(topWeakTopic.percentage || 0);
        
        if (percentage < 50) {
          fallbackAdvice = `Нужно подтянуть "${topicName}" 📚 - там ${errorCount} ошибок и только ${percentage}% правильных ответов. Удели этой теме больше внимания.`;
        } else if (percentage < 80) {
          fallbackAdvice = `Хорошо справляешься! 💪 Для идеального результата повтори "${topicName}" - там ${errorCount} ошибок.`;
        } else {
          fallbackAdvice = `Отлично справляешься! 🎯 Продолжай практиковаться для закрепления результата.`;
        }
      } else if (isAnalyticsRequest && totalScore !== undefined) {
        const avgScore = Math.round(totalScore);
        if (avgScore >= 80) {
          fallbackAdvice = "Отлично справляешься! 💪 Продолжай в том же духе.";
        } else if (avgScore >= 50) {
          fallbackAdvice = "Хороший результат! 💪 Продолжай практиковаться для идеального результата.";
        } else {
          fallbackAdvice = "Нужно больше практики 📚. Повтори темы, где было больше всего ошибок.";
        }
      } else {
        // Общий fallback
        fallbackAdvice = "Продолжайте практиковаться! Уделите внимание темам, где было больше всего ошибок.";
      }
    }
    
    // Возвращаем совет (либо от ИИ, либо fallback)
    const finalAdvice = advice || fallbackAdvice || "Продолжайте практиковаться! Уделите внимание темам, где было больше всего ошибок.";
    
    const response: any = {
      advice: finalAdvice
    };
    
    if (adviceError) {
      response.warning = 'Использован автоматический совет из-за недоступности ИИ';
    }
    
    console.log('📤 Отправка ответа:', { 
      adviceLength: response.advice.length,
      advicePreview: response.advice.substring(0, 50) + '...',
      isFallback: !advice,
      hasWarning: !!adviceError
    });
    
    // ПОСЛЕ успешного ответа от ИИ обновляем ai_queries_count в profiles
    if (advice && !adviceError && supabaseUrl && supabaseServiceKey) {
      try {
        const supabaseForUpdate = createClient(supabaseUrl, supabaseServiceKey);
        const { data: currentProfile, error: fetchError } = await supabaseForUpdate
          .from('profiles')
          .select('ai_queries_count')
          .eq('id', userId)
          .maybeSingle();
        
        if (!fetchError && currentProfile) {
          const currentCount = Number(currentProfile.ai_queries_count) || 0;
          const newCount = currentCount + 1;
          
          console.log('🔄 [SERVER] Обновляем ai_queries_count:', { currentCount, newCount });
          
          const { data: updatedProfile, error: updateError } = await supabaseForUpdate
            .from('profiles')
            .update({ ai_queries_count: newCount })
            .eq('id', userId)
            .select('ai_queries_count')
            .single();
          
          if (updateError) {
            console.error('❌ [SERVER] Ошибка обновления ai_queries_count:', updateError);
          } else {
            // Используем значение из ответа Supabase, а не вычисленное
            const updatedCount = Number(updatedProfile?.ai_queries_count) || 0;
            console.log('✅ [SERVER] ai_queries_count успешно обновлен из ответа Supabase:', updatedCount);
          }
        }
      } catch (updateException: any) {
        console.error('❌ [SERVER] Исключение при обновлении ai_queries_count:', updateException);
      }
    }
    
    // ВСЕГДА возвращаем статус 200, даже если был fallback
    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
    
  } catch (error: any) {
    console.error('❌ Критическая ошибка в Edge Function:', error);
    console.error('❌ Stack trace:', error?.stack);
    
    // Даже при критической ошибке возвращаем fallback совет со статусом 200
    // Это гарантирует, что пользователь всегда получит какой-то совет
    const fallbackAdvice = "Продолжайте практиковаться! Уделите внимание темам, где было больше всего ошибок.";
    
    return new Response(
      JSON.stringify({ 
        advice: fallbackAdvice,
        warning: 'Использован автоматический совет из-за технической ошибки'
      }),
      { 
        status: 200, // Всегда возвращаем 200, даже при ошибке
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
})

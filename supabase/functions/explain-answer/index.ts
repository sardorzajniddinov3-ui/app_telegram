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
 * Функция для получения объяснения от ИИ с автоматическим переключением между моделями
 * @param prompt - Текст промпта для ИИ
 * @param apiKey - API ключ Google Gemini
 * @returns Promise<string> - Текст объяснения или сообщение об ошибке
 */
async function getAIExplanation(prompt: string, apiKey: string): Promise<string> {
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
            }]
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text || "Не удалось получить объяснение.";
        console.log(`✅ Успешно получен ответ от модели: ${fullModelName}`);
        return explanation;
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
        continue; // Переходим к следующей модели
      }
      
      // Ошибка 404 (модель не найдена) - пропускаем эту модель
      if (response.status === 404 || errorText.includes('404') || errorText.includes('not found') || errorText.includes('NOT_FOUND')) {
        console.log(`[FALLBACK] Модель ${fullModelName} не найдена (404), автоматически переключаюсь на следующую...`);
        if (i < models.length - 1) {
          console.log(`➡️ Переключаюсь на модель: ${models[i + 1]}`);
        }
        continue; // Переходим к следующей модели
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
  return "Все лимиты ИИ временно исчерпаны. Попробуйте через 1 минуту.";
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
    const { question, wrongAnswer, correctAnswer } = await req.json()
    
    // Инициализация Supabase клиента для работы с кэшем
    // В Supabase Edge Functions эти переменные доступны автоматически
    // Для записи в таблицу используем service_role key (если доступен), иначе anon_key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    // Используем service_role key для записи (обходит RLS), если доступен, иначе anon_key
    const supabaseKey = supabaseServiceKey || supabaseAnonKey
    
    console.log('🔧 Инициализация Supabase клиента:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasAnonKey: !!supabaseAnonKey,
      usingServiceKey: !!supabaseServiceKey,
      urlLength: supabaseUrl.length,
      keyLength: supabaseKey.length
    })
    
    let supabaseClient: ReturnType<typeof createClient> | null = null
    if (supabaseUrl && supabaseKey) {
      supabaseClient = createClient(supabaseUrl, supabaseKey)
      console.log('✅ Supabase клиент успешно инициализирован')
    } else {
      console.warn('⚠️ Не удалось инициализировать Supabase клиент:', {
        missingUrl: !supabaseUrl,
        missingKey: !supabaseKey,
        missingServiceKey: !supabaseServiceKey,
        missingAnonKey: !supabaseAnonKey
      })
    }

    // ========== ШАГ 1: ПРОВЕРКА КЭША (сначала точное совпадение, потом семантический поиск) ==========
    if (supabaseClient) {
      try {
        // Сначала проверяем точное совпадение
        const { data: cachedExplanation, error: cacheError } = await supabaseClient
          .from('ai_explanations')
          .select('explanation')
          .eq('question', question)
          .eq('wrong_answer', wrongAnswer)
          .eq('correct_answer', correctAnswer)
          .single()

        if (!cacheError && cachedExplanation && cachedExplanation.explanation) {
          console.log('✅ Объяснение найдено в кэше (точное совпадение), возвращаем из базы')
          return new Response(JSON.stringify({ 
            explanation: cachedExplanation.explanation,
            cached: true 
          }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            status: 200,
          })
        }

        // Если точного совпадения нет, пробуем семантический поиск через эмбеддинги
        try {
          // Создаем эмбеддинг для текущего вопроса
          const embeddingResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: {
                  parts: [{
                    text: question
                  }]
                }
              })
            }
          )

          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json()
            const questionEmbedding = embeddingData.embedding?.values

            if (questionEmbedding && Array.isArray(questionEmbedding)) {
              // Ищем похожие вопросы через векторный поиск
              // Используем RPC функцию для векторного поиска (если доступна)
              // Или ищем через SQL запрос с cosine similarity
              const { data: similarExplanations, error: similarityError } = await supabaseClient.rpc(
                'match_ai_explanations',
                {
                  query_embedding: questionEmbedding,
                  match_threshold: 0.8, // Порог схожести (0.8 = 80%)
                  match_count: 1, // Возвращаем только 1 наиболее похожий
                  wrong_answer_filter: wrongAnswer,
                  correct_answer_filter: correctAnswer
                }
              )

              if (!similarityError && similarExplanations && similarExplanations.length > 0) {
                const bestMatch = similarExplanations[0]
                console.log('✅ Объяснение найдено в кэше (семантический поиск), возвращаем из базы')
                return new Response(JSON.stringify({ 
                  explanation: bestMatch.explanation,
                  cached: true,
                  similarity: bestMatch.similarity
                }), {
                  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                  status: 200,
                })
              }
            }
          }
        } catch (embeddingError) {
          console.warn('⚠️ Ошибка при семантическом поиске:', embeddingError)
          // Продолжаем выполнение, если не удалось выполнить семантический поиск
        }

        console.log('ℹ️ Объяснение не найдено в кэше, запрашиваем у ИИ')
      } catch (cacheCheckError) {
        console.warn('⚠️ Ошибка при проверке кэша:', cacheCheckError)
        // Продолжаем выполнение, если не удалось проверить кэш
      }
    }

    // ========== ШАГ 2: ЗАПРОС К ИИ (если нет в кэше) ==========
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      return new Response(JSON.stringify({ explanation: "⚠️ ОШИБКА: Нет ключа API" }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200, 
      })
    }

    // Формируем промпт для ИИ
    const prompt = `Ты — умный репетитор. Пользователь ошибся в тесте. Кратко и доступно объясни, почему его вариант неверен и какой ответ правильный. Используй русский язык.

Вопрос: ${question}
Неправильный ответ пользователя: ${wrongAnswer}
Правильный ответ: ${correctAnswer}`;

    // Используем функцию с автоматическим переключением между моделями
    console.log('🔄 Запрос к ИИ с автоматическим переключением моделей (Fallback)')
    const explanation = await getAIExplanation(prompt, apiKey)

    // ========== ШАГ 3: СОХРАНЕНИЕ В КЭШ С ЭМБЕДДИНГОМ ==========
    // Детальное логирование для отладки
    console.log('📝 Проверка условий для сохранения в кэш:', {
      hasSupabaseClient: !!supabaseClient,
      hasExplanation: !!explanation,
      explanationLength: explanation?.length || 0,
      explanationPreview: explanation?.substring(0, 100) || 'пусто'
    })
    
    // Не сохраняем в кэш сообщения об ошибках
    const isError = explanation.includes("Все лимиты ИИ временно исчерпаны") || 
                    explanation.includes("⚠️ ОШИБКА") ||
                    explanation === "Не удалось получить объяснение.";
    
    console.log('🔍 Проверка на ошибку:', {
      isError: isError,
      containsLimits: explanation.includes("Все лимиты ИИ временно исчерпаны"),
      containsError: explanation.includes("⚠️ ОШИБКА"),
      isFailed: explanation === "Не удалось получить объяснение."
    })
    
    if (!supabaseClient) {
      console.warn('⚠️ Supabase клиент не инициализирован, пропускаем сохранение в кэш')
    } else if (!explanation) {
      console.warn('⚠️ Объяснение пустое, пропускаем сохранение в кэш')
    } else if (isError) {
      console.warn('⚠️ Объяснение содержит ошибку, пропускаем сохранение в кэш')
    }
    
    if (supabaseClient && explanation && !isError) {
      console.log('💾 Начинаю сохранение в кэш...')
      try {
        // Создаем эмбеддинг для вопроса перед сохранением
        let questionEmbedding = null
        try {
          const embeddingResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: {
                  parts: [{
                    text: question
                  }]
                }
              })
            }
          )

          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json()
            questionEmbedding = embeddingData.embedding?.values
            console.log('✅ Эмбеддинг вопроса создан успешно')
          } else {
            console.warn('⚠️ Не удалось создать эмбеддинг, сохраняем без него')
          }
        } catch (embeddingError) {
          console.warn('⚠️ Ошибка создания эмбеддинга:', embeddingError)
          // Продолжаем сохранение без эмбеддинга
        }

        // Сохраняем объяснение с эмбеддингом (если удалось создать)
        // Убеждаемся, что все поля заполнены и не пустые
        if (!question || !wrongAnswer || !correctAnswer || !explanation) {
          console.error('❌ Не все обязательные поля заполнены:', {
            hasQuestion: !!question,
            hasWrongAnswer: !!wrongAnswer,
            hasCorrectAnswer: !!correctAnswer,
            hasExplanation: !!explanation
          })
        } else {
          const dataToSave: any = {
            question: String(question).trim(),
            wrong_answer: String(wrongAnswer).trim(),
            correct_answer: String(correctAnswer).trim(),
            explanation: String(explanation).trim()
          }

          console.log('📤 Отправка данных в Supabase:', {
            question: question.substring(0, 50) + '...',
            wrongAnswer: wrongAnswer.substring(0, 30) + '...',
            correctAnswer: correctAnswer.substring(0, 30) + '...',
            explanationLength: explanation.length,
            hasEmbedding: !!questionEmbedding
          })
          
          try {
            // Пробуем сохранить с эмбеддингом, если он есть
            if (questionEmbedding && Array.isArray(questionEmbedding)) {
              dataToSave.question_embedding = questionEmbedding
            }
            
            const { data: insertData, error: insertError } = await supabaseClient
              .from('ai_explanations')
              .upsert(dataToSave, {
                onConflict: 'question,wrong_answer,correct_answer'
              })
              .select()

            if (insertError) {
              // Если ошибка связана с отсутствием колонки question_embedding, пробуем сохранить без неё
              if (insertError.code === 'PGRST204' && insertError.message?.includes('question_embedding')) {
                console.warn('⚠️ Колонка question_embedding не найдена в таблице, сохраняю без эмбеддинга')
                
                // Создаем новый объект без эмбеддинга
                const dataWithoutEmbedding = {
                  question: dataToSave.question,
                  wrong_answer: dataToSave.wrong_answer,
                  correct_answer: dataToSave.correct_answer,
                  explanation: dataToSave.explanation
                }
                
                const { data: retryData, error: retryError } = await supabaseClient
                  .from('ai_explanations')
                  .upsert(dataWithoutEmbedding, {
                    onConflict: 'question,wrong_answer,correct_answer'
                  })
                  .select()
                
                if (retryError) {
                  console.error('❌ Ошибка сохранения в кэш (без эмбеддинга):', {
                    error: retryError,
                    message: retryError.message,
                    details: retryError.details,
                    hint: retryError.hint,
                    code: retryError.code
                  })
                  
                  // Если ошибка связана с RLS, выводим подсказку
                  if (retryError.code === '42501' || retryError.message?.includes('permission') || retryError.message?.includes('RLS')) {
                    console.error('💡 Подсказка: Возможно, проблема с RLS политиками. Убедитесь, что:')
                    console.error('   1. Таблица ai_explanations существует')
                    console.error('   2. RLS политики разрешают INSERT/UPDATE для service_role или anon')
                    console.error('   3. Используется правильный ключ (service_role для записи)')
                  }
                } else {
                  console.log('✅ Объяснение успешно сохранено в кэш (без эмбеддинга)')
                  if (retryData) {
                    console.log('📊 Данные сохранены:', {
                      savedCount: retryData.length,
                      savedIds: retryData.map((d: any) => d.id)
                    })
                  }
                }
              } else {
                console.error('❌ Ошибка сохранения в кэш:', {
                  error: insertError,
                  message: insertError.message,
                  details: insertError.details,
                  hint: insertError.hint,
                  code: insertError.code
                })
                
                // Если ошибка связана с RLS, выводим подсказку
                if (insertError.code === '42501' || insertError.message?.includes('permission') || insertError.message?.includes('RLS')) {
                  console.error('💡 Подсказка: Возможно, проблема с RLS политиками. Убедитесь, что:')
                  console.error('   1. Таблица ai_explanations существует')
                  console.error('   2. RLS политики разрешают INSERT/UPDATE для service_role или anon')
                  console.error('   3. Используется правильный ключ (service_role для записи)')
                }
              }
            } else {
              console.log('✅ Объяснение успешно сохранено в кэш' + (questionEmbedding ? ' с эмбеддингом' : ''))
              if (insertData) {
                console.log('📊 Данные сохранены:', {
                  savedCount: insertData.length,
                  savedIds: insertData.map((d: any) => d.id)
                })
              }
            }
          } catch (upsertError) {
            console.error('❌ Критическая ошибка при upsert:', upsertError)
          }
        }
      } catch (saveError) {
        console.warn('⚠️ Ошибка при сохранении в кэш:', saveError)
        // Не блокируем ответ, если не удалось сохранить в кэш
      }
    }

    return new Response(JSON.stringify({ 
      explanation: explanation,
      cached: false 
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ explanation: `⚠️ Системная ошибка: ${error.message}` }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    })
  }
})

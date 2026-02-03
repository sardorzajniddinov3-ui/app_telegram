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
    const { userId, errors, correctCount, totalCount } = await req.json()
    
    console.log('📊 Получен запрос на совет:', { userId, errorsCount: errors?.length, correctCount, totalCount });
    
    // Проверяем обязательные параметры
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId обязателен' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Инициализация Gemini API
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY не установлен');
      return new Response(
        JSON.stringify({ error: 'API ключ не настроен' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
    
    // Формируем промпт для ИИ
    const errorsList = errors && errors.length > 0 
      ? errors.map((e: any, i: number) => `${i + 1}. Вопрос: "${e.question}" - выбрал "${e.wrong}", правильный "${e.correct}"`).join('\n')
      : 'Пользователь ответил правильно на все вопросы';
    
    const performance = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    
    const prompt = `Ты — дружелюбный инструктор по подготовке к экзамену по ПДД. 
Пользователь только что завершил тест. Результат: ${correctCount} из ${totalCount} (${performance}%).

${errors.length > 0 ? `Ошибки пользователя:
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

    console.log('📝 Промпт для ИИ:', prompt.substring(0, 200) + '...');
    
    // Получаем совет от ИИ
    const advice = await getAIAdvice(prompt, apiKey);
    
    console.log('✅ Получен совет от ИИ:', advice.substring(0, 100) + '...');
    
    // Возвращаем совет
    return new Response(
      JSON.stringify({ advice }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
    
  } catch (error) {
    console.error('Критическая ошибка:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Внутренняя ошибка сервера',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    )
  }
})

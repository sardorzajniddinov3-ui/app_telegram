import "jsr:@supabase/functions-js/edge-runtime.d.ts"

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
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      return new Response(JSON.stringify({ explanation: "⚠️ ОШИБКА: Нет ключа API" }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200, 
      })
    }

    // USING GEMINI 2.0 FLASH LITE MODEL (high-speed, lower-quota usage)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Ты — дружелюбный автоинструктор. Объясни ученику одним-двумя предложениями, почему его ответ '${wrongAnswer}' является ошибкой. Вопрос был: '${question}'. Правильный ответ: '${correctAnswer}'.`
            }]
          }]
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `⚠️ Ошибка Google (${response.status}): ${errorText}`
      
      // Обработка ошибки 429 (quota exceeded)
      if (response.status === 429 || errorText.includes('429') || errorText.includes('quota')) {
        try {
          const errorJson = JSON.parse(errorText)
          let retryDelay = '60' // По умолчанию 60 секунд
          
          // Пытаемся извлечь retryDelay из details с типом google.rpc.RetryInfo
          if (errorJson.error?.details && Array.isArray(errorJson.error.details)) {
            const retryInfo = errorJson.error.details.find((d: any) => 
              d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' || d.retryDelay
            )
            if (retryInfo?.retryDelay) {
              // Извлекаем число из строки типа "22s" или "22.292475926s"
              const delayMatch = String(retryInfo.retryDelay).match(/(\d+(?:\.\d+)?)/)
              if (delayMatch && delayMatch[1]) {
                retryDelay = Math.ceil(parseFloat(delayMatch[1])).toString()
              }
            }
          }
          
          // Если не нашли в details, пытаемся извлечь из текста сообщения
          if (retryDelay === '60') {
            // Ищем "Please retry in 56.535406261s" или подобные паттерны
            const retryMatch = errorText.match(/Please retry in (\d+(?:\.\d+)?)s/i) ||
                              errorText.match(/retry in (\d+(?:\.\d+)?)s/i) ||
                              errorText.match(/retryDelay["\s:]*"?(\d+(?:\.\d+)?)s/i)
            if (retryMatch && retryMatch[1]) {
              retryDelay = Math.ceil(parseFloat(retryMatch[1])).toString()
            }
          }
          
          errorMessage = `⏳ ИИ перегружен запросами. Он заработает через ${retryDelay} секунд. Пожалуйста, подождите.`
        } catch (parseError) {
          // Если не удалось распарсить, пытаемся извлечь из текста напрямую
          // Ищем "Please retry in 56.535406261s" в любом месте текста
          const retryMatch = errorText.match(/Please retry in (\d+(?:\.\d+)?)s/i) ||
                            errorText.match(/retry in (\d+(?:\.\d+)?)s/i) ||
                            errorText.match(/(\d+(?:\.\d+)?)\s*s[.\s]/i)
          if (retryMatch && retryMatch[1]) {
            const delay = Math.ceil(parseFloat(retryMatch[1])).toString()
            errorMessage = `⏳ ИИ перегружен запросами. Он заработает через ${delay} секунд. Пожалуйста, подождите.`
          } else {
            errorMessage = `⏳ ИИ перегружен запросами. Он заработает через 60 секунд. Пожалуйста, подождите.`
          }
        }
      }
      
      return new Response(JSON.stringify({ explanation: errorMessage }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200,
      })
    }

    const data = await response.json()
    const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text || "Не удалось получить объяснение."

    return new Response(JSON.stringify({ explanation }), {
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

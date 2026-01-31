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

    // USING THE MODERN 2026 MODEL
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
      return new Response(JSON.stringify({ explanation: `⚠️ Ошибка Google (${response.status}): ${errorText}` }), {
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

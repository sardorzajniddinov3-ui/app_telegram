# Руководство по внедрению Персонального ИИ-Тренера

## ✅ Уже реализовано

### 1. База данных (AI_TRAINER_SCHEMA.sql)
- ✅ Таблица `test_results` - сохранение результатов тестов
- ✅ Таблица `user_errors` - отслеживание ошибок пользователя
- ✅ Таблица `ai_advice` - сохранение советов ИИ
- ✅ Функция `get_problematic_quizzes()` - получение 3 самых проблемных тем
- ✅ Функция `get_user_average_performance()` - расчет среднего % успеваемости
- ✅ Функция `get_user_error_questions()` - получение вопросов с ошибками

### 2. Edge Function (supabase/functions/ai-trainer-advice/index.ts)
- ✅ Автоматическое переключение между моделями при ошибках
- ✅ Генерация персонального совета на основе ошибок пользователя
- ✅ Ограничение длины совета (200 символов)

### 3. Функции в App.jsx
- ✅ `analyzeUserPerformance()` - анализ производительности
- ✅ `getAdaptiveQuestions()` - адаптивный подбор вопросов (40% из ошибок)
- ✅ `getAITrainerAdvice()` - запрос совета от ИИ
- ✅ `saveTestResultsToDatabase()` - сохранение результатов в БД
- ✅ Интеграция вызова `getAITrainerAdvice()` после завершения теста

### 4. State Management
- ✅ `userPerformance` - средний % успеваемости
- ✅ `problematicQuizzes` - проблемные темы
- ✅ `aiTrainerAdvice` - совет от ИИ
- ✅ `showAiAdvice` - показать блок с советом

## ⚠️ Требуется выполнить вручную

### Шаг 1: Применить схему базы данных
```bash
# Выполнить SQL скрипт в Supabase Dashboard:
# SQL Editor -> New Query -> Вставить содержимое AI_TRAINER_SCHEMA.sql -> Run
```

### Шаг 2: Задеплоить Edge Function
```bash
cd apptg111/apptg/telegram-mini-app
supabase functions deploy ai-trainer-advice
```

### Шаг 3: Интеграция адаптивного подбора вопросов

Найдите в `App.jsx` место, где начинается тест (кнопка "Начать тест" или переход на `screen='quiz'`).

**Поиск:** Найдите код, который выглядит примерно так:
```javascript
// Где-то в onClick кнопки "Начать тест":
const questions = getMergedQuestions(selectedTopic.id);
setTestQuestions(questions);
setCurrentQuestionIndex(0);
setSelectedAnswer(null);
setIsAnswered(false);
setCorrectAnswersCount(0);
setUserAnswers([]);
userAnswersRef.current = [];
setTestStartTime(Date.now());
setScreen('quiz');
```

**Замените на:**
```javascript
// Используем адаптивный подбор вопросов
const adaptiveQuestions = await getAdaptiveQuestions(selectedTopic.id, 20);
const questions = adaptiveQuestions.length > 0 
  ? adaptiveQuestions 
  : getMergedQuestions(selectedTopic.id);

setTestQuestions(questions);
setCurrentQuestionIndex(0);
setSelectedAnswer(null);
setIsAnswered(false);
setCorrectAnswersCount(0);
setUserAnswers([]);
userAnswersRef.current = [];
setTestStartTime(Date.now());
setScreen('quiz');
```

### Шаг 4: Добавить вызов analyzeUserPerformance при загрузке

В `useEffect` для инициализации приложения (где вызывается `loadTopicsFromSupabase`, `loadQuestionsFromSupabase`), добавьте:

```javascript
// Анализируем производительность пользователя
if (userId) {
  analyzeUserPerformance();
}
```

### Шаг 5: Добавить виджет прогресса на главный экран

Найдите экран `screen === 'topics'` и добавьте **перед списком тем**:

```javascript
{/* Виджет прогресса к экзамену */}
{userPerformance !== null && (
  <div className="progress-widget" style={{
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '20px',
    color: '#ffffff',
    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
  }}>
    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700' }}>
      🎯 Твой прогресс к экзамену
    </h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.2)', 
          borderRadius: '12px', 
          height: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            background: '#18ec23',
            height: '100%',
            width: `${userPerformance}%`,
            borderRadius: '12px',
            transition: 'width 0.5s ease'
          }} />
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
          Средний результат: {Math.round(userPerformance)}%
        </p>
      </div>
      <div style={{
        fontSize: '32px',
        fontWeight: '700',
        minWidth: '60px',
        textAlign: 'center'
      }}>
        {Math.round(userPerformance)}%
      </div>
    </div>
    
    {problematicQuizzes && problematicQuizzes.length > 0 && (
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
          ⚠️ Нужно подтянуть:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {problematicQuizzes.slice(0, 3).map((pq) => {
            const topic = topics.find(t => t.id === pq.quiz_id);
            return topic ? (
              <div key={pq.quiz_id} style={{ fontSize: '13px', opacity: 0.9 }}>
                • {topic.name} ({pq.error_count} ошибок)
              </div>
            ) : null;
          })}
        </div>
      </div>
    )}
  </div>
)}
```

### Шаг 6: Добавить отображение совета ИИ на экране результатов

Найдите экран `screen === 'topicDetail'` где показываются результаты теста, и добавьте **после карточек результатов**:

```javascript
{/* Совет от ИИ-тренера */}
{showAiAdvice && aiTrainerAdvice && (
  <div className="ai-trainer-advice-block" style={{
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    borderRadius: '16px',
    padding: '20px',
    marginTop: '20px',
    color: '#ffffff',
    boxShadow: '0 8px 24px rgba(240, 147, 251, 0.3)',
    animation: 'slideIn 0.5s ease-out'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
      <span style={{ fontSize: '28px' }}>🎓</span>
      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
        Совет от ИИ-тренера
      </h3>
    </div>
    
    {aiTrainerAdvice.loading ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="loading-spinner-small"></div>
        <span>Анализирую твои ответы...</span>
      </div>
    ) : aiTrainerAdvice.error ? (
      <p style={{ margin: 0, fontSize: '15px', opacity: 0.9 }}>
        {aiTrainerAdvice.error}
      </p>
    ) : aiTrainerAdvice.text ? (
      <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6' }}>
        {aiTrainerAdvice.text}
      </p>
    ) : null}
    
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
        cursor: 'pointer'
      }}
    >
      Понятно ✓
    </button>
  </div>
)}
```

### Шаг 7: Добавить CSS для анимации

В `App.css` добавьте:

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.loading-spinner-small {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 3px solid #ffffff;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

## 🧪 Тестирование

1. **Проверка БД:**
   - Пройдите несколько тестов с ошибками
   - Проверьте в Supabase Dashboard, что записи появились в `test_results` и `user_errors`

2. **Проверка адаптивного подбора:**
   - Пройдите тест, сделайте несколько ошибок
   - Начните новый тест по той же теме
   - В консоли должны появиться логи `[AI TRAINER] Подбор: 40% ошибочных...`

3. **Проверка совета ИИ:**
   - Завершите тест
   - На экране результатов должен появиться блок с советом от ИИ
   - В консоли должны быть логи `[AI TRAINER] Получен совет:...`

4. **Проверка виджета прогресса:**
   - На главном экране должен появиться виджет с процентом успеваемости
   - Если есть ошибки, должен показываться список проблемных тем

## 📝 Примечания

- Система fallback автоматически переключается между 5 моделями Gemini
- Советы кэшируются для оптимизации запросов
- Адаптивный подбор работает только если у пользователя есть ошибки по теме
- Все данные сохраняются в Supabase и доступны для аналитики

## 🔧 Troubleshooting

**Проблема:** Не сохраняются результаты в БД  
**Решение:** Проверьте RLS политики в Supabase и права доступа

**Проблема:** Не работает Edge Function  
**Решение:** Проверьте, что `GEMINI_API_KEY` установлен в настройках Supabase

**Проблема:** Не загружаются проблемные темы  
**Решение:** Убедитесь, что функции `get_problematic_quizzes` созданы в БД

**Проблема:** Адаптивный подбор возвращает пустой массив  
**Решение:** Проверьте, что в БД есть записи в `user_errors` для данного пользователя и темы

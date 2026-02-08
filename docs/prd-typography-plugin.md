# PRD: Figma-плагин для автонастройки интерлиньяжа и трекинга

## 1. Обзор продукта

### Название (рабочее)
**TypeTune**

### Проблема
Дизайнеры тратят значительное время на ручную настройку `line-height` и `letter-spacing` для каждого текстового слоя. Но даже когда значения подобраны — они ломаются при передаче в разработку:

1. **Handoff-разрыв:** Figma показывает `letter-spacing: 2%`, разработчик ставит `2%` в CSS — это ничего не делает. Правильно: `0.02em`. Dev Mode отдаёт `px`/`rem` — статичные единицы, не масштабируемые с font-size
2. **Variables не работают:** Figma Variables не поддерживают `%` для letter-spacing — значение применяется как пиксели. Команды отказываются от токенизации letter-spacing
3. **Вертикальный ритм вручную:** Line-height нужно выставлять кратно базовой сетке (4px/8px), но ни один инструмент не делает этого автоматически вместе с оптимизацией трекинга
4. **Line-height: auto — хаос:** Typography panel, CSS panel и CSS table показывают три разных значения для одного свойства

### Решение
Figma-плагин, который **подбирает оптимальные значения И делает их пригодными для кода**:
- Рассчитывает `line-height` и `letter-spacing` по формулам с учётом метрик шрифта
- Привязывает line-height к базовой сетке (4px / 8px)
- Экспортирует в нативных единицах платформы: CSS (`em`, `clamp()`), iOS (`kern`, `lineHeightMultiple`), Android (`letterSpacing` sp)
- Записывает результат в Figma Variables с вариантами для light/dark mode

### Ключевое позиционирование
> **TypeBalance подбирает красивые числа. TypeTune подбирает красивые числа, которые работают в коде.**

### Референс
Аналог — плагин [TypeBalance](https://www.figma.com/community/plugin/1343994326021053695/typebalance) от Dmitriy Vaganov. Он использует закрытую базу данных оптимальных значений для 200+ шрифтов, подобранных с помощью computer vision. Наш подход: открытая формульная система с возможностью кастомизации, code-ready export и интеграция с Figma Variables.

---

## 2. Целевая аудитория и боли

| Сегмент | Боль | Как решаем |
|---------|------|-----------|
| UI/UX-дизайнеры | Ручной подбор line-height и letter-spacing для каждого текста | Автоподбор в один клик с учётом шрифта, размера и контекста |
| Дизайн-системщики | Variables не поддерживают `%` для letter-spacing; нет единого источника правды | Запись оптимальных значений в Variables (px); отдельные наборы для light/dark |
| Фронтенд-разработчики | `letter-spacing: 2%` из Figma не работает в CSS; пересчёт вручную | Экспорт в `em` (CSS), `kern` (iOS), `sp` (Android) — копипаст без пересчёта |
| Дизайнеры с baseline grid | Line-height не кратен сетке → ломается вертикальный ритм | Автоокругление до ближайшего кратного 4px/8px |
| Начинающие дизайнеры | Не знают «правильных» значений | Прозрачные формулы + превью до/после |

---

## 3. УТП (уникальные торговые предложения)

| # | УТП | Конкуренты |
|---|-----|-----------|
| 1 | **Code-ready export** — CSS (`em`, `rem`, `clamp()`), iOS (`lineHeightMultiple`, `kern`), Android (`lineSpacingMultiplier`, `letterSpacing` sp) в нативных единицах платформы | Никто не делает |
| 2 | **Variables-first** — результат записывается в Figma Variables с привязкой к font-size, с вариантами для light/dark mode | TypeBalance — нет |
| 3 | **Grid-aware line-height** — автоокругление до ближайшего кратного базовой сетки (4px/8px). Настраиваемый grid-step | Ни у кого |
| 4 | **Live diff preview** — визуальное «до / после» в UI плагина с числовым diff | TypeBalance — нет превью |
| 5 | **Открытые формулы** — все коэффициенты видны и редактируемы | TypeBalance — закрытая БД |
| 6 | **Fluid typography bridge** — генерация CSS `clamp()` для font-size + пропорциональный пересчёт line-height и letter-spacing для двух breakpoints | Отдельные плагины для font-size, но не для spacing |

---

## 4. Функциональные требования

### 4.1. Автоподбор line-height (интерлиньяж)

**Входные параметры:**
- Семейство шрифта (font family)
- Кегль (font size, 8–210 px)
- Начертание (font weight)
- Контекст: заголовок (display) / основной текст (body) / подпись (caption)

**Логика расчёта:**

```
line-height = round(fontSize * baseRatio * contextMultiplier * weightAdjust * bgAdjust, gridStep)
```

Где:
- `baseRatio` — зависит от метрик шрифта: `(ascender + |descender| + opticalPadding) / unitsPerEm`. Диапазон 1.15–1.6
- `contextMultiplier`:
  - Display (≥32px): 0.85–1.0 (плотнее)
  - Body (14–31px): 1.0 (нормально)
  - Caption (≤13px): 1.05–1.15 (свободнее)
- `weightAdjust`: тонкие (100–300) → +2–3%, жирные (700–900) → -2–3%
- `bgAdjust`: тёмный фон → +1–2%
- `round(..., gridStep)` — округление до ближайшего кратного gridStep (по умолчанию 4px)

**Особые случаи:**
- Однострочные элементы (кнопки, лейблы): `line-height = fontSize` (100%)
- Крупные display-заголовки (≥64px): автоснижение до 90–100%

### 4.2. Автоподбор letter-spacing (трекинг)

**Логика расчёта:**

```
letter-spacing = fontSize * baseTracking * sizeScale * caseAdjust * bgAdjust
```

Где:
- `baseTracking` — специфичен для шрифта. Condensed → положительная коррекция; широкие → отрицательная
- `sizeScale` — обратная зависимость от размера:
  - ≤12px: +0.5–1.0%
  - 13–24px: 0
  - 25–48px: -0.5–1.5%
  - ≥49px: -1.5–3.0%
- `caseAdjust` — uppercase: +5–10%
- `bgAdjust` — тёмный фон: +1–3%

### 4.3. Определение фона (светлый / тёмный)

1. Проверить fill ближайшего родительского фрейма/компонента
2. Relative luminance: `L = 0.2126*R + 0.7152*G + 0.0722*B`
3. `L < 0.5` → тёмный фон
4. Ручной override в UI: Авто / Светлый / Тёмный

### 4.4. Grid-aware округление

Line-height округляется до ближайшего кратного `gridStep`:
```
snapToGrid(value, gridStep) = Math.round(value / gridStep) * gridStep
```
- По умолчанию `gridStep = 4`
- Настраиваемый: 1 (отключено), 2, 4, 8
- UI-индикатор: показывает исходное значение и округлённое

### 4.5. Code-ready экспорт

Для каждого обработанного текстового слоя генерируется код:

**CSS:**
```css
font-size: 16px;
line-height: 24px;    /* 150% */
letter-spacing: 0.02em; /* Figma: 2% */
```

**CSS Fluid (clamp):**
```css
font-size: clamp(14px, 1.2vw + 10px, 18px);
line-height: clamp(20px, 1.5vw + 14px, 28px);
letter-spacing: 0.02em;
```

**iOS (Swift):**
```swift
let paragraphStyle = NSMutableParagraphStyle()
paragraphStyle.lineHeightMultiple = 1.5
let attributes: [NSAttributedString.Key: Any] = [
    .kern: 0.32,
    .paragraphStyle: paragraphStyle
]
```

**Android (Kotlin):**
```kotlin
android:lineSpacingMultiplier="1.5"
android:letterSpacing="0.02" // em units
```

### 4.6. Figma Variables интеграция

Плагин создаёт/обновляет Variable Collection `TypeTune`:
```
TypeTune/
├── heading-1/line-height     = 48   (px)
├── heading-1/letter-spacing  = -0.5 (px)
├── body/line-height          = 24   (px)
├── body/letter-spacing       = 0.32 (px)
└── ...
```

С Mode-вариантами:
- `Light` — стандартные значения
- `Dark` — скорректированные (+1–3% letter-spacing, +1–2% line-height)

### 4.7. База данных шрифтов

```typescript
interface FontProfile {
  family: string;
  category: 'sans-serif' | 'serif' | 'mono' | 'display';
  baseLineHeightRatio: number;
  baseTrackingRatio: number;
  displayTightening: number;
  uppercaseBoost: number;
  weights: Record<number, {
    lineHeightAdjust: number;
    trackingAdjust: number;
  }>;
}
```

**Tier 1 (MVP, 30 шрифтов):**
- Google Fonts топ-20: Inter, Roboto, Open Sans, Montserrat, Lato, Poppins, Noto Sans, Raleway, Ubuntu, Nunito, Playfair Display, PT Sans, Merriweather, Rubik, Work Sans, DM Sans, Manrope, Space Grotesk, IBM Plex Sans, Jost
- Коммерческие: SF Pro, Neue Montreal, Golos, Graphik, Gilroy, TT Norms Pro, Basis Grotesque, Suisse Int'l, Helios, Druk

**Фоллбэк:** универсальные формулы на основе категории шрифта (sans-serif / serif / mono / display).

### 4.8. Пользовательский интерфейс

**Главный экран:**

```
┌──────────────────────────────────────┐
│  TypeTune                         ×  │
├──────────────────────────────────────┤
│                                      │
│  Контекст:  [Auto ▼]  Сетка: [4px▼] │
│  Фон:  (●) Авто  (○) Светлый  (○) Тёмный │
│                                      │
│  ─── Результат ───────────────────── │
│  Inter · 16px · Regular              │
│                                      │
│  Line-height:    24px  (150%)  ← 19.2px │
│  Letter-spacing: 0.32px (2%)  ← 0px │
│                                      │
│  [▸ Применить к выбранным]           │
│  [▸ Применить ко всей странице]      │
│                                      │
│  ─── Превью ──────────────────────── │
│  ┌────────────────────────────────┐  │
│  │ До    │ Быстрая бурая лиса    │  │
│  │       │ перепрыгнула через     │  │
│  │       │ ленивую собаку         │  │
│  ├───────┼────────────────────────┤  │
│  │ После │ Быстрая бурая лиса    │  │
│  │       │ перепрыгнула через     │  │
│  │       │ ленивую собаку         │  │
│  └────────────────────────────────┘  │
│                                      │
│  ─── Экспорт ─────────────────────── │
│  [CSS]  [CSS Fluid]  [iOS]  [Android]│
│  ┌────────────────────────────────┐  │
│  │ line-height: 24px;             │  │
│  │ letter-spacing: 0.02em;        │  │
│  └────────────────────────────────┘  │
│                               [Copy] │
│                                      │
│  ─── Настройки ───────────────────── │
│  ☐ Записать в Variables              │
│  ☐ Авто-применение при выделении     │
└──────────────────────────────────────┘
```

**Режимы работы:**
1. **Ручной** — выделить → «Применить»
2. **Автоматический** — подписка на `selectionchange` (opt-in)
3. **Пакетный** — все текстовые слои на странице/во фрейме

---

## 5. Нефункциональные требования

| Требование | Значение |
|-----------|----------|
| Время отклика | < 100ms на один текстовый слой |
| Пакетная обработка | < 2s на 500 текстовых слоёв |
| Размер плагина | < 500 KB |
| Figma API | Plugin API (не REST API) — работа без токенов |
| Хранение настроек | `figma.clientStorage` |
| Offline | Полная работа без интернета |

---

## 6. Технический дизайн

### Стек
- **UI:** Figma Plugin API + Preact (< 4 KB)
- **Логика:** TypeScript
- **Сборка:** esbuild
- **Тесты:** Vitest

### Архитектура

```
┌──────────────┐     postMessage     ┌────────────────────┐
│   UI (iframe) │ ◄────────────────► │  Main thread        │
│   Preact app  │                    │  (sandbox)          │
│               │                    │                     │
│  - контролы   │                    │  - FontDatabase     │
│  - превью     │                    │  - Calculator       │
│  - код-экспорт│                    │  - BgAnalyzer       │
│               │                    │  - GridSnapper      │
│               │                    │  - CodeExporter     │
│               │                    │  - VariablesWriter  │
│               │                    │  - NodeTraverser    │
└──────────────┘                    └────────────────────┘
```

**Модули:**

| Модуль | Ответственность |
|--------|-----------------|
| `FontDatabase` | Хранение и поиск профилей шрифтов + фоллбэк |
| `Calculator` | Расчёт line-height и letter-spacing по формулам |
| `BgAnalyzer` | Определение яркости фона ближайшего родителя |
| `GridSnapper` | Округление line-height до кратного gridStep |
| `CodeExporter` | Генерация кода: CSS, CSS Fluid, iOS, Android |
| `VariablesWriter` | Создание/обновление Figma Variables |
| `NodeTraverser` | Обход дерева нод, фильтрация TextNode |
| `Applier` | Применение рассчитанных значений к нодам |

---

## 7. Метрики успеха

| Метрика | Цель (3 мес.) |
|---------|---------------|
| Установки (Figma Community) | 1 000 |
| WAU (weekly active users) | 300 |
| Avg. применений на сессию | ≥ 3 |
| Рейтинг в Community | ≥ 4.5 / 5 |
| Шрифтов в базе | 50+ |
| % пользователей, использующих экспорт | ≥ 20% |

---

## 8. Этапы разработки

### MVP (v0.1)
- [ ] Базовый расчёт line-height и letter-spacing по формулам
- [ ] Поддержка 30 шрифтов (Tier 1)
- [ ] Grid-aware округление line-height
- [ ] Определение контекста по размеру (display / body / caption)
- [ ] Адаптация к uppercase и светлому/тёмному фону
- [ ] Применение к выделенным текстовым слоям
- [ ] Минимальный UI с превью и результатами
- [ ] Code-ready экспорт (CSS с `em` для letter-spacing)

### v0.2
- [ ] Полный экспорт: CSS Fluid (`clamp`), iOS, Android
- [ ] Пакетное применение
- [ ] Figma Variables интеграция (light/dark modes)
- [ ] Автоматический режим (selectionchange)

### v0.3
- [ ] Расширение базы до 50+ шрифтов
- [ ] Пользовательские профили (кастомные коэффициенты)
- [ ] Mixed fonts в одном TextNode (посегментная обработка)
- [ ] Онбординг и документация

### v1.0
- [ ] Полировка UI
- [ ] Публикация в Figma Community

---

## 9. Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|------------|---------|-----------|
| Figma Plugin API не даёт доступ к метрикам шрифта | Высокая | Высокое | Собственная БД метрик; эвристики для неизвестных шрифтов |
| Mixed fonts в одном TextNode | Средняя | Среднее | `getRangeFontName()` / `getRangeFontSize()` |
| Субъективность оптимальных значений | Высокая | Среднее | Ручная подстройка коэффициентов; «рекомендовано» как отправная точка |
| Шрифт не в базе | Высокая | Низкое | Фоллбэк по категории; UI-индикатор «приближённый расчёт» |
| Variables API ограничения | Средняя | Среднее | Graceful degradation: экспорт в JSON если Variables API недоступен |

---

## 10. Сравнение с конкурентами

| Аспект | TypeBalance | Peppercorn | Tokens Studio | **TypeTune** |
|--------|-------------|------------|---------------|-------------|
| Оптимизация spacing | Да (закрытая БД) | Нет | Нет | Да (открытые формулы) |
| Type scale | Нет | Да | Да | Нет (не в скоупе) |
| Code export | Нет | Частично | Через SD | CSS/iOS/Android + clamp() |
| Figma Variables | Нет | Частично | Да | Да (с light/dark modes) |
| Grid-aware | Нет | Нет | Нет | Да (4px/8px snap) |
| Dark mode коррекция | Да (авто) | Нет | Нет | Да (авто + manual) |
| Фоллбэк для любого шрифта | Нет | N/A | N/A | Да |
| Кастомизация | Нет | Нет | Да | Да |
| Цена | Бесплатно | Freemium | Платный | Бесплатно (MIT) |

# سحاب — القرارات التقنية

> كل قرار هنا مع السبب. إذا تغير قرار، نحدّث الملف ونكتب السبب الجديد.

## تغييرات أثناء التنفيذ (2026-10-26)

| الخطة الأصلية | ما نُفّذ | السبب |
|---------------|----------|-------|
| Tailwind | **CSS عادي** بنفس tokens النموذج (`src/styles/global.css`) | التصميم المعتمد مكتوب CSS مع container queries؛ نقله كما هو أدق وأسرع |
| drei (PerformanceMonitor, Sky, Clouds…) | **shaders مخصصة** + `QualityMonitor` صغير | drei Clouds يحمّل texture من الإنترنت؛ ومراقب الأداء ~30 سطر |
| Howler.js | **Web Audio مُركّب** (ضجيج مفلتر) في `scene/audio/ambient.ts` | بدون ملفات صوت أو تحميل؛ ممكن تبديله بتسجيلات حقيقية لاحقاً بنفس الواجهة |
| Leva | **لوحة المراجعة** من النموذج (`?debug`) | نفس الأداة اللي جربتها ووافقت عليها |
| i18next | قاموس بسيط `src/i18n/strings.ts` | لغتين فقط |
| — | **Reverse geocoding** عبر BigDataCloud (مجاني، بدون مفتاح) | Open-Meteo ما عنده تحويل إحداثيات لاسم مدينة |
| الوحدات من الـ API | الفرونت يطلب metric دائماً ويحوّل بالعرض | cache واحد لكل مدينة؛ التبديل فوري |

**حجم الحزمة الحالي (gzip):** التطبيق 93KB + المشهد 7KB + three.js/fiber/postprocessing 269KB + CSS 4KB = **~373KB**، فوق هدف 350KB بحوالي 7%. معظمها three.js نفسه؛ التقليل يحتاج تحميل postprocessing فقط على الجودة العالية — مؤجل للتحسينات.

---

## 1. الفرونت إند

| الطبقة | الاختيار | ليش؟ |
|--------|----------|------|
| Build tool | **Vite** | أسرع dev server، HMR فوري — مهم جداً لضبط الـ shaders بالعين |
| Framework | **React + TypeScript** | أكبر منظومة لـ 3D على الويب (R3F) |
| 3D | **Three.js** عبر **React Three Fiber (R3F)** | Three.js بأسلوب React مع أداء أصلي |
| مساعدات 3D | **@react-three/drei** | Sky, Stars, Clouds, Instances, PerformanceMonitor, AdaptiveDpr... |
| Post-processing | **@react-three/postprocessing** | Bloom, Vignette, ToneMapping — مدمجة بتمريرة واحدة |
| Shaders | GLSL مخصص (sky, rain, snow, fog, heat haze) + `vite-plugin-glsl` | تحكم كامل وأداء عالي |
| Animation (UI) | **Motion** (Framer Motion) | انتقالات البطاقات والأرقام |
| Animation (3D) | lerp/damp داخل `useFrame` (`maath/easing`) | بدون React re-render |
| Data fetching | **TanStack Query** | Cache، prefetch، retry، stale-while-revalidate جاهزة |
| State | **Zustand** | خفيف، ويُقرأ من داخل `useFrame` بدون re-render (`getState()`) |
| Styling | **Tailwind CSS** | سريع، يدعم RTL عبر `rtl:` و logical properties |
| Charts | SVG مخصص (منحنى 24 ساعة) | خفيف، تحكم كامل بالشكل — لا داعي لمكتبة ثقيلة |
| i18n | **i18next** (أو قاموس بسيط) | عربي/إنجليزي + RTL/LTR |
| الصوت | **Howler.js** (فوق Web Audio) | loops، crossfade، fallback للصيغ، فك قفل الصوت بعد أول تفاعل |
| Debug | **Leva** + **r3f-perf** (dev فقط) | ضبط المشاهد وقياس الأداء |
| Testing | **Vitest** + **Playwright** | منطق الربط (WMO → Scene) + e2e للبحث |
| Lint/Format | ESLint + Prettier | — |

---

## 2. معمارية "صفر delay" للخلفية

### 2.1 Canvas دائم
```tsx
// App.tsx — الـ Canvas خارج أي route أو شرط، لا يُفك أبداً
<>
  <WeatherCanvas />   {/* position: fixed, z-index: 0 */}
  <UI />              {/* فوقه */}
</>
```

### 2.2 تدفق البيانات
```
API ──► TanStack Query ──► weatherToSceneState() ──► Zustand: targetScene
                                                         │
                         useFrame (كل frame) ◄───────────┘
                           current = damp(current, target, dt)
                           uniforms.uRain.value = current.rainIntensity
                           ...
```
- **React لا يعيد رسم المشهد عند تغيير الطقس.** فقط يتغير `targetScene` في الـ store، وحلقة `useFrame` تقرأه وتقترب منه تدريجياً.
- كل الطبقات (مطر، ثلج، برق…) **موجودة دائماً** في المشهد؛ الطبقة بشدة 0 تُخفى بـ `visible = false` لتوفير الرسم، لكن مادتها مُجمّعة مسبقاً.

### 2.3 Pre-compile
- عند الإقلاع: `gl.compile(scene, camera)` بعد تفعيل كل الطبقات مؤقتاً → لا يوجد "أول مرة" يتجمّد فيها المتصفح عند ظهور المطر.
- مكون `<Preload all />` من drei لرفع الـ textures للـ GPU مسبقاً.

### 2.4 الجزيئات
- `InstancedMesh` أو `Points` مع shader: الحركة تُحسب **في الـ vertex shader** (موقع = f(time, seed)) — صفر عمل على الـ CPU لكل جزيء.
- عدد الجزيئات ثابت؛ الشدة تتحكم بعدد المرئي عبر uniform (`instanceCount` أو alpha threshold).

### 2.5 الأصول
- **إجرائي أولاً:** السماء، الغيوم (noise shader)، المطر، الثلج — بدون ملفات.
- Textures قليلة (noise، ندفة ثلج) بصيغة **KTX2/WebP**، حجم صغير.
- لا موديلات GLTF في النسخة الأولى (إلا إذا قررنا أفق/معالم — حينها Draco + meshopt).

### 2.6 التحميل
- Code-splitting: الـ UI يظهر فوراً، حزمة الـ 3D تُحمّل بالتوازي.
- خلفية CSS gradient تطابق ألوان المشهد الافتراضي حتى يجهز الـ Canvas → لا وميض أبيض.
- **Prefetch** بيانات المدينة عند hover/focus على الاقتراح (`queryClient.prefetchQuery`).

### 2.7 الجودة التكيفية
- `PerformanceMonitor` (drei) → Zustand `quality: 'high' | 'medium' | 'low'`.
- `AdaptiveDpr` + `frameloop` يتوقف عند إخفاء التبويب.

### 2.8 الصوت
- يُحمّل **بعد** أول frame للمشهد، بأولوية منخفضة — ما يزاحم الـ 3D ولا البيانات.
- أحجام الأصوات تُحدّث داخل نفس حلقة `useFrame` من `currentScene` (بدون React state)، فالصوت والصورة متزامنين دائماً.

---

## 3. هيكل المشروع المقترح (الفرونت إند)

```
sahab/
├── docs/                       ← هذه الملفات
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/                ← App.tsx, providers
│   │   ├── features/
│   │   │   ├── search/         ← SearchBar, Suggestions, useGeocode
│   │   │   ├── current/        ← CurrentWeather, WindCard, HumidityCard
│   │   │   ├── hourly/         ← HourlyStrip, TempCurve
│   │   │   ├── daily/          ← DailyList, TempRangeBar
│   │   │   └── settings/       ← Units, Language
│   │   ├── scene/              ← ★ كل الـ 3D
│   │   │   ├── WeatherCanvas.tsx
│   │   │   ├── layers/         ← Sky, Sun, Moon, Stars, Clouds, Rain, Snow, Fog, Lightning, Ground
│   │   │   ├── shaders/        ← *.glsl
│   │   │   ├── state/          ← SceneState, presets.ts, weatherToScene.ts, sceneStore.ts
│   │   │   ├── effects/        ← PostFX
│   │   │   ├── quality/        ← adaptive quality
│   │   │   └── audio/          ← AmbientAudio (يقرأ نفس SceneState)
│   │   ├── data/               ← types.ts, providers/ (انظر API_CONTRACT.md)
│   │   ├── ui/                 ← مكونات عامة: GlassCard, Icon, Skeleton
│   │   ├── i18n/
│   │   └── styles/
│   └── ...
└── backend/                    ← المرحلة 3
```

---

## 4. الباك إند (المرحلة 3 — منفّذ)

اختيار المستخدم: **Node.js + Express + PostgreSQL**.

| الطبقة | الاختيار | ليش؟ |
|--------|----------|------|
| Runtime | **Node.js + TypeScript** (`tsx` للتطوير) | نفس لغة الفرونت |
| Framework | **Express 5** | يلتقط أخطاء الـ async تلقائياً |
| قاعدة البيانات | **PostgreSQL** عبر `pg` | كاش دائم يعيش بعد إعادة التشغيل ومشترك بين أكثر من سيرفر؛ جاهز لإحصائيات/حسابات لاحقاً |
| Cache | **LRU بالذاكرة (500 عنصر) أمام جدول `cache_entries`** | الذاكرة للسرعة، Postgres للاستمرارية. إذا Postgres وقع، الـ API يكمل بالذاكرة |
| Migrations | ملف `src/db/migrations.ts` + جدول `schema_migrations`، تعمل تلقائياً عند الإقلاع | بدون أداة خارجية؛ تنشئ قاعدة `sahab` إذا مش موجودة |
| Validation | **Zod** | رسائل خطأ واضحة بشكل العقد |
| حماية | `express-rate-limit` + CORS لأصول محددة | |
| المزوّد | Open-Meteo + BigDataCloud خلف `WeatherProvider` | قابل للتبديل |
| اختبارات | Vitest + Supertest بمزوّد وهمي | بدون إنترنت أو قاعدة بيانات |

```
backend/src/
├── server.ts          ← نقطة التشغيل
├── app.ts             ← Express: routes + تحقق + أخطاء (قابل للاختبار)
├── weatherService.ts  ← cache-first + دمج الطلبات المتزامنة
├── providers/         ← openMeteo.ts (جلب + تحويل للعقد), wmo.ts
├── cache/cache.ts     ← MemoryLru + Postgres + تنظيف دوري
├── db/                ← db.ts (اتصال + إنشاء القاعدة + migrations), migrations.ts
├── contract.ts        ← أنواع العقد + ApiError
└── config.ts          ← متغيرات البيئة
```

في التطوير، Vite يمرّر `/api` إلى `localhost:8080` (dev و preview)، فالمتصفح ما بيحكي إلا مع نفس الأصل.

---

## 5. معايير الكود

- TypeScript `strict`.
- **ممنوع** `setState` داخل `useFrame`.
- **ممنوع** إنشاء `new Vector3/Color/Material` داخل `useFrame` — كائنات مُعاد استخدامها فقط.
- منطق تحويل الطقس → مشهد **دوال نقية** (pure) مع اختبارات وحدة.
- كل مكون UI يدعم RTL باستخدام logical properties (`ps-`, `me-`, `start`, `end`).

# سحاب — عقد البيانات (API Contract)

> الشكل الموحد للبيانات بين الفرونت إند والباك إند.
> **الفرونت إند يُبنى على هذا الشكل من اليوم الأول** — سواء كانت البيانات من mock، أو Open-Meteo مباشرة (عبر adapter)، أو من الباك إند لاحقاً.
> بهذا، عند بناء الباك إند **لا نعدّل أي مكون في الواجهة**، فقط نبدّل مصدر البيانات.

## ⚠️ ما تغيّر عند التنفيذ (المرحلة 3، 2026-10-26)

المنفّذ فعلياً في `backend/` يختلف عن المسودة أدناه بهذه النقاط (المسودة باقية للتاريخ):

| النقطة | المنفّذ |
|--------|---------|
| `GET /weather` | يأخذ `lat` و `lon` فقط. **لا** `units` ولا `lang`: البيانات دائماً metric، والواجهة تحوّل وتترجم بنفسها، فكاش واحد يخدم كل اللغات والوحدات |
| `location` في `/weather` | `{ lat, lon, timezone, utcOffsetSeconds }` فقط؛ الاسم والدولة يأتيان من المكان الذي اختاره المستخدم في الواجهة |
| `description` | محذوف من الاستجابة؛ الواجهة تشتقه من `condition` بلغتها |
| `meta.cached` | جديد: `true` إذا جاء الرد من الكاش |
| `GET /api/v1/reverse?lat&lon&lang` | **جديد**: إحداثيات → مكان (لزر "موقعي")، يرجع `Place` |
| `GET /api/health` | **جديد**: `{ ok, uptimeSec, cache: { memoryEntries, persistent } }` |
| `GET /api/v1/place?id=om:<n>&lang` | **جديد**: نفس المكان بأسماء اللغة المطلوبة (الواجهة تستدعيه عند تبديل اللغة). يرجع `Place`؛ اسم الدولة من رمزها عبر `Intl.DisplayNames`. كاش 30 يوم لكل مكان+لغة. أماكن `geo:` تُعاد تسميتها عبر `/reverse` |
| الأخطاء | نفس الشكل، + `INTERNAL` (500) لأي خطأ غير متوقع بدون كشف التفاصيل |
| الكاش | مفتاح الطقس: lat/lon مقرّبة لخانتين (~1 كم)؛ geocode أسبوع؛ reverse 30 يوم. طلبات متزامنة لنفس المفتاح = طلب واحد للمزوّد |
| Rate limit | 120 طلب/دقيقة لكل IP على `/api/v1/*` |

مصدر الحقيقة للأنواع: `backend/src/contract.ts` و `frontend/src/data/types.ts` (متطابقان يدوياً).

---

## 1. البحث عن مدينة

```
GET /api/v1/geocode?q={query}&lang={ar|en}&limit=8
```

**الاستجابة:**
```json
{
  "results": [
    {
      "id": "250441",
      "name": "عمّان",
      "region": "محافظة العاصمة",
      "country": "الأردن",
      "countryCode": "JO",
      "lat": 31.95522,
      "lon": 35.94503,
      "timezone": "Asia/Amman"
    }
  ]
}
```

---

## 2. الطقس الكامل لموقع

```
GET /api/v1/weather?lat={lat}&lon={lon}&units={metric|imperial}&lang={ar|en}
```

**الاستجابة:**
```json
{
  "location": {
    "name": "عمّان",
    "country": "الأردن",
    "lat": 31.95522,
    "lon": 35.94503,
    "timezone": "Asia/Amman",
    "utcOffsetSeconds": 10800
  },
  "current": {
    "time": "2026-10-26T14:30",
    "temperature": 24.3,
    "feelsLike": 25.1,
    "humidity": 41,
    "windSpeed": 14.2,
    "windGusts": 22.0,
    "windDirection": 290,
    "cloudCover": 35,
    "precipitation": 0.0,
    "weatherCode": 2,
    "condition": "partly-cloudy",
    "description": "غائم جزئياً",
    "isDay": true
  },
  "hourly": [
    {
      "time": "2026-10-26T15:00",
      "temperature": 24.0,
      "weatherCode": 2,
      "condition": "partly-cloudy",
      "precipitationProbability": 0,
      "isDay": true
    }
    // ... 24 عنصراً تبدأ من الساعة الحالية
  ],
  "daily": [
    {
      "date": "2026-10-26",
      "tempMax": 27.5,
      "tempMin": 16.8,
      "weatherCode": 2,
      "condition": "partly-cloudy",
      "description": "غائم جزئياً",
      "precipitationProbability": 5,
      "sunrise": "2026-10-26T06:12",
      "sunset": "2026-10-26T17:18"
    }
    // ... 7 عناصر
  ],
  "meta": {
    "provider": "open-meteo",
    "fetchedAt": "2026-10-26T11:30:12Z",
    "units": "metric"
  }
}
```

---

## 3. قواعد

| القاعدة | التفاصيل |
|---------|----------|
| **الأوقات** | `time` بالتوقيت **المحلي للمدينة** (بدون Z) — لأن المشهد والعرض يعتمدان على الوقت المحلي. `fetchedAt` فقط بـ UTC. |
| **الوحدات** | `metric`: °C، كم/س، مم. `imperial`: °F، ميل/س، إنش. |
| **`condition`** | قيمة من: `clear` · `partly-cloudy` · `overcast` · `fog` · `drizzle` · `rain` · `snow` · `storm` — مشتقة من `weatherCode` حسب جدول [SCENES.md](SCENES.md#4-ربط-رموز-wmo-بالمشاهد) |
| **`description`** | نص جاهز للعرض بلغة `lang` |
| **`hourly`** | بالضبط 24 عنصراً، أولها الساعة القادمة الكاملة |
| **`daily`** | بالضبط 7 عناصر، أولها اليوم |
| **`windDirection`** | بالدرجات، 0 = شمال، باتجاه عقارب الساعة (الاتجاه **القادم منه** الريح) |

---

## 4. الأخطاء

```json
{
  "error": {
    "code": "LOCATION_NOT_FOUND",
    "message": "لم نجد هذه المدينة"
  }
}
```

| الكود | HTTP | المعنى |
|-------|------|--------|
| `BAD_REQUEST` | 400 | معاملات ناقصة أو غير صالحة |
| `LOCATION_NOT_FOUND` | 404 | — |
| `RATE_LIMITED` | 429 | — |
| `UPSTREAM_ERROR` | 502 | مزوّد الطقس لا يستجيب |

---

## 5. التخزين المؤقت (للباك إند لاحقاً)

| المورد | مدة الـ Cache |
|--------|--------------|
| Geocode | 7 أيام |
| Weather | 10 دقائق (مفتاح: lat/lon مقرّبة لـ 2 خانة عشرية + units + lang) |

---

## 6. في مرحلة الفرونت إند

```
src/data/
├── types.ts              ← الأنواع أعلاه (TypeScript) — مصدر الحقيقة
├── providers/
│   ├── mock.ts           ← fixtures لكل condition
│   ├── openMeteo.ts      ← يجلب من Open-Meteo مباشرة ويحوّل للشكل الموحد
│   └── backend.ts        ← (المرحلة 3) يجلب من /api/v1
└── index.ts              ← يختار المزوّد حسب VITE_DATA_SOURCE
```

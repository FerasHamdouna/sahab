# سحاب — دليل النشر

```
المتصفح ──► Vercel (الفرونت إند، ملفات ثابتة)
              │  VITE_API_URL
              ▼
           Render: sahab-api (Express) ──► Render: sahab-db (PostgreSQL)
              │
              ▼
           Open-Meteo / BigDataCloud
```

الملفات الجاهزة في المشروع:
- [`render.yaml`](../render.yaml): الباك إند + قاعدة البيانات على Render بضغطة وحدة (Blueprint).
- [`vercel.json`](../vercel.json) بجذر المستودع: يبني `frontend/` وينشر `frontend/dist` + كاش طويل لملفات `assets` (فما في داعي تختار Root Directory).

---

## 0. GitHub

Render و Vercel بيسحبوا الكود من GitHub.

1. افتح https://github.com/new
2. الاسم: `sahab` · اختار **Private** · **لا** تضيف README ولا .gitignore (عندنا).
3. بعد الإنشاء، من مجلد المشروع:

```bash
git remote add origin https://github.com/<اسمك>/sahab.git
git push -u origin main
```

---

## 1. الباك إند + القاعدة على Render

1. https://dashboard.render.com ← **New** ← **Blueprint**.
2. اربط حساب GitHub واختار مستودع `sahab`.
3. Render بيقرأ `render.yaml` وبيعرض: `sahab-db` (PostgreSQL) و `sahab-api` (Web Service).
4. بيطلب قيمة `CORS_ORIGINS`: حط مؤقتاً `http://localhost:5173` (بنغيّرها بالخطوة 3).
5. **Apply**. انتظر لحد ما الاثنين يصيروا **Live** (أول مرة 3–5 دقائق).
6. افتح: `https://sahab-api.onrender.com/api/health` (الاسم الفعلي بيظهر بصفحة الخدمة)

   المتوقع: `{"ok":true, ..., "cache":{..., "persistent":true}}` ← `persistent: true` يعني متصل بالقاعدة ✅

---

## 2. الفرونت إند على Vercel

1. https://vercel.com/new ← **Import** مستودع `sahab`.
2. **Root Directory**: خليه `./` (الجذر). ملف `vercel.json` بالجذر بيبني مجلد `frontend` لحاله.
3. Framework بيتعرّف لحاله: **Vite**.
4. **Environment Variables**:

   | الاسم | القيمة |
   |-------|--------|
   | `VITE_API_URL` | رابط الباك إند من الخطوة 1، **بدون** `/` بالآخر، مثلاً `https://sahab-api.onrender.com` |

5. **Deploy**. بتاخد دقيقة تقريباً، وبتعطيك رابط مثل `https://sahab-xyz.vercel.app`.

---

## 3. اسمح للفرونت إنه يحكي مع الباك إند (CORS)

1. Render ← `sahab-api` ← **Environment**.
2. `CORS_ORIGINS` = رابط Vercel من الخطوة 2، مثلاً `https://sahab-xyz.vercel.app`
   (لأكثر من رابط افصل بفاصلة: `https://sahab.vercel.app,https://sahab.com`).
3. **Save** ← Render بيعيد النشر لحاله.

---

## 4. التحقق

- [ ] افتح رابط Vercel ← الطقس بيظهر، والمشهد 3D شغّال.
- [ ] `?debug` بالرابط ← تحت مكتوب `مصدر البيانات: backend`.
- [ ] ابحث عن مدينة ← اقتراحات تظهر.
- [ ] زر 📍 ← بيطلب الإذن وبيجيب مدينتك (لازم HTTPS، وVercel بيوفّره).
- [ ] `/api/health` على Render ← `persistent: true`.

---

## الموارد المنشورة فعلياً (2026-10-26)

| المورد | القيمة |
|--------|--------|
| GitHub | `FerasHamdouna/sahab` (Private) |
| Render workspace | My Workspace (`tea-da21crc9v7es738gg6sg`) |
| **الموقع** | **https://sahab-lovat.vercel.app** · Vercel project `sahab` (Hobby) · auto-deploy من `main` |
| الباك إند | `sahab-api` · https://sahab-api.onrender.com · Frankfurt · auto-deploy من `main` · `CORS_ORIGINS` يسمح للموقع |
| القاعدة | `sahab-db` · PostgreSQL 17 · Frankfurt · **تنتهي 2026-11-25** |

ملاحظة: الخدمة انعملت عبر Render connector مش عبر Blueprint، فـ `render.yaml` موجود كمرجع ولإعادة البناء من الصفر.

## Open-Meteo و 429 على الاستضافة المجانية

Render المجاني بيطلع للإنترنت من **IPs مشتركة**، و Open-Meteo المجاني بيحدّ الطلبات **لكل IP**، فطلبات `/forecast` من السيرفر بترجع **429**.
- **الحل الحالي:** الفرونت إند لما يشوف هالخطأ بيجيب الطقس من Open-Meteo مباشرة من متصفح المستخدم (IP المستخدم نفسه). الموقع ما بيوقف.
- **الحل الكامل:** مفتاح Open-Meteo مدفوع ← حطه بـ `OPEN_METEO_API_KEY` بخدمة Render، فيصير للسيرفر حصته الخاصة ويرجع الكاش يخدم الكل.

## حدود الخطة المجانية (مهم)

| الخدمة | الحد | الأثر |
|--------|------|-------|
| Render Web (free) | **ينام بعد 15 دقيقة** بدون زيارات | أول زائر بعد النوم بيستنى **30–60 ثانية**. الزيارات بعدها سريعة |
| Render PostgreSQL (free) | **تنتهي بعد 30 يوم** | بعدها لازم ترقية (~$7/شهر) أو إنشاء قاعدة جديدة. الموقع **ما بيوقف**: الباك إند بيكمّل بكاش الذاكرة |
| Vercel Hobby | مجاني لمشاريع شخصية | كافي تماماً للفرونت |

**البديل Railway:** ما فيه نوم ولا انتهاء للقاعدة، بس ما عنده خطة مجانية دائمة (رصيد تجربة، ثم ~$5/شهر). الكود جاهز له كمان: New Project ← Deploy from GitHub ← Root Directory `backend` ← أضف PostgreSQL ← اربط `DATABASE_URL=${{Postgres.DATABASE_URL}}` + `CORS_ORIGINS`.

---

## متغيرات البيئة

**الباك إند** (`backend/.env` محلياً، أو لوحة Render/Railway):

| المتغير | مطلوب | الوصف |
|---------|-------|-------|
| `DATABASE_URL` | لا | بدونها: كاش بالذاكرة فقط |
| `CORS_ORIGINS` | **نعم بالإنتاج** | روابط الفرونت المسموح لها |
| `PORT` | لا | المنصة بتحطه لحالها |
| `DATABASE_SSL` | لا | `true` إذا الاتصال برابط عام يحتاج TLS |
| `RATE_LIMIT_PER_MIN` | لا | الافتراضي 120 |
| `TRUST_PROXY` | لا | عدد البروكسيات قبل السيرفر (الافتراضي 1) |

**الفرونت إند** (لوحة Vercel، بتنقرأ وقت البناء):

| المتغير | الوصف |
|---------|-------|
| `VITE_API_URL` | رابط الباك إند. بدونه الفرونت بيطلب `/api` من نفس الدومين (بيشتغل محلياً فقط) |
| `VITE_DATA_SOURCE` | اختياري: `open-meteo` للاستغناء عن الباك إند |

> **روابط Preview** في Vercel (لكل branch) عناوينها مختلفة، فما بتقدر تحكي مع الباك إند إلا إذا أضفتها لـ `CORS_ORIGINS`.

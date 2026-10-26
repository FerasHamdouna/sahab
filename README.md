# ☁️ سحاب (Sahab)

🌐 **https://sahab-lovat.vercel.app**

موقع طقس بخلفية **ثلاثية الأبعاد حيّة** تتغير حسب طقس المدينة اللي بتبحث عنها.

ابحث عن أي مدينة ← شوف الحرارة، حالة الطقس، الرياح، الرطوبة، توقعات 24 ساعة و7 أيام — وكل هذا فوق مشهد 3D يعكس طقسها لحظياً: شمس، غيوم، مطر، ثلج، ضباب، عاصفة، ليل أو نهار.

## 📄 التوثيق

| الملف | المحتوى |
|-------|---------|
| [docs/PRD.md](docs/PRD.md) | متطلبات المنتج: ماذا نبني ولماذا |
| [docs/SCENES.md](docs/SCENES.md) | ★ مواصفات المشاهد 3D وربطها بحالات الطقس |
| [docs/API_CONTRACT.md](docs/API_CONTRACT.md) | شكل البيانات الموحد بين الفرونت والباك |
| [docs/TECH_STACK.md](docs/TECH_STACK.md) | القرارات التقنية والمعمارية |
| [docs/ROADMAP.md](docs/ROADMAP.md) | المراحل ومعايير الانتهاء |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | الألوان، الخطوط، المسافات، الحركة، المكونات |
| [design/prototype.html](design/prototype.html) | النموذج التفاعلي للواجهة |
| [docs/DEPLOY.md](docs/DEPLOY.md) | النشر: Vercel (فرونت) + Render (باك + PostgreSQL) |

## 🗺️ الحالة

**المرحلة 2 — Frontend + 3D: النسخة الأولى شغّالة.** التالي: مراجعة بصرية ← Backend.

## ▶️ التشغيل

**1. الباك إند** (نافذة أولى):

```bash
cd backend
npm install
cp .env.example .env   # ضع كلمة سر PostgreSQL في DATABASE_URL (أو اتركه فاضي للكاش بالذاكرة فقط)
npm run dev            # http://localhost:8080
```

**2. الفرونت إند** (نافذة ثانية):

```bash
cd frontend
npm install
npm run dev
```

ثم افتح `http://localhost:5173`:

| الرابط | ماذا يعرض |
|--------|-----------|
| `/` | طقس حقيقي عبر الباك إند (لازم يكون شغّال) |
| `/?debug` | + لوحة المراجعة (المشاهد، الوقت، الحالات، الجودة، مدن جاهزة) |
| `/?mock&debug` | بيانات تجريبية ثابتة (بدون إنترنت للطقس) |

أوامر أخرى: `npm run serve` (نسخة الإنتاج على `http://localhost:4173` — أخف وأسرع من وضع التطوير، استخدمها لتجربة الأداء الحقيقي) · `npm test` · `npm run build` · `npm run typecheck`.

## 🧰 التقنيات

React · TypeScript · Vite · Three.js · React Three Fiber · postprocessing · TanStack Query · Zustand · Open-Meteo · Web Audio

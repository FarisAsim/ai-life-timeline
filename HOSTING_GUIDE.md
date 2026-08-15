# دليل الاستضافة الدائمة — AI Life Timeline

هذا الدليل يشرح كيف تحوّل التطبيق من نسخة تجريبية تعمل محليًا إلى تطبيق دائم متاح من أي جهاز — هاتفك أو كمبيوترك — على الإنترنت، خطوة بخطوة.

## أولًا: لماذا نحتاج استضافة دائمة؟

التطبيق حاليًا يعمل على خادم مؤقت ينتهي بانتهاء الجلسة، وهذا يعني أن الرابط يتغير أو يتوقف. الاستضافة الدائمة تعطي رابطًا ثابتًا يعمل 24/7، وتتيح لك حفظ البيانات في قاعدة بيانات سحابية بدلًا من ملف محلي، وتفتح الباب لإضافة حسابات حقيقية متعددة بمصادقة فعلية.

## ثانيًا: أفضل خيار — Vercel (مجاني)

[Vercel](https://vercel.com) هي الأنسب لهذا المشروع لأنه مصمم خصيصًا لتطبيقات Next.js، وخطته المجانية كافية للاستخدام الشخصي (100GB bandwidth شهريًا، وهو كثير جدًا لتطبيق بهذا الحجم).

### الخطوة 1: رفع الكود على GitHub

1. أنشئ حسابًا مجانيًا على [GitHub](https://github.com).
2. افتح Terminal داخل مجلد المشروع ونفّذ:

```bash
git init
git add .
git git commit -m "AI Life Timeline — initial"
```

3. أنشئ Repository جديد من موقع GitHub ثم اربطه:

```bash
git remote add origin https://github.com/اسم-حسابك/ai-life-timeline.git
git push -u origin main
```

> **مهم:** تأكد أن ملف `.gitignore` يستبعد `db/custom.db` و`ai.config.json` و`node_modules` و`.next` حتى لا ترفع بياناتك أو مفاتيحك السحابية.

### الخطوة 2: إنشاء قاعدة بيانات سحابية (Neon — مجاني)

بما أن Vercel لا يدعم ملف SQLite محليًا (السيرفرات متعددة وتُنشأ عند الطلب)، ننتقل إلى PostgreSQL السحابي:

1. افتح [neon.tech](https://neon.tech) وسجّل بحسابك (نفس حساب GitHub أسهل).
2. أنشئ مشروعًا جديدًا وانسخ **Connection String** الذي يبدو هكذا:

```
postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

3. أنشئ جدول البيانات بالبنية المطابقة لمشروعك — انظر ملف `CLOUD_DB_GUIDE.md` المرفق الذي يحتوي على SQL جاهز.

### الخطوة 3: ربط GitHub بـ Vercel

1. افتح [vercel.com/new](https://vercel.com/new) وسجّل بحساب GitHub.
2. اختر Repository المشروع.
3. Framework Preset: اختر **Next.js** (يتعرف تلقائيًا).
4. في **Environment Variables** أضف:

| المتغير | القيمة |
|---|---|
| `DATABASE_URL` | Connection String الخاص بـ Neon |
| `NEXT_PUBLIC_APP_URL` | رابط المشروع بعد النشر (يمكن تعديله لاحقًا) |

5. اضغط **Deploy** — خلال دقيقتين يصبح التطبيق على رابط دائم مثل `https://ai-life-timeline.vercel.app`.

### الخطوة 4: إعدادات Post-Deploy

بعد أول Deployment، نفّذ مرة واحدة:

```bash
# في Terminal محلي (بعد تعديل .env ليشمل DATABASE_URL السحابي)
npx prisma generate
npx prisma db push
```

أو أضف الأمر في Vercel: Settings → General → Package Manager = **Other**، ثم أضف في Build Command: `bun install && npx prisma generate && bun run build` (أو استخدم npm حسب تفضيلك — Vercel يدعم Bun عبر إعدادات Build Command المخصصة).

## ثالثًا: إضافة مصادقة حقيقية (اختياري لكن موصى به)

التطبيق حاليًا يستخدم نظام حسابات على مستوى الجهاز (localStorage). عند الانتقال للسحابة، يُنصح باستبدال ذلك بمصادقة حقيقية حتى يحمي كل مستخدم بياناته عند تسجيل الدخول من أي جهاز.

أبسط خيار هو **[Clerk](https://clerk.com)** (مجاني حتى 10,000 مستخدم):

1. سجّل في Clerk وأنشئ تطبيقًا.
2. ثبّت: `npm install @clerk/nextjs`
3. أضف متغيرات البيئة `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` و`CLERK_SECRET_KEY` في Vercel.
4. لفّ التخطيط في `<ClerkProvider>` وأضف `<SignInButton/>`/`<SignOutButton/>` من Clerk في الواجهة.
5. في كل API route، استبدل `resolveUser(req)` باسترجاع `auth().userId()`، واحفظ معرف المستخدم كـ `userId` في كل جداول قاعدة البيانات.

> بنية المشروع جاهزة لهذا: كل الاستعلامات تُفلتر أصلًا عبر `userId`، فلا تحتاج أي تغيير في منطق البيانات.

## رابعًا: تشغيل التطبيق على هاتفك

بعد النشر على Vercel يصبح التطبيق موقعًا متقدمًا (PWA) بفضل ملف `manifest.json` وService Worker الموجودين:

1. افتح الرابط الدائم في Chrome على هاتفك.
2. اضغط قائمة Chrome → **Install app / إضافة إلى الشاشة الرئيسية**.
3. سيظهر التطبيق كأيقونة مستقلة تفتح بشاشة كاملة، وتصلك إشعارات التذكيرات حتى لو كان التطبيق مغلقًا.

## خامسًا: التحقق من الصحة قبل النشر

نفّذ هذه الأوامر محليًا قبل أي نشر وتأكد أن جميعها تمر:

```bash
npx tsc --noEmit            # لا أخطاء TypeScript
bun run build               # بناء إنتاج ناجح
bun start                   # تشغيل نسخة الإنتاج والتصفح اليدوي
```

## سادسًا: بدائل الاستضافة

| الخدمة | المميزات | العيوب |
|---|---|---|
| **Vercel** | مجاني، مخصص لـ Next.js، أسهل إعداد | 100GB bandwidth شهريًا (كافٍ شخصيًا) |
| **Railway** | يدعم Bun مباشرة + PostgreSQL مدمج | الخطة المجانية محدودة بـ$5 شهريًا |
| **Fly.io** | سيرفر دائم (Docker) — SQLite ملف ممكن | يتطلب Dockerfile وإعداد يدوي أكثر |
| **Netlify** | مجاني، Next.js مدعوم | أبعد قليلًا عن Vercel في توافق Next.js 16 |

**التوصية النهائية:** Vercel + Neon (PostgreSQL) + Clerk للمصادقة — هذه التركيبة مجانية تمامًا للاستخدام الشخصي وتغطي كل النواقص الهيكلية.

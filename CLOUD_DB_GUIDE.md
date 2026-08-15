# دليل بنية قاعدة البيانات السحابية — AI Life Timeline

يشرح هذا الدليل كيف تنتقل من SQLite المحلي (ملف واحد) إلى قاعدة بيانات PostgreSQL سحابية تخدم التطبيق من أي مكان، مع الحفاظ على البنية الحالية للتطبيق بدون تغييرات في منطق العمل.

## لماذا الانتقال من SQLite؟

SQLite ممتاز للتطوير والاستخدام على جهاز واحد، لكن السيرفرات السحابية (Vercel وغيرها) تُنشأ وتُدمر مع كل طلب، ولا تشارك ملفًا واحدًا بين بعضها. PostgreSQL السحابي (Neon, Supabase, Turso) يحل ذلك بقاعدة مركزية يقرأها كل سيرفر، مع ميزة إضافية: استنساخ وتوسّع تلقائي.

## بنية الجداول (مطابقة لـ Prisma schema الحالي)

الجداول التالية مطابقة حرفيًا لملف `prisma/schema.prisma` في المشروع. يمكنك تنفيذها مباشرة على Neon عبر SQL Editor، أو استخدام `bunx prisma db push` بعد تغيير `DATABASE_URL` (الطريقة الأسهل والموصى بها).

```sql
-- المستخدمون
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL
);

-- الفئات (Work, Sleep, Commute...)
CREATE TABLE IF NOT EXISTS "Category" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#10b981',
  "icon" TEXT NOT NULL DEFAULT 'briefcase',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- الأحداث (الخط الزمني)
CREATE TABLE IF NOT EXISTS "TimelineEvent" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "notes" TEXT,
  "startTime" TIMESTAMP NOT NULL,
  "endTime" TIMESTAMP NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 60,
  "source" TEXT NOT NULL DEFAULT 'user_manual',
  "confidenceScore" REAL NOT NULL DEFAULT 0.5,
  "location" TEXT,
  "tags" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_event_user_start" ON "TimelineEvent"("userId", "startTime");

-- الفجوات الزمنية غير المسجلة
CREATE TABLE IF NOT EXISTS "UnknownBlock" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "startTime" TIMESTAMP NOT NULL,
  "endTime" TIMESTAMP NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "question" TEXT,
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- محادثات المساعد
CREATE TABLE IF NOT EXISTS "AIConversation" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "AIMessage" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "AIConversation"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- الإشعارات والتذكيرات
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "triggerAt" TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- أنماط العادات
CREATE TABLE IF NOT EXISTS "HabitPattern" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "categoryName" TEXT,
  "timeOfDay" TEXT,
  "frequency" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- القوالب الجاهزة
CREATE TABLE IF NOT EXISTS "EventTemplate" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 60,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- الأهداف
CREATE TABLE IF NOT EXISTS "Goal" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "targetCategory" TEXT,
  "targetMinutesPerDay" INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- المرفقات (ملاحظات صوتية)
CREATE TABLE IF NOT EXISTS "Attachment" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT REFERENCES "TimelineEvent"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "fileName" TEXT,
  "mimeType" TEXT,
  "data" BYTEA,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);
```

## خطوات الانتقال العملية

### الخطوة 1: تغيير مزود قاعدة البيانات في Prisma

عدّل بداية ملف `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### الخطوة 2: توليد العميل ودفع البنية

```bash
npx prisma generate
npx prisma db push
```

`db push` ينشئ الجداول من البنية الموجودة مباشرة — لا تحتاج كتابة SQL يدويًا إلا إذا أردت ذلك.

### الخطوة 3: ترحيل البيانات الحالية (اختياري)

إذا أردت نقل بيانات SQLite الحالية، استخدم ميزة التصدير التي أضفناها: اضغط **تصدير JSON** من الإعدادات على النسخة المحلية، ثم **استيراد** الملف من الإعدادات على النسخة السحابية. هذا أنظف وأسرع من أي سكربت SQL يدوي.

## اعتبارات مهمة

**المرفقات الصوتية (BYTEA):** تخزين الملفات الثنائية في PostgreSQL يعمل لكنه أثقل. للإنتاج الكثيف، الممارسة الأفضل تخزين الملفات في S3/R2 وحفظ الرابط فقط — هذا تحسين مستقبلي غير مطلوب للاستخدام الشخصي.

**الفهارس:** أضفنا فهرسًا مركبًا `(userId, startTime)` على جدول الأحداث لأن كل الاستعلامات الزمنية (التايملاين، التقويم، التحليلات) تُفلتر بهما معًا.

**حذفCASCADE:** كل الجداول مرتبطة بـ `ON DELETE CASCADE` مع المستخدم، فحذف حساب يمسح بياناته بالكامل تلقائيًا — متوافق مع نظام الحسابات الحالي.

**حدود Neon المجانية:** 0.5GB تخزين و512MB RAM — كافية لعشرات الآلاف من الأحداث. عند التجاوز، تكلفة الترقية رمزية (~$19/شهر للخطة التالية).

## التحقق بعد الانتقال

```bash
# تأكد من الاتصال
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"TimelineEvent\";"

# وتأكد أن التطبيق يعمل
bun run build && bun start
# ثم افتح التطبيق وراجع: التايملاين، التقويم، المساعد، الفجوات
```

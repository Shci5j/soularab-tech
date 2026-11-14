# المرحلة الثانية — ربط محرك روح المحلي

## مسار المحادثة المعتمد

يعتمد التطبيق على المسار المحلي التالي فقط:

`واجهة SOULARAB TECH → FastAPI (127.0.0.1:8000) → llama.cpp (127.0.0.1:8081) → ملف GGUF المحلي`

- واجهة روح تطلب الحالة والنماذج من `/api/assistant/status` و`/api/assistant/models`.
- يقرأ الخادم النماذج من واجهة llama.cpp المتوافقة مع OpenAI: `GET /v1/models`.
- يرسل المحادثة إلى `POST /v1/chat/completions`.
- فحص الصحة يستخدم `GET /health`.
- عنوان المحرك الافتراضي `http://127.0.0.1:8081`، ولا يقبل الخادم عنواناً عاماً أو عنوان شبكة LAN.
- لا توجد حاجة إلى Ollama أو إلى API سحابي أو مفتاح مزود خارجي.

## تشغيل المحرك على Termux

المتطلبات:
- ملف `llama-server` مبني لمعمارية Android/ARM64.
- ملف نموذج GGUF متوافق مع llama.cpp.
- مساحة تخزين وذاكرة كافيتان للنموذج وسياق المحادثة.

من جذر المستودع:

```bash
export LLAMA_MODEL_PATH="$HOME/models/qwen2.5-3b-instruct-q4_k_m.gguf"
bash scripts/start-rooh-engine-termux.sh
```

يبحث السكربت أيضاً عن الاسم نفسه في مجلد `models` داخل المستودع أو مجلد `~/llama.cpp/models`. يمكن تغيير مسار الملف التنفيذي عبر `LLAMA_SERVER_BIN`، والمنفذ عبر `LLAMA_SERVER_PORT`، وحجم السياق عبر `LLAMA_CONTEXT_SIZE`، وعدد طبقات GPU عبر `LLAMA_GPU_LAYERS`.

يكتب السجل في `~/.soularab-llama-server.log` ومعرّف العملية في `~/.soularab-llama-server.pid`. إذا لم يبدأ المحرك، يجب فحص السجل بدلاً من اعتبار الاتصال ناجحاً.

## إعداد FastAPI

اضبط:

```bash
export LLAMA_CPP_BASE_URL=http://127.0.0.1:8081
export LLAMA_CPP_TIMEOUT_SECONDS=180
```

ثم شغّل backend وفق تعليمات Termux الموجودة في README. يجب أن يعمل llama-server وFastAPI على الجهاز نفسه لأن سياسة الاتصال الحالية تقصر محرك المحادثة على loopback.

## التحقق

```bash
curl -fsS http://127.0.0.1:8081/health
curl -fsS http://127.0.0.1:8081/v1/models
curl -fsS http://127.0.0.1:8000/api/assistant/status
curl -fsS http://127.0.0.1:8000/api/assistant/models
```

بعد ذلك افتح قسم روح، وتأكد من ظهور `rooh-local` أو معرّف النموذج الذي يعلنه llama-server، ثم أرسل رسالة اختبار.

## حدود التنفيذ المعلنة

- هذه الدفعة تستبدل تكامل Ollama القديم بالكامل بتكامل llama.cpp للمحادثة، وتضيف مشغل Termux وفحوصات توافق API.
- ComfyUI وwhisper.cpp ما زالا محركين محليين اختياريين مستقلين؛ وجود موصل API لا يعني تثبيت البرنامج أو النموذج أو تشغيله على الهاتف.
- لا تنفذ هذه الدفعة بعدُ محرر فيديو محلياً أو متجراً كاملاً أو shell عاماً أو Git داخلياً أو محرك صيانة أجهزة. لا يجوز إظهار هذه القدرات على أنها جاهزة قبل إضافة التنفيذ والاختبارات.
- لا تحزم أوزان GGUF داخل APK؛ ملف النموذج يبقى منفصلاً عن التطبيق لتقليل حجم الحزمة وإتاحة تبديله.
- لا يفتح الخادم منافذ المحرك على الإنترنت، ولا ينفذ أوامر نظام عامة من خلال المحادثة.

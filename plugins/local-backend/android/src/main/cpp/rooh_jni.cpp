#include <jni.h>
#include <android/log.h>
#include <llama.h>
#include <algorithm>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#define ROOH_LOGE(...) __android_log_print(ANDROID_LOG_ERROR, "RoohEngine", __VA_ARGS__)

static std::mutex g_mutex;
static llama_model *g_model = nullptr;
static llama_context *g_context = nullptr;
static const llama_vocab *g_vocab = nullptr;

static std::string fromJString(JNIEnv *env, jstring value) {
    if (!value) return {};
    const char *chars = env->GetStringUTFChars(value, nullptr);
    if (!chars) return {};
    std::string result(chars);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

static void unloadLocked() {
    if (g_context) { llama_free(g_context); g_context = nullptr; }
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }
    g_vocab = nullptr;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_soularab_localbackend_RoohNative_isLoaded(JNIEnv *, jclass) {
    std::lock_guard<std::mutex> lock(g_mutex);
    return g_model && g_context ? JNI_TRUE : JNI_FALSE;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_soularab_localbackend_RoohNative_version(JNIEnv *env, jclass) {
    return env->NewStringUTF(llama_version());
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_soularab_localbackend_RoohNative_loadModel(JNIEnv *env, jclass, jstring pathValue) {
    std::lock_guard<std::mutex> lock(g_mutex);
    std::string path = fromJString(env, pathValue);
    if (path.empty()) return env->NewStringUTF("مسار النموذج فارغ.");
    unloadLocked();
    llama_backend_init();
    llama_model_params modelParams = llama_model_default_params();
    modelParams.n_gpu_layers = 0;
    g_model = llama_model_load_from_file(path.c_str(), modelParams);
    if (!g_model) return env->NewStringUTF("تعذر تحميل ملف GGUF. تحقق من سلامة الملف ومساحة الذاكرة.");
    llama_context_params contextParams = llama_context_default_params();
    contextParams.n_ctx = 2048;
    contextParams.n_batch = 512;
    contextParams.n_ubatch = 512;
    contextParams.n_threads = std::max(2, (int) std::thread::hardware_concurrency() - 2);
    contextParams.n_threads_batch = contextParams.n_threads;
    contextParams.offload_kqv = false;
    g_context = llama_init_from_model(g_model, contextParams);
    if (!g_context) {
        unloadLocked();
        return env->NewStringUTF("تعذر إنشاء سياق الاستدلال للنموذج.");
    }
    g_vocab = llama_model_get_vocab(g_model);
    return env->NewStringUTF("");
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_soularab_localbackend_RoohNative_generate(JNIEnv *env, jclass, jstring promptValue, jint maxTokens) {
    std::lock_guard<std::mutex> lock(g_mutex);
    if (!g_model || !g_context || !g_vocab) return env->NewStringUTF("محرك روح غير محمّل. حمّل النموذج أولاً.");
    std::string prompt = fromJString(env, promptValue);
    if (prompt.empty()) return env->NewStringUTF("الرسالة فارغة.");
    llama_free(g_context);
    llama_context_params contextParams = llama_context_default_params();
    contextParams.n_ctx = 2048;
    contextParams.n_batch = 512;
    contextParams.n_ubatch = 512;
    contextParams.n_threads = std::max(2, (int) std::thread::hardware_concurrency() - 2);
    contextParams.n_threads_batch = contextParams.n_threads;
    contextParams.offload_kqv = false;
    g_context = llama_init_from_model(g_model, contextParams);
    if (!g_context) return env->NewStringUTF("تعذر إعادة تهيئة سياق النموذج.");

    int32_t needed = llama_tokenize(g_vocab, prompt.c_str(), (int32_t) prompt.size(), nullptr, 0, true, false);
    if (needed >= 0) return env->NewStringUTF("تعذر تحديد حجم الرموز للنص.");
    std::vector<llama_token> tokens((size_t) -needed);
    int32_t tokenCount = llama_tokenize(g_vocab, prompt.c_str(), (int32_t) prompt.size(), tokens.data(), (int32_t) tokens.size(), true, false);
    if (tokenCount <= 0) return env->NewStringUTF("تعذر تحويل الرسالة إلى رموز.");
    tokens.resize((size_t) tokenCount);
    if (llama_decode(g_context, llama_batch_get_one(tokens.data(), tokenCount)) != 0)
        return env->NewStringUTF("فشل تحليل مدخلات النموذج.");

    llama_sampler_chain_params samplerParams = llama_sampler_chain_default_params();
    llama_sampler *sampler = llama_sampler_chain_init(samplerParams);
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
    std::string output;
    const int limit = std::max(1, std::min((int) maxTokens, 1024));
    for (int i = 0; i < limit; ++i) {
        llama_token token = llama_sampler_sample(sampler, g_context, -1);
        if (llama_vocab_is_eog(g_vocab, token)) break;
        llama_sampler_accept(sampler, token);
        char piece[512];
        int32_t pieceSize = llama_token_to_piece(g_vocab, token, piece, sizeof(piece), 0, false);
        if (pieceSize < 0) {
            std::vector<char> larger((size_t) -pieceSize);
            pieceSize = llama_token_to_piece(g_vocab, token, larger.data(), (int32_t) larger.size(), 0, false);
            if (pieceSize > 0) output.append(larger.data(), (size_t) pieceSize);
        } else if (pieceSize > 0) {
            output.append(piece, (size_t) pieceSize);
        }
        if (llama_decode(g_context, llama_batch_get_one(&token, 1)) != 0) break;
    }
    llama_sampler_free(sampler);
    return env->NewStringUTF(output.c_str());
}

package com.soularab.localbackend;

import android.content.Context;
import android.content.ContentValues;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;

/**
 * Approval-gated execution adapters for the five embedded department nodes.
 * External engines are loopback-only adapters; no cloud endpoints or shell execution.
 */
final class LocalDepartmentEngine {
    private static final Object ROOH_LOCK = new Object();
    private static final int MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
    private final Context context;
    private final LocalBackendDatabase helper;
    private final String nodeId;

    LocalDepartmentEngine(Context context, LocalBackendDatabase helper, String nodeId) {
        this.context = context.getApplicationContext();
        this.helper = helper;
        this.nodeId = nodeId;
    }

    boolean isReady() {
        if ("E".equals(nodeId)) return true;
        if ("A".equals(nodeId) || "B".equals(nodeId)) {
            try { return RoohNative.isLoaded(); } catch (Throwable unavailable) { return false; }
        }
        HttpURLConnection connection = null;
        try {
            String base = "C".equals(nodeId)
                ? loopbackBase("comfyui_base_url", "http://127.0.0.1:8188")
                : loopbackBase("whisper_cpp_base_url", "http://127.0.0.1:8080");
            String path = "C".equals(nodeId) ? "/system_stats" : "/health";
            connection = (HttpURLConnection) new URL(base + path).openConnection();
            connection.setConnectTimeout(1200);
            connection.setReadTimeout(1200);
            int status = connection.getResponseCode();
            return status >= 200 && status < 300;
        } catch (Exception unavailable) {
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    boolean processOne() throws Exception {
        if (!isReady()) return false;
        SQLiteDatabase db = helper.getWritableDatabase();
        long taskId = -1L;
        String taskType = null;
        JSONObject payload = null;
        boolean claimed = false;

        // Select and claim under one SQLite write transaction. This prevents two
        // worker instances from executing the same queued task.
        db.beginTransaction();
        try {
            Cursor cursor = db.rawQuery(
                "SELECT t.id, t.task_type, t.payload FROM node_tasks t " +
                "WHERE t.node_id=? AND t.status='queued' AND t.cancel_requested=0 " +
                "AND t.attempt_count < t.max_attempts " +
                "AND EXISTS (SELECT 1 FROM node_approvals a WHERE a.task_id=t.id AND a.status='approved') " +
                "ORDER BY t.priority DESC, t.id ASC LIMIT 1",
                new String[]{nodeId}
            );
            try {
                if (!cursor.moveToFirst()) return false;
                taskId = cursor.getLong(0);
                taskType = cursor.getString(1);
                payload = new JSONObject(cursor.getString(2));
            } finally {
                cursor.close();
            }

            ContentValues claim = new ContentValues();
            claim.put("status", "running");
            claim.put("updated_at", now());
            claim.put("started_at", now());
            claim.putNull("finished_at");
            int changed = db.update("node_tasks", claim,
                "id=? AND node_id=? AND status='queued' AND cancel_requested=0 AND attempt_count < max_attempts",
                new String[]{String.valueOf(taskId), nodeId});
            // ContentValues stores values, not SQL expressions. Increment atomically below if
            // the row was claimed by this transaction.
            if (changed != 1) return false;
            db.execSQL("UPDATE node_tasks SET attempt_count=attempt_count+1 WHERE id=?",
                new Object[]{taskId});
            insertEvent(db, "task_started", taskId, taskType);
            db.setTransactionSuccessful();
            claimed = true;
        } finally {
            db.endTransaction();
        }
        if (!claimed) return false;

        try {
            String result = execute(taskType, payload);
            db.beginTransaction();
            try {
                Cursor state = db.query("node_tasks", new String[]{"cancel_requested"},
                    "id=? AND node_id=? AND status='running'",
                    new String[]{String.valueOf(taskId), nodeId}, null, null, null, "1");
                boolean cancelRequested;
                try {
                    if (!state.moveToFirst()) return true;
                    cancelRequested = state.getInt(0) == 1;
                } finally {
                    state.close();
                }
                ContentValues completed = new ContentValues();
                completed.put("status", cancelRequested ? "cancelled" : "completed");
                completed.put("result", result);
                completed.put("updated_at", now());
                completed.put("finished_at", now());
                db.update("node_tasks", completed, "id=? AND node_id=? AND status='running'",
                    new String[]{String.valueOf(taskId), nodeId});
                insertEvent(db, cancelRequested ? "task_cancelled_after_execution" : "task_completed", taskId, taskType);
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
        } catch (Exception failure) {
            db.beginTransaction();
            try {
                ContentValues failed = new ContentValues();
                failed.put("status", "failed");
                failed.put("result", safeMessage(failure));
                failed.put("updated_at", now());
                failed.put("finished_at", now());
                db.update("node_tasks", failed, "id=? AND node_id=? AND status='running'",
                    new String[]{String.valueOf(taskId), nodeId});
                insertEvent(db, "task_failed", taskId, failure.getClass().getSimpleName());
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
        }
        return true;
    }

    private void insertEvent(SQLiteDatabase db, String name, long taskId, String detailsText) {
        ContentValues values = new ContentValues();
        values.put("node_id", nodeId);
        values.put("event", name);
        try {
            values.put("details", new JSONObject().put("taskId", taskId).put("details", detailsText).toString());
        } catch (Exception ignored) {
            values.put("details", "{}");
        }
        db.insertOrThrow("node_events", null, values);
    }

    private String execute(String taskType, JSONObject payload) throws Exception {
        switch (nodeId) {
            case "A":
                return runRooh("أنت روح، منسق SOULARAB TECH. حلل الطلب وأنتج خطة تنفيذ واضحة قابلة للمراجعة. لا تدّع تنفيذ أي خطوة خارج هذا النموذج.\n\n" + taskPrompt(payload));
            case "B":
                return runRooh("أنت محرك النص والذكاء الاصطناعي في SOULARAB TECH. أنجز المهمة النصية وأعد النتيجة فقط.\n\n" + taskPrompt(payload));
            case "C":
                return runComfyUi(payload);
            case "D":
                return runWhisper(payload);
            case "E":
                return runSafeWorkspaceAction(payload);
            default:
                throw new IOException("unknown_department_node");
        }
    }

    private String runRooh(String task) throws Exception {
        synchronized (ROOH_LOCK) {
            try {
                if (!RoohNative.isLoaded()) throw new IOException("محرك روح غير محمّل. نزّل نموذج Qwen وحمّله أولاً.");
                String prompt = "<|im_start|>system\\nأنت مساعد محلي ضمن SOULARAB TECH. لا تدّع تنفيذ أعمال خارجية أو ملفات لم تنفذها.\\n<|im_end|>\\n"
                    + "<|im_start|>user\\n" + task + "<|im_end|>\\n<|im_start|>assistant\\n";
                String answer = RoohNative.generate(prompt, 768);
                if (answer == null || answer.trim().isEmpty()) throw new IOException("native_model_empty_response");
                return answer.trim();
            } catch (Throwable unavailable) {
                throw new IOException("تعذر تحميل أو تشغيل محرك روح الأصلي: " + unavailable.getClass().getSimpleName(), unavailable);
            }
        }
    }

    private String runComfyUi(JSONObject payload) throws Exception {
        Object workflow = payload.opt("workflow");
        if (!(workflow instanceof JSONObject)) {
            throw new IOException("محرك الصور C يحتاج مخطط ComfyUI API ككائن داخل الحقل workflow.");
        }
        JSONObject graph = (JSONObject) workflow;
        java.util.Iterator<String> nodeIds = graph.keys();
        if (graph.length() == 0 || graph.length() > 80) throw new IOException("ComfyUI workflow node count is outside the safe limit.");
        while (nodeIds.hasNext()) {
            JSONObject node = graph.optJSONObject(nodeIds.next());
            String classType = node == null ? "" : node.optString("class_type", "");
            if (!LocalEnginePolicy.isAllowedComfyNode(classType)) throw new IOException("ComfyUI node is not in the built-in allowlist: " + classType);
        }
        String base = loopbackBase("comfyui_base_url", "http://127.0.0.1:8188");
        JSONObject request = new JSONObject();
        request.put("prompt", graph);
        String submitted = http(base + "/prompt", "POST", request.toString(), "application/json", 20000);
        JSONObject response = new JSONObject(submitted);
        String promptId = response.optString("prompt_id", "");
        if (promptId.isEmpty()) throw new IOException("ComfyUI لم يُرجع prompt_id.");
        long deadline = System.currentTimeMillis() + 180000L;
        while (System.currentTimeMillis() < deadline) {
            Thread.sleep(1500L);
            try {
                String history = http(base + "/history/" + promptId, "GET", null, null, 12000);
                JSONObject record = new JSONObject(history).optJSONObject(promptId);
                if (record != null && record.optJSONObject("outputs") != null) {
                    return new JSONObject().put("engine", "ComfyUI").put("prompt_id", promptId)
                        .put("status", "completed").put("outputs", record.optJSONObject("outputs")).toString();
                }
            } catch (IOException transientError) {
                // ComfyUI may not have published history until the workflow finishes.
            }
        }
        throw new IOException("انتهت مهلة انتظار ComfyUI؛ معرّف المهمة: " + promptId);
    }

    private String runWhisper(JSONObject payload) throws Exception {
        String encoded = payload.optString("audioBase64", "");
        if (encoded.isEmpty()) throw new IOException("محرك الصوت D يحتاج audioBase64 لملف صوتي.");
        byte[] audio;
        try { audio = Base64.decode(encoded, Base64.DEFAULT); }
        catch (IllegalArgumentException invalid) { throw new IOException("audioBase64_invalid"); }
        if (audio.length == 0 || audio.length > 25 * 1024 * 1024) throw new IOException("حجم الصوت يجب أن يكون بين 1 بايت و25 ميغابايت.");
        String filename = safeAudioName(payload.optString("filename", "audio.wav"));
        String base = loopbackBase("whisper_cpp_base_url", "http://127.0.0.1:8080");
        String boundary = "----SOULARAB" + UUID.randomUUID().toString().replace("-", "");
        HttpURLConnection connection = (HttpURLConnection) new URL(base + "/inference").openConnection();
        try {
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(180000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            try (OutputStream out = connection.getOutputStream()) {
                writePart(out, boundary, "file", filename, "application/octet-stream", audio);
                String language = payload.optString("language", "").trim();
                if (!language.isEmpty() && language.matches("[A-Za-z-]{2,12}")) {
                    writeField(out, boundary, "language", language);
                }
                out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            }
            String response = readResponse(connection);
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
                throw new IOException("whisper_cpp_http_" + connection.getResponseCode() + ": " + response);
            }
            return new JSONObject().put("engine", "whisper.cpp").put("status", "completed")
                .put("transcript", response).toString();
        } finally {
            connection.disconnect();
        }
    }

    private String runSafeWorkspaceAction(JSONObject payload) throws Exception {
        String action = payload.optString("action", "");
        if (!("write_note".equals(action) || "write_artifact".equals(action))) {
            throw new IOException("الخادم E يسمح حالياً بإجراء write_note أو write_artifact فقط؛ لا ينفذ shell أو أوامر نظام.");
        }
        String workspace = payload.optString("workspaceId", "default").trim();
        String filename = payload.optString("filename", "").trim();
        String content = payload.optString("content", "");
        if (!LocalEnginePolicy.isSafeWorkspaceId(workspace)) throw new IOException("workspace_id_invalid");
        if (!LocalEnginePolicy.isSafeWorkspaceFilename(filename)) {
            throw new IOException("اسم الملف أو امتداده غير مسموح.");
        }
        if (content.isEmpty() || content.length() > 500000) throw new IOException("محتوى الملف فارغ أو يتجاوز 500KB.");
        File root = new File(context.getFilesDir(), "soularab-workspaces");
        if (!root.exists() && !root.mkdirs()) throw new IOException("workspace_root_create_failed");
        File directory = new File(root, workspace);
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("workspace_create_failed");
        String canonicalWorkspaces = root.getCanonicalPath() + File.separator;
        String canonicalDirectory = directory.getCanonicalPath();
        if (!canonicalDirectory.startsWith(canonicalWorkspaces)) throw new IOException("workspace_directory_escape_blocked");
        File target = new File(directory, filename);
        String canonicalRoot = canonicalDirectory + File.separator;
        if (!target.getCanonicalPath().startsWith(canonicalRoot)) throw new IOException("workspace_path_escape_blocked");
        if (target.exists()) throw new IOException("الملف موجود مسبقاً؛ لن يتم استبداله أو حذفه.");
        try (FileOutputStream output = new FileOutputStream(target, false)) {
            output.write(content.getBytes(StandardCharsets.UTF_8));
            output.getFD().sync();
        }
        return new JSONObject().put("action", action).put("status", "created")
            .put("workspaceId", workspace).put("filename", filename)
            .put("bytes", target.length()).put("path", "app-private/soularab-workspaces/" + workspace + "/" + filename).toString();
    }

    private String loopbackBase(String preference, String fallback) throws Exception {
        SharedPreferences prefs = context.getSharedPreferences("soularab_local_engines", Context.MODE_PRIVATE);
        String value = prefs.getString(preference, fallback).trim();
        URL url = new URL(value);
        String host = url.getHost().toLowerCase(Locale.ROOT);
        if (!"http".equals(url.getProtocol()) ||
            !("127.0.0.1".equals(host) || "localhost".equals(host) || "::1".equals(host))) {
            throw new IOException("عنوان المحرك يجب أن يكون HTTP على loopback فقط.");
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String http(String address, String method, String body, String contentType, int timeout) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        try {
            connection.setRequestMethod(method);
            connection.setConnectTimeout(timeout);
            connection.setReadTimeout(timeout);
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", contentType);
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(body.getBytes(StandardCharsets.UTF_8));
                }
            }
            String response = readResponse(connection);
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IOException("local_engine_http_" + status + ": " + response);
            return response;
        } finally {
            connection.disconnect();
        }
    }

    private String readResponse(HttpURLConnection connection) throws IOException {
        int status = connection.getResponseCode();
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) return "";
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_RESPONSE_BYTES) throw new IOException("local_engine_response_too_large");
                output.write(buffer, 0, count);
            }
            return output.toString("UTF-8");
        }
    }

    private void writePart(OutputStream out, String boundary, String field, String filename, String type, byte[] bytes) throws IOException {
        String header = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + field + "\"; filename=\"" + filename + "\"\r\nContent-Type: " + type + "\r\n\r\n";
        out.write(header.getBytes(StandardCharsets.UTF_8));
        out.write(bytes);
        out.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private void writeField(OutputStream out, String boundary, String name, String value) throws IOException {
        out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + value + "\r\n").getBytes(StandardCharsets.UTF_8));
    }

    private String safeAudioName(String raw) throws IOException {
        String name = raw.replaceAll("[^A-Za-z0-9_.-]", "_");
        if (name.isEmpty() || name.length() > 100) throw new IOException("audio_filename_invalid");
        return name;
    }

    private String taskPrompt(JSONObject payload) {
        String description = payload.optString("description", "").trim();
        if (description.isEmpty()) description = payload.optString("details", "").trim();
        if (description.isEmpty()) description = payload.optString("title", "أنجز المهمة").trim();
        return description;
    }

    private void event(String name, long taskId, String details) {
        try {
            ContentValues values = new ContentValues();
            values.put("node_id", nodeId);
            values.put("event", name);
            values.put("details", new JSONObject().put("taskId", taskId).put("details", details).toString());
            helper.getWritableDatabase().insert("node_events", null, values);
        } catch (Exception ignored) {}
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) message = error.getClass().getSimpleName();
        if (message.length() > 1200) message = message.substring(0, 1200);
        return message;
    }

    private String now() {
        return new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            .format(new java.util.Date());
    }
}

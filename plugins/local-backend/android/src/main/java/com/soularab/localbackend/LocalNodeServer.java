package com.soularab.localbackend;

import android.content.Context;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import fi.iki.elonen.NanoHTTPD;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

final class LocalNodeServer extends NanoHTTPD {
    final String nodeId;
    final String title;
    private final LocalBackendDatabase helper;
    private final Context context;
    private final String accessToken;
    private final AtomicBoolean workerActive = new AtomicBoolean(false);
    private Thread workerThread;

    LocalNodeServer(String nodeId, String title, int port, LocalBackendDatabase helper, String accessToken, Context context) {
        super("127.0.0.1", port);
        this.nodeId = nodeId;
        this.title = title;
        this.helper = helper;
        this.accessToken = accessToken;
        this.context = context.getApplicationContext();
    }

    void startWorker() {
        if (!workerActive.compareAndSet(false, true)) return;
        workerThread = new Thread(() -> {
            while (workerActive.get()) {
                try {
                    new LocalDepartmentEngine(context, helper, nodeId).processOne();
                    Thread.sleep(1200);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception ignored) {
                    try { Thread.sleep(2500); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); break; }
                }
            }
        }, "soularab-node-" + nodeId + "-worker");
        workerThread.setDaemon(true);
        workerThread.start();
    }

    void stopWorker() {
        workerActive.set(false);
        if (workerThread != null) workerThread.interrupt();
        workerThread = null;
    }

    @Override
    public Response serve(IHTTPSession session) {
        String origin = session.getHeaders().get("origin");
        Response response;
        try {
            if (Method.OPTIONS.equals(session.getMethod())) {
                response = newFixedLengthResponse(Response.Status.NO_CONTENT, MIME_PLAINTEXT, "");
            } else if (!isAllowedOrigin(origin)) {
                response = json(Response.Status.FORBIDDEN, error("origin_not_allowed"));
            } else if (!accessToken.equals(session.getHeaders().get("x-local-token"))) {
                response = json(Response.Status.UNAUTHORIZED, error("unauthorized"));
            } else {
                response = route(session);
            }
        } catch (Exception error) {
            response = json(Response.Status.INTERNAL_ERROR, error("internal_error"));
        }
        response.addHeader("Access-Control-Allow-Origin", allowedOrigin(origin));
        response.addHeader("Vary", "Origin");
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response.addHeader("Access-Control-Allow-Headers", "Content-Type, X-Local-Token");
        response.addHeader("Cache-Control", "no-store");
        response.addHeader("X-Content-Type-Options", "nosniff");
        return response;
    }

    private Response route(IHTTPSession session) throws Exception {
        String path = session.getUri();
        if ("/health".equals(path) && Method.GET.equals(session.getMethod())) {
            JSONObject result = new JSONObject();
            result.put("status", isAlive() ? "online" : "offline");
            result.put("node", nodeId);
            result.put("title", title);
            result.put("port", getListeningPort());
            result.put("backend", "embedded-android");
            result.put("worker", workerActive.get() ? "running" : "stopped");
            String execution = "A".equals(nodeId) ? "native_rooh_orchestration"
                : "B".equals(nodeId) ? "native_llama_cpp_text"
                : "C".equals(nodeId) ? "comfyui_loopback_workflows"
                : "D".equals(nodeId) ? "whisper_cpp_loopback_transcription"
                : "E".equals(nodeId) ? "allowlisted_app_private_files" : "unavailable";
            result.put("taskExecution", execution);
            result.put("roohEngineLoaded", "B".equals(nodeId) || "A".equals(nodeId) ? safeRoohLoaded() : false);
            return json(Response.Status.OK, result);
        }
        if (("A".equals(nodeId) || "B".equals(nodeId)) && "/models".equals(path) && Method.GET.equals(session.getMethod())) {
            return listRoohModels();
        }
        if (("A".equals(nodeId) || "B".equals(nodeId)) && "/chat".equals(path) && Method.POST.equals(session.getMethod())) {
            return chatWithRooh(readBody(session));
        }
        if ("/metrics".equals(path) && Method.GET.equals(session.getMethod())) {
            SQLiteDatabase db = helper.getReadableDatabase();
            Cursor cursor = db.rawQuery("SELECT status, COUNT(*) FROM node_tasks WHERE node_id=? GROUP BY status", new String[]{nodeId});
            JSONObject counts = new JSONObject();
            try {
                while (cursor.moveToNext()) counts.put(cursor.getString(0), cursor.getInt(1));
            } finally { cursor.close(); }
            JSONObject result = new JSONObject();
            result.put("node", nodeId);
            result.put("tasks", counts);
            return json(Response.Status.OK, result);
        }
        if ("/nodes".equals(path) && "E".equals(nodeId) && Method.GET.equals(session.getMethod())) {
            JSONArray nodes = new JSONArray();
            String[] ids = {"A", "B", "C", "D", "E"};
            String[] names = {"ROOH Orchestrator", "AI & Text", "Image & Design", "Audio & Video", "Development & Recovery"};
            int[] ports = {3101, 3102, 3103, 3104, 3105};
            for (int i = 0; i < ids.length; i++) {
                JSONObject item = new JSONObject();
                item.put("id", ids[i]); item.put("name", names[i]); item.put("port", ports[i]);
                item.put("independent", true);
                nodes.put(item);
            }
            return json(Response.Status.OK, nodes);
        }
        if ("E".equals(nodeId) && "/approvals".equals(path) && Method.GET.equals(session.getMethod())) {
            return listApprovals();
        }
        if ("E".equals(nodeId) && "/approvals".equals(path) && Method.POST.equals(session.getMethod())) {
            return createApproval(readBody(session));
        }
        if ("E".equals(nodeId) && "/agent-plans".equals(path) && Method.POST.equals(session.getMethod())) {
            return createAgentPlan(readBody(session));
        }
        if ("E".equals(nodeId) && path.startsWith("/approvals/") && Method.POST.equals(session.getMethod())) {
            return decideApproval(path, readBody(session));
        }
        if ("E".equals(nodeId) && "/events".equals(path) && Method.GET.equals(session.getMethod())) {
            return listEvents();
        }
        if ("/dispatch".equals(path) && "E".equals(nodeId) && Method.POST.equals(session.getMethod())) {
            JSONObject body = readBody(session);
            JSONObject payload = body.optJSONObject("payload") == null ? new JSONObject() : body.optJSONObject("payload");
            if (!payload.has("department")) payload.put("department", body.optString("taskType", "agents"));
            return createAgentPlan(payload);
        }
        if ("/tasks".equals(path) && Method.POST.equals(session.getMethod())) {
            return json(Response.Status.FORBIDDEN, error("task_creation_requires_approval_via_orchestrator"));
        }
        if ("/tasks".equals(path) && Method.GET.equals(session.getMethod())) {
            return json(Response.Status.OK, listTasks());
        }
        if (path.startsWith("/tasks/") && Method.POST.equals(session.getMethod())) {
            String[] parts = path.split("/");
            if (parts.length != 4) return json(Response.Status.NOT_FOUND, error("task_action_not_found"));
            String action = parts[3];
            long taskId;
            try { taskId = Long.parseLong(parts[2]); }
            catch (NumberFormatException ex) { return json(Response.Status.BAD_REQUEST, error("invalid_task_id")); }
            SQLiteDatabase db = helper.getWritableDatabase();
            Cursor current = "E".equals(nodeId)
                ? db.query("node_tasks", new String[]{"status"}, "id=?", new String[]{String.valueOf(taskId)}, null, null, null, "1")
                : db.query("node_tasks", new String[]{"status"}, "id=? AND node_id=?", new String[]{String.valueOf(taskId), nodeId}, null, null, null, "1");
            String currentStatus;
            try {
                if (!current.moveToFirst()) return json(Response.Status.NOT_FOUND, error("task_not_found"));
                currentStatus = current.getString(0);
            } finally { current.close(); }
            ContentValues values = new ContentValues();
            if ("pause".equals(action)) {
                if (!"queued".equals(currentStatus)) return json(Response.Status.CONFLICT, error("only_queued_tasks_can_be_paused_without_a_running_worker"));
                values.put("status", "paused");
            } else if ("resume".equals(action)) {
                if (!"paused".equals(currentStatus)) return json(Response.Status.CONFLICT, error("task_is_not_paused"));
                values.put("status", "queued");
            } else if ("cancel".equals(action)) {
                if (!("queued".equals(currentStatus) || "paused".equals(currentStatus))) return json(Response.Status.CONFLICT, error("running_task_cannot_be_cancelled_without_worker_support"));
                values.put("status", "cancelled");
            } else if ("priority".equals(action)) {
                JSONObject body = readBody(session);
                int priority = body.optInt("priority", 0);
                if (priority < 0 || priority > 10) return json(Response.Status.BAD_REQUEST, error("priority_must_be_between_0_and_10"));
                values.put("priority", priority);
            } else {
                return json(Response.Status.NOT_FOUND, error("task_action_not_found"));
            }
            values.put("updated_at", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(new java.util.Date()));
            int changed = "E".equals(nodeId)
                ? db.update("node_tasks", values, "id=?", new String[]{String.valueOf(taskId)})
                : db.update("node_tasks", values, "id=? AND node_id=?", new String[]{String.valueOf(taskId), nodeId});
            if (changed != 1) return json(Response.Status.CONFLICT, error("task_state_changed"));
            return getTask(String.valueOf(taskId));
        }
        if (path.startsWith("/tasks/") && Method.GET.equals(session.getMethod())) {
            String id = path.substring("/tasks/".length());
            return getTask(id);
        }
        if ("/sections".equals(path) && Method.GET.equals(session.getMethod())) {
            return json(Response.Status.OK, listSections());
        }
        if (path.startsWith("/sections/") && Method.GET.equals(session.getMethod())) {
            String sectionId = path.substring("/sections/".length());
            Cursor cursor = helper.getReadableDatabase().query("local_sections", null, "id=?", new String[]{sectionId}, null, null, null, "1");
            try {
                if (!cursor.moveToFirst()) return json(Response.Status.NOT_FOUND, error("section_not_found"));
                JSONObject item = new JSONObject();
                item.put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")));
                item.put("sectionName", cursor.getString(cursor.getColumnIndexOrThrow("section_name")));
                item.put("content", new JSONObject(cursor.getString(cursor.getColumnIndexOrThrow("content"))).opt("value"));
                item.put("updatedAt", cursor.getString(cursor.getColumnIndexOrThrow("updated_at")));
                return json(Response.Status.OK, item);
            } finally { cursor.close(); }
        }
        if ("/sections".equals(path) && Method.POST.equals(session.getMethod())) {
            JSONObject body = readBody(session);
            String id = body.optString("id", "").trim();
            String name = body.optString("sectionName", "").trim();
            Object content = body.opt("content");
            if (id.isEmpty() || name.isEmpty() || content == null || JSONObject.NULL.equals(content)) {
                return json(Response.Status.BAD_REQUEST, error("id_sectionName_content_required"));
            }
            ContentValues values = new ContentValues();
            values.put("id", id); values.put("section_name", name); values.put("content", new JSONObject().put("value", content).toString());
            helper.getWritableDatabase().insertWithOnConflict("local_sections", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            JSONObject result = new JSONObject(); result.put("status", "saved"); result.put("id", id);
            return json(Response.Status.OK, result);
        }
        return json(Response.Status.NOT_FOUND, error("route_not_found"));
    }

    private boolean safeRoohLoaded() {
        try { return RoohNative.isLoaded(); } catch (Throwable ignored) { return false; }
    }

    private Response listRoohModels() {
        try {
            boolean loaded = RoohNative.isLoaded();
            JSONArray items = new JSONArray();
            if (loaded) items.put(new JSONObject().put("name", "qwen2.5-3b-instruct-q4_k_m"));
            JSONObject result = new JSONObject();
            result.put("connected", loaded);
            result.put("provider", "llama.cpp-native-android");
            result.put("engine", "on-device");
            result.put("items", items);
            return json(Response.Status.OK, result);
        } catch (Throwable error) {
            return json(Response.Status.OK, error("rooh_native_engine_unavailable"));
        }
    }

    private Response chatWithRooh(JSONObject request) {
        String model = request.optString("model", "qwen2.5-3b-instruct-q4_k_m").trim();
        JSONArray incoming = request.optJSONArray("messages");
        if (incoming == null || incoming.length() < 1 || incoming.length() > 30) return json(Response.Status.BAD_REQUEST, error("model_and_messages_required"));
        try {
            if (!RoohNative.isLoaded()) return json(Response.Status.SERVICE_UNAVAILABLE, error("rooh_native_engine_not_loaded_download_and_load_model"));
            StringBuilder prompt = new StringBuilder();
            prompt.append("<|im_start|>system\nأنت روح AI، المساعدة الذكية الرسمية لمنصة SOULARAB TECH. تحدث بالعربية افتراضياً وبأسلوب واضح وودود. لا تدّعي تنفيذ إجراء قبل تأكيد نجاحه، ولا تنفذ تغييرات أو إجراءات خارجية دون موافقة صريحة.\n<|im_end|>\n");
            for (int i = 0; i < incoming.length(); i++) {
                JSONObject item = incoming.optJSONObject(i);
                if (item == null) return json(Response.Status.BAD_REQUEST, error("invalid_chat_message"));
                String role = item.optString("role", "");
                String content = item.optString("content", "");
                if (!("user".equals(role) || "assistant".equals(role)) || content.trim().isEmpty() || content.length() > 12000)
                    return json(Response.Status.BAD_REQUEST, error("invalid_chat_message"));
                prompt.append("<|im_start|>").append(role).append("\n").append(content).append("<|im_end|>\n");
            }
            prompt.append("<|im_start|>assistant\n");
            String answer = RoohNative.generate(prompt.toString(), Math.max(64, Math.min(1024, request.optInt("max_tokens", 512))));
            if (answer == null || answer.trim().isEmpty()) return json(Response.Status.INTERNAL_ERROR, error("rooh_native_engine_empty_response"));
            JSONObject message = new JSONObject().put("role", "assistant").put("content", answer.trim());
            JSONObject result = new JSONObject();
            result.put("provider", "llama.cpp-native-android");
            result.put("model", model);
            result.put("message", message);
            result.put("done", true);
            result.put("offline", true);
            return json(Response.Status.OK, result);
        } catch (Throwable exception) {
            return json(Response.Status.INTERNAL_ERROR, error("rooh_native_inference_failed_" + exception.getClass().getSimpleName()));
        }
    }

    private long insertTask(String target, String type, JSONObject payload) {
        return insertTask(target, type, payload, "queued");
    }

    private long insertTask(String target, String type, JSONObject payload, String status) {
        ContentValues values = new ContentValues();
        values.put("node_id", target);
        values.put("task_type", type);
        values.put("payload", payload.toString());
        values.put("status", status);
        return helper.getWritableDatabase().insertOrThrow("node_tasks", null, values);
    }

    private Response createApproval(JSONObject body) throws Exception {
        String title = body.optString("title", "").trim();
        String description = body.optString("description", "").trim();
        String risk = body.optString("risk", "medium").trim().toLowerCase();
        if (title.length() < 3 || title.length() > 240 || description.length() > 12000 ||
            !("low".equals(risk) || "medium".equals(risk) || "high".equals(risk))) {
            return json(Response.Status.BAD_REQUEST, error("invalid_approval_request"));
        }
        ContentValues values = new ContentValues();
        values.putNull("task_id");
        values.put("title", title);
        values.put("description", description);
        values.put("risk", risk);
        long id = helper.getWritableDatabase().insertOrThrow("node_approvals", null, values);
        JSONObject result = new JSONObject();
        result.put("id", id);
        result.put("status", "pending");
        result.put("task_id", JSONObject.NULL);
        return json(Response.Status.CREATED, result);
    }

    private Response createAgentPlan(JSONObject body) throws Exception {
        String title = body.optString("title", "").trim();
        String description = body.optString("description", "").trim();
        String risk = body.optString("risk", "medium").trim().toLowerCase();
        String department = body.optString("department", "agents").trim().toLowerCase();
        if (title.length() < 3 || title.length() > 240 || description.isEmpty() || description.length() > 12000 ||
            !("low".equals(risk) || "medium".equals(risk) || "high".equals(risk))) {
            return json(Response.Status.BAD_REQUEST, error("invalid_agent_plan"));
        }
        String taskType = "system".equals(department) ? "agents" : department;
        String target = targetFor(taskType);
        SQLiteDatabase db = helper.getWritableDatabase();
        long taskId;
        long approvalId;
        db.beginTransaction();
        try {
            taskId = insertTask(target, taskType, body, "waiting_approval");
            ContentValues approval = new ContentValues();
            approval.put("task_id", taskId);
            approval.put("title", title);
            approval.put("description", description);
            approval.put("risk", risk);
            approvalId = db.insertOrThrow("node_approvals", null, approval);
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        JSONObject result = new JSONObject();
        result.put("id", taskId);
        result.put("task_id", taskId);
        result.put("approval_id", approvalId);
        result.put("status", "waiting_approval");
        result.put("assignedNode", target);
        return json(Response.Status.CREATED, result);
    }

    private Response listApprovals() throws JSONException {
        JSONArray result = new JSONArray();
        Cursor cursor = helper.getReadableDatabase().rawQuery(
            "SELECT a.id, a.task_id, a.title, a.description, a.risk, a.status, a.created_at, a.decided_at, a.decision_note, t.status AS task_status " +
            "FROM node_approvals a LEFT JOIN node_tasks t ON t.id=a.task_id ORDER BY a.id DESC LIMIT 200",
            null
        );
        try {
            while (cursor.moveToNext()) {
                JSONObject item = new JSONObject();
                item.put("id", cursor.getLong(0));
                item.put("task_id", cursor.isNull(1) ? JSONObject.NULL : cursor.getLong(1));
                item.put("taskId", cursor.isNull(1) ? JSONObject.NULL : cursor.getLong(1));
                item.put("title", cursor.getString(2));
                item.put("description", cursor.getString(3));
                item.put("risk", cursor.getString(4));
                item.put("status", cursor.getString(5));
                item.put("created_at", cursor.getString(6));
                item.put("decided_at", cursor.isNull(7) ? JSONObject.NULL : cursor.getString(7));
                item.put("decision_note", cursor.getString(8));
                item.put("task_status", cursor.isNull(9) ? JSONObject.NULL : cursor.getString(9));
                result.put(item);
            }
        } finally {
            cursor.close();
        }
        return json(Response.Status.OK, result);
    }

    private Response decideApproval(String path, JSONObject body) throws Exception {
        String[] parts = path.split("/");
        if (parts.length != 4 || !"decision".equals(parts[3])) return json(Response.Status.NOT_FOUND, error("approval_action_not_found"));
        long approvalId;
        try { approvalId = Long.parseLong(parts[2]); }
        catch (NumberFormatException exception) { return json(Response.Status.BAD_REQUEST, error("invalid_approval_id")); }
        String decision = body.optString("decision", "").trim().toLowerCase();
        if (!("approved".equals(decision) || "rejected".equals(decision))) {
            return json(Response.Status.BAD_REQUEST, error("decision_must_be_approved_or_rejected"));
        }
        SQLiteDatabase db = helper.getWritableDatabase();
        long taskId = -1;
        String currentStatus;
        Cursor cursor = db.query("node_approvals", new String[]{"task_id", "status"}, "id=?", new String[]{String.valueOf(approvalId)}, null, null, null, "1");
        try {
            if (!cursor.moveToFirst()) return json(Response.Status.NOT_FOUND, error("approval_not_found"));
            taskId = cursor.isNull(0) ? -1 : cursor.getLong(0);
            currentStatus = cursor.getString(1);
        } finally {
            cursor.close();
        }
        if (!"pending".equals(currentStatus)) return json(Response.Status.CONFLICT, error("approval_already_decided"));
        db.beginTransaction();
        try {
            ContentValues approval = new ContentValues();
            approval.put("status", decision);
            approval.put("decided_at", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(new java.util.Date()));
            approval.put("decision_note", body.optString("note", ""));
            int changed = db.update("node_approvals", approval, "id=? AND status='pending'", new String[]{String.valueOf(approvalId)});
            if (changed != 1) return json(Response.Status.CONFLICT, error("approval_already_decided"));
            if (taskId >= 0) {
                ContentValues task = new ContentValues();
                task.put("status", "approved".equals(decision) ? "queued" : "cancelled");
                task.put("updated_at", new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(new java.util.Date()));
                db.update("node_tasks", task, "id=? AND status='waiting_approval'", new String[]{String.valueOf(taskId)});
            }
            ContentValues event = new ContentValues();
            event.put("node_id", "E");
            event.put("event", "approval_" + decision);
            JSONObject details = new JSONObject();
            details.put("approvalId", approvalId);
            if (taskId >= 0) details.put("taskId", taskId);
            event.put("details", details.toString());
            db.insert("node_events", null, event);
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
        JSONObject result = new JSONObject();
        result.put("approval_id", approvalId);
        result.put("task_id", taskId >= 0 ? taskId : JSONObject.NULL);
        result.put("decision", decision);
        result.put("status", decision);
        return json(Response.Status.OK, result);
    }

    private Response listEvents() throws JSONException {
        JSONArray result = new JSONArray();
        Cursor cursor = helper.getReadableDatabase().query("node_events", null, null, null, null, null, "id DESC", "100");
        try {
            while (cursor.moveToNext()) {
                JSONObject item = new JSONObject();
                item.put("id", cursor.getLong(cursor.getColumnIndexOrThrow("id")));
                item.put("node", cursor.getString(cursor.getColumnIndexOrThrow("node_id")));
                String eventName = cursor.getString(cursor.getColumnIndexOrThrow("event"));
                item.put("event", eventName);
                item.put("action", eventName);
                item.put("details", cursor.getString(cursor.getColumnIndexOrThrow("details")));
                item.put("created_at", cursor.getString(cursor.getColumnIndexOrThrow("created_at")));
                result.put(item);
            }
        } finally {
            cursor.close();
        }
        return json(Response.Status.OK, result);
    }

    private JSONArray listTasks() throws JSONException {
        JSONArray result = new JSONArray();
        Cursor cursor = "E".equals(nodeId)
            ? helper.getReadableDatabase().query("node_tasks", null, null, null, null, null, "priority DESC, id DESC", "200")
            : helper.getReadableDatabase().query("node_tasks", null, "node_id=?", new String[]{nodeId}, null, null, "priority DESC, id DESC", "100");
        try {
            while (cursor.moveToNext()) result.put(taskFromCursor(cursor));
        } finally { cursor.close(); }
        return result;
    }

    private Response getTask(String rawId) throws JSONException {
        long id;
        try { id = Long.parseLong(rawId); } catch (NumberFormatException ex) { return json(Response.Status.BAD_REQUEST, error("invalid_task_id")); }
        Cursor cursor = "E".equals(nodeId)
            ? helper.getReadableDatabase().query("node_tasks", null, "id=?", new String[]{String.valueOf(id)}, null, null, null, "1")
            : helper.getReadableDatabase().query("node_tasks", null, "id=? AND node_id=?", new String[]{String.valueOf(id), nodeId}, null, null, null, "1");
        try {
            if (!cursor.moveToFirst()) return json(Response.Status.NOT_FOUND, error("task_not_found"));
            return json(Response.Status.OK, taskFromCursor(cursor));
        } finally { cursor.close(); }
    }

    private JSONObject taskFromCursor(Cursor cursor) throws JSONException {
        JSONObject item = new JSONObject();
        item.put("id", cursor.getLong(cursor.getColumnIndexOrThrow("id")));
        item.put("node", cursor.getString(cursor.getColumnIndexOrThrow("node_id")));
        String taskType = cursor.getString(cursor.getColumnIndexOrThrow("task_type"));
        JSONObject payload = new JSONObject(cursor.getString(cursor.getColumnIndexOrThrow("payload")));
        item.put("taskType", taskType);
        item.put("payload", payload);
        item.put("title", payload.optString("title", taskType));
        item.put("description", payload.optString("description", ""));
        item.put("department", payload.optString("department", nodeId));
        item.put("priority", cursor.getInt(cursor.getColumnIndexOrThrow("priority")));
        item.put("result", cursor.getString(cursor.getColumnIndexOrThrow("result")));
        item.put("status", cursor.getString(cursor.getColumnIndexOrThrow("status")));
        String createdAt = cursor.getString(cursor.getColumnIndexOrThrow("created_at"));
        String updatedAt = cursor.getString(cursor.getColumnIndexOrThrow("updated_at"));
        item.put("createdAt", createdAt); item.put("created_at", createdAt);
        item.put("updatedAt", updatedAt); item.put("updated_at", updatedAt);
        return item;
    }

    private JSONArray listSections() throws JSONException {
        JSONArray result = new JSONArray();
        Cursor cursor = helper.getReadableDatabase().query("local_sections", null, null, null, null, null, "updated_at DESC");
        try {
            while (cursor.moveToNext()) {
                JSONObject item = new JSONObject();
                item.put("id", cursor.getString(cursor.getColumnIndexOrThrow("id")));
                item.put("sectionName", cursor.getString(cursor.getColumnIndexOrThrow("section_name")));
                item.put("content", new JSONObject(cursor.getString(cursor.getColumnIndexOrThrow("content"))).opt("value"));
                item.put("updatedAt", cursor.getString(cursor.getColumnIndexOrThrow("updated_at")));
                result.put(item);
            }
        } finally { cursor.close(); }
        return result;
    }

    private JSONObject readBody(IHTTPSession session) throws Exception {
        Map<String, String> files = new HashMap<>();
        session.parseBody(files);
        String body = files.get("postData");
        if (body == null || body.trim().isEmpty()) return new JSONObject();
        if (body.length() > 36 * 1024 * 1024) throw new IOException("Request body too large (36 MB limit)");
        return new JSONObject(body);
    }

    private String targetFor(String type) {
        String normalized = type == null ? "" : type.trim().toLowerCase();
        // Explicit department routing: every visible workspace section has a
        // deterministic owner node; keyword matching is only a fallback.
        switch (normalized) {
            case "overview": case "rooh": case "orchestrator": return "A";
            case "assistant": case "agents": case "ai": case "text": case "system": return "B";
            case "design": case "media": case "graphics": case "image": return "C";
            case "video": case "audio": case "speech": return "D";
            case "hub": case "github": case "git": case "root": case "jathr":
            case "terminal": case "web": case "store": case "apps": case "documents":
            case "files": case "automation": case "domains": case "security":
            case "development": case "recovery": return "E";
            default: break;
        }
        if (normalized.contains("orchestr") || normalized.contains("root") || normalized.contains("hub")) return "A";
        if (normalized.contains("text") || normalized.contains("chat") || normalized.contains("language") || normalized.contains("agent")) return "B";
        if (normalized.contains("image") || normalized.contains("design") || normalized.contains("logo") || normalized.contains("graphic")) return "C";
        if (normalized.contains("audio") || normalized.contains("video") || normalized.contains("speech") || normalized.contains("transcrib")) return "D";
        if (normalized.contains("code") || normalized.contains("app") || normalized.contains("web") || normalized.contains("build") ||
            normalized.contains("store") || normalized.contains("document") || normalized.contains("automation") ||
            normalized.contains("backup") || normalized.contains("recovery") || normalized.contains("system") ||
            normalized.contains("file") || normalized.contains("domain") || normalized.contains("security") ||
            normalized.contains("terminal")) return "E";
        return "A";
    }

    private boolean isAllowedOrigin(String origin) {
        return origin == null || origin.isEmpty() || "https://localhost".equals(origin) ||
            "capacitor://localhost".equals(origin) || "http://localhost".equals(origin);
    }

    private String allowedOrigin(String origin) {
        return isAllowedOrigin(origin) && origin != null && !origin.isEmpty() ? origin : "https://localhost";
    }

    private JSONObject error(String message) {
        JSONObject result = new JSONObject();
        try { result.put("status", "error"); result.put("message", message); }
        catch (JSONException ignored) {}
        return result;
    }

    private Response json(Response.IStatus status, Object value) {
        return newFixedLengthResponse(status, "application/json; charset=utf-8", value.toString());
    }
}

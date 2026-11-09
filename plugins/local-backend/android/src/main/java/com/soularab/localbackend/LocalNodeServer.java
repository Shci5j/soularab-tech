package com.soularab.localbackend;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.nanohttpd.protocols.http.NanoHTTPD;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

final class LocalNodeServer extends NanoHTTPD {
    final String nodeId;
    final String title;
    private final LocalBackendDatabase helper;
    private final String accessToken;

    LocalNodeServer(String nodeId, String title, int port, LocalBackendDatabase helper, String accessToken) {
        super("127.0.0.1", port);
        this.nodeId = nodeId;
        this.title = title;
        this.helper = helper;
        this.accessToken = accessToken;
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

    private Response route(IHTTPSession session) throws IOException, JSONException {
        String path = session.getUri();
        if ("/health".equals(path) && Method.GET.equals(session.getMethod())) {
            JSONObject result = new JSONObject();
            result.put("status", isAlive() ? "online" : "offline");
            result.put("node", nodeId);
            result.put("title", title);
            result.put("port", getListeningPort());
            result.put("backend", "embedded-android");
            return json(Response.Status.OK, result);
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
            String[] names = {"AI & Text", "Image & Design", "Audio & Video", "Development", "Recovery & Scheduler"};
            int[] ports = {3101, 3102, 3103, 3104, 3105};
            for (int i = 0; i < ids.length; i++) {
                JSONObject item = new JSONObject();
                item.put("id", ids[i]); item.put("name", names[i]); item.put("port", ports[i]);
                item.put("independent", true);
                nodes.put(item);
            }
            return json(Response.Status.OK, nodes);
        }
        if ("/dispatch".equals(path) && "E".equals(nodeId) && Method.POST.equals(session.getMethod())) {
            JSONObject body = readBody(session);
            String type = body.optString("taskType", "general").toLowerCase();
            String target = targetFor(type);
            long taskId = insertTask(target, type, body.optJSONObject("payload") == null ? new JSONObject() : body.optJSONObject("payload"));
            JSONObject result = new JSONObject();
            result.put("status", "queued"); result.put("taskId", taskId); result.put("assignedNode", target);
            return json(Response.Status.CREATED, result);
        }
        if ("/tasks".equals(path) && Method.POST.equals(session.getMethod())) {
            JSONObject body = readBody(session);
            String type = body.optString("taskType", "general");
            JSONObject payload = body.optJSONObject("payload");
            long id = insertTask(nodeId, type, payload == null ? new JSONObject() : payload);
            JSONObject result = new JSONObject();
            result.put("id", id); result.put("node", nodeId); result.put("status", "queued");
            return json(Response.Status.CREATED, result);
        }
        if ("/tasks".equals(path) && Method.GET.equals(session.getMethod())) {
            return json(Response.Status.OK, listTasks());
        }
        if (path.startsWith("/tasks/") && Method.GET.equals(session.getMethod())) {
            String id = path.substring("/tasks/".length());
            return getTask(id);
        }
        if ("/sections".equals(path) && Method.GET.equals(session.getMethod())) {
            return json(Response.Status.OK, listSections());
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
            values.put("id", id); values.put("section_name", name); values.put("content", String.valueOf(content));
            helper.getWritableDatabase().insertWithOnConflict("local_sections", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            JSONObject result = new JSONObject(); result.put("status", "saved"); result.put("id", id);
            return json(Response.Status.OK, result);
        }
        return json(Response.Status.NOT_FOUND, error("route_not_found"));
    }

    private long insertTask(String target, String type, JSONObject payload) {
        ContentValues values = new ContentValues();
        values.put("node_id", target); values.put("task_type", type); values.put("payload", payload.toString());
        return helper.getWritableDatabase().insertOrThrow("node_tasks", null, values);
    }

    private JSONArray listTasks() throws JSONException {
        JSONArray result = new JSONArray();
        Cursor cursor = helper.getReadableDatabase().query("node_tasks", null, "node_id=?", new String[]{nodeId}, null, null, "id DESC", "100");
        try {
            while (cursor.moveToNext()) result.put(taskFromCursor(cursor));
        } finally { cursor.close(); }
        return result;
    }

    private Response getTask(String rawId) throws JSONException {
        long id;
        try { id = Long.parseLong(rawId); } catch (NumberFormatException ex) { return json(Response.Status.BAD_REQUEST, error("invalid_task_id")); }
        Cursor cursor = helper.getReadableDatabase().query("node_tasks", null, "id=? AND node_id=?", new String[]{String.valueOf(id), nodeId}, null, null, null, "1");
        try {
            if (!cursor.moveToFirst()) return json(Response.Status.NOT_FOUND, error("task_not_found"));
            return json(Response.Status.OK, taskFromCursor(cursor));
        } finally { cursor.close(); }
    }

    private JSONObject taskFromCursor(Cursor cursor) throws JSONException {
        JSONObject item = new JSONObject();
        item.put("id", cursor.getLong(cursor.getColumnIndexOrThrow("id")));
        item.put("node", cursor.getString(cursor.getColumnIndexOrThrow("node_id")));
        item.put("taskType", cursor.getString(cursor.getColumnIndexOrThrow("task_type")));
        item.put("payload", new JSONObject(cursor.getString(cursor.getColumnIndexOrThrow("payload"))));
        item.put("status", cursor.getString(cursor.getColumnIndexOrThrow("status")));
        item.put("createdAt", cursor.getString(cursor.getColumnIndexOrThrow("created_at")));
        item.put("updatedAt", cursor.getString(cursor.getColumnIndexOrThrow("updated_at")));
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
                item.put("content", cursor.getString(cursor.getColumnIndexOrThrow("content")));
                item.put("updatedAt", cursor.getString(cursor.getColumnIndexOrThrow("updated_at")));
                result.put(item);
            }
        } finally { cursor.close(); }
        return result;
    }

    private JSONObject readBody(IHTTPSession session) throws IOException, JSONException {
        Map<String, String> files = new HashMap<>();
        session.parseBody(files);
        String body = files.get("postData");
        if (body == null || body.trim().isEmpty()) return new JSONObject();
        if (body.length() > 1024 * 1024) throw new IOException("Request body too large");
        return new JSONObject(body);
    }

    private String targetFor(String type) {
        if (type.contains("image") || type.contains("design") || type.contains("logo")) return "B";
        if (type.contains("audio") || type.contains("video") || type.contains("speech")) return "C";
        if (type.contains("code") || type.contains("app") || type.contains("web") || type.contains("build")) return "D";
        if (type.contains("backup") || type.contains("recovery") || type.contains("system")) return "E";
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

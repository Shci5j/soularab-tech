package com.soularab.localbackend;

import android.content.SharedPreferences;
import android.util.Base64;
import android.content.Intent;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import java.util.concurrent.Executor;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import fi.iki.elonen.NanoHTTPD;

import java.io.IOException;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import android.os.StatFs;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "LocalBackend")
public class LocalBackendPlugin extends Plugin {
    private final List<LocalNodeServer> servers = new ArrayList<>();
    private LocalBackendDatabase database;
    private String accessToken;

    @Override
    public void load() {
        super.load();
        database = new LocalBackendDatabase(getContext());
        SharedPreferences prefs = getContext().getSharedPreferences("soularab_local_backend", 0);
        accessToken = prefs.getString("access_token", null);
        if (accessToken == null) {
            byte[] bytes = new byte[32];
            new SecureRandom().nextBytes(bytes);
            accessToken = Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
            prefs.edit().putString("access_token", accessToken).apply();
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        try {
            startAll();
            JSObject result = statusObject();
            result.put("accessToken", accessToken);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to start embedded local nodes", error);
        }
    }

    @PluginMethod
    public void status(PluginCall call) { call.resolve(statusObject()); }

    @PluginMethod
    public void stop(PluginCall call) {
        stopAll();
        JSObject result = new JSObject();
        result.put("running", false);
        call.resolve(result);
    }

    @PluginMethod
    public void runTermuxCommand(PluginCall call) {
        String command = call.getString("command", "").trim();
        if (command.isEmpty() || command.length() > 12000) {
            call.reject("A command between 1 and 12000 characters is required");
            return;
        }
        try {
            Intent intent = new Intent("com.termux.RUN_COMMAND");
            intent.setClassName("com.termux", "com.termux.app.RunCommandService");
            intent.putExtra("com.termux.RUN_COMMAND_PATH", "/data/data/com.termux/files/usr/bin/bash");
            intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{"-lc", command});
            intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home");
            intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", false);
            getContext().startService(intent);
            JSObject result = new JSObject();
            result.put("accepted", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Termux command service unavailable. Enable Allow external apps in Termux.", error);
        }
    }

    private File roohModelFile() {
        File directory = new File(getContext().getFilesDir(), "rooh/models");
        if (!directory.exists()) directory.mkdirs();
        return new File(directory, "qwen2.5-3b-instruct-q4_k_m.gguf");
    }

    @PluginMethod
    public void roohEngineStatus(PluginCall call) {
        File model = roohModelFile();
        JSObject result = new JSObject();
        boolean loaded = false;
        String version = "unavailable";
        try { loaded = RoohNative.isLoaded(); version = RoohNative.version(); }
        catch (Throwable error) { result.put("nativeError", error.getClass().getSimpleName()); }
        result.put("engine", "llama.cpp-native-android");
        result.put("version", version);
        result.put("loaded", loaded);
        result.put("modelPresent", model.isFile() && model.length() > 1500000000L);
        result.put("modelBytes", model.isFile() ? model.length() : 0);
        result.put("modelPath", model.getAbsolutePath());
        result.put("runtime", "on-device-cpu");
        call.resolve(result);
    }

    @PluginMethod
    public void downloadRoohModel(PluginCall call) {
        call.setKeepAlive(true);
        new Thread(() -> {
            File target = roohModelFile();
            File partial = new File(target.getParentFile(), target.getName() + ".part");
            HttpURLConnection connection = null;
            try {
                if (target.isFile() && target.length() > 1500000000L) {
                    JSObject ready = new JSObject(); ready.put("downloaded", true); ready.put("bytes", target.length());
                    call.resolve(ready); return;
                }
                StatFs storage = new StatFs(target.getParentFile().getAbsolutePath());
                if (storage.getAvailableBytes() < 2800000000L) throw new IOException("يلزم توفير 2.8 جيجابايت على الأقل من المساحة الحرة لتنزيل النموذج.");
                URL url = new URL("https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf?download=true");
                connection = (HttpURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(120000);
                connection.setRequestProperty("User-Agent", "SOULARAB-TECH-ROOH/1.0");
                int status = connection.getResponseCode();
                if (status < 200 || status >= 300) throw new IOException("تعذر تنزيل النموذج (HTTP " + status + ").");
                long total = -1L;\n                try { total = Long.parseLong(connection.getHeaderField("Content-Length")); } catch (Exception ignored) {}
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial, false)) {
                    byte[] buffer = new byte[1024 * 1024];
                    long received = 0;
                    int count;
                    int lastPercent = -1;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                        received += count;
                        int percent = total > 0 ? (int) Math.min(100, received * 100 / total) : -1;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject progress = new JSObject();
                            progress.put("receivedBytes", received); progress.put("totalBytes", total); progress.put("percent", percent);
                            notifyListeners("roohModelDownloadProgress", progress);
                        }
                    }
                    output.getFD().sync();
                }
                if (partial.length() < 1500000000L) throw new IOException("ملف النموذج أصغر من الحجم المتوقع؛ تم رفضه.");
                if (target.exists() && !target.delete()) throw new IOException("تعذر استبدال ملف النموذج القديم.");
                if (!partial.renameTo(target)) throw new IOException("تعذر تثبيت ملف النموذج بعد التنزيل.");
                JSObject result = new JSObject(); result.put("downloaded", true); result.put("bytes", target.length());
                call.resolve(result);
            } catch (Exception error) {
                partial.delete();
                call.reject(error.getMessage() == null ? "فشل تنزيل نموذج روح." : error.getMessage(), error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "rooh-model-download").start();
    }

    @PluginMethod
    public void loadRoohModel(PluginCall call) {
        new Thread(() -> {
            try {
                File model = roohModelFile();
                if (!model.isFile() || model.length() < 1500000000L) throw new IOException("ملف نموذج Qwen غير موجود أو غير مكتمل. نزّله أولاً.");
                String error = RoohNative.loadModel(model.getAbsolutePath());
                if (error != null && !error.isEmpty()) throw new IOException(error);
                JSObject result = new JSObject(); result.put("loaded", true); result.put("version", RoohNative.version());
                call.resolve(result);
            } catch (Throwable error) {
                call.reject(error.getMessage() == null ? "تعذر تحميل محرك روح المحلي." : error.getMessage(), error instanceof Exception ? (Exception) error : new Exception(error));
            }
        }, "rooh-model-load").start();
    }

    @PluginMethod
    public void generateRooh(PluginCall call) {
        String prompt = call.getString("prompt", "");
        int maxTokens = call.getInt("maxTokens", 512);
        if (prompt.trim().isEmpty() || prompt.length() > 50000) { call.reject("نص المحادثة فارغ أو طويل جداً."); return; }
        call.setKeepAlive(true);
        new Thread(() -> {
            try {
                String answer = RoohNative.generate(prompt, maxTokens);
                if (answer == null || answer.trim().isEmpty()) throw new IOException("أعاد محرك روح استجابة فارغة.");
                JSObject result = new JSObject(); result.put("content", answer); result.put("model", "qwen2.5-3b-instruct-q4_k_m"); result.put("provider", "llama.cpp-native-android");
                call.resolve(result);
            } catch (Throwable error) {
                call.reject(error.getMessage() == null ? "فشل الاستدلال المحلي." : error.getMessage(), error instanceof Exception ? (Exception) error : new Exception(error));
            }
        }, "rooh-inference").start();
    }

    @PluginMethod
    public void biometricAvailability(PluginCall call) {
        int status = BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        JSObject result = new JSObject();
        result.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("status", status);
        call.resolve(result);
    }

    @PluginMethod
    public void authenticateBiometric(PluginCall call) {
        int status = BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        if (status != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("Strong biometric authentication is not available on this device (" + status + ").");
            return;
        }
        Executor executor = ContextCompat.getMainExecutor(getContext());
        BiometricPrompt prompt = new BiometricPrompt(getActivity(), executor, new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                JSObject response = new JSObject();
                response.put("authenticated", true);
                call.resolve(response);
            }

            @Override
            public void onAuthenticationError(int errorCode, CharSequence errString) {
                call.reject(errString == null ? "Biometric authentication failed." : errString.toString());
            }

            @Override
            public void onAuthenticationFailed() {
                // The system prompt remains available for another biometric attempt.
            }
        });
        String title = call.getString("title", "SOULARAB TECH");
        String subtitle = call.getString("subtitle", "Authenticate to unlock the app");
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .setNegativeButtonText("Use PIN")
            .build();
        prompt.authenticate(info);
    }

    @PluginMethod
    public void checkRootAccess(PluginCall call) {
        new Thread(() -> {
            Process process = null;
            try {
                process = new ProcessBuilder("su", "-c", "id").redirectErrorStream(true).start();
                byte[] buffer = new byte[2048];
                int count = process.getInputStream().read(buffer);
                boolean granted = process.waitFor() == 0;
                String output = count > 0 ? new String(buffer, 0, count, "UTF-8").trim() : "";
                JSObject result = new JSObject();
                result.put("available", granted && output.contains("uid=0"));
                if (granted && output.contains("uid=0")) result.put("uid", output);
                else result.put("message", "Root access is not available or was not granted.");
                call.resolve(result);
            } catch (Exception error) {
                JSObject result = new JSObject();
                result.put("available", false);
                result.put("message", "This Android device does not provide an accessible su binary.");
                call.resolve(result);
            } finally {
                if (process != null) process.destroy();
            }
        }).start();
    }

    private static final String[] NODE_IDS = {"A", "B", "C", "D", "E"};
    private static final String[] NODE_NAMES = {"ROOH Orchestrator", "AI & Text", "Image & Design", "Audio & Video", "Development & Recovery"};
    private static final int[] NODE_PORTS = {3101, 3102, 3103, 3104, 3105};

    @PluginMethod
    public void controlNode(PluginCall call) {
        String id = call.getString("id", "");
        String action = call.getString("action", "");
        try {
            if ("start".equals(action)) startNode(id);
            else if ("stop".equals(action)) stopNode(id);
            else { call.reject("Action must be start or stop"); return; }
            call.resolve(statusObject());
        } catch (Exception error) {
            call.reject("Unable to " + action + " node " + id, error);
        }
    }

    private synchronized void startAll() throws IOException {
        for (String id : NODE_IDS) startNode(id);
    }

    private synchronized void startNode(String id) throws IOException {
        int index = nodeIndex(id);
        if (index < 0) throw new IllegalArgumentException("Unknown node: " + id);
        for (LocalNodeServer server : servers) {
            if (server.nodeId.equals(id) && server.isAlive()) return;
        }
        stopNode(id);
        LocalNodeServer server = new LocalNodeServer(id, NODE_NAMES[index], NODE_PORTS[index], database, accessToken);
        server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
        servers.add(server);
        if ("B".equals(id)) server.startWorker();
    }

    private synchronized void stopNode(String id) {
        for (int i = servers.size() - 1; i >= 0; i--) {
            LocalNodeServer server = servers.get(i);
            if (server.nodeId.equals(id)) {
                server.stopWorker();
                try { server.stop(); } catch (Exception ignored) {}
                servers.remove(i);
            }
        }
    }

    private int nodeIndex(String id) {
        for (int i = 0; i < NODE_IDS.length; i++) if (NODE_IDS[i].equals(id)) return i;
        return -1;
    }

    private synchronized void stopAll() {
        for (LocalNodeServer server : servers) {
            server.stopWorker();
            try { server.stop(); } catch (Exception ignored) {}
        }
        servers.clear();
    }

    private synchronized JSObject statusObject() {
        JSObject result = new JSObject();
        JSArray nodes = new JSArray();
        boolean allRunning = true;
        for (int i = 0; i < NODE_IDS.length; i++) {
            LocalNodeServer found = null;
            for (LocalNodeServer server : servers) if (server.nodeId.equals(NODE_IDS[i])) { found = server; break; }
            boolean running = found != null && found.isAlive();
            allRunning = allRunning && running;
            JSObject item = new JSObject();
            item.put("id", NODE_IDS[i]);
            item.put("name", NODE_NAMES[i]);
            item.put("port", NODE_PORTS[i]);
            item.put("running", running);
            nodes.put(item);
        }
        result.put("running", allRunning);
        result.put("nodes", nodes);
        result.put("database", "soularab_embedded_backend.db");
        return result;
    }

    @Override
    protected void handleOnDestroy() {
        stopAll();
        if (database != null) database.close();
        super.handleOnDestroy();
    }
}

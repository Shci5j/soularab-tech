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
    }

    private synchronized void stopNode(String id) {
        for (int i = servers.size() - 1; i >= 0; i--) {
            LocalNodeServer server = servers.get(i);
            if (server.nodeId.equals(id)) {
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

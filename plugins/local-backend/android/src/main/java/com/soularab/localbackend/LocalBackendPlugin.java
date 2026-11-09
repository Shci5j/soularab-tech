package com.soularab.localbackend;

import android.content.SharedPreferences;
import android.util.Base64;

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
    public void status(PluginCall call) {
        call.resolve(statusObject());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopAll();
        JSObject result = new JSObject();
        result.put("running", false);
        call.resolve(result);
    }

    private synchronized void startAll() throws IOException {
        if (servers.size() == 5) {
            boolean allAlive = true;
            for (LocalNodeServer server : servers) allAlive = allAlive && server.isAlive();
            if (allAlive) return;
        }
        stopAll();
        String[] ids = {"A", "B", "C", "D", "E"};
        String[] names = {"AI & Text", "Image & Design", "Audio & Video", "Development", "Recovery & Scheduler"};
        int[] ports = {3101, 3102, 3103, 3104, 3105};
        try {
            for (int i = 0; i < ids.length; i++) {
                LocalNodeServer server = new LocalNodeServer(ids[i], names[i], ports[i], database, accessToken);
                server.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
                servers.add(server);
            }
        } catch (IOException error) {
            stopAll();
            throw error;
        }
    }

    private synchronized void stopAll() {
        for (LocalNodeServer server : servers) {
            try { server.stop(); } catch (Exception ignored) {}
        }
        servers.clear();
    }

    private JSObject statusObject() {
        JSObject result = new JSObject();
        JSArray nodes = new JSArray();
        boolean allRunning = servers.size() == 5;
        for (LocalNodeServer server : servers) {
            boolean running = server.isAlive();
            allRunning = allRunning && running;
            JSObject item = new JSObject();
            item.put("id", server.nodeId);
            item.put("name", server.title);
            item.put("port", server.getListeningPort());
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

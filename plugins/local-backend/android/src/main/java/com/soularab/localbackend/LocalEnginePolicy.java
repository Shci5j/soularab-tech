package com.soularab.localbackend;

import java.net.URL;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

final class LocalEnginePolicy {
    private static final Set<String> COMFY_NODES = new HashSet<>(Arrays.asList(
        "CheckpointLoaderSimple", "CLIPTextEncode", "EmptyLatentImage", "KSampler",
        "VAEDecode", "SaveImage", "LoraLoader", "VAEEncode", "LoadImage",
        "ImageScale", "PreviewImage"
    ));

    private LocalEnginePolicy() {}

    static boolean isLoopbackHttpUrl(String value) {
        try {
            URL url = new URL(value);
            String host = url.getHost().toLowerCase(Locale.ROOT);
            return "http".equals(url.getProtocol())
                && ("127.0.0.1".equals(host) || "localhost".equals(host) || "::1".equals(host))
                && url.getPort() > 0 && url.getPort() <= 65535
                && url.getUserInfo() == null && url.getQuery() == null && url.getRef() == null
                && (url.getPath().isEmpty() || "/".equals(url.getPath()));
        } catch (Exception invalid) {
            return false;
        }
    }

    static boolean isAllowedComfyNode(String classType) {
        return COMFY_NODES.contains(classType);
    }

    static boolean isSafeWorkspaceId(String workspace) {
        return workspace != null && workspace.matches("[A-Za-z0-9_-]{1,64}");
    }

    static boolean isSafeWorkspaceFilename(String filename) {
        return filename != null && filename.matches("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,119}\\.(txt|md|json|html|css|js|py)");
    }
}

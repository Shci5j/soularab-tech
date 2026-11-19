package com.soularab.localbackend;

import org.junit.Test;
import static org.junit.Assert.*;

public class LocalEnginePolicyTest {
    @Test
    public void acceptsOnlyExplicitLoopbackHttpUrls() {
        assertTrue(LocalEnginePolicy.isLoopbackHttpUrl("http://127.0.0.1:8188"));
        assertTrue(LocalEnginePolicy.isLoopbackHttpUrl("http://localhost:8080/"));
        assertFalse(LocalEnginePolicy.isLoopbackHttpUrl("https://127.0.0.1:8188"));
        assertFalse(LocalEnginePolicy.isLoopbackHttpUrl("http://192.168.1.10:8188"));
        assertFalse(LocalEnginePolicy.isLoopbackHttpUrl("http://example.com:8188"));
        assertFalse(LocalEnginePolicy.isLoopbackHttpUrl("http://user@localhost:8188"));
        assertFalse(LocalEnginePolicy.isLoopbackHttpUrl("http://localhost:8188/path"));
    }

    @Test
    public void acceptsOnlyBuiltInComfyNodes() {
        assertTrue(LocalEnginePolicy.isAllowedComfyNode("KSampler"));
        assertTrue(LocalEnginePolicy.isAllowedComfyNode("SaveImage"));
        assertFalse(LocalEnginePolicy.isAllowedComfyNode("ExecutePython"));
        assertFalse(LocalEnginePolicy.isAllowedComfyNode("CustomShellNode"));
    }

    @Test
    public void constrainsWorkspacePathsAndFileTypes() {
        assertTrue(LocalEnginePolicy.isSafeWorkspaceId("project_01"));
        assertFalse(LocalEnginePolicy.isSafeWorkspaceId("../outside"));
        assertTrue(LocalEnginePolicy.isSafeWorkspaceFilename("brief.md"));
        assertTrue(LocalEnginePolicy.isSafeWorkspaceFilename("app-main.js"));
        assertFalse(LocalEnginePolicy.isSafeWorkspaceFilename("../outside.txt"));
        assertFalse(LocalEnginePolicy.isSafeWorkspaceFilename("run.sh"));
        assertFalse(LocalEnginePolicy.isSafeWorkspaceFilename("note.txt/../../x"));
    }
}

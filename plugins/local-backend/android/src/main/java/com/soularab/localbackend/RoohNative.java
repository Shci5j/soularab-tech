package com.soularab.localbackend;

final class RoohNative {
    static {
        System.loadLibrary("rooh_engine");
    }

    private RoohNative() {}

    static native boolean isLoaded();
    static native String version();
    static native String loadModel(String path);
    static native String generate(String prompt, int maxTokens);
}

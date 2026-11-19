package com.soularab.localbackend;

/** Small, deterministic task-state rules shared by workers and queue controls. */
final class LocalTaskState {
    private LocalTaskState() {}

    static boolean mayRetry(String status, int attempts, int maxAttempts, boolean approved) {
        return "failed".equals(status) && approved && maxAttempts > 0 && attempts >= 0 && attempts < maxAttempts;
    }

    static String completionStatus(boolean cancelRequested) {
        return cancelRequested ? "cancelled" : "completed";
    }

    static String failureStatus(boolean cancelRequested) {
        return cancelRequested ? "cancelled" : "failed";
    }

    static String recoveryStatus(String nodeId, boolean cancelRequested, int attempts, int maxAttempts, boolean approved) {
        if (cancelRequested) return "cancelled";
        if (!approved || attempts >= maxAttempts || maxAttempts <= 0) return "failed";
        if ("A".equals(nodeId) || "B".equals(nodeId) || "D".equals(nodeId)) return "queued";
        return "failed";
    }
}

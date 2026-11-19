package com.soularab.localbackend;

import org.junit.Test;
import static org.junit.Assert.*;

public class LocalTaskStateTest {
    @Test
    public void retryRequiresFailedApprovedTaskAndRemainingAttempts() {
        assertTrue(LocalTaskState.mayRetry("failed", 1, 3, true));
        assertFalse(LocalTaskState.mayRetry("running", 1, 3, true));
        assertFalse(LocalTaskState.mayRetry("failed", 1, 3, false));
        assertFalse(LocalTaskState.mayRetry("failed", 3, 3, true));
        assertFalse(LocalTaskState.mayRetry("failed", 0, 0, true));
    }

    @Test
    public void cancellationWinsOverSuccessfulCompletion() {
        assertEquals("completed", LocalTaskState.completionStatus(false));
        assertEquals("cancelled", LocalTaskState.completionStatus(true));
        assertEquals("failed", LocalTaskState.failureStatus(false));
        assertEquals("cancelled", LocalTaskState.failureStatus(true));
    }

    @Test
    public void recoveryOnlyRequeuesApprovedRetrySafeNodes() {
        assertEquals("queued", LocalTaskState.recoveryStatus("A", false, 1, 3, true));
        assertEquals("queued", LocalTaskState.recoveryStatus("B", false, 1, 3, true));
        assertEquals("queued", LocalTaskState.recoveryStatus("D", false, 1, 3, true));
        assertEquals("failed", LocalTaskState.recoveryStatus("C", false, 1, 3, true));
        assertEquals("failed", LocalTaskState.recoveryStatus("E", false, 1, 3, true));
        assertEquals("failed", LocalTaskState.recoveryStatus("A", false, 3, 3, true));
        assertEquals("failed", LocalTaskState.recoveryStatus("A", false, 1, 3, false));
        assertEquals("cancelled", LocalTaskState.recoveryStatus("C", true, 1, 3, true));
    }
}

package com.lifeos.personal;

import android.os.SystemClock;

import java.util.concurrent.atomic.AtomicLong;

/** Process-local, time-bounded marker for one Android recovery-kit save-picker round trip. */
final class RecoveryExportActivityGuard {
    private static final long MAX_WINDOW_MS = 5 * 60 * 1000L;
    private static final AtomicLong SEQUENCE = new AtomicLong();
    private static long activeToken;
    private static long expiresAt;

    private RecoveryExportActivityGuard() {}

    static synchronized long begin() {
        return begin(SystemClock.elapsedRealtime());
    }

    static synchronized long begin(long nowElapsedRealtime) {
        activeToken = SEQUENCE.incrementAndGet();
        expiresAt = nowElapsedRealtime + MAX_WINDOW_MS;
        return activeToken;
    }

    static synchronized boolean isActive() {
        if (activeToken == 0L || SystemClock.elapsedRealtime() >= expiresAt) {
            activeToken = 0L;
            expiresAt = 0L;
            return false;
        }
        return true;
    }

    static synchronized void end(long token) {
        if (token != 0L && token == activeToken) {
            activeToken = 0L;
            expiresAt = 0L;
        }
    }

    static synchronized void endCurrent() {
        activeToken = 0L;
        expiresAt = 0L;
    }

    static synchronized boolean isActive(long nowElapsedRealtime) {
        if (activeToken == 0L || nowElapsedRealtime >= expiresAt) {
            activeToken = 0L;
            expiresAt = 0L;
            return false;
        }
        return true;
    }
}

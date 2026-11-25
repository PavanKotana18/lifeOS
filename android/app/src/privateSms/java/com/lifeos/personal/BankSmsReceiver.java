package com.lifeos.personal;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import java.util.Objects;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public final class BankSmsReceiver extends BroadcastReceiver {
    private static final ThreadPoolExecutor worker = new ThreadPoolExecutor(
        1, 1, 15, TimeUnit.SECONDS, new ArrayBlockingQueue<>(8));

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction()) || !BankSmsQueue.enabled(context)) return;
        PendingResult completion = goAsync();
        try {
            worker.execute(() -> {
                try {
                    if (!BankSmsQueue.enabled(context)) return;
                    SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
                    if (parts == null || parts.length == 0 || parts.length > 16 || parts[0] == null) return;
                    String sender = parts[0].getOriginatingAddress();
                    StringBuilder message = new StringBuilder();
                    for (SmsMessage part : parts) {
                        if (part == null || !Objects.equals(sender, part.getOriginatingAddress())) return;
                        String body = part.getMessageBody();
                        if (body == null || body.length() > 2000 - message.length()) return;
                        message.append(body);
                    }
                    if (BankSmsQueue.stage(context, message.toString())) BankSmsPlugin.queueChanged();
                } catch (Exception ignored) {
                    // Logging receiver exceptions can expose SMS data through a platform exception.
                } finally {
                    completion.finish();
                }
            });
        } catch (RejectedExecutionException ignored) {
            completion.finish();
        }
    }
}

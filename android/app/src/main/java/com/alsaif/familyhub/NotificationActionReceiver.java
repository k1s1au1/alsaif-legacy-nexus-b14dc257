package com.alsaif.familyhub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class NotificationActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d("NotificationAction", "Received action: " + action);
        // This is handled by Capacitor plugin in the foreground/background
        // But having this receiver prevents manifest errors.
    }
}

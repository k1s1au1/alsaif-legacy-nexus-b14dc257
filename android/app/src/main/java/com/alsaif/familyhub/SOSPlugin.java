package com.alsaif.familyhub;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SOS")
public class SOSPlugin extends Plugin {

    private static final String CHANNEL_ID = "sos_emergency_channel";

    @PluginMethod
    public void triggerSOS(PluginCall call) {
        // In a real app, this would send a request to Supabase/Backend
        // Here we simulate the trigger
        call.resolve();
    }

    @PluginMethod
    public void showEmergencyNotification(PluginCall call) {
        String name = call.getString("name", "أحد أفراد العائلة");
        String location = call.getString("location", "موقع غير محدد");

        NotificationManager notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "تنبيهات فزعة العاجلة",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("تنبيهات الطوارئ من أفراد العائلة");
            
            // Set custom sound if available (optional)
            // Uri soundUri = Uri.parse("android.resource://" + getContext().getPackageName() + "/" + R.raw.emergency_siren);
            // channel.setSound(soundUri, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).build());

            notificationManager.createNotificationChannel(channel);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("🆘 نداء فزعة عاجل!")
                .setContentText("يحتاج " + name + " للمساعدة في: " + location)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);

        notificationManager.notify(1001, builder.build());
        call.resolve();
    }
}

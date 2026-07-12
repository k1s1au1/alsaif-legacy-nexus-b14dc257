package com.alsaif.familyhub;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    private static final String PREFS_NAME = "CapacitorStorage";

    @PluginMethod
    public void updateData(PluginCall call) {
        String title = call.getString("title");
        String date = call.getString("date");
        String label = call.getString("label");

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        
        if (title != null) editor.putString("widget_title", title);
        if (date != null) editor.putString("widget_date", date);
        if (label != null) editor.putString("widget_label", label);
        
        editor.apply();

        // Broadcast to widget to update immediately
        Intent intent = new Intent(getContext(), TodayWidgetProvider.class);
        intent.setAction("com.alsaif.familyhub.UPDATE_WIDGET");
        getContext().sendBroadcast(intent);

        call.resolve();
    }
}

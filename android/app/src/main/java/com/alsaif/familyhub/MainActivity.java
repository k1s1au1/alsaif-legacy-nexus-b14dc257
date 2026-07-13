package com.alsaif.familyhub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetPlugin.class);
        registerPlugin(SharingPlugin.class);
        registerPlugin(ContactsPlugin.class);
        registerPlugin(SOSPlugin.class);
        registerPlugin(BiometricPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

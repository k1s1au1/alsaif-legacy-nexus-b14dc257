package com.alsaif.familyhub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register custom plugins before super.onCreate to ensure they are available to the bridge immediately
        registerPlugin(WidgetPlugin.class);
        registerPlugin(SharingPlugin.class);
        registerPlugin(ContactsPlugin.class);
        registerPlugin(SOSPlugin.class);
        registerPlugin(BiometricPlugin.class);
        registerPlugin(DocumentScannerPlugin.class);

        super.onCreate(savedInstanceState);
    }
}

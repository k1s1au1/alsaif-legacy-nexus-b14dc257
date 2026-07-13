package com.alsaif.familyhub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register only required custom plugins before super.onCreate
        registerPlugin(WidgetPlugin.class);
        registerPlugin(SharingPlugin.class);
        registerPlugin(ContactsPlugin.class);
        registerPlugin(BiometricPlugin.class);
        registerPlugin(DocumentScannerPlugin.class);

        super.onCreate(savedInstanceState);
    }
}

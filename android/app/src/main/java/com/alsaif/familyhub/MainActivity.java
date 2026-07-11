package com.alsaif.familyhub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Explicitly register the custom local plugin
        registerPlugin(DocumentScannerPlugin.class);
    }
}

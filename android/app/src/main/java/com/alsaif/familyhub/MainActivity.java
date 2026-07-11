package com.alsaif.familyhub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(BiometricPlugin.class);
        registerPlugin(SOSPlugin.class);
        registerPlugin(ContactsPlugin.class);
        registerPlugin(SharingPlugin.class);
    }
}

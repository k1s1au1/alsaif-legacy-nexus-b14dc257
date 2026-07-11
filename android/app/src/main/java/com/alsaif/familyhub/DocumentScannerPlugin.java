package com.alsaif.familyhub;

import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.IntentSenderRequest;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import android.Manifest;

import java.util.List;

@CapacitorPlugin(
    name = "DocumentScanner",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        )
    }
)
public class DocumentScannerPlugin extends Plugin {

    @PluginMethod
    public void scanDocument(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "checkPermissionCallback");
        } else {
            startScan(call);
        }
    }

    @PermissionCallback
    private void checkPermissionCallback(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) {
            startScan(call);
        } else {
            call.reject("يجب إعطاء إذن الكاميرا لاستخدام الماسح");
        }
    }

    private void startScan(PluginCall call) {
        GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
                .setGalleryImportAllowed(true)
                .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG, GmsDocumentScannerOptions.RESULT_FORMAT_PDF)
                .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
                .build();

        GmsDocumentScanner scanner = GmsDocumentScanning.getClient(options);

        scanner.getStartScanIntent(getActivity())
                .addOnSuccessListener(intentSender -> {
                    IntentSenderRequest request = new IntentSenderRequest.Builder(intentSender).build();
                    // Using startActivityForResult ensures Capacitor captures the result correctly
                    startActivityForResult(call, new Intent().putExtra("intent_sender", request), "handleScanResult");
                })
                .addOnFailureListener(e -> call.reject("تأكد من تحديث خدمات جوجل بلاي: " + e.getMessage()));
    }

    @ActivityCallback
    private void handleScanResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            GmsDocumentScanningResult scanningResult = GmsDocumentScanningResult.fromActivityResultIntent(result.getData());
            if (scanningResult != null) {
                JSObject ret = new JSObject();
                List<GmsDocumentScanningResult.Page> pages = scanningResult.getPages();
                if (pages != null && !pages.isEmpty()) {
                    ret.put("path", pages.get(0).getImageUri().toString());
                }
                
                GmsDocumentScanningResult.Pdf pdf = scanningResult.getPdf();
                if (pdf != null) {
                    ret.put("pdfPath", pdf.getUri().toString());
                }
                
                call.resolve(ret);
            } else {
                call.reject("لم يتم العثور على نتيجة للمسح");
            }
        } else if (result.getResultCode() == android.app.Activity.RESULT_CANCELED) {
            call.reject("تم إلغاء العملية");
        } else {
            call.reject("فشل المسح الضوئي");
        }
    }
}

package com.alsaif.familyhub;

import android.content.Intent;
import android.content.IntentSender;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PermissionState;
import com.getcapacitor.PluginMethod;
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
    private static final int SCAN_REQUEST_CODE = 10001;

    @PluginMethod
    public void scanDocument(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "checkPermissionCallback");
        } else {
            startScan(call);
        }
    }

    @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("value");
        JSObject ret = new JSObject();
        ret.put("value", value);
        call.resolve(ret);
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
                    try {
                        saveCall(call);
                        getActivity().startIntentSenderForResult(intentSender, SCAN_REQUEST_CODE, null, 0, 0, 0);
                    } catch (IntentSender.SendIntentException e) {
                        call.reject("فشل فتح واجهة الماسح: " + e.getMessage());
                    }
                })
                .addOnFailureListener(e -> call.reject("تأكد من تحديث خدمات جوجل بلاي: " + e.getMessage()));
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (requestCode == SCAN_REQUEST_CODE) {
            PluginCall call = getSavedCall();
            if (call == null) return;

            if (resultCode == android.app.Activity.RESULT_OK) {
                GmsDocumentScanningResult scanningResult = GmsDocumentScanningResult.fromActivityResultIntent(data);
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
            } else if (resultCode == android.app.Activity.RESULT_CANCELED) {
                call.reject("تم إلغاء العملية");
            } else {
                call.reject("فشل المسح الضوئي");
            }
        }
    }
}

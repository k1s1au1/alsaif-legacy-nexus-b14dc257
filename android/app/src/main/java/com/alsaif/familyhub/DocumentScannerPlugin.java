package com.alsaif.familyhub;

import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.IntentSenderRequest;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;

import java.util.List;

@CapacitorPlugin(name = "DocumentScanner")
public class DocumentScannerPlugin extends Plugin {

    @PluginMethod
    public void scanDocument(PluginCall call) {
        GmsDocumentScannerOptions options = new GmsDocumentScannerOptions.Builder()
                .setGalleryImportAllowed(true)
                .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG, GmsDocumentScannerOptions.RESULT_FORMAT_PDF)
                .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
                .build();

        GmsDocumentScanner scanner = GmsDocumentScanning.getClient(options);

        scanner.getStartScanIntent(getActivity())
                .addOnSuccessListener(intentSender -> {
                    IntentSenderRequest request = new IntentSenderRequest.Builder(intentSender).build();
                    startActivityForResult(call, new Intent().putExtra("intent_sender", request), "handleScanResult");
                })
                .addOnFailureListener(e -> call.reject("فشل بدء الماسح: " + e.getMessage()));
    }

    @ActivityCallback
    private void handleScanResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            GmsDocumentScanningResult scanningResult = GmsDocumentScanningResult.fromActivityResultIntent(result.getData());
            if (scanningResult != null) {
                JSObject ret = new JSObject();
                
                // Get the first page URI if available
                List<GmsDocumentScanningResult.Page> pages = scanningResult.getPages();
                if (pages != null && !pages.isEmpty()) {
                    ret.put("path", pages.get(0).getImageUri().toString());
                }
                
                // If PDF is generated
                GmsDocumentScanningResult.Pdf pdf = scanningResult.getPdf();
                if (pdf != null) {
                    ret.put("pdfPath", pdf.getUri().toString());
                }
                
                call.resolve(ret);
            } else {
                call.reject("لم يتم العثور على نتيجة للسمح");
            }
        } else if (result.getResultCode() == android.app.Activity.RESULT_CANCELED) {
            call.reject("تم إلغاء العملية");
        } else {
            call.reject("فشل المسح الضوئي");
        }
    }
}

package com.alsaif.familyhub;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "FamilySharing")
public class SharingPlugin extends Plugin {

    @PluginMethod
    public void shareInvitation(PluginCall call) {
        String title = call.getString("title", "دعوة عائلية");
        String date = call.getString("date", "");
        String location = call.getString("location", "");

        // Create a simple invitation bitmap
        Bitmap bitmap = Bitmap.createBitmap(800, 1000, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(Color.parseColor("#064E3B")); // Royal Green

        Paint paint = new Paint();
        paint.setColor(Color.parseColor("#D4AF37")); // Gold
        paint.setTextSize(60);
        paint.setFakeBoldText(true);
        paint.setTextAlign(Paint.Align.CENTER);

        canvas.drawText("مجلس عائلة السيف", 400, 200, paint);
        
        paint.setColor(Color.WHITE);
        paint.setTextSize(50);
        canvas.drawText(title, 400, 400, paint);
        
        paint.setTextSize(40);
        canvas.drawText("التاريخ: " + date, 400, 600, paint);
        canvas.drawText("الموقع: " + location, 400, 700, paint);

        // Save and share
        try {
            File cachePath = new File(getContext().getCacheDir(), "images");
            cachePath.mkdirs();
            FileOutputStream stream = new FileOutputStream(cachePath + "/invitation.png");
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
            stream.close();

            File imageFile = new File(cachePath, "invitation.png");
            Uri contentUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", imageFile);

            if (contentUri != null) {
                Intent shareIntent = new Intent();
                shareIntent.setAction(Intent.ACTION_SEND);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                shareIntent.setDataAndType(contentUri, getContext().getContentResolver().getType(contentUri));
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                getActivity().startActivity(Intent.createChooser(shareIntent, "مشاركة الدعوة"));
                call.resolve();
            }
        } catch (Exception e) {
            call.reject("Failed to share: " + e.getMessage());
        }
    }
}

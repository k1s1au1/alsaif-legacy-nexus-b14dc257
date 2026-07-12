import { registerPlugin, Capacitor } from "@capacitor/core";
import { toast } from "sonner";

export interface BiometricAuthPlugin {
  checkBiometry(): Promise<{ isAvailable: boolean }>;
  authenticate(options: { title: string; subtitle: string }): Promise<{ success: boolean }>;
}

export interface FamilySharingPlugin {
  shareInvitation(options: { title: string; date: string; location: string }): Promise<void>;
}

export interface FamilyContactsPlugin {
  saveContact(options: { name: string; phone: string; prefix?: string }): Promise<void>;
}

export interface SOSPlugin {
  triggerSOS(): Promise<void>;
  showEmergencyNotification(options: { name?: string; location?: string }): Promise<void>;
}

export interface DocumentScannerPlugin {
  scanDocument(): Promise<{ path: string }>;
}

export interface WidgetPlugin {
  updateData(options: { title?: string; date?: string; label?: string }): Promise<void>;
}

export const DocumentScanner = registerPlugin<DocumentScannerPlugin>("DocumentScanner");
export const Widget = registerPlugin<WidgetPlugin>("Widget");

const FamilySharingRaw = registerPlugin<FamilySharingPlugin>("FamilySharing");
export const FamilyContacts = registerPlugin<FamilyContactsPlugin>("FamilyContacts");
export const SOS = registerPlugin<SOSPlugin>("SOS");

/**
 * Enhanced Sharing: Generates a beautiful image on the fly and shares it.
 */
export const FamilySharing = {
  async shareInvitation({
    title,
    date,
    location,
  }: {
    title: string;
    date: string;
    location: string;
  }) {
    if (Capacitor.isNativePlatform()) {
      try {
        await FamilySharingRaw.shareInvitation({ title, date, location });
        return;
      } catch (e) {
        console.warn("Custom plugin failed, falling back to web sharing");
      }
    }

    // Web Fallback: Generate Canvas Image
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw Background
    const grad = ctx.createLinearGradient(0, 0, 1200, 1200);
    grad.addColorStop(0, "#064E3B"); // Emerald
    grad.addColorStop(1, "#051410"); // Dark
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 1200);

    // Draw Frame
    ctx.strokeStyle = "#D4AF37"; // Gold
    ctx.lineWidth = 40;
    ctx.strokeRect(60, 60, 1080, 1080);

    // Text Style
    ctx.textAlign = "center";
    ctx.fillStyle = "#D4AF37";
    ctx.font = 'bold 120px "Amiri", serif';
    ctx.fillText("دعوة عائلية", 600, 300);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 90px sans-serif";
    ctx.fillText(title, 600, 500);

    ctx.font = "50px sans-serif";
    ctx.fillStyle = "#D4AF37";
    ctx.fillText("📅 التاريخ والوقت", 600, 700);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(date, 600, 780);

    ctx.fillStyle = "#D4AF37";
    ctx.fillText("📍 الموقع", 600, 900);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(location, 600, 980);

    ctx.font = "italic 40px serif";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillText("مجلس السيف الرقمي", 600, 1120);

    // Share or Download
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "invitation.png", { type: "image/png" });

      if (navigator.share) {
        try {
          await navigator.share({
            files: [file],
            title: title,
            text: `ندعوكم لحضور: ${title}`,
          });
        } catch (e) {
          toast.error("فشل المشاركة");
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "invitation.png";
        a.click();
        toast.success("تم تحميل بطاقة الدعوة بنجاح");
      }
    });
  },
};

const BiometricAuth = registerPlugin<BiometricAuthPlugin>("BiometricAuth");
export { BiometricAuth };

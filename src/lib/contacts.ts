import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Generates a vCard file for selected family members and triggers a download.
 * On mobile, this usually opens the contact import screen.
 */
export async function syncFamilyContacts(selectedUserIds?: string[]) {
  try {
    let query = supabase
      .from("profiles")
      .select("id, arabic_name, full_name, phone");

    if (selectedUserIds && selectedUserIds.length > 0) {
      query = query.in("id", selectedUserIds);
    }

    const { data: profiles, error } = await query;

    let vcfContent = "";

    profiles.forEach(p => {
      if (p.phone) {
        const name = p.arabic_name || p.full_name || "عضو السيف";
        // Clean phone number (keep only digits and +)
        const cleanPhone = p.phone.replace(/[^\d+]/g, '');

        vcfContent += "BEGIN:VCARD\n";
        vcfContent += "VERSION:3.0\n";
        vcfContent += `FN:${name} - السيف\n`;
        vcfContent += `N:;${name};;;\n`;
        vcfContent += `TEL;TYPE=CELL:${cleanPhone}\n`;
        vcfContent += "END:VCARD\n";
      }
    });

    if (!vcfContent) {
      toast.error("لا توجد أرقام هواتف مسجلة للأعضاء");
      return;
    }

    const blob = new Blob([vcfContent], { type: "text/vcard" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Alsaif_Family_Contacts.vcf");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("تم تجهيز سجل العائلة", {
      description: "سيفتح جوالك الآن خيار حفظ جهات الاتصال."
    });
  } catch (err) {
    console.error("Contact sync error:", err);
    toast.error("فشل تصدير جهات الاتصال");
  }
}

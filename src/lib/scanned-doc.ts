import { Capacitor } from "@capacitor/core";

/**
 * Convert a scanner-returned path (content:// or file:// on native)
 * into a File the app can upload. Always resolves within a bounded time
 * so the UI can never hang after a successful scan.
 */
export async function scannedPathToFile(path: string, filename: string): Promise<File> {
  // Prefer converted URL on native; on web, use as-is.
  const webPath = Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(path) : path;

  const blob = await fetchBlobWithTimeout(webPath, 20000).catch(async () => {
    // Fallback to XHR (some tablets fail fetch on content:// bridged URLs)
    return await xhrBlobWithTimeout(webPath, 20000);
  });

  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

async function fetchBlobWithTimeout(url: string, ms: number): Promise<Blob> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  } finally {
    clearTimeout(t);
  }
}

function xhrBlobWithTimeout(url: string, ms: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.timeout = ms;
    xhr.onload = () => {
      if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
        resolve(xhr.response);
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("تعذر قراءة ملف الوثيقة"));
    xhr.ontimeout = () => reject(new Error("انتهت مهلة قراءة الملف"));
    try {
      xhr.open("GET", url);
      xhr.send();
    } catch (e: any) {
      reject(e);
    }
  });
}

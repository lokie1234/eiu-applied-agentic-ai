"use client";
let pickerLoading: Promise<void> | null = null;
export function loadPicker() {
  if (typeof google !== "undefined" && google.picker) return Promise.resolve();
  if (!pickerLoading) pickerLoading = new Promise<void>((resolve, reject) => {
    const init = () => gapi.load("picker", { callback: resolve, onerror: () => reject(new Error("Unable to load Google Picker.")), timeout: 15000, ontimeout: () => reject(new Error("Google Picker timed out.")) });
    if (typeof gapi !== "undefined") return init();
    const script = document.createElement("script"); script.src = "https://apis.google.com/js/api.js"; script.async = true;
    script.onload = init; script.onerror = () => reject(new Error("Unable to load Google Picker.")); document.head.appendChild(script);
  }).catch(error => { pickerLoading = null; throw error; });
  return pickerLoading;
}

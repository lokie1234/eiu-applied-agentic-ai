/** Report actual bytes sent, then wait for storage and metadata confirmation. */
export function uploadSectionFile(url: string, file: File, onProgress?: (value: number) => void): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.timeout = 120000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100));
    };
    request.onerror = () => reject(new Error("Connection failed. Please retry."));
    request.ontimeout = () => reject(new DOMException("Upload timed out", "TimeoutError"));
    request.onload = () => {
      try {
        const payload = JSON.parse(request.responseText);
        if (request.status < 200 || request.status >= 300 || !payload.success) throw new Error(payload.message || "Unable to upload section content.");
        resolve(payload);
      } catch (error) { reject(error); }
    };
    const data = new FormData();
    data.set("file", file);
    request.send(data);
  });
}

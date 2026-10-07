function removeCanvasBackground(canvas: HTMLCanvasElement, tolerance = 38): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  if (w <= 0 || h <= 0) return;

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Check corners to detect background color
  const corners = [
    0, // top-left
    (w - 1) * 4, // top-right
    ((h - 1) * w) * 4, // bottom-left
    ((h - 1) * w + (w - 1)) * 4, // bottom-right
  ];

  let transparentCorners = 0;
  for (const c of corners) {
    if (data[c + 3] < 128) transparentCorners++;
  }
  // If corners are already transparent, no background removal is needed
  if (transparentCorners >= 3) return;

  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (const c of corners) {
    if (data[c + 3] >= 128) {
      sumR += data[c];
      sumG += data[c + 1];
      sumB += data[c + 2];
      count++;
    }
  }
  if (count === 0) return;
  const bgR = Math.round(sumR / count);
  const bgG = Math.round(sumG / count);
  const bgB = Math.round(sumB / count);

  // BFS Flood Fill from perimeter
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  for (let x = 0; x < w; x++) {
    queue.push(x, 0);
    queue.push(x, h - 1);
    visited[x] = 1;
    visited[(h - 1) * w + x] = 1;
  }
  for (let y = 1; y < h - 1; y++) {
    queue.push(0, y);
    queue.push(w - 1, y);
    visited[y * w] = 1;
    visited[y * w + (w - 1)] = 1;
  }

  const softEdgeBand = 16;
  let head = 0;
  while (head < queue.length) {
    const px = queue[head++];
    const py = queue[head++];
    const idx = (py * w + px) * 4;

    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    if (a === 0) {
      const neighbors = [
        [px - 1, py],
        [px + 1, py],
        [px, py - 1],
        [px, py + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nPos = ny * w + nx;
          if (!visited[nPos]) {
            visited[nPos] = 1;
            queue.push(nx, ny);
          }
        }
      }
      continue;
    }

    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

    if (dist <= tolerance) {
      data[idx + 3] = 0;
      const neighbors = [
        [px - 1, py],
        [px + 1, py],
        [px, py - 1],
        [px, py + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nPos = ny * w + nx;
          if (!visited[nPos]) {
            visited[nPos] = 1;
            queue.push(nx, ny);
          }
        }
      }
    } else if (dist < tolerance + softEdgeBand) {
      const factor = (dist - tolerance) / softEdgeBand;
      data[idx + 3] = Math.round(data[idx + 3] * factor);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export function compressAndResizeIcon(
  file: File | Blob | string,
  maxWidth = 64,
  maxHeight = 64,
  shouldRemoveBg = true
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processSrc = (src: string) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (shouldRemoveBg) {
          try {
            removeCanvasBackground(canvas);
          } catch {
            // fallback gracefully
          }
        }

        try {
          const pngUrl = canvas.toDataURL("image/png");
          resolve(pngUrl);
        } catch {
          resolve(src);
        }
      };
      img.onerror = () => reject(new Error("Unable to decode image."));
      img.src = src;
    };

    if (typeof file === "string") {
      processSrc(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        processSrc(e.target?.result as string);
      };
      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.readAsDataURL(file);
    }
  });
}


import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const root = path.resolve("examples/eiu-advertising-starter");
const output = path.resolve("public/downloads/eiu-advertising-starter.zip");
const zip = new JSZip();
const excluded = new Set(["node_modules", ".next", ".git", "out", ".local"]);
async function add(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.startsWith(".env") || entry.name.endsWith(".log")) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await add(file);
    else if (entry.isFile()) zip.file(`eiu-advertising-starter/${path.relative(root, file).split(path.sep).join("/")}`, await fs.readFile(file), { date: new Date("2026-10-13T00:00:00Z") });
  }
}
await add(root);
const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, bytes);
console.log(`Packaged ${Object.keys(zip.files).filter(name => !zip.files[name].dir).length} source files, ${bytes.length} bytes: ${output}`);

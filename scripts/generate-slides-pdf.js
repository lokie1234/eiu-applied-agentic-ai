/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const downloadsDir = path.resolve(__dirname, '../public/downloads');
const port = 3099;

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

async function waitUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  console.log('--- Starting Slides PDF Generation ---');
  
  if (!fs.existsSync(edgePath)) {
    throw new Error(`Edge executable not found at: ${edgePath}`);
  }

  // Check if server is already running on port 3099 or 3000
  let serverProcess = null;
  let baseUrl = `http://127.0.0.1:${port}`;

  let running = false;
  try {
    const res = await fetch(`http://127.0.0.1:3000/export-deck?section=section1`);
    if (res.ok) {
      baseUrl = 'http://127.0.0.1:3000';
      running = true;
      console.log('Using active server at http://127.0.0.1:3000');
    }
  } catch {
    // not running on 3000
  }

  if (!running) {
    console.log(`Starting Next.js server on port ${port}...`);
    const isWindows = process.platform === 'win32';
    const nextCmd = isWindows ? 'npx.cmd' : 'npx';
    serverProcess = spawn(nextCmd, ['next', 'start', '-p', String(port)], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (d) => process.stdout.write(`[Next] ${d}`));
    serverProcess.stderr.on('data', (d) => process.stderr.write(`[Next err] ${d}`));

    console.log(`Waiting for server at ${baseUrl}...`);
    await waitUrl(`${baseUrl}/export-deck?section=section1`, 25000);
    console.log('Server is ready!');
  }

  try {
    // 1. Generate Section 1 PDF
    const s1Pdf = path.join(downloadsDir, 'eiu-applied-agentic-ai-section-1-slides.pdf');
    const s1Url = `${baseUrl}/export-deck?section=section1`;
    console.log(`Generating Section 1 Slides PDF from ${s1Url}...`);
    const s1Cmd = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${s1Pdf}" "${s1Url}"`;
    execSync(s1Cmd, { stdio: 'inherit' });
    console.log(`✓ Section 1 PDF generated successfully: ${s1Pdf} (${(fs.statSync(s1Pdf).size / 1024 / 1024).toFixed(2)} MB)`);

    // 2. Generate Section 2 PDF
    const s2Pdf = path.join(downloadsDir, 'eiu-applied-agentic-ai-section-2-slides.pdf');
    const s2Url = `${baseUrl}/export-deck?section=section2`;
    console.log(`Generating Section 2 Slides PDF from ${s2Url}...`);
    const s2Cmd = `"${edgePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${s2Pdf}" "${s2Url}"`;
    execSync(s2Cmd, { stdio: 'inherit' });
    console.log(`✓ Section 2 PDF generated successfully: ${s2Pdf} (${(fs.statSync(s2Pdf).size / 1024 / 1024).toFixed(2)} MB)`);

    console.log('--- All Slides PDFs generated successfully! ---');
  } finally {
    if (serverProcess) {
      console.log('Shutting down temporary server...');
      serverProcess.kill('SIGTERM');
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /pid ${serverProcess.pid} /T /F`);
        } catch {
          // ignore
        }
      }
    }
  }
}

main().catch((err) => {
  console.error('Error generating slides PDF:', err);
  process.exit(1);
});


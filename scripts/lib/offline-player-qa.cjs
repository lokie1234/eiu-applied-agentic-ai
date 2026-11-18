const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function browserOptions() {
  let executablePath = process.env.CHROMIUM_PATH;
  if (!executablePath && process.platform === 'win32') {
    const chrome = path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe');
    if (fs.existsSync(chrome)) executablePath = chrome;
  }
  return { headless: true, ...(executablePath ? { executablePath } : {}) };
}

async function createOfflinePlayer(page, code, template) {
  const runtime = {};
  vm.runInNewContext(fs.readFileSync('tests/fixtures/windows-player-1.2.1-runtime.js.txt', 'utf8'), runtime);
  if (template === undefined) template = 'data:image/png;base64,' + fs.readFileSync('public/templates/eiu-business-v1/background.png').toString('base64');
  await page.setContent('<style>html,body{margin:0;overflow:hidden}iframe{display:block;width:100vw;height:100vh;border:0}</style><iframe name="lesson" sandbox="allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox"></iframe>');
  await page.evaluate(({ doc, code, template }) => new Promise((resolve, reject) => {
    const frame = document.querySelector('iframe');
    const timer = setTimeout(() => reject(Error('Offline lesson did not render within 15 seconds.')), 15000);
    frame.onload = () => {
      const channel = new MessageChannel();
      window.port = channel.port1;
      window.messages = [];
      channel.port1.onmessage = event => {
        window.messages.push(event.data);
        if (event.data.type === 'shown') { clearTimeout(timer); resolve(); }
        if (event.data.type.endsWith('error')) { clearTimeout(timer); reject(Error(event.data.message)); }
      };
      channel.port1.start();
      frame.contentWindow.postMessage({ type: 'eiu-connect' }, '*', [channel.port2]);
      channel.port1.postMessage({ type: 'init', code, template, useTemplate: true, sequence: 1 });
    };
    frame.srcdoc = doc;
  }), { doc: runtime.createLessonDocument(), code, template });
  let sequence = 1;
  return {
    frame: page.frame({ name: 'lesson' }),
    total: await page.evaluate(() => window.messages.find(message => message.type === 'loaded').total),
    async show(number) {
      sequence++;
      await page.evaluate(({ number, sequence }) => window.port.postMessage({ type: 'show', page: number, sequence }), { number, sequence });
      await page.waitForFunction(sequence => window.messages.some(message => message.type === 'shown' && message.sequence === sequence), sequence);
    },
  };
}
module.exports = { browserOptions, createOfflinePlayer };

// Bundle the original interactive components, keeping the established filenames.
// No running website or browser is needed to build these offline exports.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const mime = {'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.pdf':'application/pdf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.zip':'application/zip','.txt':'text/plain;charset=utf-8','.md':'text/plain;charset=utf-8'};
function embeddedFile(file) {
  return `data:${mime[path.extname(file).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`;
}
async function buildSection(section, options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot || root);
  const outputDir = path.resolve(options.outputDir || path.join(root,'lib/drive/builtin-decks'));
  const emergencyRoute=fs.readFileSync(path.join(sourceRoot,'app/api/emergency-download/route.ts'),'utf8');
  const emergencyName=emergencyRoute.match(/config:\s*\{\s*source:\s*["']([a-zA-Z0-9_.-]+)["']/)?.[1];
  if(!emergencyName) throw Error('Cannot resolve the original Emergency download');
  const assets = new Set();
  const publicFile = value => {
    const file = path.resolve(sourceRoot, 'public', '.' + value);
    if (!file.startsWith(path.join(sourceRoot, 'public') + path.sep)) throw Error('Invalid asset path: ' + value);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw Error('Missing offline asset: ' + value);
    assets.add(value);
    return file;
  };
  const result = await esbuild.build({
    stdin: {
      contents: section === 1 ? `
        import Native from './components/section1/SectionOneNativeSlide';
        import Html from './components/section1/SectionOneHtmlSlide';
        import Models from './components/section1/SectionOneSlide14';
        import {buildSectionOneDeckItems} from './lib/builtinDeckItems';
        ${options.coverSource ? `import Cover from ${JSON.stringify(path.resolve(options.coverSource).replaceAll('\\','/'))};` : ''}
        ${options.orientationSource ? `import Orientation from ${JSON.stringify(path.resolve(options.orientationSource).replaceAll('\\','/'))};` : ''}
        ${options.ideasSource ? `import Ideas from ${JSON.stringify(path.resolve(options.ideasSource).replaceAll('\\','/'))};` : ''}
        ${options.submissionSource ? `import Submission from ${JSON.stringify(path.resolve(options.submissionSource).replaceAll('\\','/'))};` : ''}
        import {createOfflineSlides} from ${JSON.stringify(path.join(root,'course-content/applied-agentic-ai/offline/runtime').replaceAll('\\','/'))};
        const items=buildSectionOneDeckItems(false).filter(item=>item.kind!=='quiz'&&item.kind!=='showcase'&&!(item.kind==='html'&&['slide4','idea-results'].includes(item.slide)));
        const renderers=items.map(item=>()=>item.kind==='native'?${options.coverSource ? 'item.pdfPage===1?<Cover/>:' : ''}${options.ideasSource ? 'item.pdfPage===5?<Ideas/>:' : ''}<Native page={item.pdfPage} scale={1}/>:item.kind==='slide14'?<Models scale={1}/>:${options.orientationSource ? "item.slide==='slide3'?<Orientation/>:" : ''}<Html kind={item.slide} scale={1} isAdmin={false}/>);
        ${options.submissionSource ? 'renderers.splice(4,0,()=> <Submission/>);' : ''}
        export default createOfflineSlides(renderers);
      ` : `
        import Content from './components/section2/SectionTwoSlide';
        import {sectionTwoDeckItems} from './lib/builtinDeckItems';
        import {createOfflineSlides} from ${JSON.stringify(path.join(root,'course-content/applied-agentic-ai/offline/runtime').replaceAll('\\','/'))};
        export default createOfflineSlides(sectionTwoDeckItems.filter(item=>item.kind==='content').map(item=>()=> <Content pageNumber={item.page}/>));
      `,
      resolveDir: sourceRoot, sourcefile: 'offline-entry.tsx', loader: 'tsx',
    },
    absWorkingDir: sourceRoot, bundle: true, write: false, outdir: 'out',
    platform: 'browser', format: 'cjs', target: 'es2020', minify: true,
    jsx: 'automatic', define: {'process.env.NODE_ENV':'"production"'},
    legalComments: 'eof', metafile: true,
    plugins: [{name:'offline-assets', setup(build) {
      build.onResolve({filter:/^next\/image$/},()=>({path:path.join(root,'course-content/applied-agentic-ai/offline/Image.tsx')}));
      build.onResolve({filter:/app\/globals\.css$/},()=>({path:path.join(sourceRoot,'app/globals.css')}));
      build.onResolve({filter:/^@\/lib\/slideStorage$/},()=>({path:path.join(root,'course-content/applied-agentic-ai/offline/slideStorage.ts')}));
      build.onResolve({filter:/^eiu:emergency$/},()=>({path:'emergency',namespace:'embedded'}));
      build.onLoad({filter:/.*/,namespace:'embedded'},()=>({contents:`export default ${JSON.stringify({bytes:fs.readFileSync(path.join(sourceRoot,'assets/emergency',emergencyName)).toString('base64'),mime:mime[path.extname(emergencyName)]||'application/octet-stream'})}`,loader:'js'}));
      build.onLoad({filter:/\.(?:tsx?|css|tsx\.txt)$/},args=>{
        if(args.path.includes(path.sep+'node_modules'+path.sep)) return;
        if(args.path.startsWith(path.join(root,'course-content/applied-agentic-ai/offline')+path.sep)) return;
        if(args.path.endsWith('.css')) {
          const contents=fs.readFileSync(args.path,'utf8').replace(/url\(\s*['"]?(\/[^)'"\s]+)['"]?\s*\)/g,(_,url)=>`url("${embeddedFile(publicFile(url))}")`);
          return {contents,loader:args.path.endsWith('.module.css')?'local-css':'css',resolveDir:path.dirname(args.path)};
        }
        let source=fs.readFileSync(args.path,'utf8');
        if(args.path.endsWith('SectionTwoSlide.tsx')) {
          // Keep the original closing-slide composition and local LIVE DEMOs,
          // but never collect another identity or pretend to submit a voucher.
          source=source.replace(/function VoucherSignup\([\s\S]*?(?=\nfunction |\nexport default function )/,`function VoucherSignup({onClose}: {onClose:()=>void}) {
            return <div className={styles.voucherModal} data-interactive="true" role="dialog" aria-label="Đăng ký nhận voucher"><div className={styles.voucherCard}>
              <button type="button" className={styles.bihClose} onClick={onClose} aria-label="Đóng">×</button>
              <MiniTitle>Agentic AI 2</MiniTitle><h2>Đăng ký trên bản web</h2>
              <p>Đăng ký nhận voucher cần hệ thống trực tuyến. Bản offline không thu thập hoặc gửi thông tin đăng ký.</p>
              <button type="button" className={styles.voucherSubmit} onClick={onClose}>Đóng</button>
            </div></div>;
          }\n`);
        }
        const isHtml=args.path.endsWith('SectionOneHtmlSlide.tsx');
        let needsCopy=false,needsFetch=false,needsForm=false;
        source=source.replace(/(?:window\.)?navigator\.clipboard\.writeText/g,()=>{needsCopy=true;return 'offlineCopy';});
        if(args.path.endsWith('SlideTwentyEightEmergency.tsx')) {
          source=source.replace(/\bfetch\(/g,'offlineEmergencyFetch(').replaceAll('/api/emergency-download','eiu:emergency');needsFetch=true;
        }
        source=source.replace(/href="(\/downloads\/[^\"]+)" download(?=\s|>)/g,(_,url)=>`href="${url}" download="${path.basename(url)}"`);
        const isTsx = args.path.endsWith('.tsx') || args.path.endsWith('.tsx.txt');
        const parsed=ts.createSourceFile(args.path,source,ts.ScriptTarget.Latest,true,isTsx?ts.ScriptKind.TSX:ts.ScriptKind.TS);
        const transformed=ts.transform(parsed,[context=>{
          const visit=node=>{
            // The existing Windows sandbox omits allow-forms. Keep native form
            // styling/validation but dispatch local submissions in JavaScript.
            if(ts.isJsxOpeningElement(node) && node.tagName.getText(parsed)==='form') {
              needsForm=true;
              return ts.factory.updateJsxOpeningElement(node,ts.factory.createIdentifier('OfflineForm'),node.typeArguments,ts.visitEachChild(node.attributes,visit,context));
            }
            if(ts.isJsxClosingElement(node) && node.tagName.getText(parsed)==='form') return ts.factory.updateJsxClosingElement(node,ts.factory.createIdentifier('OfflineForm'));
            // Online-only widgets are excluded from the list and the bundle.
            if(isHtml && ts.isFunctionDeclaration(node) && ['SlideFour','IdeaResults'].includes(node.name?.text)) return undefined;
            if(isHtml && ts.isJsxExpression(node) && /kind === "(?:slide4|idea-results)"/.test(node.getText(parsed))) return undefined;
            if(isHtml && ts.isImportDeclaration(node) && ['@/lib/supabase/browser','@/lib/liveRefresh'].includes(node.moduleSpecifier.text)) return undefined;
            if(ts.isStringLiteral(node) && /^\/(?:branding|downloads|images|slides|fonts|templates)\//.test(node.text)) return ts.factory.createStringLiteral(embeddedFile(publicFile(node.text)));
            return ts.visitEachChild(node,visit,context);
          };
          return node=>ts.visitNode(node,visit);
        }]);
        let contents=ts.createPrinter().printFile(transformed.transformed[0]);transformed.dispose();
        const helpers=[needsCopy?'offlineCopy':null,needsFetch?'offlineEmergencyFetch':null].filter(Boolean);
        if(helpers.length) contents=`import {${helpers.join(',')}} from ${JSON.stringify(path.join(root,'course-content/applied-agentic-ai/offline/browser').replaceAll('\\','/'))};\n`+contents;
        if(needsForm) contents=`import OfflineForm from ${JSON.stringify(path.join(root,'course-content/applied-agentic-ai/offline/Form').replaceAll('\\','/'))};\n`+contents;
        return {contents,loader:isTsx?'tsx':'ts',resolveDir:path.dirname(args.path)};
      });
    }}],
  });
  const js=result.outputFiles.find(file=>file.path.endsWith('.js')).text;
  const css=result.outputFiles.find(file=>file.path.endsWith('.css'))?.text || '';
  const license=fs.readFileSync(path.join(path.dirname(require.resolve('react/package.json')),'LICENSE'),'utf8');
  const body=`// Applied Agentic AI — Section ${section}. Offline interactive export.\n// Generated from the original components and CSS by scripts/generate-builtin-tsx.cjs.\n/* Bundled React / React DOM license:\n${license}*/\nconst offlineCss=${JSON.stringify(css)};\n${js}\nconst offlineFactories=module.exports.default;\nmodule.exports={default:offlineFactories.map(factory=>()=>factory(offlineCss))};\nexports.default=module.exports.default;\n`;
  fs.mkdirSync(outputDir,{recursive:true});
  fs.writeFileSync(path.join(outputDir,`section${section}.js`),body);
  console.log(`Section ${section}: ${Buffer.byteLength(body)} bytes, ${assets.size} embedded public assets`);
  return {section,bytes:Buffer.byteLength(body),emergencyDownload:emergencyName,assets:[...assets].sort(),inputs:Object.keys(result.metafile.inputs).sort()};
}
if(require.main===module) (async()=>{
  const builds=[];
  for(const section of [1,2]) builds.push(await buildSection(section));
  fs.writeFileSync(path.join(root,'course-content/applied-agentic-ai/offline/manifest.json'),JSON.stringify(builds,null,2)+'\n');
})().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={buildSection};

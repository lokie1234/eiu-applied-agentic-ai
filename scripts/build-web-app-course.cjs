const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve('course-content/web-app-development');
const course = JSON.parse(fs.readFileSync(path.join(root,'storyboard.json'),'utf8'));
const assets = JSON.parse(fs.readFileSync(process.env.COURSE_ASSETS || 'course-content/web-app-development/assets.json','utf8'));
const renderer = fs.readFileSync(path.join(root,'renderer.tsx.txt'),'utf8');
const selected = process.argv[2];
if (selected && !['1','2'].includes(selected)) throw new Error('Choose section 1 or 2.');
for (const [name,filter] of [['Section1.tsx',1],['Section2.tsx',2]]) {
 if (selected && Number(selected) !== filter) continue;
 const section = { title: course.title, summary: course.summary, slides: course.slides.filter(s=>s.section===filter) };
 const source = renderer.replace('// __COURSE_DATA__',`// Nội dung phần ${filter}: chỉnh các slide trong mảng bên dưới.\nconst course: { title: string; summary: string; slides: SlideData[] } = ${JSON.stringify(section,null,2)};\nconst assets: Record<string,string> = ${JSON.stringify(assets,null,2)};`);
 fs.writeFileSync(path.join(root,name),source);
 console.log(name,section.slides.length,'slides',Buffer.byteLength(source),'bytes');
}

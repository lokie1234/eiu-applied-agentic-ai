// Browser QA against the exact sandbox/runtime from Windows player 1.2.1.
// Set PLAYWRIGHT_MODULE and optionally CHROMIUM_PATH when installed externally.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {browserOptions,createOfflinePlayer}=require('./lib/offline-player-qa.cjs');
const out=path.resolve(process.env.OFFLINE_QA_OUTPUT || '.tmp/builtin-offline-qa');
const deckDir=path.resolve(process.env.OFFLINE_DECK_DIR || 'lib/drive/builtin-decks');
const assetRoot=path.resolve(process.env.OFFLINE_ASSET_ROOT || '.');
const expectedCounts=(process.env.OFFLINE_EXPECTED_COUNTS || '38,37').split(',').map(Number);

async function main() {
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch(browserOptions());
  const report=[];
  try {
    for(const section of [1,2]) {
      const context=await browser.newContext({viewport:{width:960,height:540},acceptDownloads:true,offline:true});
      try {
        const page=await context.newPage(),errors=[],requests=[],downloads=[];
        page.setDefaultTimeout(8000);
        page.on('pageerror',error=>errors.push(error.message));
        page.on('request',request=>{if(/^https?:/.test(request.url())) requests.push(request.url());});
        const {frame,total,show}=await createOfflinePlayer(page,fs.readFileSync(path.join(deckDir,`section${section}.js`),'utf8'));
        assert.equal(total,expectedCounts[section-1]);
        for(let n=1;n<=total;n++) {
          await show(n);
          if(section===2 && total===39 && n===37) await frame.getByText('Còn một điều nữa',{exact:false}).waitFor();
          else await frame.locator('h1,h2').first().waitFor({state:'attached'});
          await frame.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
          assert.equal(await frame.locator('input[type=email]').count(),0);
          if(n%10===0) console.log(`Section ${section}: rendered ${n}/${total}`);
        }
        const download=async(trigger,original,name)=>{
          const pending=page.waitForEvent('download');await trigger();const file=await pending;
          assert.equal(file.suggestedFilename(),name);
          assert.deepEqual(fs.readFileSync(await file.path()),fs.readFileSync(path.join(assetRoot,original)));
          downloads.push(name);
          console.log(`Verified download: ${name}`);
        };
        if(section===1) {
          const showS1=number=>show(number+(total===39&&number>=4?1:0));
          console.log('Checking section 1 interactions');
          await showS1(8);await frame.getByRole('button',{name:/Database/}).click();
          await frame.getByText('Nơi cất giữ dữ liệu',{exact:false}).waitFor();
          await showS1(9);await frame.getByRole('button',{name:/Business Logic/}).click();
          await frame.getByRole('dialog').waitFor();await frame.getByRole('button',{name:/Close/}).click();
          await showS1(10);await frame.getByRole('button',{name:/Thực trạng/}).click();
          await frame.getByRole('button',{name:/Xem lớn ảnh 1/}).waitFor();
          assert.equal(await frame.getByRole('dialog').locator('img').count(),4);
          await frame.getByRole('button',{name:/Xem lớn ảnh 1/}).click();
          await frame.getByRole('button',{name:'Ảnh tiếp theo'}).click();
          await frame.getByText('2 / 4',{exact:true}).waitFor();
          await frame.getByRole('button',{name:'Đóng Thực trạng'}).click();
          await showS1(6);await frame.getByRole('button',{name:'Hiển thị 8 bước'}).click();
          await frame.getByRole('button',{name:'Đã hiện đầy đủ 8 bước'}).waitFor({timeout:15000});
          console.log('Architecture, gallery and eight-step animation passed');
          await showS1(33);
          await download(()=>frame.locator('a[download="design-dna.txt"]').click({force:true}),'public/downloads/design-dna.txt','design-dna.txt');
          await showS1(38);
          await download(()=>frame.locator('a[download="Sales-Data-2025.xlsx"]').click({force:true}),'public/downloads/Sales-Data-2025.xlsx','Sales-Data-2025.xlsx');
          if(await frame.getByRole('button',{name:/Emergency/}).count()) {
            await frame.getByRole('button',{name:/Emergency/}).click();
            await frame.getByRole('button',{name:'Sao chép Code.gs'}).click();
            await frame.getByRole('status').getByText('Đã sao chép Code.gs',{exact:true}).waitFor();
            await frame.getByRole('button',{name:'Đóng Emergency'}).click();
          } else {
            await frame.getByRole('button',{name:/Copy prompt/i}).click({force:true});
            await frame.getByRole('button',{name:/Đã sao chép prompt/}).waitFor();
          }
          const link=frame.locator('a[href^="https://docs.google.com/spreadsheets/"]');
          assert.match(await link.getAttribute('href'),/^https:\/\/docs.google.com\//);
          const popupPromise=page.waitForEvent('popup');await link.click({force:true});const popup=await popupPromise;
          await popup.close();
          await showS1(8);await page.waitForTimeout(1200);
        } else {
          await show(14);
          await frame.locator('select[required]').selectOption('ưu tiên');
          await frame.getByRole('button',{name:'Submit báo cáo'}).click();
          await frame.getByRole('button',{name:'Duyệt',exact:true}).click();
          await frame.getByRole('button',{name:'Hoàn thành',exact:true}).click();
          await frame.locator('tbody').getByText('Đã hoàn thành',{exact:true}).waitFor();
          assert.equal(await frame.getByRole('button',{name:'Hoàn thành',exact:true}).count(),0);
          await page.waitForTimeout(250);
          await page.screenshot({path:path.join(out,'section2-workflow.png')});
          await show(22);await frame.getByRole('button',{name:'kebab-case',exact:true}).click();
          await frame.getByRole('dialog').waitFor();await frame.getByRole('button',{name:/Close/}).click();
          await show(28);
          const collected=[];const listener=file=>collected.push(file);page.on('download',listener);
          await frame.getByRole('button',{name:/Tải bộ 3 file thực hành/}).click();
          for(let n=0;n<50&&collected.length<3;n++)await page.waitForTimeout(100);
          page.off('download',listener);assert.equal(collected.length,3);
          for(const file of collected) {
            const name=file.suggestedFilename();
            assert.deepEqual(fs.readFileSync(await file.path()),fs.readFileSync(path.join(assetRoot,'public/downloads',name)));downloads.push(name);
          }
          const emergencyName=fs.readFileSync(path.join(assetRoot,'app/api/emergency-download/route.ts'),'utf8').match(/config:\s*\{\s*source:\s*["']([a-zA-Z0-9_.-]+)["']/)[1];
          await frame.getByRole('button',{name:/Emergency|Skill hoàn thiện/}).click();
          await download(()=>frame.getByRole('dialog').getByRole('button',{name:new RegExp(emergencyName.replaceAll('.','\\.'))}).click(),'assets/emergency/'+emergencyName,emergencyName);
          await frame.getByRole('button',{name:'Đóng',exact:true}).click();
          await frame.getByRole('button',{name:'Copy Prompt',exact:true}).click();
          await frame.getByRole('button',{name:'Đã copy',exact:true}).waitFor();
          if(total===39) {
            await show(39);
            for(const index of [0,1]) {
              await frame.getByRole('button',{name:/LIVE DEMO/}).nth(index).click();
              const dialog=frame.getByRole('dialog');await dialog.waitFor();
              await dialog.getByRole('button',{name:'Tạm dừng',exact:true}).click();
              assert.equal(await dialog.getAttribute('data-paused'),'true');
              await dialog.getByRole('button',{name:'Phát',exact:true}).click();
              await frame.locator('[role=dialog][data-paused=true]').waitFor({timeout:90000});
              if(index===0) await dialog.getByText('Đã sửa nút',{exact:false}).waitFor();
              await page.screenshot({path:path.join(out,`live-demo-${index}.png`)});
              await dialog.getByRole('button',{name:'Phát lại',exact:true}).click();
              assert.notEqual(await dialog.getAttribute('data-paused'),'true');
              await dialog.getByRole('button',{name:'Đóng demo',exact:true}).click();
              console.log(`LIVE DEMO ${index+1}: full playback, pause/resume and replay passed`);
            }
            await frame.getByRole('button',{name:'ĐĂNG KÝ NHẬN VOUCHER',exact:true}).click();
            await frame.getByText('Đăng ký trên bản web',{exact:true}).waitFor();
            assert.equal(await frame.locator('input[type=email]').count(),0);
            await frame.getByRole('dialog').getByRole('button',{name:'Đóng',exact:true}).last().click();
          }
        }
        await page.waitForTimeout(250);
        await page.screenshot({path:path.join(out,`section${section}.png`)});
        assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
        const messages=await page.evaluate(()=>window.messages);
        assert.ok(messages.filter(message=>message.type==='shown').every(message=>message.evaluations===1&&message.cacheSize<=6));
        report.push({section,slides:total,downloads,errors,requests});
        console.log(`Section ${section}: ${total} slides, interactive checks passed, ${downloads.length} downloads verified byte-for-byte, no network requests`);
      } finally {await context.close();}
    }
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

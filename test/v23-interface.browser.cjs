'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(process.env.DOCUMENT_STUDIO_DIST || path.join(__dirname, '../dist'));
const types = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.woff2':'font/woff2'};
const colors = {light:'rgb(255, 255, 255)', dark:'rgb(16, 16, 16)', original:'rgb(36, 21, 56)'};
const supportUrl = 'https://ko-fi.com/forbidden_fantasy';

function serve(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
  const stream = fs.createReadStream(file);
  stream.on('error', () => response.writeHead(404).end());
  stream.on('open', () => {response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); stream.pipe(response);});
}

async function checkLayout(frame) {
  const errors = await frame.evaluate(() => {
    const issues = [];
    const visible = node => node.getBoundingClientRect().width && node.getBoundingClientRect().height;
    const buttons = [...document.querySelectorAll('#titlebar button,#desktop-support,#titlebar input:not([hidden]),#statusbar button,#statusbar .pill,#desktop-credit,#desktop-status')].filter(visible);
    for (const [i, first] of buttons.entries()) {
      const a = first.getBoundingClientRect();
      for (const second of buttons.slice(i+1)) {
        const b = second.getBoundingClientRect();
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)
          issues.push(first.textContent + ' overlaps ' + second.textContent);
      }
    }
    const support = document.getElementById('desktop-support').getBoundingClientRect();
    const credit = document.getElementById('desktop-credit').getBoundingClientRect();
    if (credit.right > support.left)
      issues.push('Creator credit overlaps the support link');
    if (innerWidth - support.right > 20 || innerHeight - support.bottom > 28 || support.bottom > innerHeight)
      issues.push('Support link is outside the bottom-right corner');
    const theme = document.getElementById('theme-buttons').getBoundingClientRect();
    const launcher = document.getElementById('btn-commands').getBoundingClientRect();
    if (innerWidth - launcher.right > 20 || theme.top > 60 || launcher.left < theme.right || Math.abs(theme.top-launcher.top) > 5)
      issues.push('Commands misplaced relative to themes');
    return issues;
  });
  assert.deepEqual(errors, []);
}

(async () => {
  const server = http.createServer(serve);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser, savedTheme;
  let supportOpens = 0;
  try {
    browser = await chromium.launch({headless:true,executablePath:process.env.DOCUMENT_STUDIO_BROWSER,channel:process.env.DOCUMENT_STUDIO_BROWSER_CHANNEL, args:['--no-sandbox']});
    async function launch() {
      const context = await browser.newContext({viewport:{width:1280, height:850},colorScheme:'light'});
      await context.exposeFunction('nativeInvoke', async (command, params) => {
        if (command === 'open_support_page') {supportOpens++; return null;}
        if (command !== 'desktop_command') return null;
        switch (params.method) {
          case 'init': return {settings:{autosave:false, theme:savedTheme}, startup:false, recoveryAvailable:false};
          case 'settings':
            if (params.args[0].theme) savedTheme = params.args[0].theme;
            return {theme:savedTheme};
          case 'fonts': case 'recent': case 'recoveries': return [];
          case 'dictionaries': return {active:'en-US', items:[{id:'en-US',label:'English'}]};
          default: return null;
        }
      });
      await context.addInitScript(() => {
        if (location.pathname.endsWith('editor.html')) {
          localStorage.setItem('fte-pro-preferences', JSON.stringify({
            quick:['2D Design','Focus mode','Desktop help'], favorites:['3D Design'], recent:['Focus mode'],
            keys:{'2D Design':'Alt+9','Focus mode':'Alt+8'}
          }));
        }
        window.__TAURI_INTERNALS__ = {transformCallback:()=>1,invoke:async(command, params)=>{
          if(command === 'show_main')
            window.themeAtReveal = document.querySelector('iframe').contentDocument.documentElement.dataset.appTheme;
          return window.nativeInvoke(command,params);
        }};
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.waitForFunction(() => window.themeAtReveal);
      const frame = page.frames().find(f => f.url().endsWith('/editor.html'));
      await frame.waitForFunction(() => window.FTEDesktop && window.FTEPro);
      return {context,page,frame,errors};
    }

    let {context,page,frame,errors} = await launch();
    assert.equal(await page.evaluate(() => window.themeAtReveal),'light');
    const themes = frame.locator('#theme-buttons');
    assert.deepEqual(await themes.locator('button').allTextContents(),['System','Light','Dark','Purple']);
    assert.equal(await themes.locator('button[aria-pressed=true]').innerText(),'System');
    await page.emulateMedia({colorScheme:'dark'});
    await page.waitForFunction(()=>document.documentElement.dataset.appTheme==='dark');
    for (const name of ['Teachers', '2D Design', '3D Design']) {
      assert.equal(await frame.locator('#tabs').getByRole('button',{name,exact:true}).count(),0);
    }
    assert.equal(await frame.getByRole('button',{name:'Check for updates',exact:true}).count(),0);
    const support = frame.getByRole('link',{name:'Support Me',exact:true});
    assert.equal(await support.count(),1);
    assert.equal(await support.getAttribute('href'),supportUrl);
    await support.locator('img').evaluate(img=>img.decode());
    await support.focus();
    await frame.page().keyboard.press('Enter');
    await page.waitForTimeout(100);
    assert.equal(supportOpens,1);
    const initialPaper = await frame.locator('.sheet').first().evaluate(el=>getComputedStyle(el).backgroundColor);
    for (const [name, key] of [['Light','light'],['Dark','dark'],['Purple','original']]) {
      await themes.getByRole('button',{name,exact:true}).click();
      await page.waitForFunction(key=>document.documentElement.dataset.appTheme===key,key);
      assert.equal(await themes.locator('button[aria-pressed=true]').innerText(),name);
      assert.equal(await frame.locator('#titlebar').evaluate(el=>getComputedStyle(el).backgroundColor),colors[key]);
      assert.equal(await frame.locator('.sheet').first().evaluate(el=>getComputedStyle(el).backgroundColor),initialPaper);
      for (const width of [1280,900,640]) {
        await page.setViewportSize({width,height:650});
        await checkLayout(frame);
      }
      await frame.locator('#tabs').getByRole('button',{name:'Home',exact:true}).click();
      const print = page.evaluate(()=>window.documentStudioDesktop.print());
      await page.getByRole('heading',{name:'Print document'}).waitFor();
      const dialogColor = await page.locator('dialog').evaluate(el=>getComputedStyle(el).backgroundColor);
      assert.equal(dialogColor,key==='original'?'rgb(33, 24, 46)':colors[key]);
      await page.getByRole('button',{name:'Cancel',exact:true}).click();
      assert.equal(await print,false);
    }
    await themes.getByRole('button',{name:'Dark',exact:true}).click();
    await page.waitForTimeout(100);
    assert.equal(savedTheme,'dark');
    await require('./ribbon-controls.cjs')(page, frame);
    assert.deepEqual(errors, []);
    await context.close();
    ({context,page,frame,errors} = await launch());
    assert.equal(await page.evaluate(()=>window.themeAtReveal),'dark');
    assert.equal(await frame.locator('#theme-buttons [aria-pressed=true]').innerText(),'Dark');
    for (const name of ['Focus mode','Exit focus','Help','How to use','Desktop help']) {
      assert.equal(await frame.getByRole('button',{name,exact:true,includeHidden:true}).count(),0);
    }
    assert.equal(await frame.locator('#viewbar button:not(#zoom-in,#zoom-out)').count(),0);
    assert.equal(await frame.locator('#pro-quick button').count(),0);
    await frame.locator('#pages-container').focus();
    await page.keyboard.press('Alt+8');
    assert.equal(await frame.locator('body').evaluate(el=>el.classList.contains('focus')),false);
    await page.keyboard.press('Control+Shift+p');
    const menu=frame.getByRole('menu',{name:'Commands'});
    await menu.waitFor();
    const names=['Keyboard shortcuts','Interface settings','Typing preferences','Appearance','About Document Studio Light'];
    assert.deepEqual(await menu.getByRole('menuitem').allTextContents(),names);
    assert.equal(await frame.evaluate(()=>document.activeElement.textContent),'Keyboard shortcuts');
    await page.keyboard.press('End');
    assert.equal(await frame.evaluate(()=>document.activeElement.textContent),'About Document Studio Light');
    await page.keyboard.press('Escape');
    assert.equal(await frame.evaluate(()=>document.activeElement.id),'btn-commands');
    await frame.locator('#btn-commands').click();
    await frame.locator('#doc-name').click();
    assert.equal(await menu.isVisible(),false);
    for (const name of names) {
      await frame.locator('#btn-commands').click();
      await menu.getByRole('menuitem',{name,exact:true}).click();
      await frame.getByRole('heading',{name,exact:true}).waitFor();
      if (name==='Keyboard shortcuts') {
        const search=frame.getByRole('searchbox',{name:'Search shortcuts'});
        for (const stale of ['2D Design','3D Design','Focus mode','Desktop help','Teachers']) {
          await search.fill(stale);
          assert.equal(await frame.locator('#pro-key-list').innerText(),'No matching shortcuts.');
        }
        await search.fill('Interface settings');
        const assignment=frame.getByRole('textbox',{name:'Interface settings',exact:true});
        await assignment.focus();
        await page.keyboard.press('Control+p');
        assert.equal(await frame.locator('#pro-key-message').innerText(),'This shortcut is reserved.');
        assert.equal(await assignment.inputValue(),'');
        await page.keyboard.press('Alt+9');
        assert.equal(await assignment.inputValue(),'Alt+9');
      }
      if (name==='About Document Studio Light') break;
      await frame.getByRole('button',{name:'Close',exact:true}).click();
    }
    await frame.getByText('License and notice',{exact:true}).click();
    const license = await frame.locator('#app-license-text').innerText();
    assert.match(license,/Copyright \(C\) 2026 Forbidden_Fantasy/);
    assert.match(license,/GNU AFFERO GENERAL PUBLIC LICENSE/);
    await frame.getByRole('button',{name:'Close',exact:true}).click();
    await page.keyboard.press('Alt+9');
    await frame.getByRole('heading',{name:'Interface settings',exact:true}).waitFor();
    await frame.getByRole('button',{name:'Close',exact:true}).click();
    await page.keyboard.press('F1');
    await frame.getByRole('textbox',{name:'Search help'}).fill('focus mode');
    assert.equal(await frame.locator('#pro-help-articles').innerText(),'');
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS header commands, customized shortcuts, retired actions, appearance persistence, print settings, responsive layout, license and notice.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error); process.exitCode=1;});

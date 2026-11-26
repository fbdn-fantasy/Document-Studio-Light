'use strict';
const assert = require('node:assert/strict');

module.exports = async function checkRibbon(page, frame) {
  const tabs = frame.locator('#tabs button');
  assert.deepEqual(await tabs.allTextContents(), ['File','Home','Insert','Design','Layout','References','Review','Tools','View','Writing']);
  const openTab = name => frame.locator('#tabs').getByRole('button', {name, exact:true}).click();
  const visible = frame.locator('.ds-ribbon:visible');

  for (const width of [1280, 640]) {
    await page.setViewportSize({width, height:800});
    for (const name of await tabs.allTextContents()) {
      await openTab(name);
      await visible.waitFor();
      const problems = await visible.evaluate(ribbon => {
        const issues = [];
        const buttons = [...ribbon.querySelectorAll('button')];
        const artwork = new Map();
        for (const svg of ribbon.querySelectorAll('.ds-ribbon-action svg,.ds-ribbon-color svg')) {
          const tool = svg.parentElement.dataset.ribbonHint;
          if (!svg.dataset.artwork || svg.dataset.artwork === 'extension') issues.push('Missing artwork: ' + tool);
          if (artwork.has(svg.innerHTML)) issues.push('Duplicate artwork: ' + tool + ' and ' + artwork.get(svg.innerHTML));
          artwork.set(svg.innerHTML, tool);
        }
        if (!buttons.length) issues.push('No buttons in tab');
        for (const b of buttons) {
          const label = b.getAttribute('aria-label'), svg = b.querySelector('svg');
          if (!label || !svg || !b.dataset.ribbonHint || b.closest('[hidden]')) issues.push('Missing label, icon or action: ' + b.textContent);
          if (b.getBoundingClientRect().width < 30 || svg?.getBoundingClientRect().width < 20) issues.push('Small icon: ' + label);
        }
        if (ribbon.textContent.includes('Other tools')) issues.push('Unassigned tools: ' + [...ribbon.querySelectorAll('[aria-label="Other tools"] button')].map(b => b.textContent).join(', '));
        if (ribbon.scrollWidth > ribbon.clientWidth + 1) issues.push('Ribbon overflows horizontally');
        return issues;
      });
      assert.deepEqual(problems, [], name + ' ribbon at ' + width + 'px: ' + problems.join('; '));
    }
  }
  await page.setViewportSize({width:1280, height:800});
  await openTab('Home');
  const bold = visible.getByRole('button', {name:'Bold', exact:true});
  const editor = frame.locator('#pages-container');
  await editor.click();
  await page.keyboard.type('select these words');
  await frame.evaluate(() => {
    const body = document.querySelector('.page-body');
    const range = document.createRange();
    range.selectNodeContents(body.querySelector('p'));
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await bold.hover();
  await frame.getByRole('tooltip').filter({hasText:'Bold'}).waitFor();
  await bold.click();
  assert.equal(await editor.locator('b,strong').first().textContent(), 'select these words');
  await openTab('Insert');
  const trigger = visible.getByRole('button', {name:'Insert table', exact:true});
  await frame.evaluate(() => {
    const selection = getSelection();
    selection.collapseToEnd();
    document.dispatchEvent(new Event('selectionchange'));
  });
  await trigger.click();
  const dialog = frame.getByRole('dialog', {name:'Insert table'});
  const grid = dialog.getByRole('grid');
  await grid.waitFor();
  const anchor = await trigger.boundingBox(), popup = await dialog.boundingBox();
  assert.ok(popup.x > anchor.x - 3 && popup.y >= anchor.y + anchor.height - 1, 'Table picker should open under its action');
  await grid.getByRole('gridcell', {name:'4 columns by 2 rows'}).click();
  const first = editor.locator('table').first();
  assert.equal(await first.locator('tr').count(), 2);
  assert.equal(await first.locator('tr').first().locator('td').count(), 4);

  await trigger.focus();
  await page.keyboard.press('Enter');
  await grid.waitFor();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  assert.match(await grid.getAttribute('aria-activedescendant'), /4-4$/);
  await page.keyboard.press('Escape');
  assert.equal(await dialog.count(), 0);
  await trigger.click();
  await dialog.getByRole('spinbutton', {name:'Rows', exact:true}).fill('1');
  await dialog.getByRole('spinbutton', {name:'Columns', exact:true}).fill('9');
  await dialog.getByRole('button', {name:'Insert', exact:true}).click();
  assert.equal(await editor.locator('tr').evaluateAll(rows=>rows.some(row=>row.cells.length === 9)), true);
  await openTab('View');
  const ruler = visible.getByRole('button', {name:'Ruler',exact:true});
  await ruler.click();
  assert.equal(await ruler.getAttribute('aria-pressed'),'true');
  await ruler.click();
  await openTab('Home');
};

/* Use the editor's real controls so selection, shortcuts and native integrations
   all invoke the same handlers. Desktop dictionaries and file tools arrive asynchronously. */
'use strict';
(() => {
  const byTab = {
    File: [
      ['Documents', ['New', 'Open', 'Recent', 'Templates']],
      ['Saving', ['Save', 'Save project', 'Save As…', 'Export DOCX', 'Export…', 'Recovery & versions', 'Autosave']],
      ['Output', ['Print', 'Print / PDF']],
      ['Import', ['Import PDF / images…', 'Import review']]
    ],
    Home: [
      ['History', ['Undo', 'Redo']],
      ['Font', ['Font family', 'Font size', 'Bold', 'Italic', 'Underline', 'Strikethrough', 'Superscript', 'Subscript', 'Font color', 'Highlight']],
      ['Paragraph', ['Paragraph style', 'Line spacing', 'Align left', 'Align center', 'Align right', 'Justify', 'Bulleted list', 'Numbered list', 'Decrease indent', 'Increase indent', 'Paragraph…']],
      ['Formatting', ['Copy format', 'Apply format', 'Clear formatting']]
    ],
    Insert: [
      ['Media & tables', ['Image', 'Image tools', 'Insert table', 'Table tools', 'Chart']],
      ['Page elements', ['Page break', 'Section / columns', 'Divider', 'Checklist', 'Link']],
      ['Text', ['Text box', 'Linked text frames', 'Content blocks', 'Symbols', 'Symbols & drawings…']],
      ['Fields', ['Form field', 'Template variable', 'Document field', 'Page number field']],
      ['Signatures', ['Signature', 'Signature layouts']],
      ['Math & codes', ['Equation', 'Function graph', 'Chemical formula', 'QR / barcode']]
    ],
    Design: [
      ['Page', ['Page design', 'Watermark…', 'Watermark', 'Watermark image', 'Remove watermark', 'Stamp']],
      ['Styles', ['Template library', 'Custom styles', 'Style and theme library', 'Curved text']],
      ['Objects', ['Object appearance', 'Move and resize object', 'Anchoring and wrapping', 'Alignment guides', 'Group selection', 'Ungroup']]
    ],
    Layout: [
      ['Page setup', ['Paper', 'Margins', 'Page orientation', 'Page setup…']],
      ['Page surface', ['Headers / footers…', 'Page texture', 'Background image', 'Remove background', 'Imported region layout']],
      ['Text flow', ['Text direction…', 'Vertical writing', 'Horizontal writing', 'Language and writing direction', 'Offline hyphenation']]
    ],
    References: [
      ['Citations', ['References manager', 'CSL citation manager', 'Citation cluster', 'Refresh references']],
      ['Links & captions', ['Caption', 'Cross-reference', 'Page reference', 'Bookmark', 'List of figures / tables']],
      ['Contents & index', ['Table of contents', 'Glossary / index', 'Mark index entry', 'Automatic index']],
      ['Notes', ['Page-bottom footnote', 'Endnote', 'Sidenote']]
    ],
    Review: [
      ['Find', ['Find / replace', 'Regex find / replace', 'Find highlights', 'Remove highlight']],
      ['Proofing', ['Writing checks', 'Spellcheck on / off', 'Review spelling…', 'Dictionary', 'English thesaurus', 'Chinese / Japanese language review']],
      ['Comments', ['Add comment', 'Comments']],
      ['Inspection', ['Statistics', 'Accessibility check', 'Conceal / redact text', 'Remove concealment']]
    ],
    Tools: [
      ['Forms', ['Populate fields', 'Lock / unlock form layout', 'Conditional content', 'Live conditional forms']],
      ['Mailings', ['Mail merge', 'Label sheet', 'Precise label sheets']],
      ['Utilities', ['Document properties', 'Unit converter']]
    ],
    View: [
      ['Workspace', ['Navigation', 'Typewriter mode']],
      ['Guides', ['Ruler', 'Margin guides']]
    ],
    Writing: [
      ['Manuscript', ['Chapters', 'Characters & world', 'Statistics']],
      ['Export', ['Save manuscript as…', 'Save chapter as…']]
    ]
  };
  const namedIds = {
    'btn-bold': 'Bold', 'btn-italic': 'Italic', 'btn-underline': 'Underline',
    'btn-align-left': 'Align left', 'btn-align-center': 'Align center',
    'btn-align-right': 'Align right', 'btn-align-justify': 'Justify',
    'btn-bullet': 'Bulleted list', 'btn-number': 'Numbered list', 'btn-table': 'Insert table',
    'font-family': 'Font family', 'font-size': 'Font size', 'font-color': 'Font color',
    'text-style': 'Paragraph style', 'line-spacing': 'Line spacing', paper: 'Paper',
    margins: 'Margins', 'desktop-auto': 'Autosave'
  };
  const printNames = {
    Strike: 'Strikethrough', 'x²': 'Superscript', 'x₂': 'Subscript',
    'Indent −': 'Decrease indent', 'Indent +': 'Increase indent'
  };
  const fieldLabels = {'Font family': 'Font', 'Font size': 'Size', 'Paragraph style': 'Style', 'Line spacing': 'Spacing'};
  const nameOf = control => {
    const raw = control.textContent.trim();
    if (namedIds[control.id]) return namedIds[control.id];
    if (raw.startsWith('Dictionary:')) return 'Dictionary';
    return printNames[raw] || raw || control.getAttribute('aria-label');
  };
  const fullName = (control, key) => {
    if (key === 'Dictionary') return control.textContent.trim();
    return key.replace(/…$/, '');
  };
  const element = (tag, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  };
  const icon = key => window.DocumentStudioRibbonIcon(key);

  function action(control, key) {
    const label = fullName(control, key);
    if (!control.dataset.ribbonOriginalName || (control.dataset.ribbonIcon && control.dataset.ribbonIcon !== key)) {
      control.dataset.ribbonOriginalName = control.title || control.textContent.trim();
    }
    if (control.dataset.ribbonIcon !== key || !control.querySelector('.ds-action-name')) {
      const name = element('span', 'ds-action-name');
      name.append(...control.childNodes);
      control.replaceChildren(icon(key), name);
    }
    control.classList.add('ds-ribbon-action');
    control.dataset.ribbonIcon = key;
    control.dataset.ribbonHint = label;
    control.setAttribute('aria-label', label);
    // The ribbon supplies the same tooltip for pointer and keyboard users.
    control.removeAttribute('title');
    return control;
  }

  function field(control, key) {
    const label = control.closest('label') || element('label');
    label.classList.add('ds-ribbon-field');
    control.setAttribute('aria-label', key);
    if (control.type === 'color') {
      if (!label.classList.contains('ds-ribbon-color')) {
        label.classList.add('ds-ribbon-color');
        label.replaceChildren(icon(key), control);
        const swatch = () => label.style.setProperty('--swatch', control.value);
        control.addEventListener('input', swatch);
        swatch();
      }
      label.dataset.ribbonHint = key;
    } else if (!label.contains(control)) {
      const caption = element('span', 'ds-field-name');
      caption.textContent = fieldLabels[key] || key;
      label.append(caption, control);
    }
    if (control.id === 'desktop-auto') label.classList.add('ds-auto-toggle');
    return label;
  }

  function group(label, entries, home) {
    const section = element('div', 'ds-ribbon-group');
    section.setAttribute('role', 'group');
    section.setAttribute('aria-label', label);
    const values = element('div', 'ds-ribbon-values');
    const actions = element('div', 'ds-ribbon-actions');
    for (const [key, control] of entries) {
      if (control.localName === 'button') actions.append(action(control, key));
      else (home && control.type !== 'color' ? values : actions).append(field(control, key));
    }
    if (values.childElementCount) section.append(values);
    if (actions.childElementCount) section.append(actions);
    const caption = element('span', 'ds-group-name');
    caption.setAttribute('aria-hidden', 'true');
    caption.textContent = label;
    section.append(caption);
    return section;
  }

  function arrange(name, ribbon) {
    const controls = [...ribbon.querySelectorAll('button,select,input')].map(c => [nameOf(c), c]);
    const remaining = new Map(controls.map(([key, c]) => [c, key]));
    const sections = [];
    for (const [label, keys] of byTab[name] || []) {
      const entries = [];
      for (const key of keys) {
        for (const [c, found] of remaining) if (key === found) {
          entries.push([key, c]);
          remaining.delete(c);
        }
      }
      if (entries.length) sections.push(group(label, entries, name === 'Home'));
    }
    // Late registered editor extensions retain a visible, usable control.
    if (remaining.size) sections.push(group('Other tools', [...remaining].map(([c, key]) => [key, c]), name === 'Home'));
    ribbon.replaceChildren(...sections);
    ribbon.classList.add('ds-ribbon');
    ribbon.dataset.ribbonTab = name;
  }

  function installTooltips(toolbar) {
    const hint = element('div', 'ds-ribbon-tooltip');
    hint.hidden = true;
    hint.setAttribute('role', 'tooltip');
    document.body.append(hint);
    let timer, anchor;
    const hide = () => {
      clearTimeout(timer);
      anchor = null;
      hint.hidden = true;
    };
    function show(control, delay) {
      hide();
      if (!control) return;
      anchor = control;
      timer = setTimeout(() => {
        if (!anchor.isConnected || !anchor.getClientRects().length) return hide();
        hint.textContent = anchor.dataset.ribbonHint;
        hint.hidden = false;
        const bounds = anchor.getBoundingClientRect(), box = hint.getBoundingClientRect();
        const left = Math.min(innerWidth - box.width - 6, Math.max(6, bounds.left + (bounds.width - box.width) / 2));
        hint.style.left = left + 'px';
        hint.style.top = Math.min(innerHeight - box.height - 4, bounds.bottom + 6) + 'px';
      }, delay);
    }
    toolbar.addEventListener('pointerover', event => {
      const next = event.target.closest('[data-ribbon-hint]');
      if (anchor !== next) show(next, 320);
    });
    toolbar.addEventListener('pointerout', event => {
      if (anchor && !anchor.contains(event.relatedTarget)) hide();
    });
    toolbar.addEventListener('focusin', event => {
      if (event.target.matches(':focus-visible')) show(event.target.closest('[data-ribbon-hint]'), 0);
    });
    toolbar.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
    toolbar.addEventListener('scroll', hide);
    window.addEventListener('blur', hide);
  }

  function installTablePicker() {
    const trigger = document.getElementById('btn-table');
    trigger.setAttribute('aria-haspopup', 'dialog');
    // Preserve the existing custom-size dialog, validation, document insert and undo.
    trigger.addEventListener('click', () => {
      const rows = document.getElementById('table-rows'), columns = document.getElementById('table-columns');
      const dialog = rows?.closest('dialog[open]');
      if (!dialog || !columns) return;
      const submit = dialog.querySelector('.dialog-actions .primary');
      const columnCount = 8, rowCount = 5;
      let row = 3, column = 3;
      const grid = element('div', 'ds-table-grid');
      const output = element('output', 'ds-table-dimensions');
      output.setAttribute('aria-hidden', 'true');
      const heading = dialog.querySelector('h2');
      heading.id = 'ds-table-heading';
      dialog.setAttribute('aria-labelledby', heading.id);
      dialog.classList.add('ds-table-picker');
      const stop = new AbortController();
      const {signal} = stop;
      grid.tabIndex = 0;
      grid.setAttribute('role', 'grid');
      grid.setAttribute('aria-label', 'Table size. Use the arrow keys and press Enter to insert.');
      const cells = [];
      for (let y = 1; y <= rowCount; y++) {
        const line = element('div', 'ds-table-row');
        line.setAttribute('role', 'row');
        for (let x = 1; x <= columnCount; x++) {
          const cell = element('span', 'ds-table-cell');
          cell.id = 'ds-cell-' + y + '-' + x;
          cell.setAttribute('role', 'gridcell');
          cell.setAttribute('aria-label', x + ' columns by ' + y + ' rows');
          cell.dataset.column = String(x);
          cell.dataset.row = String(y);
          line.append(cell);
          cells.push(cell);
        }
        grid.append(line);
      }
      function preview(x, y) {
        column = Math.max(1, Math.min(columnCount, x));
        row = Math.max(1, Math.min(rowCount, y));
        for (const cell of cells) {
          const inside = Number(cell.dataset.column) <= column && Number(cell.dataset.row) <= row;
          cell.classList.toggle('ds-cell-filled', inside);
        }
        grid.setAttribute('aria-activedescendant', 'ds-cell-' + row + '-' + column);
        output.textContent = column + ' × ' + row;
      }
      function insertSelection() {
        rows.value = String(row);
        columns.value = String(column);
        submit.click();
      }
      grid.addEventListener('pointermove', event => {
        const cell = event.target.closest('[role=gridcell]');
        if (cell) preview(Number(cell.dataset.column), Number(cell.dataset.row));
      });
      grid.addEventListener('click', event => {
        const cell = event.target.closest('[role=gridcell]');
        if (cell) { preview(Number(cell.dataset.column), Number(cell.dataset.row)); insertSelection(); }
      });
      grid.addEventListener('keydown', event => {
        const moves = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
        if (moves[event.key]) {
          event.preventDefault();
          preview(column + moves[event.key][0], row + moves[event.key][1]);
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          insertSelection();
        }
      });
      heading.append(output);
      heading.after(grid);
      const fields = element('div', 'ds-table-custom');
      grid.after(fields);
      fields.append(rows.closest('label'), columns.closest('label'));
      preview(column, row);
      function position() {
        const anchor = trigger.getBoundingClientRect();
        const width = dialog.offsetWidth, height = dialog.offsetHeight;
        dialog.style.left = Math.max(6, Math.min(anchor.left, innerWidth - width - 6)) + 'px';
        const preferred = anchor.bottom + height + 8 < innerHeight ? anchor.bottom + 5 : anchor.top - height - 5;
        dialog.style.top = Math.max(5, Math.min(preferred, innerHeight - height - 5)) + 'px';
      }
      position();
      window.addEventListener('resize', position, {signal});
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
      }, {signal});
      dialog.addEventListener('close', () => {
        stop.abort();
        dialog.classList.remove('ds-table-picker');
        dialog.removeAttribute('aria-labelledby');
        dialog.style.removeProperty('left');
        dialog.style.removeProperty('top');
      }, {once:true});
      grid.focus({preventScroll:true});
    });
  }

  function install() {
    const toolbar = document.getElementById('toolbar');
    const watch = {childList:true, subtree:true};
    const observer = new MutationObserver(changes => {
      const updated = new Set();
      for (const change of changes) {
        if (change.target.closest('select')) continue; // native font lists can be large
        const ribbon = change.target.closest('.ribbon');
        if (ribbon) updated.add(ribbon);
      }
      if (!updated.size) return;
      observer.disconnect();
      for (const ribbon of updated) arrange(ribbon.dataset.ribbonTab, ribbon);
      observer.observe(toolbar, watch);
    });
    for (const [name, ribbon] of Object.entries(ribbons)) arrange(name, ribbon);
    observer.observe(toolbar, watch);
    installTooltips(toolbar);
    installTablePicker();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();

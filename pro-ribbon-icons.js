// Original 24-unit vector artwork. The full command name belongs to the parent
// control, leaving the layered pictogram decorative for assistive technology.
(() => {
  'use strict';
  const ink = 'currentColor';
  const accent = 'var(--ribbon-icon-accent, var(--accent, currentColor))';
  const path = (d, stroke = ink) => `<path d="${d}" stroke="${stroke}"/>`;
  const detail = d => path(d, accent);
  const surface = d => `<path d="${d}" fill="${accent}" fill-opacity=".14"/>`;
  const box = (x,y,w,h,r=1.5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
  const circle = (x,y,r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  const dot = (x,y,r=1.2) => `<circle cx="${x}" cy="${y}" r="${r}" stroke="none" fill="${accent}"/>`;
  const filled = d => `<path d="${d}" fill="${accent}" stroke="none"/>`;
  const page = surface('M5 2.8h9l5 5v13.4H5z') + detail('M14 3v5h5');
  const book = surface('M2.5 4.8q5-1.6 9.5 1.5 4.5-3.1 9.5-1.5v14.5q-5-1.7-9.5 1.7-4.5-3.4-9.5-1.7z') + detail('M12 6.5v14');
  const pencil = surface('m6 15 10.8-10.8a2 2 0 0 1 3 3L9 18l-4 1z') + detail('m14.8 6.2 3 3');
  const picture = surface('M3 4.5h18v15H3z') + path('m4 17 5-6 4.1 4.3 3-3.5 4.9 5.6') + dot(16,8.3);
  const table = box(2.5,4.2,19,15.6,2) + filled('M3.5 5h17v4h-17z') + path('M3 9.6h18M3 14.7h18M9.1 10v9.3m5.8-9.3v9.3');
  const disk = surface('M4 3.7h13l3.5 3.5v13H4z') + path('M8 4v6h8V4M8.2 20v-6.8h8.3V20') + detail('M13.4 5.5v2.4');
  const panel = box(2.8,4,18.4,16,2) + detail('M3.2 8.3h17.5') + dot(5.8,6.2,.7);
  const note = surface('M3 4.3h18v12.4H10L5.3 21v-4.3H3z');
  const lens = circle(9.5,9.5,5.9) + detail('m14 14 6.1 6.1');
  const crop = path('M4 4v13h16M7 7h10v13');
  const t = path('M5.5 6h13M12 6v13M8.5 19h7');
  const scale = (svg,x,y,factor) => `<g transform="translate(${x} ${y}) scale(${factor})">${svg}</g>`;
  const badge = svg => scale(svg,11.6,11.4,.53);
  const plus = path('M12 4v16M4 12h16');
  const cross = path('m6 6 12 12M18 6 6 18');
  const tick = detail('m3 12 5.8 6.2L21 5.4');
  const mark = surface('M6 3.5h12v17l-6-4-6 4z');
  const template = panel + path('M6 11.4h5v5.7H6zM14 12h4m-4 3.5h3');
  const keyboard = box(2.4,5.1,19.2,13.9,2.4) + path('M5.4 9h.4m3.6 0h.4m3.6 0h.4m3.6 0h.4M5.4 12.4h.4m3.6 0h.4m3.6 0h.4m3.6 0h.4') + detail('M7.7 15.8h8.6');
  const chain = path('m8.7 15.3 6.6-6.6M9.4 8.2l2.8-2.8a4.2 4.2 0 0 1 6 6l-2.8 2.8M14.6 15.8l-2.8 2.8a4.2 4.2 0 0 1-6-6l2.8-2.8');
  const gear = surface('m10 3-.6 2.1-2 .9-2-.8-2 3.4L5 10l-.1 2.4-1.5 1.5 2 3.4 2.2-.5 2 1.1.4 2H14l.6-2.1 2-.9 2 .8 2-3.4-1.6-1.4.1-2.4 1.5-1.5-2-3.4-2.2.5-2-1.1-.4-2z') + circle(12,11.5,3.1);
  const swatch = surface('M4 4h5.2v13.6a2.6 2.6 0 1 1-5.2 0z') + path('m9.2 11.4 5-6 4.4 3.6L8.4 20M13.4 16H21v4.3H7.2') + dot(6.6,17.4,.8);

  const drawings = new Map();
  const normalize = name => String(name).trim().toLowerCase().replace(/(?:\.{3}|…)/g,'').replace(/\s+/g,' ');
  function draw(names, artwork) {
    for (const name of names.split('|')) drawings.set(normalize(name), artwork);
  }

  // File actions and application controls.
  draw('New', page + detail('M8.5 14h7m-3.5-3.5v7'));
  draw('Open', surface('M2.6 7V5h6l2 2H20v2.4H6.7L4 18.6z') + surface('M6.5 10h15l-3 9.4H3.3z'));
  draw('Save', disk);
  draw('Save as', scale(disk,0,0,.83) + scale(pencil,9.2,9.3,.68));
  draw('Save project', disk + detail('M9.4 16.8h5.7'));
  draw('Print|Print / PDF', box(6,2.8,12,6,1) + surface('M4 8.7h16a1.5 1.5 0 0 1 1.5 1.5v6.3h-4v-3h-11v3h-4v-6.3A1.5 1.5 0 0 1 4 8.7z') + box(6.5,13.5,11,7.5,1) + dot(18,11));
  draw('Recovery & versions', path('M3.8 10a8.3 8.3 0 1 1 1.2 7.1M3.4 5.2V10h4.9') + detail('M12 7.2V12l3.6 2.2'));
  draw('Templates', box(3,4,7.8,16,1.6) + surface('M14 4h7v6h-7z') + box(14,13.4,7,6.6));
  draw('Recent', page + badge(circle(12,12,9.2) + path('M12 6.5V12l3.5 2')));
  draw('Import PDF / images', scale(page,0,0,.86) + detail('M21 15h-9m4-4-4 4 4 4') + path('M7 10h4m-4 3h2'));
  draw('Import review', scale(page,0,0,.85) + badge(lens) + detail('M7 10h4m-4 3h2'));
  draw('Export|Export DOCX', page + detail('M10 15h12m-4-4 4 4-4 4'));
  draw('Autosave', scale(disk,0,0,.82) + badge(tick));
  draw('Commands', path('M8.8 8.8v-3a2.7 2.7 0 1 0-2.7 2.7h11.8a2.7 2.7 0 1 0-2.7-2.7v12.4a2.7 2.7 0 1 0 2.7-2.7H6a2.7 2.7 0 1 0 2.7 2.7z'));
  draw('Keyboard shortcuts', keyboard);
  draw('Interface settings', detail('M3 6h5m4 0h9M3 12h11m4 0h3M3 18h3m4 0h11') + circle(10,6,2) + circle(16,12,2) + circle(8,18,2));
  draw('Appearance', circle(12,12,8.8) + filled('M12 3.2a8.8 8.8 0 0 1 0 17.6z'));
  draw('About Document Studio Light', circle(12,12,8.6) + dot(12,7.8) + path('M10.5 11.5H12v5.4m-1.8.2h3.6'));
  draw('Typing preferences', scale(keyboard,0,0,.85) + badge(gear));

  // Character, paragraph, and history tools.
  draw('Undo', path('M9 5 3.8 10 9 15') + detail('M4.5 10h9.2q6.5 0 6.5 6.8v1.1'));
  draw('Redo', path('m15 5 5.2 5-5.2 5') + detail('M19.5 10h-9.2q-6.5 0-6.5 6.8v1.1'));
  draw('Bold|B', '<path d="M7 3.7h6.2c6.1 0 6.6 7.1.6 7.9H7m6.4 0c7.6 0 7.4 8.4.3 8.4H7V3.7" stroke-width="2.75"/>');
  draw('Italic|I', path('M11.5 4h7.6M5 20h7.6m3-16-7 16'));
  draw('Underline|U', path('M6 4v6.6c0 7.7 12 7.7 12 0V4') + detail('M4.5 20h15'));
  draw('Strikethrough|Strike', path('M17.6 7.5c-.7-3.8-10.7-5-10.7.1 0 2.1 1.6 3 4.5 3.8M8 16.6c1.3 3.8 10.2 3.9 10.2-.5 0-1.3-.8-2.4-2.6-3.2') + detail('M2.5 11.8h19'));
  draw('Superscript|x²', path('m3.4 9.2 8.9 10.2m-.2-10.2L3.4 19.4') + detail('M14.6 5.5c.5-3.4 6.4-3.3 5.7.3-.3 1.6-3.6 3.1-5.7 5h6.1'));
  draw('Subscript|x₂', path('m3.4 4.5 8.9 10.6m-.2-10.6L3.4 15.1') + detail('M14.6 15.8c.5-3.4 6.4-3.3 5.7.3-.3 1.6-3.6 3.1-5.7 5h6.1'));
  draw('Align left|Left', path('M3.5 5H21M3.5 9.6h11M3.5 14.3H21M3.5 19h11'));
  draw('Align center|Center', path('M3.5 5h17M7 9.6h10M3.5 14.3h17M7 19h10'));
  draw('Align right|Right', path('M3 5h17.5M9.5 9.6h11M3 14.3h17.5M9.5 19h11'));
  draw('Justify|Align justify', path('M3.5 5h17m-17 4.6h17m-17 4.7h17m-17 4.7h17'));
  draw('Bulleted list|• List', dot(4.3,6,1.55)+dot(4.3,12,1.55)+dot(4.3,18,1.55)+path('M9 6h11.5M9 12h11.5M9 18h11.5'));
  draw('Numbered list|1. List', detail('m3 5 2-1v5m-1.8.2h3M3 15c0-2.9 5-3 4-.1-.4 1.2-2.7 2.5-4 4h4')+path('M10 6.5h10.5M10 16.5h10.5'));
  draw('Increase indent|Indent +', path('M3 5h17.5M11.5 9.8h9M11.5 14.2h9M3 19h17.5') + detail('m3 9 4.2 3L3 15'));
  draw('Decrease indent|Indent −', path('M3 5h17.5M11.5 9.8h9M11.5 14.2h9M3 19h17.5') + detail('m7.2 9-4.2 3 4.2 3'));
  draw('Clear formatting', surface('m4 13.6 8.8-9 6.7 6.2-9.4 9.1H8.8z') + detail('m8 10 6.5 6.1M11 20h10'));
  draw('Paragraph', path('M14 4H9.8a4.8 4.8 0 0 0 0 9.6h3.6M13.4 4v16M18.1 4v16M11 4h9.5'));
  draw('Copy format', scale(pencil,4,-1,.83) + path('M3 11.4V20h10M5.8 9v8.2h8') );
  draw('Apply format', surface('m6.1 11.3 8.3-8.2 5.9 5.8-8.3 8.2z') + path('m6.4 11.6-3 7q-.6 2.5 2.2 1.4l6.4-3.2') + detail('m11.4 6.6 5.6 5.5'));
  draw('Font color', path('m5 15 5.2-11h2L17.5 15M7 11.5h8.5') + filled('M3 17.8h18v3.5H3z'));
  draw('Highlight', surface('m6 13 9.4-10 5.1 4.9-9.2 10.2z') + path('m7.4 14.6-3 5.1 5.3-2.4') + detail('M11 20.6h10'));
  // Insert. The grid, landscape, chart and equation are miniature previews.
  draw('Image', picture);
  draw('Insert table|Table', table);
  draw('Table tools', scale(table,-.4,0,.81) + badge(gear));
  draw('Image tools', scale(picture,0,0,.81) + badge(crop));
  draw('Chart', path('M3 3v17.5h18') + surface('M6.5 19.7v-6h3.1v6zm5.2 0V9.1h3.1v10.6zm5.2 0V4h3.1v15.7z'));
  draw('Page break', path('M5 3h14v5.5m0 6.5v5.5H5V15m0-6.5V3') + detail('M2 11.7h3m3.4 0h3.1m3.3 0H18m2.3 0H22'));
  draw('Section / columns', box(3.1,3.4,17.8,17.2) + detail('M12 6v12') + path('M5.8 8h3.4m-3.4 3.7h3.4m-3.4 3.7h3.4M14.8 8h3.4m-3.4 3.7h3.4m-3.4 3.7h3.4'));
  draw('Divider', path('M5 4.6h14m-14 14.8h14') + detail('M2.8 12h6.9m4.6 0h6.9') + filled('m12 9.5 2.5 2.5-2.5 2.5L9.5 12z'));
  draw('Checklist', box(3.1,13.7,5.8,5.8,1) + detail('m2.8 7 2.4 2.6 4.3-5.3') + path('M12.5 7.6H21m-8.5 9H21'));
  draw('Link', chain);
  draw('Text box', box(2.9,4.2,18.2,15.6,1) + scale(t,3.2,2.6,.73));
  draw('Linked text frames', box(2.2,4,10,11,1) + box(12,10,9.8,10.2,1) + detail('M5 7.5h4.3M14.9 16.8h3.8m-12-5.5h4.6q4 0 4 3.2'));
  draw('Content blocks', surface('M3.5 4h17v5.5h-17z') + box(3.5,12.3,7,7.8,1) + box(13.5,12.3,7,7.8,1));
  draw('Symbols', path('M3.6 17.3v2h6.1v-2.7a6.5 6.5 0 1 1 4.6 0v2.7h6.1v-2'));
  draw('Symbols & drawings', circle(8,8,4.6) + surface('m15.7 5.8 5.7 9.7H10z') + box(3,13,7.5,7.5,1));
  draw('Form field', box(2.5,6.3,19,11.4,2.1) + path('M6.2 9h3.4m-1.7 0v6m-1.7 0h3.4') + detail('M13 12h5'));
  draw('Template variable', path('M8.5 3.7H7c-4 0 .1 7.1-4.3 8.3 4.4 1.2.3 8.3 4.3 8.3h1.5M15.5 3.7H17c4 0-.1 7.1 4.3 8.3-4.4 1.2-.3 8.3-4.3 8.3h-1.5') + dot(12,12,1.4));
  draw('Document field', page + detail('M9.5 11.8H8V17h1.5m4.5-5.2h1.5V17H14') + dot(11.8,14.4,.9));
  draw('Page number field', page + detail('m10.5 11-1.3 7.1m5-7.1-1.3 7.1m-4.7-5.2h7.2m-7.8 3.1h7.2'));
  draw('Signature', path('M2.8 16.5C7.3 14 15.8 3.4 12.2 3.7c-3.2.2-6.7 13.8-3.2 13.8 1.8 0 3.8-5.4 4.8-5.4 1 0-.3 4.2 1.3 4.2 1.7 0 3.1-2.9 5.7-1.8') + detail('M3 20h18'));
  draw('Signature layouts', page + path('m7 13.5 2-2.2-.5 2.9 2.6-1.5m1.7.8h3') + detail('M7.4 17.5h3.8m2.3 0h3.7'));
  draw('Equation', surface('M18.5 4h-13l7.1 7.8L5.3 20h13.4v-3M18.5 4v3'));
  draw('Function graph', path('M3 3.5v16.7h18') + detail('M4.4 16c2.6 0 3.7-3.3 5.1-7s3.6-4.7 5.1.2 2.9 5.7 6.2-3'));
  draw('Chemical formula', surface('m4.1 8 5.1-3 5.1 3v6l-5.1 3-5.1-3z') + detail('m7 9 2.3-1.4m5.2 1.1 3.1-1.8m-3.1 6.8 3.1 1.8m-8.4 1.4v3.4') + circle(19.5,5.8,2.1) + circle(19.5,16.5,2.1));
  draw('QR / barcode', box(2.6,3,6.6,6.6,.4) + box(13.4,3,6.6,6.6,.4) + box(2.6,14,6.6,6.6,.4) + dot(5.9,6.3,.95) + dot(16.7,6.3,.95) + dot(5.9,17.3,.95) + detail('M13.4 13v2.8h3v4.7m3.6-7.5v4.3m-6.6 2.2v1m6.6-.5v.6'));

  // Page styling, surface controls and object placement.
  draw('Page design', page + detail('M8 8.3h3M8 11.8h8.4M8 15.1h3.1v2.5H8zm5.4 0h3m-3 2.4h3'));
  draw('Watermark', page + detail('m7.7 16.9 6.8-6.8m-4.2 7.8 5.9-5.9') );
  draw('Watermark image', page + scale(picture,6.3,8.4,.48));
  draw('Remove watermark', scale(page,0,0,.87) + detail('m6.3 14.8 5.1-5.2') + badge(cross));
  draw('Stamp', surface('M10 12.7V10C10 8.7 8.6 7.5 8.6 5.6a3.4 3.4 0 0 1 6.8 0c0 1.9-1.4 3.1-1.4 4.4v2.7h3.5l2.5 3v2.1H4v-2.1l2.5-3z') + detail('M4.5 20.7h15'));
  draw('Template library', scale(template,3,0,.88) + detail('M2.5 7.1v14h14.9'));
  draw('Custom styles', scale(swatch,-.5,-.3,.84) + badge(pencil));
  draw('Style and theme library', swatch);
  draw('Curved text', detail('M2.8 17.6Q12 2.8 21.2 17.6') + path('m3.2 13.6 1-5 3 1.9M3.6 12l2.1-1.4M10.7 6.9V3.7h2.6m-2.6 1.8h2.2M17 9.3l2.2-2.6 2 4.6'));
  draw('Object appearance', surface('M3.5 4h12v12h-12z') + path('M6.5 7h5.8') + surface('M17.2 10.6c-1.3 2.3-4.5 4.8-4.5 6.7a4.5 4.5 0 0 0 9 0c0-1.9-3.2-4.4-4.5-6.7z'));
  draw('Move and resize object', box(4.5,4.5,14,14,.5) + box(2.5,2.5,4,4,.5) + box(16.5,16.5,4,4,.5) + detail('m8.4 15 6.8-6.8m-3.8 0h3.8V12'));
  draw('Anchoring and wrapping', circle(12,5.2,2.4) + path('M12 8v12.3M8.5 10.6h7M3.2 13.6c1.1 3.2 3.4 5.6 8.8 7 5.4-1.4 7.7-3.8 8.8-7') + detail('m3.1 16 .1-3 3 1m11.6 0 3-1 .1 3'));
  draw('Alignment guides', detail('M3 3v18m18-9H3') + box(6,4.5,8,4.5,.7) + box(6,14.8,13,4.5,.7));
  draw('Group selection', path('M6.5 2.8H3v3.8m14.4-3.8H21v3.8M3 17.4v3.8h3.5m10.9 0H21v-3.8') + surface('M6.5 6.8h7v7h-7z') + box(11.5,11.8,6.1,6.1,.7));
  draw('Ungroup', box(2.6,4,7,7,.7) + box(14.4,13.1,7,7,.7) + detail('m10 14.1-5.6 5.6m0-3.7v3.7h3.7m6.4-10.8 5-5m-3.7 0h3.7v3.7'));
  draw('Page orientation', box(3.1,3.1,9.3,12.7,1) + surface('M9 12h12v8.5H9z') + detail('M15.8 4.4c2.6.5 4.1 2.4 4.1 5m-2.6-2.2 2.6 2.5 1.6-2.7'));
  draw('Page setup', scale(page,0,-.2,.85) + badge(gear));
  draw('Headers / footers', box(4.8,2.8,14.4,18.4,1.2) + filled('M5.8 4h12.4v3.5H5.8zm0 12.6h12.4V20H5.8z') + detail('M8.3 10.5h7.4m-7.4 3h5.4'));
  draw('Page texture', page + detail('m7.9 13.2 3.2-3.2M8 17.5l7.2-7.2m-3.3 7.2 4.4-4.4'));
  draw('Background image', path('M3.8 6.5H2.5v14.2h15v-1.5') + scale(picture,3.9,-.6,.86));
  draw('Remove background', scale(picture,-.4,-.3,.86) + badge(cross));
  draw('Imported region layout', panel + box(5.7,11,4.3,5.6,.4) + detail('M12.6 11h5.4v2.3h-5.4zm0 5.4h5.4'));
  draw('Text direction', path('M3.2 5.2h11.4m-7.8 4.1h7.8m-10.8 4h10.8') + detail('M5.5 18h14m-3.9-4 4 4-4 4'));
  draw('Vertical writing', path('M3 4h10M8 4v10m-2.5 0h5') + detail('M18 3.5v16.8m-3.4-3.7 3.4 3.9 3.5-3.9'));
  draw('Horizontal writing', path('M3.5 3.5h11m-5.5 0v9m-2.5 0h5') + detail('M3 18.5h17.3m-3.8-3.5 4 3.5-4 3.5'));
  draw('Language and writing direction', scale(circle(12,12,9) + path('M3 12h18M12 3q-9 9 0 18 9-9 0-18z'),0,0,.78) + detail('M11 19h10m-3.2-3.2 3.2 3.2-3.2 3.2'));
  draw('Offline hyphenation', path('M3 5.8h17M3 10.7h8m-8 7.4h10') + detail('M14.4 10.7h5.8m-.1 3.4v3.1h-3.5'));

  // Reference structures, notes and review marks.
  draw('References manager', book + detail('M5 8.7h3.3m7.5-.3h3.1M5 12.4h3.3m7.5-.4h3.1'));
  draw('CSL citation manager', path('M3 5h15M3 9.5h10M3 14h5') + surface('M11 13h3.6v3.5l-2.3 3.4H11l1.7-3.3H11zm6.1 0h3.6v3.5l-2.3 3.4h-1.3l1.7-3.3h-1.7z'));
  draw('Citation cluster', path('M3.2 5.2H7v4.1L4.5 13H3l1.9-3.7H3.2zm6.1 0h3.8v4.1L10.6 13H9.1l1.9-3.7H9.3z') + scale(chain,10,10,.55));
  draw('Refresh references', scale(book,0,0,.78) + badge(path('M4.2 10a7.8 7.8 0 1 1 1 7M4 4.7V10h5.4')));
  draw('Caption', scale(picture,3,-.1,.76) + detail('M3.6 18h17M6.5 21h11'));
  draw('Cross-reference', path('M3 3.8h8.5v8.4H3zM12.5 12.8H21v7.5h-8.5z') + detail('M7 14v3.7h3.6M14 6.3h4v4m-3.7-.3 3.7-3.7'));
  draw('Page reference', scale(page,0,0,.87) + detail('M21 18h-5.3v-6.5m-3.4 3.3 3.4-3.4 3.4 3.4'));
  draw('Bookmark', mark);
  draw('List of figures / tables', scale(picture,1.8,1,.46) + scale(table,1.7,11.8,.46) + path('M14 6.3h6.4M14 9.6h4.2M14 16h6.4M14 19.3h4.2'));
  draw('Table of contents', path('M3.7 5.7h9m-7.5 6.4h7.5m-9 6.4h9') + dot(16,5.7,.7) + dot(16,12.1,.7) + dot(16,18.5,.7) + detail('M19 5.7h1.5M19 12.1h1.5M19 18.5h1.5'));
  draw('Glossary / index', book + path('m4.7 14.5 2-5.3 2.1 5.3m-3.2-1.6h2.2') + detail('M15 9h3.9L15 14.2h4'));
  draw('Mark index entry', scale(mark,-1,-.2,.83) + badge(plus));
  draw('Automatic index', page + path('M8 10.5h4m-4 3.4h2.3') + filled('m16.4 10.2 1.3 3.7 3.7 1.3-3.7 1.4-1.3 3.8-1.4-3.8-3.7-1.4 3.7-1.3z'));
  draw('Page-bottom footnote', page + path('M7.9 14.7h8m-5.3 3h5') + detail('m8 10.4 1.6-1v3.1'));
  draw('Endnote', book + detail('M15 16h4m-3.2-5.8 1.3-.9v3.4'));
  draw('Sidenote', scale(page,0,0,.88) + surface('M12.5 8.6h9v7h-4L15 18v-2.4h-2.5z') + detail('M15 11.8h4.2'));
  draw('Find / replace', scale(lens,-.3,-.5,.82) + detail('M8.2 19.3H19m-2.8-3 3.2 3-3.2 3'));
  draw('Regex find / replace', scale(lens,-1,-1,.78) + detail('M16.2 13.1v7.8m-3.3-5.9 6.6 3.8m-6.6-.1 6.6-3.7') + dot(9.8,19.6));
  draw('Find highlights', scale(lens,-.4,-.2,.93) + filled('M4 7.6h8.7V11H4z'));
  draw('Remove highlight', scale(pencil,-.6,-.3,.84) + path('M3 20h8.4') + badge(cross));
  draw('Writing checks', page + path('M8.1 9h4m-4 3h2.3') + badge(tick));
  draw('Spellcheck on / off', path('m3.1 14 3.2-8.1 3.2 8.1m-5.3-2.4h4.1m3.8.8V5.6h3.1c3.7 0 3.5 3.4.4 3.4h-3.2m3.1 0q3.9.1 2.3 3.2') + detail('m10.2 17.9 3.2 2.7 7.8-7.8'));
  draw('Review spelling', path('m3.3 14 3-8 3 8m-5.2-2.5h4.4M12 6v8h3.2c4.4 0 4.5-4.3.3-4.3H12m3.2 0c4.3 0 4.2-3.7.2-3.7H12') + detail('m3.4 18.9 2.5-1.9 2.7 1.9 2.6-1.9 2.6 1.9 2.6-1.9 2.7 1.9'));
  draw('Dictionary', surface('M5 3.6h13.8v16.8H5q-1.8-.3-1.8-2V5.6q0-2 1.8-2z') + detail('M6.7 4v13.6M4 17.6h14.5') + path('m9.1 13.2 2.4-6 2.5 6m-3.8-1.7h2.9'));
  draw('English thesaurus', book + detail('M5.4 10.4h3.8m-1.6-1.5 1.6 1.5-1.6 1.5m10.8 1.9H15m1.6-1.5L15 13.8l1.6 1.5'));
  draw('Chinese / Japanese language review', path('M3 6h11M8.5 3.4V6m3.2 1.4c-.9 4.5-4.2 8.5-8.4 10.5m1.8-9c.9 2.6 2.8 5.2 5.3 7.2') + detail('m12.4 20.2 4.1-10.5 4.1 10.5m-6.5-3.1h4.8'));
  draw('Add comment', note + detail('M8.4 10.5h7.2M12 6.9v7.2'));
  draw('Comments', scale(note,.1,.2,.78) + path('M19.3 9.1h2v9.2h-2.6v2.9l-3.6-2.9h-4.4v-2'));
  draw('Statistics', surface('M3.5 19.9v-7.5h3.6v7.5zm6.7 0v-12H14v12zm6.8 0V3.7h3.6v16.2z') + detail('M2.6 21h18.8'));
  draw('Accessibility check', circle(12,4.5,2.2) + path('m3.5 8.8 8.5 1.6 8.5-1.6M12 10.8v3.7m0-.3-4.3 6.4m4.3-6.4 4.3 6.4'));
  draw('Conceal / redact text', path('M3.3 5.9h16.4M3.3 18.6h10.4') + filled('M2.8 9.3H21v5.3H2.8z'));
  draw('Remove concealment', path('M2.6 11.8q9.4-11.2 18.8 0-9.4 11.2-18.8 0z') + circle(12,11.8,3.2) + detail('m3.3 20.5 17.4-17'));

  // Forms and delivery, the writing workspace, and navigation.
  draw('Populate fields', box(3.2,3.6,17.6,16.8) + path('M6.6 8h3.2m-3.2 6.7h3.2') + detail('m12.2 8 1.8 1.8 3.2-3.5m-5 8.5 1.8 1.8 3.2-3.5'));
  draw('Lock / unlock form layout', surface('M5.2 10.6h13.6v10H5.2z') + path('M8.1 10.3V7.1a3.9 3.9 0 1 1 7.8 0v1') + dot(12,14.7) + detail('M12 15v2.1'));
  draw('Conditional content', surface('m6 3 4.2 4L6 11 2 7z') + path('M6 11v5.3q0 2 2 2h3.9m-.3-11.3h5.6v4') + box(14,14.7,6.5,6,.7));
  draw('Live conditional forms', panel + detail('M5.5 14h2l1.5-3.1 2 6.7 2.1-5 1.7 1.4h3.5'));
  draw('Mail merge', surface('M2.7 8h15.9v12H2.7z') + path('m3.3 8.8 7.4 5.8 7.2-5.8') + detail('M7 4.3h14.1v11.8'));
  draw('Label sheet', box(4,3.2,16,17.6,1) + box(6.8,6.6,3.8,3.1,.6) + box(13.2,6.6,3.8,3.1,.6) + box(6.8,13.6,3.8,3.1,.6) + box(13.2,13.6,3.8,3.1,.6));
  draw('Precise label sheets', box(5.6,5.1,12.9,13.6,.5) + detail('M2.4 8h5.7M5.4 2.4v5.7m10.7 8h5.5m-2.8.1v5.5') + path('M9 10h6m-6 3.5h4'));
  draw('Document properties', page + path('M8.1 9.8h3.1m-3.1 3.6h6.8m-6.8 3.7h4.1') + dot(16.2,16.9));
  draw('Unit converter', surface('m2.4 15.1 12.8-12.8 6.5 6.4L8.9 21.5z') + detail('m6.2 12 2.7 2.8m.3-5.8 1.7 1.7m1.5-4.9 2.7 2.8m.4-5.7L17 4.6'));
  draw('Navigation', panel + detail('M9.1 8.5v11') + path('M5.1 11.1h1.6m-1.6 3h1.6m5-2.4h5.1m-5.1 3.4h3'));
  draw('Typewriter mode', surface('M4.3 11.3h15.4l2 8.5H2.3z') + path('M6.6 10.8V3.5h10.8v7.3M9 7h6') + detail('M6.4 14.7H7m3 0h.6m3 0h.6m3 0h.6m-10.2 2.5h8.7'));
  draw('Ruler', surface('M2.5 7.3h19v9.3h-19z') + detail('M5.5 7.7v4.6m3.2-4.6v2.9m3.3-2.9v4.6m3.3-4.6v2.9m3.2-2.9v4.6'));
  draw('Margin guides', box(3.8,2.7,16.4,18.6,1) + detail('M7.4 4v15.8M16.6 4v15.8M5.2 7.2h13.6M5.2 16.8h13.6'));
  draw('Chapters', book + detail('M6 4.8v7l2.2-1.3 2.2 2V5.7') + path('M15.1 10h3.5m-3.5 3.6h3.5'));
  draw('Characters & world', circle(8.1,7.2,3.2) + path('M2.5 19.4v-1.3a5.6 5.6 0 0 1 10.9-1.6') + circle(16.8,15,4.7) + detail('M12.5 15H21m-4.2-4.5q-3.6 4.5 0 9 3.6-4.5 0-9'));
  draw('Save manuscript as', scale(book,-.2,0,.85) + badge(disk));
  draw('Save chapter as', scale(mark,-1,-.2,.83) + badge(disk));

  // An editor extension can declare a new action before its artwork is installed.
  // Preserve a functional control with the extension's name in its tooltip.
  const extensionIcon = panel + detail('M8 14h8m-4-4v8');
  window.DocumentStudioRibbonIcon = name => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const key = normalize(name);
    const drawing = drawings.get(key);
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('width','24');
    svg.setAttribute('height','24');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke',ink);
    svg.setAttribute('stroke-width','1.65');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('focusable','false');
    svg.setAttribute('aria-hidden','true');
    svg.dataset.artwork = drawing ? key : 'extension';
    svg.innerHTML = drawing || extensionIcon;
    return svg;
  };
})();

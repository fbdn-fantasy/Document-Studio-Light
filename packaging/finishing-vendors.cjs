const esbuild=require('esbuild');
const fs=require('fs');
const langs=['en-us','en-gb','de','fr','es','nl','ru'];
fs.writeFileSync('packaging/vendor-entry.cjs',`window.FTEHyphens={${langs.map(l=>JSON.stringify(l)+':require("hyphen/'+l+'").hyphenateSync').join(',')}};window.FTECite=require('@citation-js/core').Cite;window.FTECitationPlugins=require('@citation-js/core').plugins;require('@citation-js/plugin-csl');require('@citation-js/plugin-bibtex');require('@citation-js/plugin-ris');`);
esbuild.buildSync({entryPoints:['packaging/vendor-entry.cjs'],bundle:true,platform:'browser',outfile:'assets/vendor/writing.js',minify:true});

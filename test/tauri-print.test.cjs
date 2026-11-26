const {test}=require('node:test');const assert=require('node:assert/strict');
// Use the locked TypeScript compiler so the documented Node 22 minimum works.
const ts=require('typescript'),fs=require('node:fs'),Module=require('node:module');
const filename=require.resolve('../src/print-settings.ts');const compiled=new Module(filename,module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const settings=compiled.exports;
test('print selection accepts all pages and normalizes duplicated unordered ranges',()=>{const {parsePageRange}=settings;assert.deepEqual(parsePageRange('all',5),[0,1,2,3,4]);assert.deepEqual(parsePageRange(' 3, 1-2, 2,5 ',5),[0,1,2,4]);});
test('print selection rejects missing, reverse and malformed pages before system printing',()=>{const {parsePageRange}=settings;for(const value of ['0','6','3-1','1,,2','1-2-3','1.5','abc'])assert.throws(()=>parsePageRange(value,5));assert.throws(()=>parsePageRange('all',0));});
test('orientation fits original page inside requested paper without clipping',()=>{const {printGeometry}=settings;assert.deepEqual(printGeometry(794,1123,'document'),{width:794,height:1123,scale:1,x:0,y:0});for(const [w,h,orientation] of [[794,1123,'landscape'],[1123,794,'portrait'],[794,1123,'portrait']]){const g=printGeometry(w,h,orientation);assert.ok(g.x>=0&&g.y>=0);assert.ok(g.x+w*g.scale<=g.width+.001);assert.ok(g.y+h*g.scale<=g.height+.001);assert.equal(g.width>g.height,orientation==='landscape');}assert.throws(()=>printGeometry(NaN,1123,'portrait'));});

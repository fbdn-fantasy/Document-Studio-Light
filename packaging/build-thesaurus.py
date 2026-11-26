from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
synsets={}; entries={}
for pos in ['noun','verb','adj','adv']:
 for line in (root/'node_modules/wordnet-db/dict'/('data.'+pos)).read_text().splitlines():
  if not line or not line[0].isdigit():continue
  main,_,definition=line.partition('|');a=main.split();n=int(a[3],16);words=[a[4+i*2].replace('_',' ') for i in range(n)];at=4+n*2;ptr=[]
  for i in range(int(a[at])):
   b=a[at+1+i*4:at+5+i*4]
   if b[0]=='!':ptr.append((b[2],b[1],b[3]))
  key=(a[2].replace('s','a'),a[0]);synsets[key]=(words,ptr,definition.strip())
for key,(words,ptr,definition) in synsets.items():
 for wi,w in enumerate(words):
  if not w.isascii():continue
  ant=[]
  for pos,offset,indices in ptr:
   if int(indices[:2],16) not in [0,wi+1]:continue
   target=synsets.get((pos,offset))
   if target:
    j=int(indices[2:],16);ant+=target[0][j-1:j] if j else target[0]
  entries.setdefault(w.lower(),[]).append({'meaning':definition,'synonyms':[x for x in words if x!=w],'antonyms':ant})
(root/'assets/vendor/thesaurus.json').write_text(json.dumps(entries,ensure_ascii=False,separators=(',',':')))
# JS lazy loaded file for file:// compatibility, without fetch/CORS.
(root/'assets/vendor/thesaurus.js').write_text('window.FTEThesaurus='+json.dumps(entries,ensure_ascii=False,separators=(',',':'))+';')
(root/'assets/vendor/thesaurus.json').unlink()

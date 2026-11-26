"""Smoke-test installed Linux resources without any loose source dependencies.

Usage: python3 scripts/smoke-linux-package.py "/extracted/rpm/usr/lib/Document Studio Light/app-resources"
Native dialog responses are simulated here; real native dialog tests are separate.
"""
from pathlib import Path
import argparse,json,subprocess,tempfile,threading,queue,time
p=argparse.ArgumentParser();p.add_argument('resources');p.add_argument('--skip-health',action='store_true');args=p.parse_args()
root=Path(args.resources).resolve(strict=True)
with tempfile.TemporaryDirectory(prefix='document-studio-installed-smoke-') as work:
 work=Path(work);target=work/'saved.fte.json';startup=work/'startup.txt';startup.write_text('Installed runtime smoke test')
 child=subprocess.Popen([str(root/'node/bin/node'),str(root/'desktop-service.cjs'),str(work/'profile'),str(startup)],cwd=work,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 lines=queue.Queue();errors=[]
 def read_stdout():
  for line in child.stdout:lines.put(line)
  lines.put(None)
 def read_stderr():
  for line in child.stderr:errors.append(line)
 threading.Thread(target=read_stdout,daemon=True).start();threading.Thread(target=read_stderr,daemon=True).start()
 seq=0
 def send(value):child.stdin.write(json.dumps(value)+'\n');child.stdin.flush()
 def receive(match,timeout=120):
  end=time.monotonic()+timeout
  while True:
   try:line=lines.get(timeout=max(.01,end-time.monotonic()))
   except queue.Empty:raise RuntimeError('Service response timed out. '+''.join(errors))
   if line is None:raise RuntimeError('Service exited: '+str(child.poll())+' '+''.join(errors))
   msg=json.loads(line)
   if 'native' in msg:
    method=msg['method'];result={'canceled':False,'filePath':str(target)} if method=='save' else None
    send({'nativeReply':msg['native'],'result':result});continue
   if match(msg):
    if 'error' in msg:raise RuntimeError(msg['error'])
    return msg
 def call(method,*values):
  global seq
  seq+=1;send({'id':seq,'method':method,'args':list(values)});return receive(lambda m:m.get('id')==seq).get('result')
 try:
  # Send before ready: the first Tauri request must survive dictionary startup.
  init=call('init');assert init['startup'] is True,init
  dictionaries=call('dictionaries');assert len(dictionaries['items'])>=8,dictionaries
  opened=call('open','startup');assert bytes(opened['bytes']).decode()=='Installed runtime smoke test',opened
  body=json.dumps({'format':'ForbiddenStudio','name':'Installed Smoke','html':'<p>Offline</p>'})
  saved=call('save',{'body':body,'name':'saved.fte.json','saveAs':True});assert target.read_text()==body,saved
  snap=call('snapshot',{'id':'installed-smoke','body':body,'recoverable':True});recoveries=call('recoveries');assert any(x['name']==snap for x in recoveries),recoveries
  restored=call('recover',{'id':'installed-smoke','name':snap});assert restored==body
  assert call('cancelImport') is False
  health=None if args.skip_health else call('importHealth');assert health is None or health['ok'] is True,health
  assert call('close') is True
  print(json.dumps({'ok':True,'resources':str(root),'checks':['startup','dictionary','file read','native save delegation','atomic save','recovery snapshot','recovery restore','import cancellation','runtime integrity' if health else 'health skipped','clean close'],'health':health},indent=2))
 finally:
  child.stdin.close()
  try:child.wait(timeout=5)
  except subprocess.TimeoutExpired:child.kill();child.wait()

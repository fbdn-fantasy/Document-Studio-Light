from pathlib import Path
import urllib.request,tarfile,zipfile,hashlib
root=Path(__file__).resolve().parent.parent
base='https://nodejs.org/dist/latest-v22.x/'
checks=urllib.request.urlopen(base+'SHASUMS256.txt').read().decode()
for suffix,folder in [('linux-x64.tar.xz','node-linux'),('win-x64.zip','node-windows')]:
 digest,name=next(line.split() for line in checks.splitlines() if line.endswith(suffix))
 target=root/name
 if not target.exists():urllib.request.urlretrieve(base+name,target)
 assert hashlib.sha256(target.read_bytes()).hexdigest()==digest
 out=root/folder;out.mkdir(exist_ok=True)
 if name.endswith('.zip'):
  with zipfile.ZipFile(target) as z:
   node=next(n for n in z.namelist() if n.endswith('/node.exe'));(out/'node.exe').write_bytes(z.read(node))
   license=next(n for n in z.namelist() if n.endswith('/LICENSE'));(out/'LICENSE').write_bytes(z.read(license))
 else:
  with tarfile.open(target) as t:
   for member in t.getmembers():
    rel=Path(*Path(member.name).parts[1:]);
    if str(rel) in ['bin/node','LICENSE']:
     dest=out/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(t.extractfile(member).read());dest.chmod(member.mode)
 target.unlink()
 print(folder,name)

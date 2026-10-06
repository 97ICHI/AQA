# -*- coding: utf-8 -*-
"""Однократная разборка собранного AQA_Lab_v3.html на исходники src/ (манифест хранит порядок сборки)."""
import re, json, os, sys
SRC='/home/user/AQA/src'; V3='/home/user/AQA/AQA_Lab_v3.html'
t=open(V3,encoding='utf8').read()
os.makedirs(SRC+'/chapters',exist_ok=True); os.makedirs(SRC+'/css',exist_ok=True); os.makedirs(SRC+'/js',exist_ok=True); os.makedirs(SRC+'/shell',exist_ok=True)
parts=[]  # (kind, path)
def put(path,text,kind='text'):
    open(os.path.join(SRC,path),'w',encoding='utf8').write(text); parts.append({'kind':kind,'path':path})
# 1. head до <style>
i=t.index('<style>')+len('<style>')
put('shell/head.html',t[:i])
# 2. css: шрифты отдельно
j=t.index('</style>')
css=t[i:j]; k=css.index('/* =====')
put('css/fonts.css',css[:k]); put('css/app.css',css[k:])
# 3. body до первой главы
c0=t.index('<article class="chapter" id="/')
put('shell/body-open.html',t[j:c0])
# 4. главы
mend=t.index('</main>')
starts=[m.start() for m in re.finditer(r'<article class="chapter" id="/',t[:mend])]
zipre=re.compile(r'data:application/zip;base64,[A-Za-z0-9+/=]+')
for n,a in enumerate(starts):
    b=starts[n+1] if n+1<len(starts) else mend
    chunk=t[a:b]; cid=re.match(r'<article class="chapter" id="/([^"]+)"',chunk).group(1)
    chunk=zipre.sub('{{STARTER_ZIP}}',chunk)
    put(f'chapters/{n:02d}-{cid}.html',chunk,'chapter')
# 5. после глав до book-data
bd=re.search(r'<script type="application/json" id="book-data">',t)
put('shell/body-close.html',t[mend:bd.end()])
e=t.index('</script>',bd.end())
data=json.loads(t[bd.end():e].replace('<\\/','</'))
open(SRC+'/book.json','w',encoding='utf8').write(json.dumps(data,ensure_ascii=False,indent=1)+'\n'); parts.append({'kind':'book','path':'book.json'})
# 6. основной скрипт: разбить по маркерам /* ===== name.js
s0=e  # '</script>' начало
rest_start=e
m2=re.search(r'<script>\n',t[e:]); sc0=e+m2.end()
put('shell/script-open.html',t[e:sc0])
sc1=t.index('</script>',sc0)
js=t[sc0:sc1]
marks=[m.start() for m in re.finditer(r'/\* ===== [\w./-]+\.js',js)]
marks=[0]+marks if marks[0]!=0 else marks
for n,a in enumerate(marks):
    b=marks[n+1] if n+1<len(marks) else len(js)
    chunk=js[a:b]; mm=re.match(r'/\* ===== ([\w./-]+)\.js',chunk); name=(mm.group(1) if mm else 'prelude').replace('/','-')
    put(f'js/{n:02d}-{name}.js',chunk)
put('shell/tail.html',t[sc1:])
json.dump(parts,open(SRC+'/manifest.json','w'),indent=1)
print(len(parts),'parts')

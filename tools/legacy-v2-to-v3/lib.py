import re, html, json, collections
V2='/home/user/AQA/AQA_Lab_v2.html'
TERM_RE=re.compile(r'<button type="button" class="term" data-term="([^"]+)" aria-expanded="false">(.*?)</button>|<button class="term" type="button" data-term="([^"]+)" aria-expanded="false">(.*?)</button>',re.S)
ART_RE=re.compile(r'<article class="chapter" id="/([^"]+)".*?</article>',re.S)
VOID={'br','img','input','hr','meta','link','path','circle','rect','line','polyline','polygon','use','source','col','wbr','area','base','embed','param','track'}
TOK=re.compile(r'<!--.*?-->|<[^>]+>|[^<]+',re.S)
def load(): return open(V2,encoding='utf8').read()
def strip_terms(h):
    rec=collections.defaultdict(collections.Counter)
    def f(m):
        tid=m.group(1) or m.group(3); s=m.group(2) if m.group(1) else m.group(4)
        rec[tid][s]+=1; return s
    return TERM_RE.sub(f,h),rec
def walk(h, on_text):
    """Iterate tokens with ancestor stack [(tag, class)], on_text(text, stack)->new text"""
    out=[]; stack=[]
    for m in TOK.finditer(h):
        t=m.group(0)
        if t.startswith('<!--'): out.append(t); continue
        if t.startswith('<'):
            mm=re.match(r'<(/?)([a-zA-Z0-9]+)([^>]*)>',t)
            if not mm: out.append(t); continue
            close,tag,rest=mm.group(1),mm.group(2).lower(),mm.group(3)
            if close:
                for k in range(len(stack)-1,-1,-1):
                    if stack[k][0]==tag: del stack[k:]; break
            elif tag not in VOID and not rest.rstrip().endswith('/'):
                c=re.search(r'class="([^"]*)"',rest); stack.append((tag,c.group(1) if c else '',rest))
            out.append(t)
        else:
            out.append(on_text(t,stack))
    return ''.join(out)

# ---------- структурные операции над HTML главы ----------
class Chap:
    def __init__(self,cid,h): self.id=cid; self.h=h
    def sub(self,old,new,count=1):
        n=self.h.count(old)
        assert n==count, f'[{self.id}] expected {count} got {n} for: {old[:90]!r}'
        self.h=self.h.replace(old,new)
    def sub_re(self,pat,new,count=1,flags=re.S):
        ms=list(re.finditer(pat,self.h,flags)); assert len(ms)==count, f'[{self.id}] re expected {count} got {len(ms)} for {pat[:80]!r}'
        self.h=re.sub(pat,new,self.h,flags=flags)
    def sec_bounds(self,anchor):
        st=self.h.index(f'<h2 id="/{self.id}/{anchor}" data-anchor="{anchor}">')
        nxt=self.h.find('<h2 ',st+5); end_prose=self.h.find('</div><footer class="ch-foot">',st)
        cands=[x for x in (nxt,end_prose) if x>=0]
        return st,min(cands)
    def get_sec(self,anchor):
        a,b=self.sec_bounds(anchor); return self.h[a:b]
    def cut_sec(self,anchor):
        a,b=self.sec_bounds(anchor); x=self.h[a:b]; self.h=self.h[:a]+self.h[b:]; return x
    def insert_before(self,anchor,block):
        a,_=self.sec_bounds(anchor); self.h=self.h[:a]+block+self.h[a:]
    def move(self,anchor,before):
        blk=self.cut_sec(anchor); self.insert_before(before,blk)
    def retitle(self,anchor,title):
        pat=re.compile(rf'(<h2 id="/{self.id}/{anchor}" data-anchor="{anchor}">)(.*?)(<a class="h-anchor")',re.S)
        assert pat.search(self.h), (self.id,anchor)
        self.h=pat.sub(lambda m:m.group(1)+title+m.group(3),self.h,count=1)
    def headings(self):
        return [(a,re.sub(r'<[^>]+>','',t)) for a,t in re.findall(rf'<h2 id="/{self.id}/([^"]+)" data-anchor="[^"]+">(.*?)<a class="h-anchor"',self.h,re.S)]
    def regen_toc(self):
        hs=self.headings()
        toc=''.join(f'<a href="#/{self.id}/{a}">{t}</a>' for a,t in hs)
        self.h,n=re.subn(r'(<nav class="ch-toc" aria-label="Содержание главы"><div class="ch-toc-label">В этой главе</div>).*?(</nav>)',lambda m:m.group(1)+toc+m.group(2),self.h,count=1,flags=re.S)
        links=''.join(f'<a href="#/{self.id}/{a}">{t} →</a>' for a,t in hs)
        self.h=re.sub(r'(<div class="recall-links">).*?(</div></section>)',lambda m:m.group(1)+links+m.group(2),self.h,count=1,flags=re.S)

# -*- coding: utf-8 -*-
"""Переразметка подсказок терминов: один термин — один раз в разделе, только в обычном тексте."""
import re, collections
from lib import walk

BAD_TAGS = {'a', 'button', 'code', 'pre', 'kbd', 'summary', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'svg', 'dt', 'option', 'textarea',
            'script', 'style', 'title', 'figcaption', 'nav', 'footer', 'header'}
BAD_CLS = ('sim', 'ch-toc', 'ch-foot', 'ch-head', 'quiz', 'code-head', 'code-title', 'code-lang', 'term-pop', 'gl-', 'iq-lvl', 'toc', 'src-bar', 'btn',
           'callout-head', 'stack-list', 'recall-links', 'recall-terms', 'home-', 'deep-badge', 'deep-title', 'tp-', 'crumbs', 'foot-link')
CMD = re.compile(r'(?:\b(?:npx|npm|node|git|docker|curl|cd|ls|cat|pip|pytest|tsc)\s+(?:-\S+\s+)*)$')


def scope_of(stack):
    cls = ' '.join(s[1] for s in stack)
    toks = cls.split()
    if any(x in BAD_TAGS for x in (s[0] for s in stack)): return None
    if any(any(t.startswith(b) for b in BAD_CLS) for t in toks): return None
    if 'recall' in toks: return 'recall'
    if 'idea-card' in toks: return 'idea'
    if 'prose' in toks: return 'prose'
    return None


def rewrap(chaps, REC, extra_wanted=None):
    total_before = sum(sum(c.values()) for r in REC.values() for c in r.values())
    total_after = 0
    per = {}
    for cid, ch in chaps.items():
        if cid in ('glossary',): continue
        rec = REC.get(cid)
        if cid in (extra_wanted or {}): rec = extra_wanted[cid]
        if not rec: continue
        surf = {}
        for tid, cnt in rec.items():
            for s, n in cnt.items():
                if not s or '<' in s: continue
                surf.setdefault(s, tid)
        if not surf: continue
        alts = sorted(surf, key=len, reverse=True)
        rx = re.compile(r'(?<![\w./@#\-])(' + '|'.join(re.escape(a) for a in alts) + r')(?![\w@]|-[\w]|\.\w|/|://)')
        used = set(); state = {'h2': None, 'n': 0}

        def on_text(txt, stack):
            # отслеживаем раздел (h2)
            for s in stack:
                if s[0] == 'h2':
                    mm = re.search(r'id="([^"]+)"', s[2]); state['h2'] = mm.group(1) if mm else None
                    return txt
            sc = scope_of(stack)
            if not sc or not txt.strip(): return txt
            key = (sc, state['h2'] if sc == 'prose' else None)
            out = []; pos = 0; n_here = 0
            for m in rx.finditer(txt):
                tid = surf[m.group(1)]
                if (key, tid) in used or n_here >= 2: continue
                if CMD.search(txt[max(0, m.start() - 24):m.start()]): continue
                used.add((key, tid)); n_here += 1
                out.append(txt[pos:m.start()])
                out.append(f'<button type="button" class="term" data-term="{tid}" aria-expanded="false">{m.group(1)}</button>')
                pos = m.end()
            if not out: return txt
            out.append(txt[pos:]); state['n'] += n_here
            return ''.join(out)

        ch.h = walk(ch.h, on_text)
        per[cid] = state['n']; total_after += state['n']
    return {'before': total_before, 'after': total_after, 'per': per}

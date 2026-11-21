import re,json,collections
FILES={'Matemáticas':'mat_flow.txt','Humanidades y Lengua Castellana':'dba_lenguaje-min_flow.txt','Ciencias Naturales y Educación Ambiental':'dba_c.naturales-min_flow.txt'}
STOP={'Ejemplo','Evidencias','Derechos','Matemáticas','Lenguaje','Ciencias','Grado','Para','Este','Esta','Estos','Estas','Los','Las','Una','Cada','Como','Cuando','Donde','Entre','Desde','Sobre','Según','Durante','Antes','Después','Cuál','Qué','Dado','Dadas','Dados','Considera','Observa'}
def inicio(l):
    m=re.match(r'^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}[aeé]\b',l)
    return bool(m) and m.group(0) not in STOP and not re.match(r'^(?:[mq]\s)',l)
out={}
for area,f in FILES.items():
    t=open(f,encoding='utf-8',errors='ignore').read()
    t=re.sub(r'Grad\s*\n?\s*o\s*(\d+)',r'Grado \1',t)
    L=[x.rstrip() for x in t.split('\n')]
    grado=None;res=collections.defaultdict(list);vistos=set()
    for i,l in enumerate(L):
        m=re.search(r'Grado\s+(\d+)\s*[º°]',l)
        if m and len(l)<60:grado=m.group(1)
        if l.strip()!='Evidencias de aprendizaje' or not grado:continue
        W=[]
        k=i-1
        while k>=0 and len(W)<12:
            x=L[k].strip()
            if x and not re.fullmatch(r'\d+\.',x) and 'Derechos Básicos' not in x and not re.search(r'Grado\s+\d+|\.indd|^\d+$|Ciencias Naturales •|Matemáticas •|Lenguaje •',x):
                if re.match(r'^[mq]\s',x) or x=='Ejemplo' or x=='Evidencias de aprendizaje':
                    W.append(x);break
                W.append(x)
            k-=1
        # W va de la línea más cercana a Evidencias hacia arriba
        start=None
        for idx,x in enumerate(W):
            s2=re.sub(r'^\d+\.\s*','',x)
            prev=W[idx+1] if idx+1<len(W) else ''
            if inicio(s2) and (not prev or re.search(r'[.)?!:;]$',prev) or prev=='Ejemplo' or re.match(r'^[mq]\s',prev)):
                start=idx;break
        if start is None:continue
        seg=list(reversed(W[:start+1]))
        txt=' '.join(re.sub(r'(?<!\d)\d+\.(?=\S)',' ',' '.join(seg)).split())
        txt=re.sub(r'\s+\d+\.\s*$','',txt)
        if len(txt)<25 or (grado,txt) in vistos:continue
        vistos.add((grado,txt));res[grado].append(txt)
    out[area]={g:[{'n':i+1,'t':x} for i,x in enumerate(res[g])] for g in sorted(res,key=int)}
    print(area,{g:len(v) for g,v in out[area].items()})
json.dump(out,open('dba3.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)

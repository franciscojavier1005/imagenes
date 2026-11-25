import re,glob,sys
R='/home/user/imagenes/apps_script/'
api=open(R+'Api.gs',encoding='utf-8').read()
perm=set(re.findall(r"^\s+(\w+): \[(?:'directivo'|'docente'|'publico')",api,re.M))
disp=set(re.findall(r"\b(\w+): \1\b",api))
print('permisos',len(perm),'despacho',len(disp))
print('sin función en el despacho:',sorted(perm-disp))
print('en el despacho sin permiso:',sorted(disp-perm))
PUB=set(re.findall(r"(\w+):1",re.search(r"PUBLICAS=\{([^}]*)\}",open(R+'Menu.html',encoding='utf-8').read()).group(1)))
usadas=set()
for f in glob.glob(R+'*.html'):
    s=open(f,encoding='utf-8').read()
    usadas|=set(re.findall(r"\.(?:srv\(\)|google\.script\.run)(?:\.with\w+\([^)]*\))*\.(\w+)\(",s))
    usadas|=set(re.findall(r"srv\(\)(?:\.with(?:Success|Failure)Handler\((?:function\([^)]*\)\{.*?\}|\w+)\))*\.(\w+)\(",s))
    usadas|=set(re.findall(r"API\('(\w+)'",s))
usadas={u for u in usadas if not u.startswith('with')}
faltan=sorted(u for u in usadas if u not in perm and u not in PUB)
print('llamadas de las pantallas sin permiso/función:',faltan)

import os
s='src/'
js=''.join(open(s+n).read()+'\n' for n in ['icons.js','tg.js','core.js','scenes1.js','scenes2.js','flow.js'])
html=open(s+'head.html').read()+open(s+'body.html').read()+'<script>\n'+js+'</script>\n</body>\n</html>\n'
os.makedirs('public',exist_ok=True); open('public/index.html','w').write(html); print(len(html))

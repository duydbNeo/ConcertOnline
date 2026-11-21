import json,os
d=os.path.dirname(os.path.abspath(__file__))
r=lambda n:open(os.path.join(d,'src',n),encoding='utf-8').read()
js='\n'.join(r(n) for n in ['core.js','audio.js','led.js','stage.js','env.js','performers.js','crowd.js','avatar.js','wardrobe.js','net.js','app.js'])
show=json.dumps(json.load(open(os.path.join(d,'src','show.json'),encoding='utf-8')),ensure_ascii=False).replace('</','<\\/')
bands=json.dumps(json.load(open(os.path.join(d,'src','bands.json'),encoding='utf-8')),ensure_ascii=False).replace('</','<\\/')
wardrobe=json.dumps(json.load(open(os.path.join(d,'src','wardrobe.json'),encoding='utf-8')),ensure_ascii=False).replace('</','<\\/')
vendor=open(os.path.join(d,'vendor','GLTFLoader.js'),encoding='utf-8').read()+'\n'+open(os.path.join(d,'vendor','SkeletonUtils.js'),encoding='utf-8').read()
t=r('template.html').replace('{{CSS}}',r('style.css')).replace('{{SHOW}}',show).replace('{{BANDS}}',bands).replace('{{WARDROBE}}',wardrobe).replace('{{VENDOR}}',vendor.replace('</script','<\\/script')).replace('{{JS}}',js)
open(os.path.join(d,'index.html'),'w',encoding='utf-8').write(t)
print(len(t))

# bản tĩnh cho Cloudflare: bật relay cùng nguồn
st=t.replace('</head>','<script>window.NM_RELAY="auto";</script></head>',1)
os.makedirs(os.path.join(d,'server','public'),exist_ok=True)
open(os.path.join(d,'server','public','index.html'),'w',encoding='utf-8').write(st)
print('static',len(st))

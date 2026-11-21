# Tỉ lệ và độ lệch phụ kiện theo nhân vật mẫu Quaternius (toạ độ thế giới ở tư thế gốc, mét)
import json,sys
FIT={
 'headphones':{'s':1.08,'o':[0,0,-0.005]},
 'sunglasses':{'s':0.85,'o':[0,0.008,0.012]},
 'cat_ears':{'s':1.0,'o':[0,0.07,0]},
 'flower_crown':{'s':0.95,'o':[0,0.06,0]},
 'top_hat':{'s':0.9,'o':[0,0.045,0]},
 'bandana':{'s':0.95,'o':[0,0.05,0]},
 'non_la':{'s':0.85,'o':[0,0.095,0]},
 'necklace':{'s':1.25,'o':[0,0.0,0.03]},
 'wristband':{'s':1.15,'o':[0,0,0]},
 'wings':{'s':1.0,'o':[0,0,0]},
 'lightstick':{'s':1.0,'o':[0,0,0]},
 'heart_lightstick':{'s':1.0,'o':[0,0,0]},
}
p='src/wardrobe.json'; d=json.load(open(p,encoding='utf-8'))
ov=json.load(open(sys.argv[1])) if len(sys.argv)>1 else {}
FIT.update(ov)
for slot,items in d['v3']['acc'].items():
    for it in items:
        if it['id']:
            v=FIT[it['id']]; it['fit']=v if 'all' in v else {'all':v}
json.dump(d,open(p,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))

import numpy as np, colorsys
from PIL import Image
P='/home/claude/outf/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Modular Parts/'
def rgb2hsv(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; mx=a.max(-1); mn=a.min(-1); d=mx-mn
    h=np.zeros_like(mx); m=d>1e-6
    rc=np.where(m,(mx-r)/np.where(m,d,1),0); gc=np.where(m,(mx-g)/np.where(m,d,1),0); bc=np.where(m,(mx-b)/np.where(m,d,1),0)
    h=np.where(mx==r,bc-gc,np.where(mx==g,2+rc-bc,4+gc-rc)); h=(h/6)%1.0; h=np.where(m,h,0)
    s=np.where(mx>0,d/np.where(mx>0,mx,1),0); return h,s,mx
def hsv2rgb(h,s,v):
    i=np.floor(h*6).astype(int)%6; f=h*6-np.floor(h*6)
    p=v*(1-s); q=v*(1-f*s); t=v*(1-(1-f)*s)
    r=np.choose(i,[v,q,p,p,t,v]); g=np.choose(i,[t,v,v,q,p,p]); b=np.choose(i,[p,p,t,v,v,q]); return np.stack([r,g,b],-1)
# (cloth: hue,sat,val*)  (leather: hue,sat,val*)  neon rgb
PAL={
 'midnight':dict(cloth=(0.76,0.85,0.55),leather=(0.0,0.0,0.30),neon=(1.0,0.12,0.60)),
 'cyber':   dict(cloth=(0.0,0.0,0.28),leather=(0.50,0.80,0.70),neon=(0.0,0.95,1.0)),
 'sakura':  dict(cloth=(0.93,0.22,1.55),leather=(0.07,0.45,1.05),neon=(1.0,0.55,0.85)),
 'solar':   dict(cloth=(0.03,0.90,0.95),leather=(0.0,0.0,0.22),neon=(1.0,0.70,0.10)),
 'aurora':  dict(cloth=(0.45,0.75,0.95),leather=(0.62,0.65,0.45),neon=(0.55,1.0,0.25)),
 'mono':    dict(cloth=(0.0,0.0,1.5),leather=(0.0,0.0,0.18),neon=(0.55,0.25,1.0)),
}
def run(src,N=2048):
    im=Image.open(P+src+'_BaseColor.png').convert('RGB').resize((N,N),Image.LANCZOS)
    a=np.asarray(im).astype(np.float32)/255; h,s,v=rgb2hsv(a)
    cloth=(h>0.18)&(h<0.50)&(s>0.22); leather=((h<0.13)|(h>0.95))&(s>0.22); metal=(s<0.28)&(v>0.50)
    for name,p in PAL.items():
        H,S,V=h.copy(),s.copy(),v.copy()
        for m,(ph,ps,pv) in ((cloth,p['cloth']),(leather,p['leather'])):
            H=np.where(m,ph,H); S=np.where(m,np.clip(S*0+ps*np.clip(s*1.2,0.5,1),0,1) if ps>0 else 0,S); V=np.where(m,np.clip(v*pv,0,1),V)
        rgb=hsv2rgb(H,S,V)
        Image.fromarray((np.clip(rgb,0,1)*255).astype(np.uint8)).save(f'fest/{src}_{name}_bc.png')
        mk=np.clip((metal.astype(np.float32)),0,1)[...,None]
        em=np.array(p['neon'])[None,None,:]*mk*np.clip(v[...,None]*1.2,0.4,1)
        Image.fromarray((np.clip(em,0,1)*255).astype(np.uint8)).save(f'fest/{src}_{name}_em.png')
    print(src,'cloth',cloth.mean().round(3),'leather',leather.mean().round(3),'metal',metal.mean().round(3))
run('T_Ranger'); run('T_Peasant')

def peasant_ramp(N=2048):
    im=Image.open(P+'T_Peasant_BaseColor.png').convert('RGB').resize((N,N),Image.LANCZOS)
    a=np.asarray(im).astype(np.float32)/255; lum=(a*np.array([.3,.59,.11])).sum(-1)
    lum=np.clip((lum-0.04)/0.60,0,1)[...,None]
    for name,p in PAL.items():
        ch,cs,cv=p['cloth']; lh,ls,lv=p['leather']
        # tông chính lấy từ vải; riêng bảng "đen" thì dùng da
        h,s,v=(ch,cs,min(cv,1.0)) if cs>0.05 else (lh,ls,max(min(lv*1.6,0.85),0.35))
        dark=hsv2rgb(np.array(h),np.array(min(1,s*1.0)),np.array(0.10)); mid=hsv2rgb(np.array(h),np.array(s),np.array(min(0.8,max(v,0.4)))); lite=hsv2rgb(np.array(h),np.array(s*0.35),np.array(1.0))
        out=np.where(lum<0.5,dark+(mid-dark)*(lum/0.5),mid+(lite-mid)*((lum-0.5)/0.5))
        Image.fromarray((np.clip(out,0,1)*255).astype(np.uint8)).save(f'fest/T_PeasantG_{name}_bc.png')
peasant_ramp()

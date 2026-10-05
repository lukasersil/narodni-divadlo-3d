import sys, math, os
sys.path.insert(0,'tools')
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import prep_partitions as P
E=lambda k,d: float(os.environ.get(k,d))
IN_R,OUTER,AUD_BACK,K=E('IN_R',8.9),E('OUTER',11.6),E('AUD_BACK',14.4),E('K',1.15)
PORTAL,STAGE_BACK,HW=E('PORTAL',36.6),E('STAGE_BACK',52.1),E('HW',11.4)
OUT_R=OUTER-0.45; CV=AUD_BACK+OUTER*K; FRONT=PORTAL-2.6
c,s=math.cos(P.AX_ANG),math.sin(P.AX_ANG)
def A(pts):
    u=np.array([p[0] for p in pts]); v=np.array([p[1] for p in pts]); z=v-P.AX_PIVOT
    return P.AX_SHIFT+u*c+z*s, P.AX_PIVOT-u*s+z*c
def upath(r, segs=60):
    pts=[(r,FRONT)]
    for i in range(segs+1):
        a=i/segs*math.pi; pts.append((math.cos(a)*r, CV-math.sin(a)*r*K))
    pts.append((-r,FRONT)); return pts
feat=[(A(upath(IN_R)),(255,0,0)),(A(upath(OUT_R)),(255,140,0)),(A(upath(OUTER)),(200,0,200)),
      (A([(-6.4,PORTAL),(6.4,PORTAL)]),(0,150,0)),
      (A([(-HW,PORTAL),(-HW,STAGE_BACK),(HW,STAGE_BACK),(HW,PORTAL)]),(0,120,255)),
      (A([(0,8),(0,60)]),(255,0,255))]
stairs=[(13.6,18.0,2.2,7.2),(-17.6,-13.0,-0.6,4.4),(12.8,18.4,8.8,16.4),(-15.4,-10.6,11.0,16.4),
        (13.95,17.55,29.8,34.6),(-16.2,-11.6,45.2,49.2),(-13.8,-11.4,55.8,58.8),(15.4,17.8,55.8,58.8)]
spirals=[(13.0,47.4,2.0),(6.4,84.2,2.0)]
li=int(sys.argv[1]); crop=sys.argv[2] if len(sys.argv)>2 else None
name=P.LEVELS[li-1][0]; g=P.load(name); mask=P.building_mask(g)
walls=ndimage.binary_opening(g<105, structure=np.ones((6,6)))
params,fit,to_px=P.register(mask,walls)
img=Image.open(P.PLANS/name).convert('RGB'); d=ImageDraw.Draw(img)
for (u,v),col in feat:
    x,y=to_px(params,u,v); d.line(list(zip(x,y)),fill=col,width=5)
for i,(u0,u1,v0,v1) in enumerate(stairs):
    x,y=to_px(params,np.array([u0,u1,u1,u0,u0]),np.array([v0,v0,v1,v1,v0])); d.line(list(zip(x,y)),fill=(0,190,0),width=6)
    d.text((x[0]+8,y[0]+8),'S%d'%i,fill=(0,140,0))
for (cu,cv,r) in spirals:
    a=np.linspace(0,2*math.pi,30); x,y=to_px(params,cu+np.cos(a)*r,cv+np.sin(a)*r*1.25); d.line(list(zip(x,y)),fill=(0,190,0),width=6)
if crop:
    x0,y0,x1,y1=map(int,crop.split(',')); img=img.crop((x0,y0,x1,y1))
img=img.resize((img.width*int(os.environ.get('SC','100'))//100, img.height*int(os.environ.get('SC','100'))//100)); img.save(f'{os.environ.get("OUT")}/ov3_{li}.jpg',quality=85)
print('ok',img.size)

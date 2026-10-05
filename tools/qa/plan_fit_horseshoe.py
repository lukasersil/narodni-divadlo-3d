import sys, math
sys.path.insert(0,'tools')
import numpy as np
from scipy import ndimage
import prep_partitions as P
c,s=math.cos(P.AX_ANG),math.sin(P.AX_ANG)
def a2b(u,v):
    z=v-P.AX_PIVOT; return P.AX_SHIFT+u*c+z*s, P.AX_PIVOT-u*s+z*c
def upath(R, CV, k, front, n=200):
    a=np.linspace(0,math.pi,n)
    u=np.cos(a)*R; v=CV-np.sin(a)*R*k
    # straight sides from v=CV to front
    t=np.linspace(0,1,40)
    us=np.r_[np.full(40,R), u, np.full(40,-R)]; vs=np.r_[front+(CV-front)*t, v, CV+(front-CV)*t]
    return us, vs
for li in [int(a) for a in sys.argv[1:]]:
    name=P.LEVELS[li][0]; g=P.load(name); mask=P.building_mask(g)
    walls=ndimage.binary_opening(g<105, structure=np.ones((6,6)))
    dw=ndimage.distance_transform_edt(~walls)/30.2  # metres to nearest wall pixel
    params,fit,to_px=P.register(mask,walls)
    def score(R,CV,k,front=33.5):
        u,v=upath(R,CV,k,front); bu,bv=a2b(u,v); x,y=to_px(params,bu,bv)
        xi=np.clip(x.astype(int),0,g.shape[1]-1); yi=np.clip(y.astype(int),0,g.shape[0]-1)
        return np.mean(np.minimum(dw[yi,xi],1.0))
    best=[]
    for R in np.arange(10.6,13.2,0.1):
        for CV in np.arange(26,31.5,0.25):
            for k in (1.0,1.08,1.15,1.22,1.3):
                best.append((score(R,CV,k),R,CV,k))
    best.sort()
    print('level',li+1,'outer wall best:',[(round(b[0],3),round(b[1],2),round(b[2],2),b[3],'back',round(b[2]-b[1]*b[3],2)) for b in best[:4]])
    best=[]
    for R in np.arange(8.0,10.6,0.1):
        for CV in np.arange(26,31.5,0.25):
            for k in (1.0,1.08,1.15,1.22,1.3):
                best.append((score(R,CV,k),R,CV,k))
    best.sort()
    print('level',li+1,'inner (front) best:',[(round(b[0],3),round(b[1],2),round(b[2],2),b[3],'back',round(b[2]-b[1]*b[3],2)) for b in best[:4]])

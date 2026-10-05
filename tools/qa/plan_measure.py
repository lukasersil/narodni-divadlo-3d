import sys, math
sys.path.insert(0,'tools')
import numpy as np
from scipy import ndimage
import prep_partitions as P
c,s=math.cos(P.AX_ANG),math.sin(P.AX_ANG)
def a2b(u,v):
    z=v-P.AX_PIVOT; return P.AX_SHIFT+u*c+z*s, P.AX_PIVOT-u*s+z*c
def runs1d(vals, coords, minlen=0.25):
    out=[];i=0
    while i<len(vals):
        if vals[i]:
            j=i
            while j<len(vals) and vals[j]: j+=1
            if coords[j-1]-coords[i]>=minlen: out.append((round(coords[i],2),round(coords[j-1],2)))
            i=j
        else: i+=1
    return out
for li in [int(a) for a in sys.argv[1:]]:
    name=P.LEVELS[li][0]; g=P.load(name); mask=P.building_mask(g)
    walls=ndimage.binary_opening(g<105, structure=np.ones((6,6)))
    params,fit,to_px=P.register(mask,walls)
    def sample(us,vs):
        bu,bv=a2b(us,vs); x,y=to_px(params,bu,bv)
        xi=np.clip(x.astype(int),0,g.shape[1]-1); yi=np.clip(y.astype(int),0,g.shape[0]-1)
        return walls[yi,xi]
    print('== level',li+1,name[:28])
    us=np.arange(-20,20,0.05)
    for v in (18,22,26,30,34,40,46,51):
        print(f' v={v:3d} walls at u:', runs1d(sample(us,np.full_like(us,v)),us))
    vs=np.arange(-2,62,0.05)
    for u in (-6,-3,0,3,6):
        print(f' u={u:3d} walls at v:', runs1d(sample(np.full_like(vs,u),vs),vs))

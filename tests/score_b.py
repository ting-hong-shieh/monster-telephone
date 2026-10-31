import json,glob,collections,math,os
key=json.load(open('test_b_key.json'))
ans={}
for f in glob.glob('answers/ratings/*.json'):
    d=json.load(open(f)); ans[d.get('id',os.path.basename(f)[:-5])]=d.get('data',d)
print('sample',next(iter(ans.items())))
def wilson(k,n,z=1.96):
    p=k/n;c=(p+z*z/2/n)/(1+z*z/n);h=z*math.sqrt(p*(1-p)/n+z*z/4/n/n)/(1+z*z/n);return round(c-h,3),round(c+h,3)
T=collections.Counter();N=collections.Counter();NO=collections.Counter();by=collections.defaultdict(collections.Counter);conf=collections.defaultdict(collections.Counter)
for it in key:
    c=ans[it['id']]['choice']; m=it['model']; N[m]+=1; T[m]+=c==it['creature']; NO[m]+=c=='none'
    by[m][it['creature']]+=c==it['creature']; conf[m][c]+=1
for m in ('base','student','teacher'): print(m,f"{T[m]}/{N[m]}={T[m]/N[m]:.3f}",wilson(T[m],N[m]),'none',NO[m],dict(by[m]),dict(conf[m]))
rs,rt=T['student']/N['student'],T['teacher']/N['teacher']
print('Issue 1:', 'CONFIRMED' if rt-rs>=.2 and rs<.4 else 'REFUTED' if rs>=rt-.1 and rs>=.4 else 'INCONCLUSIVE', round(rt-rs,3))
vals=[ans[it['id']]['choice'] for it in key]; print(collections.Counter(vals))

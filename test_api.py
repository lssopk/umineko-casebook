import requests
root='http://127.0.0.1:5699'
s=requests.Session()
def post(p,obj):return s.post(root+p,json=obj,headers={'Origin':root},timeout=5)
assert s.get(root+'/healthz').json()['status']=='ok'
assert s.get(root+'/api/progress').json()['level']==0
manifest=s.get(root+'/api/manifest').json()
assert len(manifest['episodes'])==8
assert '贝伦卡斯泰露' not in str(manifest)
assert s.get(root+'/api/chapter/1').status_code==403
assert s.get(root+'/api/chapter/8').status_code==403
assert s.get(root+'/chapters/ep08.json').status_code==404
assert s.get(root+'/server.js').status_code==404
assert s.get(root+'/state/cookie-secret').status_code==404
assert post('/api/unlock',{'episode':8,'typed':'EP8','confirmed':True}).status_code==409
assert post('/api/unlock',{'episode':1,'typed':'ep1','confirmed':True}).status_code==400
assert post('/api/unlock',{'episode':1,'typed':'EP1','confirmed':False}).status_code==400
assert post('/api/unlock',{'episode':1,'typed':'EP1','confirmed':True}).json()['level']==1
assert s.get(root+'/api/chapter/1').status_code==200
assert s.get(root+'/api/chapter/2').status_code==403
assert post('/api/unlock',{'episode':2,'typed':'EP2','confirmed':True}).json()['level']==2
assert s.get(root+'/api/chapter/2').json()['id']==2
assert post('/api/relock',{'from':2,'confirmed':True}).json()['level']==1
assert s.get(root+'/api/chapter/2').status_code==403
print('PASS: health, manifest, static allowlist, security gate, ordered unlock, typed confirmation, signed cookies, re-lock')

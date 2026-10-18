#!/usr/bin/env python3
import os,tempfile,subprocess,urllib.request,urllib.error,json,time,pathlib,socket
ROOT=pathlib.Path(__file__).resolve().parent
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'STATE_DIR':tmp,'PORT':'18769','HOST':'127.0.0.1','AI_API_KEY':''}
 def manage(*args,input=None):return subprocess.run(['node','manage.js',*args],cwd=ROOT,env=env,text=True,input=input,capture_output=True,check=True).stdout
 manage('set-password','--stdin',input='some-safe-password-123\n')
 keyout=manage('create-key','--name','codex');token=[l.split('=',1)[1] for l in keyout.splitlines() if l.startswith('API_TOKEN=')][0]
 p=subprocess.Popen(['node','server.js'],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 jar=None
 def api(route,method='GET',obj=None,auth=True,tokenauth=False,csrf=True):
  headers={}
  if obj is not None:headers['Content-Type']='application/json'
  if method=='POST' and not tokenauth:headers['Origin']='http://127.0.0.1:18769'
  if auth and jar and not tokenauth: headers['Cookie']=jar
  if tokenauth:headers['Authorization']='Bearer '+token
  if csrf and method not in ['GET','HEAD'] and jar and not tokenauth:headers['X-CSRF-Token']=xsrf
  req=urllib.request.Request('http://127.0.0.1:18769'+route,method=method,headers=headers,data=json.dumps(obj).encode() if obj is not None else None)
  try:
   with urllib.request.urlopen(req,timeout=6) as res:
    raw=res.read();return res.status, json.loads(raw) if res.headers.get_content_type()=='application/json' else raw.decode(),res.headers
  except urllib.error.HTTPError as e:
   raw=e.read();return e.code,json.loads(raw) if e.headers.get_content_type()=='application/json' else raw.decode(),e.headers
 try:
  for _ in range(30):
   try:
    if api('/healthz')[0]==200:break
   except Exception:time.sleep(.2)
  else:raise RuntimeError('no listening')
  assert api('/api/manifest')[0]==401
  assert '管理员登录' in api('/')[1]
  assert api('/api/auth/login','POST',{'password':'wrong!'},auth=False)[0]==401
  status,result,headers=api('/api/auth/login','POST',{'password':'some-safe-password-123'},auth=False)
  assert status==200
  jar=headers['Set-Cookie'].split(';')[0]
  xsrf=api('/api/auth/status')[1]['csrf']
  assert xsrf
  assert api('/api/manifest')[0]==200
  assert api('/api/chapter/1')[0]==403
  assert api('/api/unlock','POST',{'episode':1,'confirmed':True,'typed':'EP1'},csrf=False)[0]==403
  status,dat,head=api('/api/unlock','POST',{'episode':1,'confirmed':True,'typed':'EP1'});assert status==200,(status,dat);jar+='; '+head['Set-Cookie'].split(';')[0]
  assert api('/api/chapter/1')[0]==200
  assert api('/api/agent/chapters/2',tokenauth=True)[0]==403
  status,data,_=api('/api/room/1/messages','POST',{'type':'hypothesis','content':'EP1 的密室是否有不同解释？'})
  assert status==201,data
  msgid=data['message']['id']
  status,data,_=api('/api/agent/jobs',tokenauth=True)
  assert status==200 and len(data['jobs'])==1,data
  jobid=data['jobs'][0]['id']
  status,data,_=api('/api/agent/jobs/'+jobid+'/claim','POST',{},tokenauth=True)
  assert status==200 and data['message']['id']==msgid
  status,data,_=api('/api/agent/jobs/'+jobid+'/complete','POST',{'reply':'一种解释是时间差，另一种是证言存在偏差，需要更多线索。'},tokenauth=True)
  assert status==200
  status,data,_=api('/api/room/1/messages')
  assert status==200 and len(data['messages'])==2
  status,data,_=api('/api/agent/chapters/1','PATCH',{'changes':{'lead':'EP1 增强版简介，仅使用本章知识。'}},tokenauth=True)
  assert status==200,data
  assert api('/api/chapter/1')[1]['lead']=='EP1 增强版简介，仅使用本章知识。'
  status,dat,head=api('/api/relock','POST',{'from':1,'confirmed':True});assert status==200,(status,dat);jar=jar.split('; ')[0]+'; '+head['Set-Cookie'].split(';')[0]
  assert api('/api/agent/chapters/1',tokenauth=True)[0]==403
  assert api('/api/room/1/messages')[0]==403
  assert api('/api/auth/logout','POST',{})[0]==200
  print('UPGRADE API SMOKE TEST PASSED')
 finally:
  p.terminate();p.wait(timeout=10)

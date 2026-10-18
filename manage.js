#!/usr/bin/env node
'use strict';
// CLI: node manage.js set-password [--stdin]; create-key --name codex; list-keys; revoke-key ID
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const state=process.env.STATE_DIR||path.join(__dirname,'state');fs.mkdirSync(state,{recursive:true});const file=path.join(state,'auth.json');
const read=()=>{try{return JSON.parse(fs.readFileSync(file))}catch(e){if(e.code==='ENOENT')return {password:null,keys:[],sessionVersion:'initial'};throw e}};
const save=c=>{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(c,null,2),{mode:0o600});fs.renameSync(tmp,file)};
const arg=process.argv[2];const c=read();
if(arg==='has-password'){process.exit(c.password?0:1)}
if(arg==='set-password'){
 if(!process.argv.includes('--stdin')){console.error('请使用 --stdin 从标准输入传递新密码，避免 shell history 记录');process.exit(1)}
 let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>input+=x);process.stdin.on('end',()=>{const pw=input.replace(/[\r\n]+$/,'');if(pw.length<12){console.error('管理员密码至少12个字符');process.exitCode=1;return}const salt=crypto.randomBytes(16);c.password={salt:salt.toString('hex'),hash:crypto.scryptSync(pw,salt,32).toString('hex')};c.sessionVersion=crypto.randomBytes(16).toString('hex');save(c);console.log('管理员密码已更新，原登录会话失效。')});
}else if(arg==='create-key'){
 const name=process.argv.includes('--name')?process.argv[process.argv.indexOf('--name')+1]:'codex';if(!name||name.length>80)throw Error('bad key name');const key='cbk_'+crypto.randomBytes(32).toString('base64url');const id='key_'+crypto.randomBytes(6).toString('hex');const scopes=['jobs:read','jobs:write','chapters:read','chapters:write','messages:read','messages:write'];c.keys.push({id,name,hash:crypto.createHash('sha256').update(key).digest('hex'),scopes,revoked:false,createdAt:new Date().toISOString()});save(c);console.log('KEY_ID='+id+'\nAPI_TOKEN='+key+'\n仅显示一次，请保存到外部 AI 平台的安全 Secrets，勿写入 GitHub/浏览器/聊天记录。');
}else if(arg==='list-keys'){for(const k of c.keys)console.log(JSON.stringify({id:k.id,name:k.name,scopes:k.scopes,revoked:k.revoked,createdAt:k.createdAt}))
}else if(arg==='revoke-key'){const key=c.keys.find(x=>x.id===process.argv[3]);if(!key){console.error('找不到密钥 ID');process.exitCode=1}else{key.revoked=true;save(c);console.log('已撤销 '+key.id)}}
else{console.log('命令: node manage.js set-password --stdin | create-key --name codex | list-keys | revoke-key ID | has-password');process.exitCode=1}

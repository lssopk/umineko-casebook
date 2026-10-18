'use strict';
const form=document.getElementById('loginForm'),message=document.getElementById('loginError');
form.addEventListener('submit',async e=>{e.preventDefault();message.textContent='正在验证…';const btn=form.querySelector('button');btn.disabled=true;
try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({password:document.getElementById('password').value})});const data=await response.json();if(!response.ok)throw Error(data.error==='admin_not_configured'?'网站管理员尚未初始化':data.error==='too_many_attempts'?'尝试次数过多，请稍后再试':'密码不正确');window.location.assign('/');}catch(err){message.textContent=err.message;btn.disabled=false;}});

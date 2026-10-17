from playwright.sync_api import sync_playwright
import json,pathlib
root=pathlib.Path(__file__).parent
manifest=json.loads((root/'public/manifest.json').read_text())
chapters={i:json.loads((root/f'chapters/ep{i:02d}.json').read_text()) for i in range(1,9)}
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  script='''window.__testLevel = 0;
  const MANIFEST=__META__, CHAPTERS=__CHAPTERS__;
  window.fetch=async (url,opts={})=>{
    let status=200, body={};url=String(url);
    if(url.includes('/api/progress'))body={level:window.__testLevel};
    else if(url.includes('/api/manifest'))body={episodes:MANIFEST};
    else if(url.includes('/api/unlock')){let value=JSON.parse(opts.body);if(value.episode>window.__testLevel+1)status=409;else window.__testLevel=value.episode;body={level:window.__testLevel}}
    else if(url.includes('/api/relock')){let value=JSON.parse(opts.body);window.__testLevel=Math.min(window.__testLevel,value.from-1);body={level:window.__testLevel}}
    else if(url.includes('/api/chapter/')){let id=Number(url.split('/').pop());if(id>window.__testLevel)status=403;else body=CHAPTERS[id]}
    return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
  };'''.replace('__META__',json.dumps(manifest,ensure_ascii=False)).replace('__CHAPTERS__',json.dumps(chapters,ensure_ascii=False))
  page.set_content((root/'public/index.html').read_text(),wait_until='domcontentloaded')
  page.add_style_tag(content=(root/'public/style.css').read_text())
  page.evaluate(script)
  page.add_script_tag(content=(root/'public/app.js').read_text())
  page.wait_for_timeout(400)
  print('cards',page.locator('.episode-card').count(), 'errors',errors)
  assert page.locator('.episode-card').count()==8
  assert '尚未解锁' in page.locator('#progressBadge').inner_text()
  assert '黄金魔女的回合' not in page.locator('body').inner_text()
  page.screenshot(path=str(root/'docs/desktop-locked.png'),full_page=True)
  page.locator('.episode-card[data-episode="2"]').click()
  assert page.locator('#modalShade').is_hidden()
  page.locator('.episode-card[data-episode="1"]').click()
  assert page.locator('#modalShade').is_visible()
  assert page.locator('#modalConfirm').is_disabled()
  page.locator('#unlockCheckbox').check();page.locator('#unlockInput').fill('EP1')
  assert page.locator('#modalConfirm').is_enabled()
  page.locator('#modalConfirm').click();page.wait_for_timeout(150)
  assert '黄金魔女的传说' in page.locator('#chapterHeading').inner_text()
  page.screenshot(path=str(root/'docs/desktop-chapter.png'),full_page=True)
  page.locator('aside [data-page="relations"]').click()
  assert page.locator('.person').count()==20
  page.locator('.person[data-person="battler"]').click()
  assert '右代宫战人' in page.locator('#personInspector').inner_text()
  page.screenshot(path=str(root/'docs/desktop-relations.png'),full_page=False)
  page.locator('aside [data-page="timeline"]').click()
  assert page.locator('.time-entry').count()==10
  page.locator('aside [data-page="evidence"]').click()
  assert page.locator('.evidence-card').count()==5
  page.locator('aside [data-page="notes"]').click()
  page.locator('input[name="title"]').fill('测试假说')
  page.locator('textarea[name="reason"]').fill('观察证据与解释')
  page.locator('#notesForm button[type="submit"]').click()
  assert '测试假说' in page.locator('#notesList').inner_text()
  page.locator('aside [data-page="dashboard"]').click()
  page.locator('.episode-card[data-episode="2"]').click()
  assert page.locator('#modalShade').is_visible()
  page.locator('#modalCancel').click()
  assert page.locator('#modalShade').is_hidden()
  page.locator('.episode-card[data-episode="2"]').click()
  page.locator('#unlockCheckbox').check();page.locator('#unlockInput').fill('EP2')
  page.locator('#modalConfirm').click();page.wait_for_timeout(150)
  assert '黄金魔女的回合' in page.locator('#chapterHeading').inner_text()
  assert not errors,errors
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
  mobile.set_content((root/'public/index.html').read_text(),wait_until='domcontentloaded')
  mobile.add_style_tag(content=(root/'public/style.css').read_text())
  mobile.evaluate(script)
  mobile.add_script_tag(content=(root/'public/app.js').read_text());mobile.wait_for_timeout(250)
  mobile.screenshot(path=str(root/'docs/mobile-locked.png'),full_page=True)
  assert mobile.locator('.episode-card').count()==8
  print('PASS: local front-end injection: spoiler-safe default, chapter unlock, family tree, timeline, evidence, note creation, mobile')
  browser.close()

# -*- coding: utf-8 -*-
"""以 Felix 原版为基底，挂接参考版的 V2~V9 扩展增量，并加入本地化层与无敌模式。

2026-11 追加：手机端移动修复（mobile-fix.css / mobile-fix.js）、
              暂停面板「返回主菜单」修复（menu-fix.js）。

注意：BASE / REF 是本地未随仓库分发的构建基底，本脚本用于说明补丁如何复现；
      仓库里的成品 index.html 由同一套注入规则产出。
"""
import os

BASE   = 'Saltline/index.en.html'      # 原版（抓取自 Claude artifact 的纯净英文版）
REF    = '_ref/aggie.html'             # 公开修改版，仅取增量
I18N   = 'Saltline/i18n.source.js'
FIXCSS = 'mobile-fix.css'              # 手机端移动修复样式
FIXJS  = 'mobile-fix.js'               # 运行时手势兜底（不依赖 CSS）
MENUJS = 'menu-fix.js'                 # 暂停面板「返回主菜单」修复
OUT    = 'Saltline/index.html'

orig = open(BASE, encoding='utf-8').read()
ref  = open(REF,  encoding='utf-8').read()
fixcss = open(FIXCSS, encoding='utf-8').read()
fixjs = open(FIXJS, encoding='utf-8').read()
menujs = open(MENUJS, encoding='utf-8').read()

# 线上特有：国内访问 fonts.googleapis.com 会长时间挂起，渲染阻塞的
# <link rel=stylesheet> 会推迟后续内联脚本执行，造成初始化时序差异 -> 改为非阻塞
import re as _reFont
_fm = _reFont.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>', orig)
assert _fm, 'font stylesheet link missing'
orig = orig[:_fm.start()] + _fm.group(0).replace(
    '<link ', '<link media="print" onload="this.media=\'all\'" ') + orig[_fm.end():]

# 参考版的第 2 个 <style> 与第 2 个 <script> 就是全部扩展增量
s2 = ref.find('<style>', 31000);  e2 = ref.find('</style>', s2) + len('</style>')
s3 = ref.find('<script>', 1456900); e3 = ref.find('</script>', s3) + len('</script>')
style2, ext = ref[s2:e2], ref[s3:e3]

BRAND = [
 ('Aggie速记英语3A大作 · V6', 'Saltline · Extended'),
 ('Aggie速记英语3A大作', 'Saltline · Extended'),
 ('Aggie速记英语 · 3A 大作', 'Saltline · Extended'),
 ('Aggie速记英语突击小队', '港务局突防小队'),
 ('Aggie速记英语港区', '盐线港区'),
 ('Aggie速记英语队员', '突防队员'),
 ('Aggie速记英语九式突击步枪', '九式突击步枪'),
 ('Aggie速记英语启动失败：', 'Saltline 启动失败：'),
 ('Aggie速记英语性能测试', 'Saltline 性能测试'),
 ('Aggie速记英语制式步枪', '制式步枪'),
 ('Aggie速记英语', 'Saltline'),
 ('Aggie 的大小写', 'SALTLINE 的大小写'),
 ("'aggie.v2'", "'saltline.v2'"),
]
def debrand(t):
    for a, b in BRAND: t = t.replace(a, b)
    return t
style2, ext = debrand(style2), debrand(ext)

import re as _re
_pat = _re.compile(r'weapon\.(name|damage|rpm|magSize)\s*=\s*([^;]+);')
ext, _n = _pat.subn(lambda m: "window.__saltlineSetWeapon('%s', %s);" % (m.group(1), m.group(2).rstrip()), ext)
print('weapon setter shim:', _n, 'sites')
assert _n >= 7, _n

# 返回主菜单修复：扩展插入的按钮调了一个不存在的 game.toTitle()，改成走引擎状态机
OLD = "b.addEventListener('click', () => { if (typeof game.toTitle === 'function') game.toTitle(); });"
NEW = "b.addEventListener('click', () => { if (typeof window.__saltlineToTitle === 'function') window.__saltlineToTitle(); });"
assert ext.count(OLD) == 1, '返回主菜单按钮回调锚点变化'
assert ext.count(NEW) == 0
ext = ext.replace(OLD, NEW, 1)

# 无敌补丁：不扣血 + 不派发 player:dead（双保险，受击反馈保留）
p1 = 'A.health=Math.max(0,A.health-J)'
p2 = 'A.health<=0&&(A.alive=!1'
assert orig.count(p1) == 1 and orig.count(p2) == 1
orig = orig.replace(p1, 'A.health=window.__saltlineGod?A.health:Math.max(0,A.health-J)', 1)
orig = orig.replace(p2, 'A.health<=0&&!window.__saltlineGod&&(A.alive=!1', 1)

# 手机端移动修复 ①：左摇杆热区由 45% 放宽到 50%（左右正好分屏）
anchor = 'innerWidth*.45'
assert orig.count(anchor) == 1, 'innerWidth*.45 anchor missing/changed'
orig = orig.replace(anchor, 'innerWidth*.5', 1)

# 手机端移动修复 ②：自检上游仍含那条会破坏触摸的 CSS，避免「0 命中」被当成成功
assert style2.count('body { touch-action: manipulation; }') == 1, \
    'upstream touch-action rule changed, review mobile-fix.css'

# 原版把 weapon.name/damage/rpm/magSize 定义成不可配置的只读 getter，
# 参考扩展直接赋值会在严格模式下抛 TypeError 并中断 refreshWeapon。
# 这里给扩展的赋值加一层安全写入：能写就写，写不了就落到 b.slot（name / magSize）。
prelude = (
    '<script>'
    'try{window.__saltlineGod=localStorage.getItem("saltline.god")==="1"}catch(e){window.__saltlineGod=false};'
    'window.__saltlineSetWeapon=function(k,v){"use strict";'
    'var G=window.__G,w=G&&G.weapon;if(!w)return;'
    'try{w[k]=v;return}catch(e){}'
    'if(k!=="name"&&k!=="magSize")return;'
    'try{var sl=w.slots,s=null,i;if(sl){'
    'for(i in sl){if(sl[i]&&sl[i].name===w.name){s=sl[i];break}}'
    'if(!s)s=sl[Object.keys(sl)[0]];if(s)s[k]=v;}}catch(e2){}'
    '};'
    '</script>'
)
assert orig.count('</head>') == 1
# 手机端移动修复 ③：补丁样式放在最后，确保覆盖扩展注入的 body{touch-action:manipulation}
orig = orig.replace('</head>',
                    prelude + '\n' + style2 + '\n<style>\n' + fixcss + '\n</style>\n'
                    + '<script>\n' + fixjs + '\n</script>\n'
                    + '<script>\n' + menujs + '\n</script>\n</head>', 1)

i18n = open(I18N, encoding='utf-8').read()
i18n = i18n.replace("let lang = 'en';", "let lang = 'zh';")
i18n = i18n.replace("localStorage.getItem(STORE_KEY) === 'zh' ? 'zh' : 'en'",
                    "localStorage.getItem(STORE_KEY) === 'en' ? 'en' : 'zh'")
assert "let lang = 'zh';" in i18n
assert '</script' not in ext[len('<script>'):-len('</script>')].lower()
assert '</script' not in i18n.lower()
assert orig.count('\n</body>') == 1
orig = orig.replace('\n</body>', '\n' + ext + '\n<script>\n' + i18n + '\n</script>\n</body>', 1)
open(OUT, 'w', encoding='utf-8', newline='').write(orig)
print('built', OUT, os.path.getsize(OUT), 'bytes')

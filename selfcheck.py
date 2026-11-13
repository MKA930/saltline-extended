# -*- coding: utf-8 -*-
"""成品 index.html 的静态自检。

每条检查都带期望命中数，用来区分「0 命中 = 上游已变」和「扫描器/注入失效」，
避免把静默失败当成修复成功。运行：python3 selfcheck.py
"""
import sys

P = 'index.html'
s = open(P, encoding='utf-8').read()

# (说明, 锚点, 期望出现次数)
CHECKS = [
    ('扩展注入的冲突规则仍在（它没被删，是被覆盖）', 'body { touch-action: manipulation; }', 1),
    ('修复样式已注入',                              '/* Saltline · 手机端移动修复（v2', 1),
    ('全链 touch-action:none 覆盖',                 'html, body, #app, #view {', 1),
    ('命中链全覆盖（WebKit 看命中元素）',          '#app, #app *, canvas {', 1),
    ('页面固定定位禁滚动/橡皮筋',                  'position: fixed !important', 1),
    ('运行时手势兜底已注入',                      'Saltline · 手机端移动修复 · 运行时手势兜底', 1),
    ('捕获阶段 passive:false 兜底',                "addEventListener('touchstart', guard, { capture: true, passive: false })", 1),
    ('真机诊断对象已暴露',                        'window.__saltlineMobileDiag = d;', 1),
    ('外部字体改为非阻塞',                        'media="print" onload=', 1),
    ('竖屏按钮归位规则',                           '@media (orientation: portrait) and (max-width: 520px)', 1),
    ('摇杆热区已放宽到 50%',                       'innerWidth*.5', 1),
    ('旧 45% 阈值已移除',                          'innerWidth*.45', 0),
    ('原版 canvas 规则仍在',                       '#view { position: absolute; inset: 0;', 1),
    ('返回主菜单空回调已移除',                    "if (typeof game.toTitle === 'function') game.toTitle();", 0),
    ('返回主菜单新回调已注入',                    'window.__saltlineToTitle();', 1),
    ('返回主菜单实现已注入',                      '/* Saltline · 暂停面板「返回主菜单」修复', 1),
    ('回主菜单走引擎状态机',                      "G.events.emit('game:state', { state: 'title', prev: prev })", 1),
    ('菜单切回 title',                            "call(menus, 'show', 'title')", 1),
]

fail = 0
for desc, needle, want in CHECKS:
    got = s.count(needle)
    ok = got == want
    fail += not ok
    print('%s  %-46s expect=%d got=%d' % ('PASS' if ok else 'FAIL', desc, want, got))

# 顺序断言：补丁必须在扩展样式之后，否则 !important 之前的同权重规则仍可能生效
a = s.find('body { touch-action: manipulation; }')
b = s.find('/* Saltline · 手机端移动修复')
ok = a > 0 and b > a
fail += not ok
print('%s  %-46s ext@%d fix@%d' % ('PASS' if ok else 'FAIL', '补丁位于扩展样式之后', a, b))

# 顺序断言2：兜底 JS 必须在补丁 CSS 之后、且位于 head 内（捕获阶段尽早注册）
c = s.find('Saltline · 手机端移动修复 · 运行时手势兜底')
h = s.find('</head>')
ok = c > b >= 0 and 0 < h and c < h
fail += not ok
print('%s  %-46s css@%d js@%d head@%d' % ('PASS' if ok else 'FAIL', '兜底 JS 在 CSS 之后且位于 head 内', b, c, h))

# 顺序断言3：菜单修复脚本在手势兜底之后、且同样位于 head 内
m = s.find('/* Saltline · 暂停面板「返回主菜单」修复')
ok = 0 <= c < m < h
fail += not ok
print('%s  %-46s js@%d menu@%d head@%d' % ('PASS' if ok else 'FAIL', '菜单修复 JS 在兜底之后且位于 head 内', c, m, h))

print('\n%s  size=%d bytes' % ('FAILED' if fail else 'ALL PASS', len(s.encode('utf-8'))))
sys.exit(1 if fail else 0)

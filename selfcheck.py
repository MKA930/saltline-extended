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
    ('修复样式已注入',                              'Saltline · 手机端移动修复', 1),
    ('全链 touch-action:none 覆盖',                 'html, body, #app, #view {', 1),
    ('竖屏按钮归位规则',                           '@media (orientation: portrait) and (max-width: 520px)', 1),
    ('摇杆热区已放宽到 50%',                       'innerWidth*.5', 1),
    ('旧 45% 阈值已移除',                          'innerWidth*.45', 0),
    ('原版 canvas 规则仍在',                       '#view { position: absolute; inset: 0;', 1),
]

fail = 0
for desc, needle, want in CHECKS:
    got = s.count(needle)
    ok = got == want
    fail += not ok
    print('%s  %-46s expect=%d got=%d' % ('PASS' if ok else 'FAIL', desc, want, got))

# 顺序断言：补丁必须在扩展样式之后，否则 !important 之前的同权重规则仍可能生效
a = s.find('body { touch-action: manipulation; }')
b = s.find('Saltline · 手机端移动修复')
ok = a > 0 and b > a
fail += not ok
print('%s  %-46s ext@%d fix@%d' % ('PASS' if ok else 'FAIL', '补丁位于扩展样式之后', a, b))

print('\n%s  size=%d bytes' % ('FAILED' if fail else 'ALL PASS', len(s.encode('utf-8'))))
sys.exit(1 if fail else 0)

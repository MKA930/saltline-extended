# 改造记录 / Build Report

基于 Felix Rieseberg 原版《Saltline》（英文单文件）做本地化与功能扩展。基底保持原版纯净，只从参考二开版抽取 V2~V9 扩展增量（第二个 `<style>` 与第二个 `<script>`）挂到原版引擎上。

## 摘要

| 症状 | 根因 | 修复 | 验证 |
|---|---|---|---|
| 点击 DEPLOY 后扩展模块报错，部分功能失效 | 原版把 `weapon.name/damage/rpm/magSize` 定义为不可配置的只读 getter，扩展直接赋值在严格模式抛 `TypeError` 并中断 `refreshWeapon` | 用正则把 7 处赋值改为安全写入垫片（`name`/`magSize` 回落到 `weapon.slots`，其余静默跳过） | 部署后 `window.__errors` 为空 |
| 切到英文后界面残留 108 条中文 | 扩展模块自带中文 UI，没有英文原文，无法回译 | 新增 `ZH2EN`（96 条）+ 由主字典反查的 `REV`，中文节点也保存原文，英文模式显式回译 | 残留降到 1 条（语言按钮自身的「中文」标签，设计如此） |

## Case 1 — 扩展模块部署时 TypeError

### Symptom
点击 DEPLOY 进入游戏后，控制台出现 `TypeError: Cannot assign to read only property 'name' of object '#<Object>'`，扩展 HUD（九把枪、载具、空战）部分失效。

### Diagnosis
假设检验：
- 假设 A：扩展 JS 自身逻辑错误 → 排除：在参考版原环境正常运行。
- 假设 B：原版与参考版 `weapon` 对象结构不同 → 决定性测试：实机读取 `Object.getOwnPropertyDescriptor(weapon,'name')`，确认原版将其定义为 `{get, configurable:false, writable:false}` 的只读 getter，值来自闭包 `b.slot`/`b.def`。

### Repair
在 `build.py` 注入安全写入垫片 `window.__saltlineSetWeapon(k,v)`：
- 先尝试直接赋值；失败则对 `name`/`magSize` 回落到 `weapon.slots[当前槽].<k>`。
- 用正则把扩展中的 `weapon.(name|damage|rpm|magSize) = X;` 全部改写为 `window.__saltlineSetWeapon('k', X);`，共 7 处。

### Verification
部署后 `errors: []`；九把枪标签、军需箱、铁壁号、地图、载具、雷达 HUD 全部正常渲染。

## Case 2 — 英文模式中文残留

### Symptom
`O.setLang('en')` 后，主菜单与扩展 HUD 仍残留 108 条中文文本节点。

### Diagnosis
本地化层默认只处理"英文原文 → 中文译文"，并依赖节点首次出现时的英文原文做回译。但扩展模块在运行时二次把中文写死进 DOM（无英文原文），`REV` 表中没有对应映射。

### Repair
- 主字典反向：遍历 `DICT` 建立 `REV[中文] -> 英文`。
- 新增 `ZH2EN`（96 条）覆盖扩展模块特有中文（突击/霰弹/铁壁号/四号泊位/干扰弹/加力/高度 等）。
- 文本处理时，中文节点也保存原文到 `ORIG`，英文模式优先用 `REV` 回译。

### Verification
英文模式中文残留从 108 降到 1；唯一保留的是语言按钮自身的「中文」标签（切换入口，设计如此）。

## 横向发现
- 原版引擎把武器伤害 / 射速做成只读 getter，导致"战场强化"中的伤害/射速升级无法写回（弹匣容量、武器名可以）。这是原版本身的限制，非本改造引入。
- 中文节点必须保存原文，否则英文模式无法回译；只保存"含英文字母"节点的旧逻辑会漏掉纯中文节点。

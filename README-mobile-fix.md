# Saltline Extended · 手机端无法移动 修复说明

## 现象

手机浏览器打开游戏，点「开始行动」后按住屏幕拖动，角色不走或拖动断续。

> 操作方式本来是：**左半屏任意位置按住拖动 = 移动**，**右半屏滑动 = 转视角**。摇杆默认不显示，按住左半屏才出现。

## 根因

扩展 V6 的「手机触屏修复」在第二个 `<style>` 注入了 `body { touch-action: manipulation; }`（成品 `index.html` 第 660 行）。`manipulation` 明确允许平移与双指缩放，浏览器从 `touchstart` 起就进入滚动手势；原版只有 `#view { touch-action: none }`，管不到 body 的手势决策。结果 `touchmove` 变成 `cancelable=false`，canvas 上 `passive:false` 的 `preventDefault()` 被忽略（控制台刷 `Ignored attempt to cancel ...`），滑动被系统手势接管，iOS Safari / 微信 WebView 尤其明显。

两个叠加问题：V3/V9 新增的 `.t-swap` / `.t-flare` 在 390px 竖屏下用 `right:162px`，按钮左边缘落在 x≈180 的屏幕中线且 `pointer-events:auto`，按屏幕中间只会换枪、不会移动；摇杆热区又只有左 45%。

## 最终修复（3 处）

| # | 位置 | 改动 |
|---|---|---|
| 1 | `mobile-fix.css` | `html, body, #app, #view` 全链 `touch-action: none !important`，覆盖冲突规则 |
| 2 | `mobile-fix.css` | 竖屏 ≤520px 把 `.t-swap` / `.t-flare` 收回右侧，不再侵占左半屏 |
| 3 | `index.html` / `build.py` | 摇杆判定 `innerWidth*.45` → `innerWidth*.5`，左右正好分屏 |

没有改动游戏逻辑、事件绑定和本地化层。

## 实测对照

Chrome 手机模拟 390×844 + CDP 真实触摸事件，同一脚本跑原版与修复版：

| 指标 | 原版 | 修复版 |
|---|---|---|
| `touchstart` / `touchmove` 的 `cancelable` | `false` | `true` |
| `preventDefault` 被忽略报错 | 8 条 | **0 条** |
| `body` 计算后的 `touch-action` | `manipulation` | `none` |
| 左半屏拖动的位移 | 2.19 | **3.42** |
| 屏幕中央 (x=200) 的触摸目标 | `.t-btn.t-swap`（按钮吃掉） | `#view`（穿透到画布） |

## 验证命令

```bash
cd saltline-extended
python3 selfcheck.py                 # 静态自检，全部 PASS 才算注入成功
python3 -m http.server 8898          # 本地起服务
```

浏览器打开 `http://127.0.0.1:8898/index.html`，开发者工具切 iPhone 设备，点「开始行动」，左半屏按住向上拖动，角色应持续前进、松手即停；控制台不应再出现 `Ignored attempt to cancel`。

## 部署

- 直接用成品：把本目录 `index.html` 覆盖仓库根目录同名文件即可，单文件离线可跑，GitHub Pages 立即生效。
- 从源码重建：`build.py` 已把 `mobile-fix.css` 作为输入并注入；它依赖原版 `Saltline/index.en.html` 与 `_ref/aggie.html`（精简交付里未包含）。

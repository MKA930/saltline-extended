# Saltline Extended · 手机端无法移动 修复说明

> **v3（决定性修复 · 线上 / iOS WebKit）**：真机 `?diag=1` 排查发现，事件链路其实是健康的——`touch-action:none` 生效、`preventDefault()` 被接受（`prevented` 计数在涨）、命中元素 `elementFromPoint=view`、左半屏判定正确，但引擎内部 `input.move` 始终为 `0`，角色就是不走。根因是 iOS 上引擎自身的 `touch → input.move` 换算链路失效（手指追踪 / `Touch.identifier` 匹配 / 归一化向量没有产出），与手势层无关。v3 新增 `stick-fix.js`：自己跟踪左半屏手指算出归一化摇杆向量，**包装 `input.update`**，在引擎算完之后直接用我们的向量覆盖 `input.move`（右半屏同理补视角），彻底绕开这条失效链路；并在 `touchend / touchcancel / blur` 时把向量归零，避免松手后角色继续走。
>
> v2 的 CSS 禁手势 + 运行时 `preventDefault()` 兜底 + `?diag=1` 浮层仍需保留：它们保证事件能干净送达游戏区域、不被系统手势吞掉，也是桌面 / 本地 `file://` 跑通的基础；但要真正让 iOS 移动，必须有 v3 的向量注入。
>
> 真机自查：访问 `https://MKA930.github.io/saltline-extended/?diag=1`，左上角浮层实时显示 `body/#view` 的 `touch-action`、`input.touch` / `input.move`、`stick=x=.. y=.. act=..`、包装器 `wrapped=..`、触摸坐标与左半屏判定、命中元素、以及 `prevented/blocked/touchcancel` 计数。

## 现象

手机浏览器打开游戏，点「开始行动」后按住屏幕拖动，角色不走或拖动断续。

> 操作方式本来是：**左半屏任意位置按住拖动 = 移动**，**右半屏滑动 = 转视角**。摇杆默认不显示，按住左半屏才出现。

## 排查时间线

1. **v1（CSS 静态修复）**：本地直接双击 `index.html` 可移动；但线上 Pages 在 iOS Safari / iOS Chrome（同为 WebKit）仍不行。
2. **v2（手势层加固）**：三个 URL（本地 `file://`、本地 `http://`、线上 `https://`）抓取结果 sha256 一致且 `X-Cache: MISS`，排除缓存；差异来自线上页面是可滚动文档、WebKit 手势判定更早且依赖命中元素自身的 `touch-action`，以及一个渲染阻塞的 Google Fonts 请求。v2 做了整棵 DOM 树禁默认手势、`html/body` 固定定位、捕获阶段 `preventDefault()` 兜底、字体非阻塞、竖屏按钮收回右侧、热区 45%→50%。本地 / headless / 真机对照一度显示「数值在变」，但**真机角色仍不走**。
3. **v3（根因定位 + 向量注入）**：真机 `?diag=1` 截图把根因钉死——`prevented` 在涨、`blocked=0`、`touchcancel=0`、命中 `view`、左半屏判定正确，但 **`input.move=0.00,0.00` 恒定**。说明不是手势被接管，而是事件已送达、引擎内部没产出移动向量。于是绕开内部链路，自己算摇杆向量并直接写 `input.move`。

## 根因（最终结论）

引擎内部有一套自己的触屏→移动换算：在 `touchstart` 里记录左半屏手指的 `Touch.identifier`，在 `touchmove` 里按 `identifier` 匹配该手指、计算相对起点的偏移并归一化为 `input.move`。这套路径在 iOS Safari / 微信 WebView 上**静默失效**——手指追踪或向量换算没有产出，`input.move` 恒为 `[0,0]`，所以人物不移动。

与之无关、但曾被怀疑并已排除的因素：

- `touch-action: manipulation` 接管滚动（v1 修了，是必要但不是决定性的）；
- `preventDefault()` 被忽略 / 系统手势吞事件（v2 已兜底、真机 `prevented` 在涨，排除）；
- 按钮遮挡（竖屏按钮已收回右侧、热区已分屏，排除）；
- 返回主菜单后的状态残留（真机首次进入也无法移动，排除）；
- 缓存（多浏览器 + `X-Cache:MISS` + 远端 blob sha 一致，排除）。

## 修复总览

| # | 文件 | 作用 | 阶段 |
|---|---|---|---|
| 1 | `mobile-fix.css` | `html, body, #app, #view` 全链 `touch-action: none !important` | v1/v2 |
| 2 | `mobile-fix.css` | `#app, #app *, canvas` 命中链全覆盖（WebKit 看命中元素本身） | v1/v2 |
| 3 | `mobile-fix.css` | `html, body` 固定定位 + `overflow:hidden`，消除 iOS 橡皮筋 / 下拉刷新 | v1/v2 |
| 4 | `mobile-fix.js` | window 捕获阶段 `passive:false` 对游戏区域 `preventDefault()`，不依赖 CSS 兜底 | v2 |
| 5 | `index.html` / `build.py` | Google Fonts 改为 `media="print" onload` 非阻塞 | v2 |
| 6 | `mobile-fix.css` | 竖屏 ≤520px 把 `.t-swap` / `.t-flare` 收回右侧，不侵占左半屏 | v2 |
| 7 | `index.html` / `build.py` | 摇杆判定 `innerWidth*.45` → `innerWidth*.5`，左右正好分屏 | v2 |
| 8 | `mobile-fix.js` | `?diag=1` 真机诊断浮层（含 `input.move` / `stick=` / `wrapped=`） | v2/v3 |
| 9 | **`stick-fix.js`** | **包装 `input.update`，引擎算完后用自算摇杆向量覆盖 `input.move`；松手 / 失焦归零** | **v3（决定性）** |

没有改动引擎原始事件绑定与本地化层；`stick-fix.js` 只在 `input.update` 之后补写向量，属于「结果层」修补，不影响其它输入路径。诊断层（`?diag=1`）保留。

## 实测对照

- **headless WebKit 模拟**（CDP 真实触摸事件，左半屏拖动）：拖动期间 `stick=x=0 y=1 act=true`、`input.move=[0,1]`、玩家位移 `dx≈5.9`；松手后 `input.move` 正确归零 → PASS。
- **隔离测试**：不触发任何触摸、仅手动把 `window.__saltlineStick={x:1,y:0,active:true}` 写入，引擎 `input.move` 即变为 `[1,0]` 且角色移动 → 证明包装器本身能驱动移动，与那条坏的引擎触摸链路无关。
- **真机（用户）**：iOS 上原来 `input.move` 恒为 0、角色不走；部署 v3 后拖动左半屏，浮层 `stick` / `input.move` 随之变化、角色实际移动，返回主菜单也正常。

静态自检 `python3 selfcheck.py` 全 PASS（含 v3 注入断言：`__saltlineStick`、向量覆盖、`innerWidth*.5`、返回主菜单回调替换）。

## 验证命令

```bash
cd saltline-extended
python3 selfcheck.py                 # 静态自检，全部 PASS 才算注入成功
python3 -m http.server 8898          # 本地起服务
```

浏览器打开 `http://127.0.0.1:8898/index.html`，开发者工具切 iPhone 设备，点「开始行动」，左半屏按住向上拖动：角色应持续前进、松手即停；控制台不应再出现 `Ignored attempt to cancel`。真机则用 `?diag=1` 看 `stick` / `input.move` 是否随拖动变化。

## 部署

- 直接用成品：把本目录 `index.html` 覆盖仓库根目录同名文件即可，单文件离线可跑，GitHub Pages 立即生效。
- 从源码重建：`build.py` 会把 `mobile-fix.css` / `mobile-fix.js` / `menu-fix.js` / **`stick-fix.js`** 作为输入并注入 `</head>` 前；上游基底（`Saltline/index.en.html`、`_ref/aggie.html`、`Saltline/i18n.source.js`）未随精简仓库分发，故 `build.py` 主要作文档化的注入配方，线上依赖已内联好修复的成品 `index.html`。

## 附带修复：暂停后「返回主菜单」无效

扩展模块给暂停 / 阵亡 / 结算面板插入的「返回主菜单」按钮，点击回调是
`if (typeof game.toTitle === 'function') game.toTitle();`，但引擎 `window.__G.game`
从来没有 `toTitle` 方法（全文件仅此一处引用、零处定义），点击静默无操作；引擎内部
状态切换函数也从未以 `'title'` 调用过，即原版没有回主菜单路径。

`menu-fix.js` 提供 `window.__saltlineToTitle`：把 `game.state` 置为 `'title'` 并派发
`game:state`（让各扩展模块清场 / 重置战绩 / 刷新标题页，主循环 `case "title"` 只跑
标题相机动画、不再更新玩法），再复位标题页呈现（菜单 `show('title')`、隐藏 HUD 与武器、
解除输入锁与音频暂停、清空摇杆残留）。ESC 保持原设计的暂停 / 继续。

验证：暂停 → 点击「返回主菜单」→ `game.state === 'title'`、`menus.screen === 'title'`，
且再点「开始行动」能正常重新开局。

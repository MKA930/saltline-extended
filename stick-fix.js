/* Saltline · 手机端摇杆驱动（v3：绕开引擎内部输入链路）
 *
 * 真机诊断（iOS Safari + ?diag=1）结论：
 *   body/#view touch-action=none、cancelable=true、prevented=183~293、
 *   blocked=0、touchcancel=0、event.target=view、leftHalf=true、input.touch=true
 *   —— 手势层与事件投递全部健康，但 input.move 恒为 0.00, 0.00。
 *
 * 因此断点不在 CSS / preventDefault，而在引擎输入模块内部：
 *   gE() 用闭包变量 r(gameplay 开关)、I(摇杆 identifier)、k/C(摇杆向量)，
 *   touchmove 必须 `ye.identifier === I` 才更新 k/C，he() 再 `if(r)` 累加。
 *   iOS Safari 线上环境这条链路不产出向量（identifier 序列 / gameplay 状态 /
 *   changedTouches 行为与桌面 Chromium 不同），沙箱三种 URL 全部复现不出来。
 *
 * 本补丁完全绕开上述内部状态：
 *   1) window 捕获阶段自己跟踪左半屏手指，算归一化摇杆向量，
 *      写入 window.__saltlineStick = {x, y, active, sprint}；
 *   2) 包装 input.update：在引擎 he() 算完之后、player.update() 读取之前，
 *      直接用我们的向量覆盖 input.move —— 无论 r/I/k/C 是否失效都能驱动；
 *   3) 右半屏转视角同理，仅在引擎 he() 未产出 look 时补我们的增量；
 *   4) make_fix.py 另在 he() 源码里注入同一覆盖作为第二道兜底，
 *      防止 input 对象被替换导致包装失效。两处幂等，互不冲突。
 *
 * 约束：
 *   - 只用 passive:true 监听，不 preventDefault（手势层由 mobile-fix.js 负责）；
 *   - 按钮 / 菜单 / 输入框等交互控件跳过，不影响合成 click（返回主菜单照常可用）；
 *   - 不改游戏逻辑、不改原有事件绑定、不改本地化层。
 */
(function () {
  'use strict';

  var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!hasTouch) return;

  var RAD = 58;           // 与引擎 x1=58（摇杆半径）一致
  var LOOK_K = 0.0052;    // 与引擎 dE 一致

  var S = {
    x: 0, y: 0, active: false, sprint: false,
    stickId: null, x0: 0, y0: 0,
    lookId: null, lx: 0, ly: 0, lookDx: 0, lookDy: 0
  };
  window.__saltlineStick = S;

  function isGameTarget(t) {
    if (!t || !t.closest) return true;
    try {
      return !t.closest('button, a, input, select, textarea, .menu, .v4-shop, .v2-perks, .m-callout, .t-btn');
    } catch (e) { return true; }
  }

  function touches(e) {
    if (e.changedTouches && e.changedTouches.length) return e.changedTouches;
    return e.touches || [];
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  addEventListener('touchstart', function (e) {
    if (!isGameTarget(e.target)) return;
    var list = touches(e);
    for (var j = 0; j < list.length; j++) {
      var t = list[j];
      var left = t.clientX < innerWidth * .5;
      if (left && S.stickId === null) {
        S.stickId = t.identifier;
        S.x0 = t.clientX; S.y0 = t.clientY;
        S.x = 0; S.y = 0; S.sprint = false; S.active = true;
      } else if (!left && S.lookId === null) {
        S.lookId = t.identifier;
        S.lx = t.clientX; S.ly = t.clientY;
      }
    }
  }, { capture: true, passive: true });

  addEventListener('touchmove', function (e) {
    if (!S.active && S.lookId === null) return;
    var list = touches(e);
    for (var j = 0; j < list.length; j++) {
      var t = list[j];

      // --- 左半屏摇杆：identifier 匹配优先；iOS 序列不稳定时容错按位置接管 ---
      if (S.active && (t.identifier === S.stickId || t.clientX < innerWidth * .5)) {
        var dx = t.clientX - S.x0, dy = t.clientY - S.y0;
        var len = Math.hypot(dx, dy);
        if (len > RAD) { dx *= RAD / len; dy *= RAD / len; }
        S.x = clamp(dx / RAD, -1, 1);
        S.y = clamp(-dy / RAD, -1, 1);   // 引擎用 C=-Re/x1，向上拖为正
        S.sprint = Math.hypot(S.x, S.y) > .93 && S.y > .8;
        continue;
      }

      // --- 右半屏转视角：只累计增量，由 update 包装在引擎未产出时补 ---
      if (S.lookId !== null && (t.identifier === S.lookId || t.clientX >= innerWidth * .5)) {
        var G = window.__G, inp = G && G.input;
        S.lookDx += (t.clientX - S.lx) * LOOK_K;
        S.lookDy += (t.clientY - S.ly) * LOOK_K * (inp && inp.invertY ? -1 : 1);
        S.lx = t.clientX; S.ly = t.clientY;
      }
    }
  }, { capture: true, passive: true });

  function clearEngineMove() {
    // 只在触摸交互结束时调用：直接把引擎向量归零，避免松手后角色继续走（真机兜底）
    var G = window.__G, inp = G && G.input;
    if (inp && inp.move) { inp.move.x = 0; inp.move.y = 0; }
  }
  function clearEngineLook() {
    var G = window.__G, inp = G && G.input;
    if (inp && inp.look) { inp.look.dx = 0; inp.look.dy = 0; }
  }

  function end(e) {
    var stillStick = false, stillLook = false;
    var list = e.touches || [];
    for (var j = 0; j < list.length; j++) {
      var t = list[j];
      if (t.clientX >= innerWidth * .5) stillLook = true;
      else stillStick = true;
    }
    if (!stillStick) {
      S.active = false; S.stickId = null;
      S.x = 0; S.y = 0; S.sprint = false;
      clearEngineMove();
    }
    if (!stillLook) { S.lookId = null; S.lookDx = 0; S.lookDy = 0; clearEngineLook(); }
  }
  addEventListener('touchend', end, { capture: true, passive: true });
  addEventListener('touchcancel', end, { capture: true, passive: true });

  // 失焦清残留，避免下次开局角色自己走
  addEventListener('blur', function () {
    S.active = false; S.stickId = null; S.lookId = null;
    S.x = 0; S.y = 0; S.sprint = false; S.lookDx = 0; S.lookDy = 0;
    clearEngineMove(); clearEngineLook();
  });

  // ---- 包装 input.update：把我们的向量写进引擎真正读取的对象 ----
  function install() {
    var G = window.__G, inp = G && G.input;
    if (!inp || typeof inp.update !== 'function') return false;
    if (inp.update.__saltlineWrapped) return true;   // 已包装（含对象未替换）
    var orig = inp.update;
    var wrapped = function (dt) {
      orig.call(this, dt);
      if (S.active) {
        this.move.x = S.x;
        this.move.y = S.y;
        if (S.sprint) this.sprint = true;
      }
      // 引擎内部 look 链路失效时补我们的增量；有产出则不重复累加
      if ((S.lookDx || S.lookDy) &&
          Math.abs(this.look.dx) + Math.abs(this.look.dy) < 1e-4) {
        this.look.dx = clamp(S.lookDx, -.6, .6);
        this.look.dy = clamp(S.lookDy, -.6, .6);
      }
      S.lookDx = 0; S.lookDy = 0;
      return this;
    };
    wrapped.__saltlineWrapped = true;
    inp.update = wrapped;
    return true;
  }

  // 游戏异步初始化；持续探测，input 对象若被替换也能重新包装
  install();
  document.addEventListener('DOMContentLoaded', install);
  addEventListener('load', install);
  var n = 0;
  var timer = setInterval(function () {
    install();
    if (++n > 120) clearInterval(timer);   // 最多探测 60s
  }, 500);
})();

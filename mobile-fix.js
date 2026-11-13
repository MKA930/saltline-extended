/* Saltline · 手机端移动修复 · 运行时手势兜底（v2）
 *
 * 独立于一处 CSS：在 window 捕获阶段（passive:false）抢在浏览器把滑动判定为
 * 滚动 / 缩放手势之前调用 preventDefault()，保证原版 canvas 上的 touchstart /
 * touchmove 保持 cancelable、后续 touchmove 不被 touchcancel 截断。
 *
 * 为什么必须有这一层：本地 file:// 预览（App 内 WebView）页面本身不可滚动，
 * 不会触发手势接管；线上 https 页面是可滚动文档，iOS Safari / iOS Chrome 同为
 * WebKit，手势判定比桌面 Chrome 更早且更依赖「命中元素」本身的 touch-action，
 * 仅靠 html/body 上的 CSS 声明不足以保证 touchmove 可取消。
 *
 * 注意：
 *  - 不 stopPropagation，原版输入模块（绑在 canvas 上）照常收到事件；
 *  - 菜单 / 按钮 / 输入框 / 商店等交互控件跳过，保留合成 click，避免点不动菜单；
 *  - URL 加 ?diag=1 会显示实时诊断浮层，便于真机自查。
 */
(function () {
  'use strict';
  var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!hasTouch) return;

  var DIAG = /(?:^|[?&])diag=1(?:&|$)/.test(location.search);
  var d = {
    starts: 0, moves: 0, cancels: 0, prevented: 0, blocked: 0,
    x: -1, y: -1, left: null, hit: '', hitEl: '',
    lastCancelable: null, lastDefaultPrevented: null,
    touchMode: null, move: 'n/a', bodyTA: '', viewTA: '',
    innerWidth: innerWidth
  };
  window.__saltlineMobileDiag = d;

  // 这些控件需要保留默认行为（合成 click / 列表滚动），不做 preventDefault
  var SKIP = 'button, a, input, select, textarea, .menu, .v4-shop, .v2-perks, .m-callout';
  function skip(t) {
    if (!t || !t.closest) return false;
    try { return !!t.closest(SKIP); } catch (e) { return false; }
  }

  function guard(e) {
    if (e.type === 'touchstart') d.starts++;
    if (e.type === 'touchmove') d.moves++;
    d.lastCancelable = e.cancelable;
    d.hit = e.target ? String(e.target.id || e.target.className || e.target.tagName || '') : '';

    var tp = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    if (tp) {
      d.x = tp.clientX; d.y = tp.clientY;
      d.left = tp.clientX < innerWidth * .5;      // 左半屏摇杆判定
      try {
        var el = document.elementFromPoint(tp.clientX, tp.clientY);
        d.hitEl = el ? String(el.id || el.className || el.tagName || '') : '';
      } catch (err) {}
    }

    if (skip(e.target)) return;
    if (e.cancelable) { e.preventDefault(); d.prevented++; }
    else d.blocked++;
    d.lastDefaultPrevented = e.defaultPrevented;
  }

  addEventListener('touchstart', guard, { capture: true, passive: false });
  addEventListener('touchmove',  guard, { capture: true, passive: false });
  addEventListener('touchcancel', function () { d.cancels++; }, { capture: true, passive: true });

  // 可选：?diag=1 真机诊断浮层
  if (DIAG) {
    var box = null;
    function mount() {
      if (box || !document.body) return;
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;z-index:2147483647;left:6px;top:6px;max-width:94vw;' +
        'padding:8px 10px;background:rgba(0,0,0,.86);color:#7dff9b;font:11px/1.45 monospace;' +
        'white-space:pre-wrap;pointer-events:none;border:1px solid #7dff9b;border-radius:6px';
      document.body.appendChild(box);
    }
    mount();
    document.addEventListener('DOMContentLoaded', mount);
    setInterval(function () {
      if (!box) { mount(); if (!box) return; }
      try {
        var v = document.getElementById('view');
        d.bodyTA = getComputedStyle(document.body).touchAction;
        d.viewTA = v ? getComputedStyle(v).touchAction : 'no #view';
        var G = window.__G, inp = G && G.input;
        d.touchMode = inp ? !!inp.touch : null;
        var mv = inp && inp.move;
        d.move = mv ? (mv.x.toFixed(2) + ', ' + mv.y.toFixed(2)) : 'n/a';
        d.innerWidth = innerWidth;
        // v3 摇杆包装器状态 + 我们的摇杆向量 S —— 真机验证移动修复的关键
        var S = window.__saltlineStick;
        d.stick = S ? ('x=' + (+S.x).toFixed(2) + ' y=' + (+S.y).toFixed(2) + ' act=' + S.active) : 'n/a';
        var w = inp && inp.update && inp.update.__saltlineWrapped;
        d.wrapped = w;
        box.textContent =
          'innerWidth=' + d.innerWidth + '  hasTouch=' + hasTouch + '\n' +
          'body TA=' + d.bodyTA + '  #view TA=' + d.viewTA + '\n' +
          'input.touch=' + d.touchMode + '  input.move=' + d.move + '\n' +
          'stick=' + d.stick + '  wrapped=' + d.wrapped + '\n' +
          'x,y=' + d.x + ',' + d.y + '  leftHalf=' + d.left + '\n' +
          'event.target=' + d.hit + '\n' +
          'elementFromPoint=' + d.hitEl + '\n' +
          'start/move/cancel=' + d.starts + '/' + d.moves + '/' + d.cancels + '\n' +
          'prevented/blocked=' + d.prevented + '/' + d.blocked + '\n' +
          'last cancelable=' + d.lastCancelable + '  prevented=' + d.lastDefaultPrevented;
      } catch (err) { box.textContent = 'diag error: ' + err; }
    }, 200);
  }
})();

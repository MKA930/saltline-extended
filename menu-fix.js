/* Saltline · 暂停面板「返回主菜单」修复
 *
 * 根因：扩展模块给暂停 / 阵亡 / 结算三个面板各插了一个「返回主菜单」按钮，
 * 但点击回调只做了一次 `typeof` 判断后调用 `game.toTitle()` 这个不存在的方法，
 * 而引擎（window.__G.game）从来没有任何 toTitle 方法 —— 全文件只有这一处
 * 引用、零处定义，typeof 判断恒为 false，点击静默无操作。引擎内部的状态
 * 切换函数 A(Y) 也从未被以 'title' 调用过，即原版根本没有「回主菜单」路径。
 *
 * 修复：提供 window.__saltlineToTitle，走引擎自己的状态机回到 title：
 *   1) game.state = 'title' + events.emit('game:state') —— 真正结束对局，
 *      并让所有扩展模块的 hooks.state 执行清场 / 重置战绩 / 刷新标题页；
 *      主循环 update() 的 case "title" 只跑标题相机动画，不再更新玩法。
 *   2) 复位标题页呈现：menus.show('title')、隐藏 HUD 与武器、解除输入锁、
 *      解除音频暂停（复刻引擎初始化时 title 分支的设置）。
 *   3) 清掉触屏摇杆 / 开火残留，避免回到主菜单后角色还在移动。
 *
 * 全部可选接口都包了 try/catch：某个模块缺失不影响「回主菜单」这个主目标。
 * ESC 保持原设计（暂停 / 继续），不改成退出。
 */
(function () {
  'use strict';

  function call(obj, method) {
    try {
      if (obj && typeof obj[method] === 'function') {
        obj[method].apply(obj, Array.prototype.slice.call(arguments, 2));
      }
    } catch (e) { /* 可选接口，失败不影响回主菜单 */ }
  }

  window.__saltlineToTitle = function () {
    var G = window.__G, game = G && G.game;
    if (!game) return false;
    var prev = game.state;

    if (prev !== 'title') {
      game.state = 'title';
      try {
        if (G.events && typeof G.events.emit === 'function') {
          G.events.emit('game:state', { state: 'title', prev: prev });
        }
      } catch (e) { console.error('[menu-fix] game:state emit failed', e); }
    }

    var menus = game.menus, input = G.input, hud = G.hud,
        weapon = G.weapon, audio = G.audio, player = G.player;

    call(input, 'setGameplay', false);
    call(input, 'exitLock');
    if (document.pointerLockElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (e) {}
    }
    call(hud, 'show', false);
    call(weapon, 'setVisible', false);
    call(audio, 'setPaused', false);
    call(audio, 'setIntensity', 0.15);
    if (player) { try { player.enabled = false; } catch (e) {} }
    call(menus, 'show', 'title');
    call(menus, 'locationCard', true);

    // 触屏摇杆 / 视角 / 开火残留清零
    if (input) {
      try {
        if (input.move) { input.move.x = 0; input.move.y = 0; }
        if (input.look) { input.look.x = 0; input.look.y = 0; }
        input.fire = false;
      } catch (e) {}
    }
    return true;
  };
})();

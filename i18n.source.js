/*
 * Saltline — 界面本地化 + 无敌模式
 *
 * 设计要点：
 *  - 不改动游戏原有的 1.6MB 打包逻辑，只在 DOM 文本节点上做可逆替换。
 *  - 每个文本节点的英文原文存在 WeakMap 中，切回英文时逐字还原。
 *  - MutationObserver 覆盖运行时生成的字幕、HUD 提示与面板重绘。
 *  - 语言 / 无敌两个开关插进主菜单的 .m-actions 行，
 *    不参与游戏自身的 data-act 事件委托，均为捕获阶段拦截 + 阻止冒泡。
 *  - 无敌模式的实际判定由 index.html 主脚本里的两处补丁读取
 *    window.__saltlineGod 完成：不扣血、也不派发 player:dead 事件。
 *  - 品牌 LOGO「SALTLINE」按本地化惯例保留原文；3D 武器贴图上的铭文属于
 *    美术资产（canvas 纹理），DOM 层无法覆盖，保持英文。
 */
(() => {
  'use strict';

  const STORE_KEY = 'saltline.lang';
  const GOD_KEY = 'saltline.god';

  // ---------- 字典：英文原文 -> 简体中文 ----------
  const NOTE_EN = 'Based on the publicly shared Claude artifact "Saltline" by Felix Rieseberg. This local build adds: nine weapons, forklift / towing / speedboat / stealth jet, open-sea and air combat, the boss ship "Ironwall", three new maps and fixed touch controls, plus a language switch and a god mode.';
  const NOTE_ZH = '基于 Felix Rieseberg 在 Claude 上公开分享的作品《Saltline》制作。本本地版本加入：九把枪、叉车 / 牵引 / 快艇 / 隐身战机、外海与空战、海上首领「铁壁号」、三张新地图，并修复手机触屏；另有界面语言切换与无敌模式。';

  const DICT = {
    // 主菜单 / 标题
    "The port’s security net has gone feral. Cut its three uplinks. Reach the boat.": "港口的安防网络已经失控。切断三处上行中继，赶到接应船。",
    "Deploy": "开始行动",
    "Settings": "设置",
    "Controls": "操作说明",
    "Mode": "模式",
    "Mission": "任务",
    "Holdout": "坚守",
    "Difficulty": "难度",
    "Standard": "标准",
    "Hard": "困难",
    "Brutal": "残酷",
    "Cut three relays and reach the boat. About five minutes.": "切断三处中继并抵达接应船，约五分钟。",
    "Endless waves that keep growing. Resupply between waves. How long can you hold?": "一波波敌人不断增强，波次之间可以补给。你能撑多久？",
    "Every surface, machine and sound is generated in your browser. Nothing is downloaded.": "所有场景、机械与音效都在浏览器中实时生成，无需下载任何资源。",
    "A note from Felix": "作者 Felix 的说明",
    "Dismiss this note": "关闭说明",
    "Hi, Felix here. People online were impressed with the one-shotted version of this game - Claude Fable 5.2 built something pretty good without any human feedback. However, I really wanted to fix the weapon models, sounds, and some gameplay work. I spent an additional two hours to improve this game.": "大家好，我是 Felix。网上很多人对这款游戏一次生成的版本印象深刻——Claude Fable 5.2 在没有任何人工反馈的情况下做出了相当不错的成品。不过我特别想修正武器模型、音效和一些玩法细节，于是又花了两个小时来打磨这个版本。",
    "If you'd rather see the first version that didn't receive any human feedback, click here:": "如果你想看那个未经人工反馈的第一版，点这里：",
    "See the one-shotted version": "查看一次生成的初版",
    "Port Authority Breach Unit": "港务局突防小队",
    "Port Authority Breach Unit — one breacher, no backup": "港务局突防小队 — 仅一名突防队员，无后援",
    "Saltline Terminal · 05:42": "盐线码头 · 05:42",
    "Saltline Terminal · Berth 4 · 05:42": "盐线码头 · 4 号泊位 · 05:42",

    // HUD / 任务 / 提示
    "Objective": "任务目标",
    "Relays": "中继",
    "Vitals": "状态",
    "Control": "指挥台",
    "Cut the three uplink relays": "切断三处上行中继",
    "Cut the last relay": "切断最后一处中继",
    "Stand by": "待命",
    "Hold the berth": "守住泊位",
    "Catch your breath": "喘口气",
    "Machines inbound": "机械敌人逼近",
    "Get to the boat": "前往接应船",
    "Resume recaptures the mouse.": "继续后会重新锁定鼠标。",
    "Low ammo": "弹药不足",
    " urgent": " 告急",
    "X — Reload": "X — 装填",
    "R — Reload": "R — 装填",
    "Empty — Y swaps": "弹匣已空 — 按 Y 换枪",
    "Empty — swap": "弹匣已空 — 换枪",
    "Empty — Q swaps": "弹匣已空 — 按 Q 换枪",
    "Hauled out of the water": "从水中打捞",
    "Relays still live — the boat will not wait under fire": "中继仍在运行 — 接应船不会在火力下久等",

    // 暂停 / 阵亡 / 结算
    "Operation on hold": "行动暂停",
    "Paused": "已暂停",
    "Resume": "继续",
    "Restart mission": "重开任务",
    "Breacher down": "突防队员阵亡",
    "Signal lost": "信号中断",
    "Time survived": "存活时间",
    "Relays cut": "已切断中继",
    "Waves cleared": "已清波次",
    "Machines destroyed": "击毁机械",
    "Score": "得分",
    "Best": "最佳",
    "Retry": "重试",
    "Berth 4 · Debrief": "4 号泊位 · 任务总结",
    "Saltline is dark": "盐线归于沉寂",
    "Rating": "评级",
    "Clean": "干净利落",
    "Time": "用时",
    "Accuracy": "命中率",
    "Retries": "重试次数",
    "Redeploy": "重新部署",
    "Close": "关闭",
    "Settings and controls": "设置与操作说明",

    // 设置面板
    "Weapon position": "武器位置",
    "Three-quarter": "四分之三视角",
    "Compact": "紧凑",
    "Graphics quality": "画质",
    "low": "低",
    "medium": "中",
    "high": "高",
    "ultra": "极高",
    "Mouse sensitivity": "鼠标灵敏度",
    "Invert Y": "反转 Y 轴",
    "Off": "关",
    "Master volume": "主音量",
    "Field of view": "视野角度",
    "Display": "显示",
    "Enter fullscreen": "进入全屏",
    "Quality was picked for this device (high). Lower it if the frame rate struggles. Difficulty applies to machines that arrive from now on.": "画质已根据本机自动选定（高）。若帧率偏低可适当调低。难度调整仅对之后出现的机械敌人生效。",

    // 控制说明
    "Keyboard · Mouse": "键盘 · 鼠标",
    "Controller": "手柄",
    "Touch": "触屏",
    "Move": "移动",
    "Look": "视角",
    "Fire": "开火",
    "Aim": "瞄准",
    "Reload": "装填",
    "Sidearm": "副武器",
    "Cut relay": "切断中继",
    "Jump": "跳跃",
    "Sprint": "冲刺",
    "Crouch": "下蹲",
    "Pause": "暂停",
    "Melee": "近战",
    "Swap weapon": "切换武器",
    "Sticks move and look": "摇杆控制移动与视角",
    "Reload / cut": "装填 / 切断",
    "Left thumb moves": "左侧拇指控制移动",
    "Right thumb looks": "右侧滑动控制视角",
    "Fire · Aim · Reload · Jump on screen": "屏幕按键：开火 · 瞄准 · 装填 · 跳跃",
    "Left button": "鼠标左键",
    "Right button": "鼠标右键",
    ", wheel, or": "、滚轮或",
    "Hold": "长按",
    "or": "或",
    "If the browser will not capture the mouse, hold a mouse button and drag to look (left also fires, right also aims). Arrow keys or": "若浏览器未锁定鼠标，可按住鼠标拖动转向（左键同时开火，右键同时瞄准）。方向键或",
    "turn,": "转向，",
    "fires.": "开火。",
    "Left thumb, anywhere": "左侧任意位置",
    "Drag the right side": "拖动屏幕右侧",
    "Hold FIRE, drag to track": "按住开火键并拖动追踪",
    "AIM toggles": "瞄准键切换",
    "RLD": "装填",
    "JUMP": "跳跃",
    "Hold USE at a relay": "在中继处长按使用键",
    "Push the stick fully forward": "将摇杆推到底",
    "Move · Look": "移动 · 视角",
    "Left stick · Right stick": "左摇杆 · 右摇杆",
    "Fire · Aim": "开火 · 瞄准",
    "or D-pad": "或十字键",
    "at a relay": "在中继处",
    "Click the left stick": "按下左摇杆",
    "or click the right stick": "或按下右摇杆",
    "Start": "Start 键",
    "In menus the D-pad or left stick moves the selection,": "在菜单中用十字键或左摇杆移动选择，",
    "accepts and": "确认，",
    "goes back. Browsers only start sound after a click or key press, so click once if a controller-only start is silent.": "返回。浏览器需先点击或按键才会播放声音，若只用手柄启动没有声音，请先点击一次。",

    // 电台字幕
    "Breacher, this is Control. The Harbormaster holds the berth. Cut its three uplinks — yard, shed, quay.": "突防队员，这里是指挥台。港务主控已封锁泊位。切断三处上行中继 —— 堆场、库房、码头。",
    "It has seen you. Gulls fly, Hounds walk. Put them down.": "它发现你了。飞行机「海鸥」与地面机「猎犬」正在逼近，全部击毁。",
    "One relay dark. It felt that — machines inbound.": "第一处中继已断。它察觉到了 —— 机械敌人正在赶来。",
    "Two dark. It is throwing everything it has left at you.": "第二处已断。它正倾尽剩余兵力扑向你。",
    "All three dark. The boat is holding at the quay ladder, south end. Run.": "三处全部切断。接应船停在南端码头舷梯，快跑。",
    "You are hit hard. Get behind steel and breathe.": "你伤得很重。躲到钢制掩体后缓一缓。",
    "Breacher is aboard. Saltline is dark. Good work.": "突防队员已登船。盐线归于沉寂。干得漂亮。",

    // 启动加载文案
    "Raising the terminal": "正在建立码头终端",
    "Mixing paint, rust and rain": "调配漆色、锈迹与雨幕",
    "Raising the cranes": "竖起龙门吊",
    "Flooding the apron": "淹没装卸区",
    "Loading tracers and smoke": "装填曳光弹与烟雾",
    "Checking the rifle": "检查步枪",
    "Waking the Harbormaster": "唤醒港务主控",
    "Waiting for first light": "等待第一缕光",
    "Ready": "就绪",
    "Mouse capture unavailable — move the mouse to look, rest it at a screen edge to keep turning · click fires · arrows or IJKL also turn": "无法锁定鼠标 — 移动鼠标转向，停在屏幕边缘可持续旋转 · 点击开火 · 方向键或 IJKL 也可转向",
    "Mouse captured — Esc releases it": "鼠标已锁定 — 按 Esc 释放",
    "Click once to capture the mouse": "点击一次以锁定鼠标",
    [NOTE_EN]: NOTE_ZH
  };

  // 带可变内容（数字、代号）的动态文案
  const RULES = [
    [/^Cut relay\s+(.+)$/i, m => '切断中继 ' + m[1]],
    [/^Contact\s+[-—]\s*(.+)$/i, m => '接敌 — ' + m[1]]
  ];

  // ---------- 反向字典：扩展模块自带中文 UI -> 英文 ----------
  // 英文界面下这些节点没有英文原文（或被二次写入固化成中文），需显式回译。
  const ZH2EN = {
    "手雷": "Grenade",
    "行动得分": "Score",
    "返回主菜单": "Back to menu",
    "军需箱": "Supply crates",
    "军功": "Merit",
    "空格": "Space",
    "最佳纪录": "Best",
    "模式 · 难度": "Mode · Difficulty",
    "选择强化": "Pick an upgrade",
    "靠近后按住": "Hold near to",
    "突击": "Assault",
    "霰弹": "Shotgun",
    "精确": "Precision",
    "冲锋": "SMG",
    "榴弹": "Grenade launcher",
    "机枪": "LMG",
    "火箭": "Rocket",
    "轨道": "Railgun",
    "电弧": "Arc",
    "北": "N",
    "连杀": "Streak",
    "重装守卫": "Heavy Guard",
    "战场强化": "Field upgrades",
    "按 1 · 2 · 3 选择": "Press 1 · 2 · 3 to pick",
    "本局军功": "Merit this run",
    "铁壁号": "Ironwall",
    "战斗机": "Jet",
    "速度": "Speed",
    "加力": "Afterburner",
    "高度": "Altitude",
    "米": "m",
    "导弹": "Missiles",
    "干扰弹": "Flares",
    "V7.3 · 制空权": "V7.3 · Air Superiority",
    "港区防御系统失控。切断三处中继，击毁重装守卫，登船撤离。": "The port defense grid has gone feral. Cut three relays, destroy the Heavy Guard, and reach the boat.",
    "地图": "Map",
    "四号泊位": "Berth 4",
    "十字街区 · 未解锁": "Crossroads · Locked",
    "钢铁斗兽场 · 未解锁": "Iron Arena · Locked",
    "远海围猎 · 未解锁": "Open Sea Hunt · Locked",
    "行动模式": "Mode",
    "战役 · 突破封锁": "Campaign · Breakthrough",
    "坚守 · 无尽波次": "Holdout · Endless waves",
    "难度": "Difficulty",
    "新兵": "Rookie",
    "老兵": "Veteran",
    "噩梦": "Nightmare",
    "战役 · 老兵难度尚无纪录": "Campaign · No record on Veteran yet",
    "列兵": "Private",
    "军需处 · 奖励": "Armory · Rewards",
    "中文": "Chinese",
    "换枪": "Swap",
    "近战": "Melee",
    "上下载具": "Enter / exit vehicle",
    "自动驾驶": "Autopilot",
    "游泳时爬上岸": "Climb ashore while swimming",
    "结算奖励": "Mission rewards",
    "切换武器": "Swap weapon",
    "或滚轮": "or wheel",
    "或鼠标中键": "or middle mouse",
    "出现强化卡片时按": "When upgrade cards appear, press",
    "上 / 下载具": "Enter / exit vehicle",
    "，再按": ", then press ",
    "离开": "Leave",
    "叉车": "Forklift",
    "油门，": "throttle, ",
    "转向，": "steer, ",
    "自动驾驶（可射击）": "Autopilot (can fire)",
    "直升机": "Helicopter",
    "飞行，": "fly, ",
    "升，": "ascend, ",
    "降，左键机炮": "descend, left click cannon",
    "下水 · 上岸": "Water · Shore",
    "从码头或栈桥走下去即可游泳；面向岸边按": "Walk off a dock or pier to swim; face the shore and press ",
    "爬上去": "climb up",
    "快艇": "Speedboat",
    "按住": "Hold",
    "上船，": "board, ",
    "驾驶，左键艇炮，": "drive, left click boat cannon, ",
    "自动航行": "Auto-sail",
    "打开": "Open",
    "手雷 · 近战 · 换枪": "Grenade · Melee · Swap",
    "右侧对应按钮": "the matching buttons on the right",
    "点选左侧强化卡片": "tap an upgrade card on the left",
    "载具": "Vehicles",
    "靠近后按住“交互”上车；摇杆驾驶，“自驾”切换自动驾驶；直升机用“跳跃”升、“下降”降": "Hold INTERACT near a vehicle to board; steer with the stick, toggle AUTO for autopilot; helicopter: JUMP to ascend, DESCEND to descend",
    "游泳 · 快艇": "Swimming · Speedboat",
    "游泳时面向岸边按“跳跃”爬上去；快艇用“交互”上下船，“自驾”自动航行": "Face the shore and press JUMP to climb out; use INTERACT to board / leave the speedboat, AUTO to sail",
    "盐线码头 · 4 号泊位 · 05:42": "Saltline Terminal · Berth 4 · 05:42",
    "港务局突防小队 — 仅一名突防队员，无后援": "Port Authority Breach Unit — one breacher, no backup",
    "军需处": "Armory",
    "关闭": "Close",
    "贴近": "Close",
    "永久升级": "Permanent upgrades",
    "勋章": "Medals",
    "军功来自：切断中继、打开军需箱、摧毁重装守卫、行动结算与评级星数、军衔晋升和勋章。": "Merit comes from: cutting relays, opening supply crates, destroying Heavy Guards, mission results and rating stars, rank promotions and medals.",
  };

  // ---------- 工具 ----------
  const norm = s => String(s)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-');

  const LUT = new Map();
  for (const en in DICT) LUT.set(norm(en), DICT[en]);

  // 英文界面：把扩展模块原生中文、以及被二次写入固化的中文还原成英文
  const REV = new Map();
  for (const en in DICT) if (!REV.has(norm(DICT[en]))) REV.set(norm(DICT[en]), en);
  for (const zh in ZH2EN) REV.set(norm(zh), ZH2EN[zh]);

  let lang = 'en';
  try { lang = localStorage.getItem(STORE_KEY) === 'zh' ? 'zh' : 'en'; } catch (e) {}

  // 无敌开关：<head> 里的前置脚本已给出初值，这里从存储接管并同步到菜单
  let god = false;
  try { god = localStorage.getItem(GOD_KEY) === '1'; } catch (e) { god = !!window.__saltlineGod; }
  window.__saltlineGod = god;

  // 每个文本节点的英文原文；用于切回英文时精确还原
  const ORIG = new WeakMap();

  function translate(text, node) {
    const trimmed = text.trim();
    if (!trimmed) return text;
    const key = norm(trimmed);

    // 「Close」在 .seg 选项组里是武器位置「贴近」，其余是「关闭」
    if (key === 'close') {
      const inSeg = node && node.parentElement && node.parentElement.closest('.seg');
      return text.replace(trimmed, inSeg ? '贴近' : '关闭');
    }
    for (const [re, fn] of RULES) {
      const m = trimmed.match(re);
      if (m) return text.replace(trimmed, fn(m));
    }
    if (LUT.has(key)) return text.replace(trimmed, LUT.get(key));
    return text;
  }

  function processNode(node, fresh) {
    if (!node || node.nodeType !== 3) return;
    const el = node.parentElement;
    if (!el) return;
    if (el.closest('[data-i18n-skip]')) return;
    if (/^(script|style|canvas|textarea)$/i.test(el.tagName)) return;

    let base;
    if (fresh) {
      // 中文节点也要留原文，否则英文模式无法回译
      base = node.nodeValue;
      ORIG.set(node, base);
    } else {
      base = ORIG.get(node);
      if (base === undefined) {
        base = node.nodeValue;
        ORIG.set(node, base);
      }
    }
    const trimmed = base.trim();
    let out;
    if (lang === 'zh') {
      out = translate(base, node);
    } else {
      const back = REV.get(norm(trimmed));
      out = back === undefined ? base : base.replace(trimmed, back);
    }
    if (out !== node.nodeValue) node.nodeValue = out;
  }

  function walk(root, fresh) {
    if (!root) return;
    if (root.nodeType === 3) { processNode(root, fresh); return; }
    if (root.nodeType !== 1) return;
    if (root.closest('[data-i18n-skip]')) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) processNode(n, fresh);
  }

  function roots() {
    return [document.getElementById('ui'), document.getElementById('boot')].filter(Boolean);
  }

  function scanAll() {
    roots().forEach(r => walk(r, false));
  }

  function addLocalNote() {
    const body = document.querySelector('.m-callout-body');
    if (!body || body.querySelector('[data-local-note]')) return;
    const p = document.createElement('p');
    p.dataset.localNote = '1';
    p.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid rgba(232,228,218,.2)';
    p.textContent = NOTE_EN;
    body.appendChild(p);
    walk(p, true);
  }

  // ---------- 菜单上的两个开关 ----------
  function makeButton(cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small ' + cls;
    b.dataset.i18nSkip = '1';
    // 捕获阶段先于游戏菜单的事件委托，避免被当成普通菜单动作
    b.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      onClick();
    }, true);
    return b;
  }

  function updateButtons() {
    const row = document.querySelector('.m-actions:not(.col)');
    if (!row) return;
    const langBtn = row.querySelector('[data-i18n-lang]');
    const godBtn = row.querySelector('[data-i18n-god]');
    if (langBtn) {
      langBtn.textContent = lang === 'zh' ? 'English' : '中文';
      langBtn.title = lang === 'zh' ? '切换为英文界面' : '切换为中文界面';
      langBtn.setAttribute('aria-label', langBtn.title);
    }
    if (godBtn) {
      godBtn.textContent = lang === 'zh'
        ? (god ? '无敌模式：开' : '无敌模式：关')
        : (god ? 'GOD MODE: ON' : 'GOD MODE: OFF');
      godBtn.title = lang === 'zh'
        ? (god ? '关闭无敌模式' : '开启无敌模式（受伤不死亡）')
        : (god ? 'Disable god mode' : 'Enable god mode');
      godBtn.setAttribute('aria-label', godBtn.title);
      godBtn.setAttribute('aria-pressed', god ? 'true' : 'false');
    }
  }

  function toggleGod() {
    god = !god;
    window.__saltlineGod = god;
    try { localStorage.setItem(GOD_KEY, god ? '1' : '0'); } catch (e) {}
    updateButtons();
  }

  function ensureButtons() {
    const row = document.querySelector('.m-actions:not(.col)');
    if (!row) return;
    addLocalNote();
    if (!row.querySelector('[data-i18n-lang]')) {
      const b = makeButton('i18n-lang-btn', () => setLang(lang === 'zh' ? 'en' : 'zh'));
      b.dataset.i18nLang = '1';
      row.appendChild(b);
    }
    if (!row.querySelector('[data-i18n-god]')) {
      const b = makeButton('i18n-god-btn', toggleGod);
      b.dataset.i18nGod = '1';
      row.appendChild(b);
    }
    updateButtons();
  }

  // ---------- 观察器 ----------
  const obs = new MutationObserver(records => {
    obs.disconnect();
    let needButtons = false;
    for (const r of records) {
      if (r.type === 'characterData') {
        processNode(r.target, true);
      } else if (r.type === 'childList') {
        needButtons = true;
        for (const n of r.addedNodes) walk(n, true);
      }
    }
    if (needButtons) ensureButtons();
    attach();
    obs.takeRecords(); // 丢弃由本层自身写入产生的记录，避免递归
  });

  function attach() {
    roots().forEach(r => obs.observe(r, { childList: true, subtree: true, characterData: true }));
  }

  function setLang(next) {
    lang = next;
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    document.documentElement.classList.toggle('lang-zh', lang === 'zh');
    obs.disconnect();
    ensureButtons();
    scanAll();
    attach();
    obs.takeRecords();
  }

  // ---------- 样式 ----------
  const style = document.createElement('style');
  style.textContent = [
    // 中文用系统黑体；数字仍交给等宽字体，避免 HUD 跳动
    'html.lang-zh #ui {',
    '  --f-label: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", system-ui, sans-serif;',
    '  --f-mono: "Microsoft YaHei", "PingFang SC", ui-monospace, monospace;',
    '}',
    // 英文版的大字距/大写规则对中文不适用
    'html.lang-zh .btn { letter-spacing: .06em; }',
    'html.lang-zh .m-pick label,',
    'html.lang-zh .panel label,',
    'html.lang-zh .m-callout-tab { letter-spacing: .04em; }',
    '.i18n-lang-btn, .i18n-god-btn { font-size: 11px; letter-spacing: .06em; }',
    '.i18n-god-btn[aria-pressed="true"] { background: var(--signal); border-color: var(--signal); color: var(--ink); }'
  ].join('\n');
  document.head.appendChild(style);

  // ---------- 启动 ----------
  document.documentElement.classList.toggle('lang-zh', lang === 'zh');
  scanAll();          // 记录静态节点原文（#boot 等）
  ensureButtons();    // 菜单此时可能尚未生成，观察器会在生成时补齐
  attach();
  obs.takeRecords();

  // 暴露给控制台，便于手动切换 / 调试
  window.__saltlineOpts = {
    get lang() { return lang; },
    setLang: v => setLang(v === 'zh' ? 'zh' : 'en'),
    get god() { return god; },
    setGod: v => { if (!!v !== god) toggleGod(); },
    dictSize: LUT.size,
    revSize: REV.size
  };
})();

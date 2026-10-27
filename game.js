(() => {
  "use strict";

  // ---------- Cấu hình ----------
  const PRIZES = [
    100000, 200000, 500000, 1000000, 2000000,
    4000000, 7000000, 12000000, 20000000, 35000000,
    60000000, 100000000, 180000000, 300000000, 500000000,
  ];
  const MILESTONES = [4, 9]; // câu 5 và câu 10 (tính từ 0)
  const LETTERS = ["A", "B", "C", "D"];

  const TOPICS = {
    "lich-su-vn": "Lịch sử Việt Nam",
    "dia-ly-van-hoa-vn": "Địa lý & Văn hóa VN",
    "khoa-hoc": "Khoa học & Công nghệ",
    "the-gioi": "Địa lý & Lịch sử Thế giới",
    "van-hoc": "Ngôn ngữ & Văn học",
    "giai-tri-the-thao": "Giải trí & Thể thao",
  };

  const FRIENDS = [
    "Bạn Minh", "Chị Lan", "Anh Tuấn", "Cô giáo Hoa", "Bác Hùng",
    "Em Ngọc", "Anh Khoa", "Chị Thảo", "Chú Bình", "Bạn Quân",
  ];

  const BANK = (window.QUESTION_BANK || []).map((q) => ({ ...q, id: hash(q.q) }));

  // ---------- Lưu trữ cục bộ (an toàn khi bị chặn) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* bỏ qua */ }
    },
  };

  // ---------- Âm thanh (Web Audio, không cần file) ----------
  const sound = {
    ctx: null,
    muted: store.get("tttp-muted", false),
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    tone(freq, start, dur, type = "sine", vol = 0.18) {
      const ctx = this.ensure();
      if (!ctx || this.muted) return;
      const t = ctx.currentTime + start;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    },
    select() { this.tone(660, 0, 0.12, "triangle", 0.12); },
    lock() {
      this.tone(110, 0, 0.6, "sawtooth", 0.08);
      this.tone(164.8, 0, 0.6, "sine", 0.12);
      this.tone(110, 0.8, 0.8, "sine", 0.1);
    },
    correct() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, i * 0.11, 0.35, "triangle", 0.16));
    },
    wrong() {
      this.tone(220, 0, 0.35, "sawtooth", 0.12);
      this.tone(185, 0.3, 0.6, "sawtooth", 0.12);
    },
    tick() { this.tone(1200, 0, 0.05, "square", 0.05); },
    lifeline() {
      [392, 523.25, 659.25].forEach((f, i) => this.tone(f, i * 0.07, 0.2, "sine", 0.12));
    },
    start() {
      [261.63, 329.63, 392, 523.25].forEach((f, i) => this.tone(f, i * 0.15, 0.5, "triangle", 0.14));
    },
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => this.tone(f, i * 0.14, 0.45, "triangle", 0.16));
    },
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const screens = { start: $("screen-start"), game: $("screen-game"), end: $("screen-end") };
  const el = {
    btnStart: $("btn-start"),
    qNumber: $("q-number"),
    qPrize: $("q-prize"),
    qTopic: $("q-topic"),
    qBox: document.querySelector(".question-box"),
    qText: $("q-text"),
    answers: $("answers"),
    btnWalk: $("btn-walk"),
    ladder: $("ladder"),
    ladderList: $("ladder-list"),
    btnLadder: $("btn-ladder"),
    btnSound: $("btn-sound"),
    timer: $("timer"),
    timerFill: $("timer-fill"),
    timerText: $("timer-text"),
    ll5050: $("ll-5050"),
    llAudience: $("ll-audience"),
    llPhone: $("ll-phone"),
    modal: $("modal"),
    modalTitle: $("modal-title"),
    modalBody: $("modal-body"),
    modalActions: $("modal-actions"),
    endKicker: $("end-kicker"),
    endTitle: $("end-title"),
    endPrize: $("end-prize"),
    endDetail: $("end-detail"),
    btnAgain: $("btn-again"),
    btnHome: $("btn-home"),
  };

  // ---------- Trạng thái ----------
  let state = null;
  let timerId = null;

  // ---------- Tiện ích ----------
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rand = (min, max) => min + Math.random() * (max - min);
  const money = (n) => n.toLocaleString("vi-VN") + " ₫";
  const difficultyFor = (level) => (level < 5 ? 1 : level < 10 ? 2 : 3);
  const timeFor = (level) => (level < 5 ? 30 : level < 10 ? 45 : 60);

  function showScreen(name) {
    Object.entries(screens).forEach(([k, s]) => s.classList.toggle("active", k === name));
    window.scrollTo(0, 0);
  }

  // ---------- Chọn câu hỏi (ngẫu nhiên từ mọi chủ đề) ----------
  function nextQuestion(level) {
    const d = difficultyFor(level);
    const seen = new Set(store.get("tttp-seen", []));
    const base = BANK.filter((q) => q.d === d && !state.used.has(q.id));
    const lastTopic = state.current ? state.current.t : null;

    // Ưu tiên: chưa gặp gần đây + khác chủ đề câu trước → nới dần điều kiện
    const tiers = [
      base.filter((q) => !seen.has(q.id) && q.t !== lastTopic),
      base.filter((q) => !seen.has(q.id)),
      base.filter((q) => q.t !== lastTopic),
      base,
    ];
    const pool = tiers.find((t) => t.length > 0) || [];
    if (pool.length === 0) return null;
    const q = pick(pool);

    state.used.add(q.id);
    const seenList = store.get("tttp-seen", []).filter((id) => id !== q.id);
    seenList.push(q.id);
    // Chỉ nhớ khoảng 70% ngân hàng câu hỏi để luôn còn câu mới
    store.set("tttp-seen", seenList.slice(-Math.floor(BANK.length * 0.7)));
    return q;
  }

  // ---------- Bắt đầu / hiển thị ----------
  function startGame() {
    sound.ensure();
    sound.start();
    state = {
      level: 0,
      used: new Set(),
      current: null,
      options: [],
      removed: new Set(),
      selected: null,
      locked: false,
      lifelines: { fifty: false, audience: false, phone: false },
      timeLeft: 0,
      paused: false,
    };
    [el.ll5050, el.llAudience, el.llPhone].forEach((b) => b.classList.remove("used"));
    renderLadder();
    showScreen("game");
    loadQuestion();
  }

  function loadQuestion() {
    const q = nextQuestion(state.level);
    if (!q) {
      endGame("walk");
      return;
    }
    state.current = q;
    state.options = shuffle(q.a.map((text, i) => ({ text, correct: i === 0 })));
    state.removed = new Set();
    state.selected = null;
    state.locked = false;

    el.qNumber.textContent = "Câu " + (state.level + 1);
    el.qPrize.textContent = money(PRIZES[state.level]);
    el.qTopic.textContent = TOPICS[q.t] || "";
    el.qText.textContent = q.q;
    el.qBox.classList.remove("enter");
    void el.qBox.offsetWidth;
    el.qBox.classList.add("enter");

    el.answers.innerHTML = "";
    state.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "answer enter";
      btn.style.animationDelay = 0.15 + i * 0.08 + "s";
      const letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = LETTERS[i] + ":";
      const text = document.createElement("span");
      text.textContent = opt.text;
      btn.append(letter, text);
      btn.addEventListener("click", () => chooseAnswer(i));
      el.answers.appendChild(btn);
    });

    el.btnWalk.disabled = false;
    updateLifelineButtons();
    renderLadder();
    startTimer(timeFor(state.level));
  }

  function renderLadder() {
    el.ladderList.innerHTML = "";
    PRIZES.forEach((p, i) => {
      const li = document.createElement("li");
      if (MILESTONES.includes(i) || i === PRIZES.length - 1) li.classList.add("milestone");
      if (state && i < state.level) li.classList.add("passed");
      if (state && i === state.level) li.classList.add("current");
      const lv = document.createElement("span");
      lv.className = "lv";
      lv.textContent = i + 1;
      const amt = document.createElement("span");
      amt.className = "amt";
      amt.textContent = money(p);
      li.append(lv, amt);
      el.ladderList.appendChild(li);
    });
  }

  function answerButtons() {
    return [...el.answers.querySelectorAll(".answer")];
  }

  // ---------- Đồng hồ ----------
  function startTimer(seconds) {
    stopTimer();
    state.timeLeft = seconds;
    state.timeTotal = seconds;
    state.paused = false;
    renderTimer();
    timerId = setInterval(() => {
      if (state.paused || state.locked) return;
      state.timeLeft--;
      renderTimer();
      if (state.timeLeft > 0 && state.timeLeft <= 5) sound.tick();
      if (state.timeLeft <= 0) {
        stopTimer();
        timeUp();
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function renderTimer() {
    const circ = 119.38;
    el.timerText.textContent = Math.max(0, state.timeLeft);
    el.timerFill.style.strokeDashoffset = circ * (1 - state.timeLeft / state.timeTotal);
    el.timer.classList.toggle("warn", state.timeLeft <= 10);
    el.timer.classList.toggle("paused", state.paused);
  }

  function setPaused(paused) {
    if (!state) return;
    state.paused = paused;
    renderTimer();
  }

  // ---------- Trả lời (bấm là chốt ngay) ----------
  function chooseAnswer(chosen) {
    if (!state || state.locked || state.removed.has(chosen) || !el.modal.hidden) return;
    state.locked = true;
    state.selected = chosen;
    stopTimer();
    el.btnWalk.disabled = true;
    updateLifelineButtons();
    answerButtons().forEach((b, j) => {
      b.disabled = true;
      b.classList.toggle("selected", j === chosen);
    });
    sound.lock();

    setTimeout(() => {
      const correctIdx = state.options.findIndex((o) => o.correct);
      const buttons = answerButtons();
      buttons[correctIdx].classList.remove("selected");
      buttons[correctIdx].classList.add("correct", "flash");

      if (chosen === correctIdx) {
        sound.correct();
        if (state.level === PRIZES.length - 1) {
          setTimeout(() => endGame("win"), 1800);
        } else {
          setTimeout(() => {
            state.level++;
            loadQuestion();
          }, 2000);
        }
      } else {
        buttons[chosen].classList.remove("selected");
        buttons[chosen].classList.add("wrong");
        sound.wrong();
        setTimeout(() => endGame("wrong"), 2600);
      }
    }, 2200);
  }

  function timeUp() {
    state.locked = true;
    updateLifelineButtons();
    const buttons = answerButtons();
    buttons.forEach((b) => { b.disabled = true; b.classList.remove("selected"); });
    const correctIdx = state.options.findIndex((o) => o.correct);
    buttons[correctIdx].classList.add("correct", "flash");
    sound.wrong();
    setTimeout(() => endGame("timeout"), 2600);
  }

  function safeWinnings() {
    let won = 0;
    MILESTONES.forEach((m) => { if (state.level > m) won = PRIZES[m]; });
    return won;
  }

  function endGame(reason) {
    stopTimer();
    closeModal();
    const correct = state.current ? state.current.a[0] : "";
    let prize = 0;

    if (reason === "win") {
      prize = PRIZES[PRIZES.length - 1];
      el.endKicker.textContent = "Xin chúc mừng!";
      el.endTitle.textContent = "Bạn là Triệu Phú!";
      el.endDetail.textContent = "Bạn đã trả lời đúng cả 15 câu hỏi. Thật xuất sắc!";
      sound.win();
    } else {
      if (reason === "walk") {
        prize = state.level > 0 ? PRIZES[state.level - 1] : 0;
        el.endKicker.textContent = "Dừng cuộc chơi";
        el.endTitle.textContent = "Một quyết định khôn ngoan";
      } else {
        prize = safeWinnings();
        el.endKicker.textContent = reason === "timeout" ? "Hết giờ" : "Rất tiếc";
        el.endTitle.textContent = reason === "timeout" ? "Đồng hồ đã điểm" : "Câu trả lời chưa chính xác";
      }
      el.endDetail.textContent = "";
      const p1 = document.createElement("span");
      p1.textContent = `Bạn đã vượt qua ${state.level}/15 câu hỏi. `;
      el.endDetail.appendChild(p1);
      if (correct) {
        const p2 = document.createElement("span");
        p2.textContent = "Đáp án đúng của câu " + (state.level + 1) + " là: ";
        const b = document.createElement("b");
        b.textContent = correct;
        el.endDetail.append(p2, b);
      }
    }

    el.endPrize.textContent = money(prize);
    showScreen("end");
  }

  // ---------- Quyền trợ giúp ----------
  function updateLifelineButtons() {
    const lock = !state || state.locked;
    el.ll5050.disabled = lock || state.lifelines.fifty;
    el.llAudience.disabled = lock || state.lifelines.audience;
    el.llPhone.disabled = lock || state.lifelines.phone;
  }

  function useFifty() {
    if (state.locked || state.lifelines.fifty) return;
    state.lifelines.fifty = true;
    el.ll5050.classList.add("used");
    sound.lifeline();
    const wrong = state.options.map((o, i) => (o.correct ? -1 : i)).filter((i) => i >= 0);
    const toRemove = shuffle(wrong).slice(0, 2);
    const buttons = answerButtons();
    toRemove.forEach((i) => {
      state.removed.add(i);
      buttons[i].classList.add("hidden-opt");
      buttons[i].disabled = true;
    });
    updateLifelineButtons();
  }

  function useAudience() {
    if (state.locked || state.lifelines.audience) return;
    state.lifelines.audience = true;
    el.llAudience.classList.add("used");
    sound.lifeline();
    updateLifelineButtons();

    const d = state.current.d;
    const visible = state.options.map((o, i) => i).filter((i) => !state.removed.has(i));
    const correctIdx = state.options.findIndex((o) => o.correct);
    let correctShare = d === 1 ? rand(55, 80) : d === 2 ? rand(40, 65) : rand(25, 50);
    if (visible.length === 2) correctShare = Math.min(90, correctShare + 15);
    // Câu khó: thỉnh thoảng khán giả cũng nhầm
    const others = visible.filter((i) => i !== correctIdx);
    const weights = others.map(() => Math.random() + 0.2);
    const wSum = weights.reduce((a, b) => a + b, 0);
    const pct = [0, 0, 0, 0];
    pct[correctIdx] = correctShare;
    others.forEach((i, k) => { pct[i] = ((100 - correctShare) * weights[k]) / wSum; });
    const rounded = pct.map(Math.round);
    const diff = 100 - rounded.reduce((a, b) => a + b, 0);
    rounded[correctIdx] += diff;

    const poll = document.createElement("div");
    poll.className = "poll";
    rounded.forEach((p, i) => {
      const col = document.createElement("div");
      col.className = "poll-col";
      const pctEl = document.createElement("span");
      pctEl.className = "poll-pct";
      pctEl.textContent = state.removed.has(i) ? "" : p + "%";
      const bar = document.createElement("div");
      bar.className = "poll-bar";
      bar.dataset.h = state.removed.has(i) ? 0 : p;
      const letter = document.createElement("span");
      letter.className = "poll-letter";
      letter.textContent = LETTERS[i];
      col.append(pctEl, bar, letter);
      poll.appendChild(col);
    });

    openModal("Ý kiến khán giả", poll);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      poll.querySelectorAll(".poll-bar").forEach((b) => { b.style.height = b.dataset.h * 1.5 + "px"; });
    }));
  }

  function usePhone() {
    if (state.locked || state.lifelines.phone) return;
    state.lifelines.phone = true;
    el.llPhone.classList.add("used");
    sound.lifeline();
    updateLifelineButtons();

    const d = state.current.d;
    const friend = pick(FRIENDS);
    const visible = state.options.map((o, i) => i).filter((i) => !state.removed.has(i));
    const correctIdx = state.options.findIndex((o) => o.correct);
    const accuracy = d === 1 ? 0.92 : d === 2 ? 0.75 : 0.55;
    const isRight = Math.random() < accuracy;
    const answer = isRight ? correctIdx : pick(visible.filter((i) => i !== correctIdx));
    const L = LETTERS[answer];
    const text = state.options[answer].text;

    const lines = isRight && d === 1
      ? [`Dễ mà! Chắc chắn là ${L}: ${text}.`, `Mình chắc 100%, chọn ${L} đi: ${text}.`]
      : d === 3
        ? [`Câu này khó quá... Mình nghĩ có thể là ${L}: ${text}, nhưng không dám chắc.`, `Hmm, mình đoán là ${L}: ${text}. Cân nhắc kỹ nhé!`]
        : [`Mình khá chắc là ${L}: ${text}.`, `Theo mình thì là ${L}: ${text}. Khoảng 70–80% thôi nhé.`];

    const wrap = document.createElement("div");
    const intro = document.createElement("p");
    intro.textContent = `Bạn đang gọi cho ${friend}...`;
    const bubble = document.createElement("p");
    bubble.className = "phone-bubble";
    bubble.textContent = "…";
    wrap.append(intro, bubble);
    openModal("Gọi điện cho người thân", wrap);
    setTimeout(() => { bubble.textContent = `“${pick(lines)}”`; }, 1400);
  }

  // ---------- Hộp thoại ----------
  function openModal(title, bodyNode, actions) {
    setPaused(true);
    el.modalTitle.textContent = title;
    el.modalBody.innerHTML = "";
    el.modalBody.appendChild(bodyNode);
    el.modalActions.innerHTML = "";
    (actions || [{ label: "Đóng", primary: true, onClick: closeModal }]).forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn " + (a.primary ? "btn-primary" : "btn-ghost");
      b.textContent = a.label;
      b.addEventListener("click", a.onClick);
      el.modalActions.appendChild(b);
    });
    el.modal.hidden = false;
    el.modalActions.lastChild.focus();
  }

  function closeModal() {
    if (el.modal.hidden) return;
    el.modal.hidden = true;
    setPaused(false);
  }

  function askWalkAway() {
    if (!state || state.locked) return;
    const prize = state.level > 0 ? PRIZES[state.level - 1] : 0;
    const p = document.createElement("p");
    p.textContent = `Bạn sẽ dừng cuộc chơi và mang về ${money(prize)}. Bạn chắc chắn chứ?`;
    openModal("Dừng cuộc chơi?", p, [
      { label: "Chơi tiếp", onClick: closeModal },
      { label: "Dừng lại", primary: true, onClick: () => { state.locked = true; endGame("walk"); } },
    ]);
  }

  // ---------- Âm thanh bật/tắt ----------
  function renderSoundBtn() {
    el.btnSound.innerHTML = sound.muted
      ? '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a9 9 0 0 1 0 13"/></svg>';
  }

  // ---------- Sự kiện ----------
  el.btnStart.addEventListener("click", startGame);
  el.btnAgain.addEventListener("click", startGame);
  el.btnHome.addEventListener("click", () => showScreen("start"));
  el.btnWalk.addEventListener("click", askWalkAway);
  el.ll5050.addEventListener("click", useFifty);
  el.llAudience.addEventListener("click", useAudience);
  el.llPhone.addEventListener("click", usePhone);
  el.btnLadder.addEventListener("click", () => el.ladder.classList.toggle("open"));
  el.btnSound.addEventListener("click", () => {
    sound.muted = !sound.muted;
    store.set("tttp-muted", sound.muted);
    renderSoundBtn();
    if (!sound.muted) sound.select();
  });
  el.modal.addEventListener("click", (e) => { if (e.target === el.modal) closeModal(); });

  document.addEventListener("keydown", (e) => {
    if (!screens.game.classList.contains("active")) return;
    if (e.key === "Escape") { closeModal(); el.ladder.classList.remove("open"); return; }
    if (!el.modal.hidden) return;
    const idx = LETTERS.indexOf(e.key.toUpperCase());
    if (idx >= 0) chooseAnswer(idx);
  });

  el.btnStart.disabled = BANK.length === 0;
  renderSoundBtn();
  renderLadder();
})();

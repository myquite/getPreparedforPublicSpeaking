(function () {
  "use strict";

  // ---------- Elements ----------
  const inputView   = document.getElementById("input-view");
  const cardView    = document.getElementById("card-view");
  const speechInput = document.getElementById("speech-input");
  const startBtn    = document.getElementById("start-btn");
  const backBtn     = document.getElementById("back-btn");
  const restartBtn  = document.getElementById("restart-btn");
  const chunkSize   = document.getElementById("chunk-size");

  const cardEl      = document.getElementById("card");
  const cardStage   = document.getElementById("card-stage");
  const cardText    = document.getElementById("card-text");
  const prevBtn     = document.getElementById("prev-btn");
  const nextBtn     = document.getElementById("next-btn");
  const progressFill= document.getElementById("progress-fill");
  const progressLbl = document.getElementById("progress-label");

  const timerEl     = document.getElementById("timer");
  const timerToggle = document.getElementById("timer-toggle");
  const timerReset  = document.getElementById("timer-reset");
  const icPlay      = timerToggle.querySelector(".ic-play");
  const icPause     = timerToggle.querySelector(".ic-pause");

  const STORE_KEY = "speech-practice:text";

  // ---------- State ----------
  let cards = [];
  let index = 0;
  let targetWords = 38;

  // ---------- Speech splitting ----------
  // Break text into coherent cards: respect paragraph boundaries, split into
  // sentences, then group whole sentences up to a target word count so we never
  // cut a sentence in half.
  function splitSpeech(text, target) {
    const paragraphs = text
      .replace(/\r\n/g, "\n")
      .split(/\n\s*\n|\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const result = [];

    for (const para of paragraphs) {
      // Split into sentences, keeping the terminating punctuation.
      const sentences = para.match(/[^.!?…]+[.!?…]+(?:["'”’)\]]+)?|\S[^.!?…]*$/g) || [para];

      let buffer = [];
      let bufferWords = 0;

      for (const raw of sentences) {
        const sentence = raw.trim();
        if (!sentence) continue;
        const words = sentence.split(/\s+/).length;

        // A single long sentence stands on its own card.
        if (words >= target * 1.4 && buffer.length === 0) {
          result.push(sentence);
          continue;
        }

        if (bufferWords + words > target && buffer.length > 0) {
          result.push(buffer.join(" "));
          buffer = [];
          bufferWords = 0;
        }

        buffer.push(sentence);
        bufferWords += words;
      }

      if (buffer.length) result.push(buffer.join(" "));
    }

    return result.length ? result : [text.trim()];
  }

  // ---------- Card rendering ----------
  function render(direction) {
    const text = cards[index] || "";

    if (direction) {
      const outClass = direction === "next" ? "swap-out-left" : "swap-out-right";
      const inClass  = direction === "next" ? "swap-in-left"  : "swap-in-right";
      cardEl.classList.add(outClass);
      cardEl.addEventListener("animationend", function handler() {
        cardEl.removeEventListener("animationend", handler);
        cardEl.classList.remove(outClass);
        cardText.textContent = text;
        cardEl.scrollTop = 0;
        cardEl.classList.add(inClass);
        cardEl.addEventListener("animationend", () => cardEl.classList.remove(inClass), { once: true });
      }, { once: true });
    } else {
      cardText.textContent = text;
      cardEl.scrollTop = 0;
    }

    const total = cards.length;
    progressFill.style.width = ((index + 1) / total) * 100 + "%";
    progressLbl.textContent = (index + 1) + " / " + total;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === total - 1;
  }

  function go(delta) {
    const next = index + delta;
    if (next < 0 || next >= cards.length) return;
    const direction = delta > 0 ? "next" : "prev";
    index = next;
    render(direction);
  }

  function restart() {
    if (index === 0) return;
    index = 0;
    render("prev");
  }

  // ---------- Timer (count-up stopwatch) ----------
  let timerRunning = false;
  let elapsed = 0;        // ms accumulated
  let startStamp = 0;     // performance.now() at last start
  let rafId = null;

  function fmt(ms) {
    const total = Math.floor(ms / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return m + ":" + s;
  }

  function tick() {
    if (!timerRunning) return;
    timerEl.textContent = fmt(elapsed + (performance.now() - startStamp));
    rafId = requestAnimationFrame(tick);
  }

  function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    startStamp = performance.now();
    icPlay.classList.add("hidden");
    icPause.classList.remove("hidden");
    timerToggle.setAttribute("aria-label", "Pause timer");
    tick();
  }

  function pauseTimer() {
    if (!timerRunning) return;
    timerRunning = false;
    elapsed += performance.now() - startStamp;
    if (rafId) cancelAnimationFrame(rafId);
    icPlay.classList.remove("hidden");
    icPause.classList.add("hidden");
    timerToggle.setAttribute("aria-label", "Start timer");
  }

  function resetTimer() {
    pauseTimer();
    elapsed = 0;
    timerEl.textContent = "00:00";
  }

  // ---------- View switching ----------
  function startPractice() {
    const text = speechInput.value.trim();
    if (!text) return;
    cards = splitSpeech(text, targetWords);
    index = 0;
    localStorage.setItem(STORE_KEY, speechInput.value);
    inputView.classList.add("hidden");
    cardView.classList.remove("hidden");
    resetTimer();
    render();
  }

  function backToEditor() {
    pauseTimer();
    cardView.classList.add("hidden");
    inputView.classList.remove("hidden");
  }

  // ---------- Events ----------
  speechInput.addEventListener("input", () => {
    startBtn.disabled = speechInput.value.trim().length === 0;
  });

  chunkSize.addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    [...chunkSize.children].forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    targetWords = Number(btn.dataset.words);
  });

  startBtn.addEventListener("click", startPractice);
  backBtn.addEventListener("click", backToEditor);
  restartBtn.addEventListener("click", restart);
  prevBtn.addEventListener("click", () => go(-1));
  nextBtn.addEventListener("click", () => go(1));

  timerToggle.addEventListener("click", () => (timerRunning ? pauseTimer() : startTimer()));
  timerReset.addEventListener("click", resetTimer);

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (cardView.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft")  { go(-1); }
    else if (e.key === "ArrowRight") { go(1); }
    else if (e.key === "Home")  { e.preventDefault(); restart(); }
    else if (e.key === " ")     { e.preventDefault(); timerRunning ? pauseTimer() : startTimer(); }
  });

  // Touch swipe
  let touchStartX = 0, touchStartY = 0, touching = false;
  cardStage.addEventListener("touchstart", (e) => {
    touching = true;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  cardStage.addEventListener("touchend", (e) => {
    if (!touching) return;
    touching = false;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      go(dx < 0 ? 1 : -1); // swipe left -> forward, swipe right -> back
    }
  }, { passive: true });

  // Mouse drag (desktop swipe)
  let mouseDownX = null;
  cardStage.addEventListener("mousedown", (e) => { mouseDownX = e.clientX; });
  cardStage.addEventListener("mouseup", (e) => {
    if (mouseDownX === null) return;
    const dx = e.clientX - mouseDownX;
    mouseDownX = null;
    if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1);
  });

  // ---------- Restore last speech ----------
  const saved = localStorage.getItem(STORE_KEY);
  if (saved) {
    speechInput.value = saved;
    startBtn.disabled = saved.trim().length === 0;
  }
})();

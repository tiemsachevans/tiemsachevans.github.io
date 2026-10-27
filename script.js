const SUPABASE_URL =
  window.SUPABASE_URL || "https://yvngwbeprfcesjdnjwzh.supabase.co";
const SUPABASE_ANON_KEY =
  window.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2bmd3YmVwcmZjZXNqZG5qd3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDIzOTgsImV4cCI6MjEwMDcxODM5OH0.hEiP2gTcg0yU4HFBlUpmzcXQ3sydx0HxvG3ZbByjiUQ";

let _supabaseInstance = null;

async function ensureSupabaseScriptLoaded() {
  if (typeof window.supabase !== "undefined" && window.supabase.createClient) {
    return true;
  }

  const cdnSources = [
    "https://cdn.jsdelivr.532799.cn/npm/@supabase/supabase-js@2",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    "https://unpkg.com/@supabase/supabase-js@2"
  ];

  for (const src of cdnSources) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      if (typeof window.supabase !== "undefined" && window.supabase.createClient) {
        return true;
      }
    } catch (e) {
      console.warn(`⚠️ Không thể tải Supabase từ nguồn: ${src}`);
    }
  }
  return false;
}

let _supabasePromise = null;

async function getSupabase() {
  if (_supabaseInstance) return _supabaseInstance;
  if (!_supabasePromise) {
    _supabasePromise = createSupabaseInstance().then(
      (inst) => {
        if (!inst) _supabasePromise = null;
        return inst;
      },
      (err) => {
        _supabasePromise = null;
        throw err;
      },
    );
  }
  return _supabasePromise;
}

async function createSupabaseInstance() {
  if (_supabaseInstance) return _supabaseInstance;

  let retries = 60;
  while (
    retries > 0 &&
    (typeof window.supabase === "undefined" || !window.supabase.createClient)
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    retries--;
  }

  if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
    await ensureSupabaseScriptLoaded();
  }

  if (typeof window.supabase !== "undefined" && window.supabase.createClient) {
    _supabaseInstance = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    );
    return _supabaseInstance;
  }

  console.warn("⚠️ Không thể khởi tạo Supabase sau khi đã thử mọi nguồn CDN.");
  return null;
}

// ==================== MÀN HÌNH CHỜ KHI MỞ TRANG ====================
let fixedStackFullOffset = null;

function updateFixedBottomOffset() {
  const root = document.documentElement;
  const player = document.getElementById("musicPlayer");
  if (!player || getComputedStyle(player).display === "none") {
    fixedStackFullOffset = null;
    root.style.setProperty("--fixed-bottom-offset", "0px");
    return;
  }

  const compact = ["minimized", "minimized-scroll", "hidden-by-menu", "hide-on-menu"].some((name) =>
    player.classList.contains(name),
  );

  if (!compact || fixedStackFullOffset === null) {
    const bottomGap = parseFloat(getComputedStyle(player).bottom) || 0;
    const height = compact ? 72 : player.getBoundingClientRect().height;
    fixedStackFullOffset = Math.round(bottomGap + height);
  }

  root.style.setProperty("--fixed-bottom-offset", `${fixedStackFullOffset}px`);
}

function initFixedBottomStack() {
  if (window.__fixedBottomStackBound) return;
  window.__fixedBottomStackBound = true;

  let timer = null;
  const schedule = () => {
    updateFixedBottomOffset();
    clearTimeout(timer);
    timer = setTimeout(updateFixedBottomOffset, 350);
  };

  const player = document.getElementById("musicPlayer");
  if (player) {
    if ("ResizeObserver" in window) new ResizeObserver(schedule).observe(player);
    new MutationObserver(schedule).observe(player, { attributes: true, attributeFilter: ["class", "style"] });
    player.addEventListener("transitionend", updateFixedBottomOffset);
  }
  window.addEventListener("resize", () => {
    fixedStackFullOffset = null;
    schedule();
  });
  window.addEventListener("orientationchange", () => {
    fixedStackFullOffset = null;
    schedule();
  });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", schedule);
  schedule();
}

function markPageReady() {
  document.body.classList.add("page-ready");
  const loaderVideo = document.getElementById("loaderVideo");
  if (loaderVideo) setTimeout(() => loaderVideo.pause(), 500);
}

function waitAtMost(promises, ms) {
  return Promise.race([
    Promise.allSettled(promises),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
}

function runStartupTask(label, fn) {
  try {
    return Promise.resolve(fn()).catch((err) => {
      console.warn(`Khởi động "${label}" gặp lỗi:`, err);
    });
  } catch (err) {
    console.warn(`Khởi động "${label}" gặp lỗi:`, err);
    return Promise.resolve();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const readyFailsafe = setTimeout(markPageReady, 9000);

  try {
    hoistSharedModals();
    renderCharacterCreatedDates();

    [
      ["theme", initThemeMode],
      ["colorPicker", initColorPicker],
      ["searchFilter", initSearchAndFilter],
      ["modal", initModal],
      ["backToTop", initBackToTop],
      ["globalListeners", initGlobalListeners],
      ["ajaxNav", initAjaxNavigation],
      ["charSwipe", initCharViewSwipe],
      ["musicPlayer", initMusicPlayer],
      ["fixedBottomStack", initFixedBottomStack],
      ["menuToggle", initMenuToggle],
      ["catMascot", initCatMascot],
      // ["dustParticles", initDustParticles],
      ["halloweenEffect", initHalloweenEffect],
      ["unlockedPuzzles", checkUnlockedPuzzles],
    ].forEach(([label, fn]) => runStartupTask(label, fn));

    const startupTasks = [
      ["maintenance", checkMaintenanceMode],
      ["profile", initProfilePage],
      ["votes", syncCharacterVotes],
      ["feedbacks", loadFeedbacks],
      ["newCharacter", checkNewCharacter],
      ["dailyQuote", loadRandomDailyQuote],
      ["topRanking", loadTopRanking],
      ["cfsNotes", loadCfsNotes],
      ["randomCharacter", displayRandomCharacter],
      ["userSession", checkUserSession],
      ["deepLink", restoreCharViewFromHash],
    ].map(([label, fn]) => runStartupTask(label, fn));

    if (document.fonts && document.fonts.ready) startupTasks.push(document.fonts.ready);
    await waitAtMost(startupTasks, 6000);
  } finally {
    clearTimeout(readyFailsafe);
    markPageReady();
  }
});

function safeCssColor(value, fallback = "#fff2b2") {
  const v = String(value || "").trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(v) ? v : fallback;
}

function escapeHTML(str) {
  if (!str) return "";
  const p = document.createElement("p");
  p.appendChild(document.createTextNode(str));
  return p.innerHTML;
}

let lastScrollTop = 0;
window.addEventListener("scroll", () => {
  const musicPlayer = document.getElementById("musicPlayer");
  const navMenu = document.getElementById("navMenu");

  if (!musicPlayer) return;
  if (navMenu && navMenu.classList.contains("show")) return;

  let currentScroll = window.pageYOffset || document.documentElement.scrollTop;
  if (currentScroll > lastScrollTop && currentScroll > 60) {
    musicPlayer.classList.add("minimized-scroll");
  } else {
    musicPlayer.classList.remove("minimized-scroll");
  }
  lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
});

function parseQuotesData(rawQuotes) {
  if (!rawQuotes) return [];

  if (Array.isArray(rawQuotes)) {
    return rawQuotes;
  }

  if (typeof rawQuotes === "string") {
    const trimmed = rawQuotes.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      const clean = trimmed.replace(/^\[\s*|\s*\]$/g, "");
      return clean
        .split(/",\s*"/)
        .map((item) => item.replace(/^"|"$/g, "").trim())
        .filter((item) => item.length > 0);
    }
  }

  return [];
}

async function loadRandomDailyQuote() {
  let allQuotes = [];
  const supabase = await getSupabase();

  if (supabase) {
    try {
      const { data: characters, error } = await supabase
        .from("characters")
        .select("name, quotes");

      if (error) {
        console.error("Lỗi truy vấn Supabase:", error);
      }

      if (!error && characters && characters.length > 0) {
        console.log("Danh sách nhân vật từ Supabase:", characters);

        characters.forEach((char) => {
          const quotesList = parseQuotesData(char.quotes);

          if (quotesList.length > 0) {
            quotesList.forEach((quote) => {
              if (quote && typeof quote === "string" && quote.trim() !== "") {
                allQuotes.push({
                  text: quote.trim(),
                  author: char.name,
                });
              }
            });
          }
        });
      }
    } catch (err) {
      console.warn("Lỗi lấy quote từ Supabase:", err);
    }
  }

  if (allQuotes.length === 0) {
    console.warn(
      "Không tìm thấy quote từ Supabase, chuyển sang danh sách dự phòng.",
    );
    allQuotes = [
      {
        text: "Tiệm sách nhỏ này được dựng nên từ những mảnh ký ức và những câu chuyện chưa kể.",
        author: "Evans",
      },
      {
        text: "Sự bình yên đôi khi bắt đầu từ một cái chạm vô tình.",
        author: "Mimi",
      },
      {
        text: "Đừng quên đọc một chương sách trước khi ngủ nhé.",
        author: "Mèo Tiệm Sách",
      },
    ];
  }

  console.log("Tổng số câu trích dẫn khả dụng:", allQuotes.length, allQuotes);

  const randomIndex = Math.floor(Math.random() * allQuotes.length);
  const selected = allQuotes[randomIndex];

  const quoteTextEl = document.getElementById("dailyQuoteText");
  const quoteAuthorEl = document.getElementById("dailyQuoteAuthor");

  if (quoteTextEl) quoteTextEl.textContent = `"${selected.text}"`;
  if (quoteAuthorEl) quoteAuthorEl.textContent = `— ${selected.author}`;
}

// ==================== TOAST NOTIFICATION SYSTEM ====================
function showToast(message, type = "success") {
  let toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toastContainer";
    toastContainer.style.cssText = `
      position: fixed;
      bottom: calc(var(--fixed-bottom-offset, 0px) + var(--toast-bottom-gap, 24px));
      left: 0;
      right: 0;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  const isError = type === "error";

  toast.style.cssText = `
    background: ${isError ? "#fee2e2" : "#f0fdf4"};
    color: ${isError ? "#991b1b" : "#166534"};
    padding: 12px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    font-size: 0.95rem;
    font-weight: 500;
    border-left: 4px solid ${isError ? "#ef4444" : "#22c55e"};
    opacity: 0;
    transform: translateY(20px);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 360px;
    pointer-events: auto;
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;

  const icon = isError
    ? '<i class="bi bi-heartbreak-fill"></i>'
    : '<i class="bi bi-heart-fill"></i>';
  toast.innerHTML = `${icon} <span>${escapeHTML(message)}</span>`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function initGlobalListeners() {
  document.addEventListener("click", (e) => {
    const likeBtn =
      e.target.closest(".btn-like") ||
      e.target.closest(".like-btn") ||
      e.target.closest("#modalVoteBtn");
    if (likeBtn) {
      e.preventDefault();
      e.stopPropagation();
      window.toggleLike(likeBtn);
    }
  });

  document.addEventListener("click", (e) => {
    const lockedChip = e.target.closest("a[data-puzzle-id], .chip-btn[data-puzzle-id]");
    if (lockedChip) {
      const puzzleId = lockedChip.getAttribute("data-puzzle-id");
      if (puzzleId) {
        if (getPuzzleLink(puzzleId)) {
          unlockCharacterLinks(puzzleId);
          const targetHref = lockedChip.href;
          if (targetHref && targetHref !== "#" && !targetHref.includes("javascript")) {
            return;
          }
        }

        e.preventDefault();
        e.stopPropagation();
        if (typeof openPuzzleModal === "function") {
          openPuzzleModal(puzzleId);
        }
      }
    }
  });

  document
    .getElementById("submitFeedbackBtn")
    ?.addEventListener("click", async () => {
      const authorInput = document.getElementById("feedbackAuthor");
      const contentInput = document.getElementById("feedbackContent");
      const currentTitle = document
        .getElementById("modalTitle")
        ?.textContent.trim();

      const author = authorInput?.value.trim() || currentUser?.user_metadata?.display_name || "Lữ khách ẩn danh";
      const content = contentInput?.value.trim();

      if (!content) {
        showToast("Vui lòng nhập nội dung cảm nhận!", "error");
        return;
      }
      if (!checkSpamGuard("feedback", content)) return;

      const userId = currentUser ? currentUser.id : null;
      const avatarUrl = currentUser?.user_metadata?.avatar_url || "./images/default_avt.jpg";

      const supabase = await getSupabase();
      if (supabase && currentTitle) {
        const { error } = await supabase
          .from("feedbacks")
          .insert([
            {
              char_name: currentTitle,
              author_name: author,
              content: content,
              user_id: userId,
              avatar_url: avatarUrl,
              parent_id: null
            },
          ]);

        if (error) {
          console.error("❌ Lỗi Supabase khi gửi feedback:", error);
          showToast(spamErrorMessage(error, "Gửi đánh giá thất bại: " + error.message), "error");
          return;
        }
      }

      markSpamSent("feedback", content);
      if (contentInput) contentInput.value = "";
      showToast("Gửi đánh giá thành công!", "success");
      await loadFeedbacks();
      await syncModalFeedbacksByName(currentTitle, { silent: true });
      revealNewFeedback("#dynamicFeedbackList");
    });
}

// ==================== MUSIC PLAYER LOGIC ====================
const playlist = [
  { title: "60%_的遐想静谧", src: "bgm/60-的遐想静谧.mp3" },
  { title: "60%_的日常自由", src: "bgm/60-的日常自由.mp3" },
  { title: "赤いドレスの女", src: "bgm/赤いドレスの女.mp3" },
  { title: "閃光", src: "bgm/閃光.mp3" },
  { title: "TruE (Ed Ver.)", src: "bgm/TruE-edver.mp3" },
  { title: "漫步香港1999", src: "bgm/漫步香港1999.mp3" },
  { title: "Không Buông", src: "bgm/không-buông.mp3" },
  { title: "Tìm Em", src: "bgm/tìm-em.mp3" },
  {
    title: "If I Can Stop One Heart from Breaking",
    src: "bgm/if-i-can-stop-one-heart-from-breaking.mp3",
  },
  { title: "White Night", src: "bgm/white-night.mp3" },
  { title: "Monodrama", src: "bgm/monodrama.mp3" },
  { title: "Duodrama", src: "bgm/duodrama.mp3" },
  { title: "Coronal Radiance", src: "bgm/coronal-radiance.mp3" },
  {
    title: "Flares of the Blazing Sun",
    src: "bgm/flares-of-the-blazing-sun.mp3",
  },
  {
    title: "Come Alive (Tripped Out)",
    src: "bgm/come-alive-tripped-out.mp3",
  },
  { title: "' Nhức Tiềm Thức |", src: "bgm/nhức-tiềm-thức.mp3" },
  { title: "Move On", src: "bgm/move-on.mp3" },
  { title: "Dạt Vào Tim Em", src: "bgm/dạt-vào-tim-em.mp3" },
  { title: "Xa", src: "bgm/xa.mp3" },
];
let currentTrackIndex = 0;
let isLooping = false;
let isMusicPlayerInitialized = false;

function initMusicPlayer() {
  if (isMusicPlayerInitialized) return;

  const audio = document.getElementById("audioSource");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const playIcon = document.getElementById("playIcon");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const loopBtn = document.getElementById("loopBtn");
  const trackTitle = document.getElementById("trackTitle");
  const progressBar = document.getElementById("progressBar");
  const currentTimeEl = document.getElementById("currentTime");
  const durationTimeEl = document.getElementById("durationTime");
  const playlistToggleBtn = document.getElementById("playlistToggleBtn");
  const playlistMenu = document.getElementById("playlistMenu");
  const playlistContainer = document.getElementById("playlistContainer");
  const playlistWrapper = document.getElementById("playlistWrapper");

  if (!audio) return;

function loadTrack(index) {
    if (playlist.length === 0) return;
    currentTrackIndex = index;
    const track = playlist[currentTrackIndex];
    audio.src = track.src;

    if (trackTitle) {
      trackTitle.textContent = track.title;
      trackTitle.dataset.originalTitle = track.title;
    }

    audio.load();
    updatePlaylistUI();
  }

  function updatePlaylistUI() {
    if (!playlistContainer) return;
    playlistContainer.innerHTML = playlist
      .map(
        (item, idx) => `
      <div class="playlist-item ${idx === currentTrackIndex ? "active" : ""}" onclick="playTrackIndex(${idx})">
        <span>${escapeHTML(item.title)}</span>
        ${
          idx === currentTrackIndex
            ? `
          <div class="sound-wave ${audio.paused ? "paused" : ""}" id="soundWave">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        `
            : ""
        }
      </div>
    `,
      )
      .join("");
  }

  function updateSoundWaveState() {
    const soundWave = document.getElementById("soundWave");
    if (!soundWave) {
      updatePlaylistUI();
      return;
    }
    if (audio.paused) {
      soundWave.classList.add("paused");
      if (playIcon) playIcon.className = "bi bi-play-fill";
    } else {
      soundWave.classList.remove("paused");
      if (playIcon) playIcon.className = "bi bi-pause-fill";
    }
  }

  window.playTrackIndex = function (idx) {
    loadTrack(idx);
    audio.play().catch((err) => console.log("Lỗi phát nhạc:", err));
  };

  playPauseBtn?.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().catch((err) => console.log("Lỗi phát nhạc:", err));
    } else {
      audio.pause();
    }
  });

  prevBtn?.addEventListener("click", () => {
    currentTrackIndex =
      (currentTrackIndex - 1 + playlist.length) % playlist.length;
    loadTrack(currentTrackIndex);
    audio.play().catch((err) => console.log("Lỗi phát nhạc:", err));
  });

  nextBtn?.addEventListener("click", () => {
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    loadTrack(currentTrackIndex);
    audio.play().catch((err) => console.log("Lỗi phát nhạc:", err));
  });

  loopBtn?.addEventListener("click", () => {
    isLooping = !isLooping;
    audio.loop = isLooping;
    loopBtn.classList.toggle("active", isLooping);
  });

  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      const progressPercent = (audio.currentTime / audio.duration) * 100;
      if (progressBar) progressBar.value = progressPercent;
      if (currentTimeEl)
        currentTimeEl.textContent = formatTime(audio.currentTime);
      if (durationTimeEl)
        durationTimeEl.textContent = formatTime(audio.duration);

      const trackTitleEl = document.querySelector(".track-title");
      const currentTime = Math.floor(audio.currentTime);

      if (trackTitleEl) {
        if (
          !trackTitleEl.dataset.originalTitle &&
          !trackTitleEl.innerHTML.includes("Morse:")
        ) {
          trackTitleEl.dataset.originalTitle = trackTitleEl.textContent;
        }

        if (currentTime >= 196 && currentTime <= 200) {
          trackTitleEl.innerHTML =
            "<span style='color: #6475f1; font-weight: bold;'>48696d69747375</span>";
        } else {
          if (trackTitleEl.dataset.originalTitle) {
            trackTitleEl.textContent = trackTitleEl.dataset.originalTitle;
          }
        }
      }
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    if (durationTimeEl && audio.duration) {
      durationTimeEl.textContent = formatTime(audio.duration);
    }
  });

  progressBar?.addEventListener("input", (e) => {
    if (audio.duration) {
      const seekTime = (e.target.value / 100) * audio.duration;
      audio.currentTime = seekTime;
    }
  });

  audio.addEventListener("ended", () => {
    if (!isLooping) {
      nextBtn?.click();
    }
  });

  playlistToggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    playlistMenu?.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (playlistWrapper && !playlistWrapper.contains(e.target)) {
      playlistMenu?.classList.remove("show");
    }
  });

  audio.addEventListener("play", updateSoundWaveState);
  audio.addEventListener("pause", updateSoundWaveState);

  loadTrack(0);
  isMusicPlayerInitialized = true;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// ==================== AJAX NAVIGATION SYSTEM ====================
function initAjaxNavigation() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a.nav-link, .nav-logo");
    if (!link) return;

    const href = link.getAttribute("href");
    if (
      !href ||
      href.startsWith("http") ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.endsWith("#")
    ) {
      return;
    }

    e.preventDefault();

    closeMobileMenu();

    loadPageViaAjax(href);
  });

  window.addEventListener("popstate", (e) => {
    closeMobileMenu();

    if (isBotModalOpen()) {
      closeBotModal(true);
      return;
    }
    if (
      e.state &&
      e.state.charView &&
      isMobileView() &&
      document.getElementById("botModal")
    ) {
      openBotModalByName(e.state.charView);
      return;
    }

    const path = window.location.pathname.split("/").pop() || "index.html";
    if (path === currentPagePath) return;
    loadPageViaAjax(path, false);
  });
}

const SHARED_MODAL_IDS = ["botModal", "puzzleModal", "feedbackPopupModal"];

function applyDialogA11y() {
  [
    ["botModal", "Thông tin nhân vật"],
    ["puzzleModal", "Giải mã nhân vật"],
    ["feedbackPopupModal", "Gửi thư / Feedback"],
  ].forEach(([id, label]) => {
    const el = document.getElementById(id);
    if (el && !el.getAttribute("role")) {
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", label);
    }
  });
}

function hoistSharedModals() {
  const main = document.getElementById("main-content");
  if (!main) return;
  SHARED_MODAL_IDS.forEach((id) => {
    const inMain = main.querySelector("#" + id);
    if (!inMain) return;
    const persistent = Array.from(document.querySelectorAll("#" + id)).find(
      (el) => !main.contains(el),
    );
    if (persistent) {
      inMain.remove();
    } else {
      document.body.appendChild(inMain);
    }
  });
  applyDialogA11y();
}

async function loadPageViaAjax(url, pushHistory = true) {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) {
    window.location.href = url;
    return;
  }

  try {
    mainContent.style.opacity = "0";
    mainContent.style.transition = "opacity 0.2s ease-in-out";

    const response = await fetch(url);
    if (!response.ok) throw new Error("Không thể tải trang");
    const htmlText = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const newMain = doc.querySelector("#main-content");
    const newTitle = doc.querySelector("title");

    if (!newMain) {
      window.location.href = url;
      return;
    }

    setTimeout(async () => {
      mainContent.innerHTML = newMain.innerHTML;
      hoistSharedModals();
      if (newTitle) document.title = newTitle.textContent;

      if (pushHistory) {
        window.history.pushState({ path: url }, "", url);
      }

      currentPagePath =
        url.split("#")[0].split("?")[0].split("/").pop() || "index.html";
      const pageTasks = reinitializePageScripts();
      await waitAtMost(pageTasks || [], 3500);

      mainContent.style.opacity = "1";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
  } catch (error) {
    console.error("Lỗi chuyển trang AJAX:", error);
    window.location.href = url;
  }
}

function reinitializePageScripts() {
  document.body.classList.remove("modal-open", "char-view-open");
  unlockPageScroll(false);
  renderCharacterCreatedDates();
  const pageTasks = [
    syncCharacterVotes(),
    loadTopRanking(),
    loadCfsNotes(),
    displayRandomCharacter(),
    loadRandomDailyQuote(),
    checkNewCharacter(),
  ];
  initColorPicker();
  initSearchAndFilter();
  initModal();
  initCatMascot();
  // initDustParticles();
  initHalloweenEffect();
  checkUnlockedPuzzles();
  autofillUserNames();

  if (document.querySelector(".profile-page-container")) {
    pageTasks.push(initProfilePage());
  }
  return pageTasks;
}
function handleNavAuthClick() {
  closeMobileMenu();
  if (currentUser) {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    if (currentPath !== "profile.html") {
      loadPageViaAjax("profile.html");
    }
  } else {
    openAuthModal();
  }
}

// ==================== SEARCH & FILTER LOGIC ====================
function initSearchAndFilter() {
  const searchInput = document.getElementById("searchInput");
  const filterToggleBtn = document.getElementById("filterToggleBtn");
  const currentFilterText = document.getElementById("currentFilterText");
  const genreContainer = document.getElementById("genreContainer");
  const genreOptions = document.querySelectorAll(".genre-card-option");
  const botCards = document.querySelectorAll(".bot-card");
  const secretCatCard = document.querySelector(".secret-cat-card");

  if (!searchInput && !genreContainer) return;

  let activeFilter = "all";

  function isCatClue(term) {
    const keywords = ["himitsu", "Himitsu", "HIMITSU"];
    return keywords.some((key) => term.includes(key));
  }

  function filterCards() {
    const searchTerm = searchInput
      ? searchInput.value.toLowerCase().trim()
      : "";
    const hasCatClue = isCatClue(searchTerm);

    botCards.forEach((card) => {
      if (card.classList.contains("secret-cat-card")) {
        if (hasCatClue) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
        return;
      }

      const name =
        card.querySelector(".bot-name")?.textContent.toLowerCase() || "";
      const tags =
        card.querySelector(".bot-tags")?.textContent.toLowerCase() || "";

      const matchesSearch = name.includes(searchTerm);

      const matchesGenre =
        activeFilter === "all" || tags.includes(activeFilter.toLowerCase());

      if (matchesSearch && matchesGenre) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  }

  searchInput?.addEventListener("input", filterCards);

  filterToggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    genreContainer?.classList.toggle("show");
  });

  genreOptions.forEach((option) => {
    option.addEventListener("click", () => {
      genreOptions.forEach((opt) => opt.classList.remove("active"));
      option.classList.add("active");

      activeFilter = option.getAttribute("data-filter") || "all";
      if (currentFilterText) {
        currentFilterText.textContent = option.textContent.trim();
      }

      genreContainer?.classList.remove("show");
      filterCards();
    });
  });

  document.addEventListener("click", (e) => {
    if (
      genreContainer &&
      !genreContainer.contains(e.target) &&
      filterToggleBtn &&
      !filterToggleBtn.contains(e.target)
    ) {
      genreContainer.classList.remove("show");
    }
  });
}

// ==================== MODAL CARD SYSTEM LOGIC ====================
let isModalInitialized = false;

function initModal() {
  if (isModalInitialized) return;
  isModalInitialized = true;

  document.addEventListener("click", async (e) => {
    const modal = document.getElementById("botModal");

    const tabBtn = e.target.closest(".modal-tab");
    if (tabBtn && modal && modal.contains(tabBtn)) {
      setModalTab(tabBtn.dataset.tab);
      return;
    }

    if (e.target.closest("#modalShareBtn")) {
      shareCurrentCharacter();
      return;
    }

    if (
      e.target.closest("#modalClose") ||
      e.target.closest("#modalBackBtn") ||
      (modal && e.target === modal)
    ) {
      closeBotModal();
      return;
    }

    const card = e.target.closest(".bot-card");
    if (card) {
      if (
        e.target.closest(".chip-btn") ||
        e.target.closest(".bot-actions") ||
        e.target.closest(".feedback-section") ||
        e.target.closest(".btn-like") ||
        card.dataset.secret === "true" ||
        card.classList.contains("secret-cat-card")
      ) {
        return;
      }

      const charName = card.querySelector(".bot-name")?.textContent.trim();
      if (charName && charName !== "Coming Soon...") {
        e.preventDefault();
        openBotModalByName(charName);
      }
    }
  });
}

// ==================== SPA XEM NHÂN VẬT (MOBILE) ====================
let charViewScrollY = 0;

function lockPageScroll() {
  const body = document.body;
  if (body.classList.contains("scroll-locked")) return;
  charViewScrollY = window.scrollY;
  body.style.top = `-${charViewScrollY}px`;
  document.documentElement.classList.add("scroll-locked");
  body.classList.add("scroll-locked");
}

function unlockPageScroll(restore = true) {
  const body = document.body;
  if (!body.classList.contains("scroll-locked")) return;
  body.classList.remove("scroll-locked");
  document.documentElement.classList.remove("scroll-locked");
  body.style.top = "";
  if (restore) {
    window.scrollTo({ top: charViewScrollY, left: 0, behavior: "instant" });
  }
}
let currentPagePath = window.location.pathname.split("/").pop() || "index.html";

function isMobileView() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function isBotModalOpen() {
  return !!document.getElementById("botModal")?.classList.contains("show");
}

function setModalTab(tab) {
  const modal = document.getElementById("botModal");
  if (!modal) return;
  modal
    .querySelector(".modal-card")
    ?.classList.toggle("show-feedback", tab === "feedback");
  modal.querySelectorAll(".modal-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  modal.querySelector(".modal-body")?.scrollTo({ top: 0 });
}

function openBotModalUI(modal, charName) {
  setModalTab("info");
  lockPageScroll();
  modal.classList.add("show");
  if (!isMobileView()) return;

  document.body.classList.add("char-view-open");

  if (!(window.history.state && window.history.state.charView)) {
    window.history.pushState(
      { path: currentPagePath, charView: charName },
      "",
      "#nv=" + encodeURIComponent(charName),
    );
  }
}

let charViewClosing = false;

function closeBotModal(fromPopstate = false) {
  const modal = document.getElementById("botModal");
  if (!modal || charViewClosing) return;

  const wasMobileView = document.body.classList.contains("char-view-open");
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const finish = () => {
    modal.classList.remove("show", "closing");
    document.body.classList.remove("modal-open", "char-view-open");
    charViewClosing = false;
    unlockPageScroll();
    if (!wasMobileView && /^#nv=/.test(window.location.hash)) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  };

  const animate = wasMobileView && !reduceMotion;
  if (animate) charViewClosing = true;

  if (!fromPopstate && window.history.state && window.history.state.charView) {
    window.history.back();
  }

  if (animate) {
    modal.classList.add("closing");
    setTimeout(finish, 260);
  } else {
    finish();
  }
}

function initCharViewSwipe() {
  if (window.__charSwipeInit) return;
  window.__charSwipeInit = true;
  let startX = 0;
  let startY = 0;
  let tracking = false;

  document.addEventListener(
    "touchstart",
    (e) => {
      if (!isBotModalOpen() || !isMobileView() || e.touches.length !== 1) {
        tracking = false;
        return;
      }
      const t = e.touches[0];
      tracking = t.clientX < 28;
      startX = t.clientX;
      startY = t.clientY;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (t.clientX - startX > 70 && Math.abs(t.clientY - startY) < 60) {
        closeBotModal();
      }
    },
    { passive: true },
  );
}

async function restoreCharViewFromHash() {
  const m = window.location.hash.match(/^#nv=(.+)$/);
  if (!m || !document.getElementById("botModal")) return;
  let name = "";
  try {
    name = decodeURIComponent(m[1]);
  } catch (_) {
    return;
  }
  if (isMobileView()) {
    window.history.replaceState(
      { path: currentPagePath },
      "",
      window.location.pathname + window.location.search,
    );
  }
  await openBotModalByName(name);
}

window.openBotModalByName = async function (name) {
  const modal = document.getElementById("botModal");
  if (!modal) return;

  document.body.classList.add("modal-open");

  const normalize = (str) => (str || "").trim().toLowerCase().replace(/[’']/g, "'");
  const cleanTargetName = normalize(name);

  const characters = await getAllCharacters();
  const char = characters.find((c) => normalize(c.name) === cleanTargetName);

  if (char) {
    const modalTitle = document.getElementById("modalTitle");
    const modalSubtitle = document.getElementById("modalSubtitle");
    const modalToc = document.getElementById("modalToc");
    const modalTocHeading = document.getElementById("modalTocHeading");
    const modalOpeningScenes = document.getElementById("modalOpeningScenes");
    const openingSectionBox = document.getElementById("openingSectionBox");
    const modalChipsContainer = document.getElementById("modalChipsContainer");
    const modalVoteCount = document.getElementById("modalVoteCount");
    const modalVoteBtn = document.getElementById("modalVoteBtn");

    if (modalTitle) modalTitle.textContent = char.name;
    if (modalSubtitle) modalSubtitle.textContent = char.title || "";
    if (modalTocHeading) modalTocHeading.textContent = "Trigger Commands";
    if (modalToc) modalToc.innerHTML = char.toc || "Chưa có thông tin trigger commands.";

    if (openingSectionBox && modalOpeningScenes) {
      if (char.opening && char.opening.trim() !== "") {
        openingSectionBox.style.display = "block";
        modalOpeningScenes.innerHTML = char.opening;
      } else {
        openingSectionBox.style.display = "none";
      }
    }

    if (modalChipsContainer) modalChipsContainer.innerHTML = char.chipsHTML || "";
    if (modalVoteCount) modalVoteCount.textContent = char.votes || 0;

    const userLikedList = getLocalLikedCharacters();
    const isLiked = userLikedList.some((n) => normalize(n) === cleanTargetName);
    if (modalVoteBtn) {
      modalVoteBtn.classList.toggle("liked", isLiked);
    }

    modal.classList.add("show");
    await syncModalFeedbacksByName(char.name);

    autofillUserNames();
    checkUnlockedPuzzles();
  }
};

async function syncModalFeedbacks(charName, botCard) {
  const modalFeedbackList = document.getElementById("dynamicFeedbackList");
  if (!modalFeedbackList) return;

  modalFeedbackList.innerHTML = "";

  const cardFeedbackItems = botCard.querySelectorAll(
    ".feedback-list .feedback-item",
  );

  if (cardFeedbackItems.length > 0) {
    cardFeedbackItems.forEach((item) => {
      modalFeedbackList.appendChild(item.cloneNode(true));
    });
    return;
  }

  try {
    const supabase = await getSupabase();
    if (supabase && charName) {
      const { data, error } = await supabase
        .from("feedbacks")
        .select("*")
        .eq("char_name", charName)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const cardFeedbackContainer = botCard.querySelector(".feedback-list");
        if (cardFeedbackContainer) cardFeedbackContainer.innerHTML = "";

        data.forEach((fb) => {
          const fbHTML = `
            <div class="feedback-item">
              <strong>${escapeHTML(fb.author_name || "Lữ khách ẩn danh")}:</strong> ${escapeHTML(fb.content)}
            </div>
          `;
          modalFeedbackList.insertAdjacentHTML("beforeend", fbHTML);
          if (cardFeedbackContainer) {
            cardFeedbackContainer.insertAdjacentHTML("beforeend", fbHTML);
          }
        });
        return;
      }
    }
  } catch (err) {
    console.error("Lỗi khi tải feedback cho Modal:", err);
  }

  modalFeedbackList.innerHTML = `
    <p class="no-feedback-text" style="opacity:0.7; font-style:italic; padding: 8px 0;">
      Chưa có lời nhắn nào cho ${escapeHTML(charName)}. Hãy là người đầu tiên gửi feedback!
    </p>
  `;
}

function renderModalFeedbacks(charName, botCard) {
  const modalFeedbackList = document.getElementById("dynamicFeedbackList");
  if (!modalFeedbackList) return;

  const cardFeedbackItems = botCard.querySelectorAll(
    ".feedback-list .feedback-item",
  );

  if (cardFeedbackItems.length === 0) {
    modalFeedbackList.innerHTML = `<p class="no-feedback-text" style="opacity:0.7; font-style:italic;">Chưa có lời nhắn nào cho ${escapeHTML(charName)}. Hãy là người đầu tiên gửi feedback!</p>`;
    return;
  }

  modalFeedbackList.innerHTML = "";
  cardFeedbackItems.forEach((item) => {
    const cloneItem = item.cloneNode(true);
    modalFeedbackList.appendChild(cloneItem);
  });
}

// ==================== XỬ LÝ MỞ MODAL CHI TIẾT NHÂN VẬT ====================
window.openBotModalByName = async function (name) {
  const modal = document.getElementById("botModal");
  if (!modal) {
    console.warn("Chưa tìm thấy #botModal trên trang hiện tại.");
    return;
  }

  const normalize = (str) => (str || "").trim().toLowerCase().replace(/[’']/g, "'");
  const cleanTargetName = normalize(name);

  const characters = await getAllCharacters();
  const char = characters.find((c) => normalize(c.name) === cleanTargetName);

  if (char) {
    const modalTitle = document.getElementById("modalTitle");
    const modalSubtitle = document.getElementById("modalSubtitle");
    const modalToc = document.getElementById("modalToc");
    const modalTocHeading = document.getElementById("modalTocHeading");
    const modalOpeningScenes = document.getElementById("modalOpeningScenes");
    const openingSectionBox = document.getElementById("openingSectionBox");
    const modalChipsContainer = document.getElementById("modalChipsContainer");
    const modalVoteCount = document.getElementById("modalVoteCount");
    const modalVoteBtn = document.getElementById("modalVoteBtn");

    if (modalTitle) modalTitle.textContent = char.name;
    if (modalSubtitle) modalSubtitle.textContent = char.title || "";
    if (modalTocHeading) modalTocHeading.textContent = "Trigger Commands";
    if (modalToc) modalToc.innerHTML = char.toc || "Chưa có thông tin trigger commands.";

    if (openingSectionBox && modalOpeningScenes) {
      if (char.opening && char.opening.trim() !== "") {
        openingSectionBox.style.display = "block";
        modalOpeningScenes.innerHTML = char.opening;
      } else {
        openingSectionBox.style.display = "none";
      }
    }

    if (modalChipsContainer) modalChipsContainer.innerHTML = char.chipsHTML || "";
    if (modalVoteCount) modalVoteCount.textContent = char.votes || 0;

    const userLikedList = getLocalLikedCharacters();
    const isLiked = userLikedList.some((n) => normalize(n) === cleanTargetName);
    if (modalVoteBtn) {
      modalVoteBtn.classList.toggle("liked", isLiked);
    }

    renderModalCreated(char.created);

    openBotModalUI(modal, char.name);

    checkUnlockedPuzzles();
    await syncModalFeedbacksByName(char.name);
  } else {
    console.error("Không tìm thấy thông tin cho nhân vật:", name);
  }
};

async function syncModalFeedbacksByName(charName, { silent = false } = {}) {
  const modalFeedbackList = document.getElementById("dynamicFeedbackList");
  if (!modalFeedbackList) return;

  const prevScroll = modalFeedbackList.scrollTop;
  if (!silent) {
    modalFeedbackList.innerHTML = `<span style="font-size:0.85rem; opacity:0.7; font-style:italic;">Đang tải cảm nhận...</span>`;
  }

  try {
    const supabase = await getSupabase();
    if (supabase) {
      const { data: feedbacks, error } = await supabase
        .from("feedbacks")
        .select("*")
        .eq("char_name", charName)
        .order("created_at", { ascending: true });

      if (!error && feedbacks && feedbacks.length > 0) {
        const parents = feedbacks.filter(f => !f.parent_id);
        const replies = feedbacks.filter(f => f.parent_id);

        modalFeedbackList.innerHTML = parents.map((parent) => {
          const parentAvatar = parent.avatar_url || "./images/default_avt.jpg";
          const isOwnerParent = parent.user_id === OWNER_USER_ID;
          const parentOwnerBadge = isOwnerParent ? `<i class="fa-solid fa-feather-pointed" style="color: #d4af37; margin-left: 4px;" title="Chủ Tiệm Sách Evans"></i>` : "";

          const childReplies = replies.filter(r => r.parent_id === parent.id);

          let repliesHTML = childReplies.map(r => {
            const replyAvatar = r.avatar_url || "./images/default_avt.jpg";
            const isOwnerReply = r.user_id === OWNER_USER_ID;
            const ownerBadge = isOwnerReply ? `<i class="fa-solid fa-feather-pointed" style="color: #d4af37; margin-left: 4px;" title="Chủ Tiệm Sách Evans"></i>` : "";
            return `
              <div class="feedback-reply-item" data-feedback-id="${r.id}" style="display: flex; gap: 8px; margin-left: 28px; margin-top: 8px; align-items: flex-start; padding-left: 8px; border-left: 2px solid #d4af37; font-size: 14px;">
                <img src="${escapeHTML(replyAvatar)}" alt="Avatar" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 1px solid #d4af37; flex-shrink: 0;" />
                <div style="flex: 1; font-size: 14px;">
                  <strong>${escapeHTML(r.author_name || "Lữ khách")}${ownerBadge}:</strong> ${escapeHTML(r.content)}
                </div>
              </div>
            `;
          }).join("");

          return `
            <div class="feedback-item-wrapper" data-feedback-id="${parent.id}" style="margin-bottom: 12px; font-size: 14px;">
              <div class="feedback-parent-item" style="display: flex; gap: 10px; align-items: flex-start; font-size: 14px;">
                <img src="${escapeHTML(parentAvatar)}" alt="Avatar" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid #d4af37; flex-shrink: 0;" />
                <div style="flex: 1; font-size: 14px;">
                  <div style="font-size: 14px;"><strong>${escapeHTML(parent.author_name || "Lữ khách ẩn danh")}${parentOwnerBadge}:</strong> ${escapeHTML(parent.content)}</div>
                  <button class="btn-toggle-reply" onclick="toggleReplyBox(this)" style="background: none; border: none; color: #8b3a3a; font-size: 0.8rem; cursor: pointer; padding: 2px 0; margin-top: 4px;">
                    <i class="bi bi-reply-fill"></i> Phản hồi
                  </button>
                  <div class="reply-input-box" style="display: none; margin-top: 6px;">
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                      <input type="text" class="book-input reply-name-input" placeholder="Tên..." style="font-size: 0.8rem; padding: 6px 10px; width: 100%; box-sizing: border-box;" />
                      <div style="display: flex; gap: 6px;">
                        <textarea class="book-input reply-content-input" placeholder="Viết phản hồi..." style="font-size: 0.8rem; padding: 6px 10px; flex: 1;"></textarea>
                        <button class="btn-send-reply" onclick="sendReply(this, ${parent.id})" style="background: #8b3a3a; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; flex-shrink: 0;">Gửi</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="feedback-replies-container">${repliesHTML}</div>
            </div>
          `;
        }).join("");
        modalFeedbackList.scrollTop = prevScroll;
        return;
      }
    }
  } catch (err) {
    console.warn("Lỗi tải feedback cho modal:", err);
  }

  modalFeedbackList.innerHTML = `
    <p class="no-feedback-text">
      Chưa có lời nhắn nào cho ${escapeHTML(charName)}. Hãy là người đầu tiên gửi feedback!
    </p>
  `;
}

function applyLikeUI(charName, count, liked, btn, countSpan) {
  if (btn) btn.classList.toggle("liked", liked);
  if (countSpan) countSpan.textContent = count;

  document.querySelectorAll(".bot-card").forEach((card) => {
    const name = card.querySelector(".bot-name")?.textContent.trim();
    if (name === charName) {
      const cardCount = card.querySelector(".like-count");
      if (cardCount) cardCount.textContent = count;
      card.querySelector(".btn-like")?.classList.toggle("liked", liked);
    }
  });

  if (document.getElementById("modalTitle")?.textContent.trim() === charName) {
    const modalCount = document.getElementById("modalVoteCount");
    if (modalCount) modalCount.textContent = count;
    document.getElementById("modalVoteBtn")?.classList.toggle("liked", liked);
  }
}

window.toggleLike = async function (btn) {
  const now = Date.now();
  if (btn._lastToggleTime && now - btn._lastToggleTime < 250) return;
  btn._lastToggleTime = now;

  const cardElement = btn.closest(".bot-card");
  let charName = cardElement?.querySelector(".bot-name")?.textContent.trim();
  if (!charName) {
    charName = document.getElementById("modalTitle")?.textContent.trim();
  }
  if (!charName) return;

  const countSpan =
    btn.querySelector(".like-count") ||
    document.getElementById("modalVoteCount");
  if (!countSpan) return;

  let count = parseInt(countSpan.textContent) || 0;

  const willBeLiked = !btn.classList.contains("liked");

  saveLocalLikeState(charName, willBeLiked);

  btn.classList.toggle("liked", willBeLiked);
  count = willBeLiked ? count + 1 : Math.max(0, count - 1);
  countSpan.textContent = count;

  document.querySelectorAll(".bot-card").forEach((card) => {
    const name = card.querySelector(".bot-name")?.textContent.trim();
    if (name === charName) {
      const cardCount = card.querySelector(".like-count");
      if (cardCount) cardCount.textContent = count;
      const cardLikeBtn = card.querySelector(".btn-like");
      if (cardLikeBtn) cardLikeBtn.classList.toggle("liked", willBeLiked);
    }
  });

  if (willBeLiked) {
    showToast(`Đã gửi tình yêu của bạn đến ${charName}!`, "success");
  } else {
    showToast(`Bạn không còn yêu thích ${charName} nữa rồi`, "error");
  }

  const supabase = await getSupabase();
  if (supabase) {
    const { data: newTotal, error } = await supabase.rpc("set_vote", {
      p_name: charName,
      p_liked: willBeLiked,
      p_device: getDeviceId(),
    });

    if (error) {
      console.error("❌ Lỗi Supabase khi lưu tim:", error);
      const revertedCount = willBeLiked ? Math.max(0, count - 1) : count + 1;
      saveLocalLikeState(charName, !willBeLiked);
      applyLikeUI(charName, revertedCount, !willBeLiked, btn, countSpan);
      showToast(spamErrorMessage(error, "Không lưu được lượt tim, thử lại sau nhé!"), "error");
      return;
    }

    if (typeof newTotal === "number") {
      applyLikeUI(charName, newTotal, willBeLiked, btn, countSpan);
    }
    loadTopRanking();
  }

  if (currentUser) {
  const supabase = await getSupabase();
  if (supabase) {
    if (willBeLiked) {
      await supabase
        .from("user_favorites")
        .upsert([{ user_id: currentUser.id, char_name: charName }], { onConflict: "user_id, char_name" });
    } else {
      await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("char_name", charName);
    }
  }
}
};

async function handleLikeClick(characterId, currentVotes) {
  const newVotes = currentVotes + 1;

  const supabase = await getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("characters")
    .update({ votes: newVotes })
    .eq("id", characterId);

  if (error) {
    console.error("Lỗi cập nhật tim:", error.message);
  } else {
    const el = document.querySelector(`#char-${characterId} .like-count`);
    if (el) el.textContent = newVotes;
  }
}

// ==================== NGÀY TẠO NHÂN VẬT ====================
function formatCreatedDate(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[3].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[1]}`;
  m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
  return v;
}

function createdDateHTML(text) {
  return `<i class="bi bi-calendar3"></i> Ngày tạo: ${escapeHTML(text)}`;
}

function renderCharacterCreatedDates() {
  document.querySelectorAll(".bot-card").forEach((card) => {
    const text = formatCreatedDate(card.getAttribute("data-created"));
    let el = card.querySelector(".bot-created");
    if (!text) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.className = "bot-created";
      const tags = card.querySelector(".bot-tags");
      if (tags) tags.insertAdjacentElement("afterend", el);
      else card.querySelector(".bot-body")?.prepend(el);
    }
    el.innerHTML = createdDateHTML(text);
  });
}

function renderModalCreated(raw) {
  const sub = document.getElementById("modalSubtitle");
  if (!sub) return;
  const text = formatCreatedDate(raw);
  let el = document.getElementById("modalCreated");
  if (!text) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("div");
    el.id = "modalCreated";
    el.className = "bot-created";
    sub.insertAdjacentElement("afterend", el);
  }
  el.innerHTML = createdDateHTML(text);
}

// ==================== THÔNG BÁO (CHUÔNG TRÊN THANH ĐIỀU HƯỚNG) ====================
const NOTIF_LIMIT = 30;
const notifState = {
  userId: null,
  supabase: null,
  items: [],
  channel: null,
  timer: null,
  visibilityBound: false,
  docBound: false,
};

function timeAgoVi(iso) {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return "Vừa xong";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} ngày trước`;
  return new Date(t).toLocaleDateString("vi-VN");
}

function ensureNotifUI() {
  let bell = document.getElementById("notifBellBtn");
  if (!bell) {
    const authBtn = document.getElementById("navAuthBtn");
    const host = authBtn?.parentElement || document.querySelector(".nav-right-actions");
    if (!host) return null;

    bell = document.createElement("button");
    bell.type = "button";
    bell.id = "notifBellBtn";
    bell.className = "notif-bell-btn";
    bell.hidden = true;
    bell.setAttribute("aria-label", "Thông báo");
    bell.setAttribute("aria-haspopup", "dialog");
    bell.setAttribute("aria-expanded", "false");
    bell.innerHTML = `<i class="bi bi-bell-fill"></i><span class="notif-badge" id="notifBadge" hidden>0</span>`;
    host.insertBefore(bell, authBtn || null);
  }

  if (!document.getElementById("notifPanel")) {
    const panel = document.createElement("div");
    panel.id = "notifPanel";
    panel.className = "notif-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Thông báo");
    panel.innerHTML = `
      <div class="notif-panel-head">
        <strong id="notifPanelTitle">Thông báo</strong>
        <button type="button" class="notif-markall" id="notifMarkAll">Đánh dấu đã đọc</button>
      </div>
      <div class="notif-list" id="notifList"></div>
    `;
    document.body.appendChild(panel);
  }

  if (!notifState.docBound) {
    notifState.docBound = true;
    document.addEventListener("click", (e) => {
      const bellEl = document.getElementById("notifBellBtn");
      const panelEl = document.getElementById("notifPanel");
      if (!bellEl || !panelEl) return;

      if (e.target.closest("#notifBellBtn")) {
        toggleNotifPanel();
        return;
      }
      if (e.target.closest("#notifMarkAll")) {
        markAllNotifRead();
        return;
      }
      const item = e.target.closest(".notif-item");
      if (item && panelEl.contains(item)) {
        handleNotifClick(item.dataset.notifId);
        return;
      }
      if (!panelEl.hidden && !panelEl.contains(e.target)) closeNotifPanel();
    });
  }
  return bell;
}

function toggleNotifPanel() {
  const panel = document.getElementById("notifPanel");
  if (!panel) return;
  if (panel.hidden) {
    panel.hidden = false;
    document.getElementById("notifBellBtn")?.setAttribute("aria-expanded", "true");
    renderNotifications();
    fetchNotifications();
  } else {
    closeNotifPanel();
  }
}

function closeNotifPanel() {
  const panel = document.getElementById("notifPanel");
  if (panel && !panel.hidden) panel.hidden = true;
  document.getElementById("notifBellBtn")?.setAttribute("aria-expanded", "false");
}

function renderNotifications() {
  const list = document.getElementById("notifList");
  const badge = document.getElementById("notifBadge");
  const unread = notifState.items.filter((n) => !n.is_read).length;

  if (badge) {
    badge.textContent = unread > 9 ? "9+" : String(unread);
    badge.hidden = unread === 0;
  }
  const markAll = document.getElementById("notifMarkAll");
  if (markAll) markAll.hidden = unread === 0;
  if (!list) return;

  if (notifState.items.length === 0) {
    list.innerHTML = `<div class="notif-empty">Chưa có thông báo nào.<br />Khi có người gửi feedback hoặc phản hồi bạn, thông báo sẽ hiện ở đây.</div>`;
    return;
  }

  list.innerHTML = notifState.items
    .map((n) => {
      const actor = escapeHTML(n.actor_name || "Một lữ khách");
      const ch = escapeHTML(n.char_name || "một nhân vật");
      const text =
        n.type === "reply"
          ? `<b>${actor}</b> đã phản hồi bạn ở <b>${ch}</b>`
          : `<b>${actor}</b> vừa gửi feedback cho <b>${ch}</b>`;
      const icon = n.type === "reply" ? "bi-reply-fill" : "bi-envelope-fill";
      return `
        <button type="button" class="notif-item${n.is_read ? "" : " unread"}" data-notif-id="${escapeHTML(String(n.id))}">
          <span class="notif-icon"><i class="bi ${icon}"></i></span>
          <span class="notif-body">
            <span class="notif-text">${text}</span>
            ${n.snippet ? `<span class="notif-snippet">“${escapeHTML(n.snippet)}”</span>` : ""}
            <span class="notif-time">${escapeHTML(timeAgoVi(n.created_at))}</span>
          </span>
        </button>`;
    })
    .join("");
}

async function fetchNotifications() {
  const supabase = notifState.supabase;
  if (!supabase || !notifState.userId) return;
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(NOTIF_LIMIT);
    if (error) throw error;
    notifState.items = data || [];
    const bell = document.getElementById("notifBellBtn");
    if (bell) bell.hidden = false;
    renderNotifications();
  } catch (err) {
    console.warn("Chưa tải được thông báo (đã chạy supabase/003_notifications.sql chưa?):", err);
  }
}

async function markNotifRead(ids) {
  if (!ids || ids.length === 0) return;
  const set = new Set(ids.map(String));
  notifState.items.forEach((n) => {
    if (set.has(String(n.id))) n.is_read = true;
  });
  renderNotifications();
  try {
    await notifState.supabase?.from("notifications").update({ is_read: true }).in("id", ids);
  } catch (err) {
    console.warn("Lỗi đánh dấu đã đọc:", err);
  }
}

async function markAllNotifRead() {
  const ids = notifState.items.filter((n) => !n.is_read).map((n) => n.id);
  if (ids.length === 0) return;
  notifState.items.forEach((n) => (n.is_read = true));
  renderNotifications();
  try {
    await notifState.supabase?.from("notifications").update({ is_read: true }).eq("is_read", false);
  } catch (err) {
    console.warn("Lỗi đánh dấu tất cả đã đọc:", err);
  }
}

async function handleNotifClick(idStr) {
  const n = notifState.items.find((x) => String(x.id) === String(idStr));
  if (!n) return;
  if (!n.is_read) markNotifRead([n.id]);
  closeNotifPanel();
  await openNotificationTarget(n);
}

async function openNotificationTarget(n) {
  if (!n.char_name) return;

  if (!document.getElementById("botModal")) {
    window.location.href = `characters.html#nv=${encodeURIComponent(n.char_name)}`;
    return;
  }

  await openBotModalByName(n.char_name);
  if (isMobileView()) setModalTab("feedback");

  const list = document.getElementById("dynamicFeedbackList");
  if (!list) return;
  const target =
    n.type === "reply"
      ? list.querySelector(`.feedback-reply-item[data-feedback-id="${n.feedback_id}"]`) ||
        list.querySelector(`.feedback-item-wrapper[data-feedback-id="${n.parent_id}"]`)
      : list.querySelector(`.feedback-item-wrapper[data-feedback-id="${n.feedback_id}"]`);
  flashAndReveal(target);
}

function handleIncomingNotification(n) {
  if (!n || notifState.items.some((x) => x.id === n.id)) return;
  notifState.items.unshift(n);
  notifState.items = notifState.items.slice(0, NOTIF_LIMIT);
  renderNotifications();

  const who = n.actor_name || "Một lữ khách";
  const ch = n.char_name || "một nhân vật";
  showToast(
    n.type === "reply" ? `💬 ${who} vừa phản hồi bạn ở ${ch}` : `💌 ${who} vừa gửi feedback cho ${ch}`,
    "success",
  );
}

async function initNotifications(user) {
  if (!user) return teardownNotifications();
  if (notifState.userId === user.id) return;
  teardownNotifications();

  const supabase = await getSupabase();
  if (!supabase) return;

  notifState.userId = user.id;
  notifState.supabase = supabase;
  if (!ensureNotifUI()) return;

  await fetchNotifications();
  if (notifState.userId !== user.id) return;

  try {
    notifState.channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => handleIncomingNotification(payload.new),
      )
      .subscribe();
  } catch (err) {
    console.warn("Không bật được thông báo realtime:", err);
  }

  notifState.timer = setInterval(() => {
    if (document.visibilityState === "visible") fetchNotifications();
  }, 90000);

  if (!notifState.visibilityBound) {
    notifState.visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && notifState.userId) fetchNotifications();
    });
  }
}

function teardownNotifications() {
  if (notifState.timer) clearInterval(notifState.timer);
  try {
    if (notifState.channel && notifState.supabase) notifState.supabase.removeChannel(notifState.channel);
  } catch (_) {}
  notifState.userId = null;
  notifState.timer = null;
  notifState.channel = null;
  notifState.items = [];
  closeNotifPanel();
  const bell = document.getElementById("notifBellBtn");
  if (bell) bell.hidden = true;
  renderNotifications();
}

// ==================== CHỐNG SPAM (PHÍA CLIENT) ====================
const SPAM_RULES = {
  feedback: { cooldownMs: 15000, maxLen: 500 },
  reply: { cooldownMs: 10000, maxLen: 300 },
  note: { cooldownMs: 30000, maxLen: 300 },
};

function checkSpamGuard(kind, content) {
  const rule = SPAM_RULES[kind];
  if (!rule) return true;

  if (content.length > rule.maxLen) {
    showToast(`Nội dung hơi dài rồi, tối đa ${rule.maxLen} ký tự nhé (hiện ${content.length}).`, "error");
    return false;
  }

  const links = (content.match(/(https?:\/\/|www\.)/gi) || []).length;
  if (links > 1) {
    showToast("Mỗi lời nhắn chỉ nên có tối đa 1 liên kết nha!", "error");
    return false;
  }

  let last = {};
  try {
    last = JSON.parse(localStorage.getItem(`spam_last_${kind}`) || "{}");
  } catch (_) {}

  const waitMs = (last.t || 0) + rule.cooldownMs - Date.now();
  if (waitMs > 0) {
    showToast(`Bạn gửi hơi nhanh, đợi ${Math.ceil(waitMs / 1000)} giây nữa nhé!`, "error");
    return false;
  }

  if (last.c && last.c === content.toLowerCase() && Date.now() - last.t < 10 * 60 * 1000) {
    showToast("Bạn vừa gửi nội dung này rồi.", "error");
    return false;
  }
  return true;
}

function markSpamSent(kind, content) {
  try {
    localStorage.setItem(
      `spam_last_${kind}`,
      JSON.stringify({ t: Date.now(), c: content.toLowerCase() }),
    );
  } catch (_) {}
}

function spamErrorMessage(error, fallback) {
  const msg = String(error?.message || "");
  if (msg.includes("RATE_LIMITED")) return "Bạn thao tác hơi nhanh, đợi một lát rồi thử lại nhé!";
  if (msg.includes("CONTENT_TOO_LONG")) return "Nội dung quá dài, hãy rút gọn lại nhé.";
  if (msg.includes("TOO_MANY_LINKS")) return "Mỗi lời nhắn chỉ được chứa tối đa 1 liên kết.";
  if (msg.includes("DUPLICATE_CONTENT")) return "Bạn vừa gửi nội dung này rồi.";
  if (msg.includes("EMPTY_CONTENT")) return "Nội dung đang trống.";
  return fallback;
}

function getDeviceId() {
  try {
    let id = localStorage.getItem("evans_device_id");
    if (!id) {
      id =
        window.crypto && crypto.randomUUID
          ? crypto.randomUUID()
          : "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("evans_device_id", id);
    }
    return id;
  } catch (_) {
    return "no-storage";
  }
}

// ==================== CHIA SẺ NHÂN VẬT ====================
let shareMapPromise = null;

function shareKey(name) {
  return String(name || "").normalize("NFC").trim().toLowerCase();
}

function loadShareMap() {
  if (!shareMapPromise) {
    shareMapPromise = fetch("share/map.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return shareMapPromise;
}

async function buildShareUrl(name) {
  const map = await loadShareMap();
  const slug = map[shareKey(name)];
  return slug
    ? new URL(`share/${slug}.html`, document.baseURI).href
    : new URL(`characters.html#nv=${encodeURIComponent(name)}`, document.baseURI).href;
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (_) {
    return false;
  }
}

window.shareCurrentCharacter = async function () {
  const name = document.getElementById("modalTitle")?.textContent.trim();
  if (!name) return;

  const url = await buildShareUrl(name);
  const subtitle = document.getElementById("modalSubtitle")?.textContent.trim() || "";

  if (isMobileView() && navigator.share) {
    try {
      await navigator.share({
        title: `${name} — Tiệm Sách Evans`,
        text: subtitle ? `${name} · ${subtitle}` : name,
        url,
      });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }

  const copied = await copyTextToClipboard(url);
  showToast(
    copied
      ? `Đã sao chép liên kết của ${name}!`
      : `Hãy sao chép liên kết của ${name}: ${url}`,
    copied ? "success" : "error",
  );
};

window.toggleFeedback = async function (btn) {
  const card = btn.closest(".bot-card");
  if (!card) return;
  await openFeedbackPopup(card);
};

function getFeedbackPopupCard(charName) {
  return Array.from(document.querySelectorAll(".bot-card")).find(
    (c) => c.querySelector(".bot-name")?.textContent.trim() === charName,
  );
}

function renderFeedbackPopupList() {
  const popup = document.getElementById("feedbackPopupModal");
  const listEl = document.getElementById("feedbackPopupList");
  if (!popup || !listEl) return;

  const card = getFeedbackPopupCard(popup.dataset.charName || "");
  const source = card?.querySelector(".feedback-list");
  const hasItems = !!source && source.querySelector(".feedback-item-wrapper");

  const prevScroll = listEl.scrollTop;
  listEl.innerHTML = hasItems
    ? source.innerHTML
    : `<p class="no-feedback-text">Chưa có lời nhắn nào cho nhân vật này. Hãy là người đầu tiên gửi feedback!</p>`;
  listEl.scrollTop = prevScroll;
}

function flashAndReveal(el) {
  if (!el) return;
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const prevTransition = el.style.transition;
  el.style.transition = "background-color 1.2s ease";
  el.style.backgroundColor = "rgba(212, 175, 55, 0.28)";
  setTimeout(() => {
    el.style.backgroundColor = "";
    setTimeout(() => (el.style.transition = prevTransition), 1300);
  }, 1400);
}

function feedbackListSelectorFor(btn) {
  if (btn.closest("#feedbackPopupModal")) return "#feedbackPopupList";
  if (btn.closest("#botModal")) return "#dynamicFeedbackList";
  return null;
}

function revealNewReply(parentId, listSelector) {
  if (!listSelector) return;
  const wrapper = document
    .querySelector(listSelector)
    ?.querySelector(`.feedback-item-wrapper[data-feedback-id="${parentId}"]`);
  flashAndReveal(wrapper?.querySelector(".feedback-replies-container")?.lastElementChild);
}

function revealNewFeedback(listSelector) {
  if (!listSelector) return;
  const items = document.querySelector(listSelector)?.querySelectorAll(".feedback-item-wrapper");
  flashAndReveal(items && items[items.length - 1]);
}

window.openFeedbackPopup = async function (card) {
  const popup = document.getElementById("feedbackPopupModal");
  if (!popup || !card) return;

  const charName = card.querySelector(".bot-name")?.textContent.trim() || "";
  popup.dataset.charName = charName;

  const nameEl = document.getElementById("feedbackPopupCharName");
  if (nameEl) nameEl.textContent = charName;

  const nameInput = popup.querySelector(".input-name");
  const loggedInName = currentUser?.user_metadata?.display_name || "";
  if (nameInput && !nameInput.value.trim() && loggedInName) {
    nameInput.value = loggedInName;
  }

  renderFeedbackPopupList();
  lockPageScroll();
  popup.classList.add("active");

  await loadFeedbacks();
};

window.closeFeedbackPopup = function () {
  const popup = document.getElementById("feedbackPopupModal");
  if (!popup || !popup.classList.contains("active")) return;
  popup.classList.remove("active");
  if (!isBotModalOpen()) unlockPageScroll();
};

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (document.getElementById("notifPanel") && !document.getElementById("notifPanel").hidden) {
    closeNotifPanel();
    return;
  }
  if (document.getElementById("puzzleModal")?.classList.contains("active")) {
    if (typeof closePuzzleModal === "function") closePuzzleModal();
    return;
  }
  if (document.getElementById("feedbackPopupModal")?.classList.contains("active")) {
    window.closeFeedbackPopup();
    return;
  }
  if (isBotModalOpen()) closeBotModal();
});

window.toggleReplyBox = function(btn) {
  const parentBox = btn.closest(".feedback-parent-item") || btn.closest(".feedback-item-wrapper");
  const replyBox = parentBox?.querySelector(".reply-input-box");
  if (replyBox) {
    const isHidden = replyBox.style.display === "none" || !replyBox.style.display;
    replyBox.style.display = isHidden ? "block" : "none";
    if (isHidden) {
      const nameInput = replyBox.querySelector(".reply-name-input");
      const loggedInName = currentUser?.user_metadata?.display_name || "";
      if (nameInput && !nameInput.value && loggedInName) {
        nameInput.value = loggedInName;
      }
      replyBox.querySelector(".reply-content-input")?.focus();
    }
  }
};

window.sendFeedback = async function (btn) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  console.log("👉 Đã nhấn nút gửi feedback!");

  const box = btn.closest(".feedback-input-box") || btn.closest(".modal-right-col") || btn.closest(".feedback-section");
  const nameInput = box?.querySelector(".input-name") || document.getElementById("feedbackAuthor");
  const contentInput = box?.querySelector(".input-content") || document.getElementById("feedbackContent");

  const card = btn.closest(".bot-card");
  const feedbackPopup = btn.closest("#feedbackPopupModal");
  let charName = "";

  if (feedbackPopup) {
    charName = feedbackPopup.dataset.charName || "";
  } else if (card) {
    charName = card.querySelector(".bot-name")?.textContent.trim();
  } else {
    charName = document.getElementById("modalTitle")?.textContent.trim();
  }

  const loggedInName = currentUser?.user_metadata?.display_name;
  const author = loggedInName || nameInput?.value.trim() || "Lữ khách ẩn danh";
  const content = contentInput?.value.trim();

  console.log("📝 Dữ liệu feedback:", { charName, author, content });

  if (!content) {
    showToast("Bạn quên chưa nhập nội dung rồi!", "error");
    return;
  }

  if (!charName) {
    showToast("Không xác định được tên nhân vật!", "error");
    return;
  }

  if (!checkSpamGuard("feedback", content)) return;

  btn.disabled = true;

  const userId = currentUser ? currentUser.id : null;
  const avatarUrl = currentUser?.user_metadata?.avatar_url || "./images/default_avt.jpg";

  const supabase = await getSupabase();
  if (supabase) {
    const { error } = await supabase.from("feedbacks").insert([
      {
        char_name: charName,
        author_name: author,
        content: content,
        user_id: userId,
        avatar_url: avatarUrl,
        parent_id: null
      },
    ]);

    if (error) {
      console.error("❌ Lỗi Supabase khi gửi feedback:", error);
      showToast(spamErrorMessage(error, "Gửi đánh giá thất bại!"), "error");
      btn.disabled = false;
      return;
    }
  }

  markSpamSent("feedback", content);

  if (contentInput) contentInput.value = "";
  showToast("Gửi đánh giá thành công!", "success");
  btn.disabled = false;

  const listSelector = feedbackListSelectorFor(btn);
  await loadFeedbacks();

  if (typeof syncModalFeedbacksByName === "function" && charName) {
    await syncModalFeedbacksByName(charName, { silent: true });
  }
  revealNewFeedback(listSelector);
};

window.sendReply = async function(btn, parentId) {
  const replyBox = btn.closest(".reply-input-box");
  const nameInput = replyBox?.querySelector(".reply-name-input");
  const contentInput = replyBox?.querySelector(".reply-content-input");

  const author = nameInput?.value.trim() || currentUser?.user_metadata?.display_name || "Lữ khách ẩn danh";
  const content = contentInput?.value.trim();

  if (!content) {
    showToast("Vui lòng nhập nội dung phản hồi!", "error");
    return;
  }

  const card = btn.closest(".bot-card");
  const charName =
    btn.closest("#feedbackPopupModal")?.dataset.charName ||
    card?.querySelector(".bot-name")?.textContent.trim() ||
    document.getElementById("modalTitle")?.textContent.trim();

  if (!checkSpamGuard("reply", content)) return;

  btn.disabled = true;

  const userId = currentUser ? currentUser.id : null;
  const avatarUrl = currentUser?.user_metadata?.avatar_url || "./images/default_avt.jpg";

  const supabase = await getSupabase();
  if (supabase) {
    const { error } = await supabase.from("feedbacks").insert([
      {
        char_name: charName,
        author_name: author,
        content: content,
        user_id: userId,
        avatar_url: avatarUrl,
        parent_id: parentId
      }
    ]);

    if (error) {
      console.error("Lỗi gửi phản hồi:", error);
      showToast(spamErrorMessage(error, "Gửi phản hồi thất bại!"), "error");
      btn.disabled = false;
      return;
    }
  }

  markSpamSent("reply", content);
  showToast("Phản hồi thành công!", "success");

  const listSelector = feedbackListSelectorFor(btn);
  await loadFeedbacks();
  if (listSelector === "#dynamicFeedbackList" && charName) {
    await syncModalFeedbacksByName(charName, { silent: true });
  }
  btn.disabled = false;
  revealNewReply(parentId, listSelector);
};

// ==================== TẢI FEEDBACK TỪ SUPABASE ====================
async function loadFeedbacks() {
  const supabase = await getSupabase();
  if (!supabase) return;

  try {
    const { data: feedbacks, error } = await supabase
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: true });

    if (error || !feedbacks) return;

    const parents = feedbacks.filter(f => !f.parent_id);
    const replies = feedbacks.filter(f => f.parent_id);

    const botCards = document.querySelectorAll(".bot-card");
    botCards.forEach((card) => {
      const charNameEl = card.querySelector(".bot-name");
      if (!charNameEl) return;

      const charName = charNameEl.textContent.trim();
      const feedbackListEl = card.querySelector(".feedback-list");
      if (!feedbackListEl) return;

      const charParents = parents.filter(item => item.char_name === charName);

      if (charParents.length > 0) {
        feedbackListEl.innerHTML = "";

        charParents.forEach((parent) => {
          const itemEl = document.createElement("div");
          itemEl.className = "feedback-item-wrapper";
          itemEl.dataset.feedbackId = parent.id;

          const parentAvatar = parent.avatar_url || "./images/default_avt.jpg";
          const isOwnerParent = parent.user_id === OWNER_USER_ID;
          const parentOwnerBadge = isOwnerParent ? `<i class="fa-solid fa-feather-pointed" style="color: #d4af37; margin-left: 4px;" title="Chủ Tiệm Sách Evans"></i>` : "";

          const childReplies = replies.filter(r => r.parent_id === parent.id);

          let repliesHTML = childReplies.map(r => {
            const replyAvatar = r.avatar_url || "./images/default_avt.jpg";
            const isOwnerReply = r.user_id === OWNER_USER_ID;
            const ownerBadge = isOwnerReply ? `<i class="fa-solid fa-feather-pointed" style="color: #d4af37; margin-left: 4px;" title="Chủ Tiệm Sách Evans"></i>` : "";
            return `
              <div class="feedback-reply-item" data-feedback-id="${r.id}" style="display: flex; gap: 8px; margin-left: 28px; margin-top: 8px; align-items: flex-start; padding-left: 8px; border-left: 2px solid #d4af37; font-size: 14px;">
                <img src="${escapeHTML(replyAvatar)}" alt="Avatar" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover; border: 1px solid #d4af37; flex-shrink: 0;" />
                <div style="flex: 1; font-size: 14px;">
                  <strong>${escapeHTML(r.author_name || "Lữ khách")}${ownerBadge}:</strong> ${escapeHTML(r.content)}
                </div>
              </div>
            `;
          }).join("");

          itemEl.innerHTML = `
            <div class="feedback-parent-item" style="display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-start; font-size: 14px;">
              <img src="${escapeHTML(parentAvatar)}" alt="Avatar" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid #d4af37; flex-shrink: 0;" />
              <div style="flex: 1; font-size: 14px;">
                <div style="font-size: 14px;"><strong>${escapeHTML(parent.author_name || "Lữ khách ẩn danh")}${parentOwnerBadge}:</strong> ${escapeHTML(parent.content)}</div>
                <button class="btn-toggle-reply" onclick="toggleReplyBox(this)" style="background: none; border: none; color: #8b3a3a; font-size: 0.8rem; cursor: pointer; padding: 2px 0; margin-top: 4px;">
                  <i class="bi bi-reply-fill"></i> Phản hồi
                </button>
                <div class="reply-input-box" style="display: none; margin-top: 6px;">
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <input type="text" class="book-input reply-name-input" placeholder="Tên..." style="font-size: 0.85rem; padding: 6px 10px; width: 100%; box-sizing: border-box;" />
                    <div style="display: flex; gap: 6px;">
                      <input type="text" class="book-input reply-content-input" placeholder="Viết phản hồi..." style="font-size: 0.85rem; padding: 6px 10px; flex: 1; box-sizing: border-box;" />
                      <button class="btn-send-reply" onclick="sendReply(this, ${parent.id})" style="background: #8b3a3a; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; flex-shrink: 0;">Gửi</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="feedback-replies-container">${repliesHTML}</div>
          `;
          feedbackListEl.appendChild(itemEl);
        });
      }
    });

    if (document.getElementById("feedbackPopupModal")?.classList.contains("active")) {
      renderFeedbackPopupList();
    }
  } catch (err) {
    console.warn("Lỗi loadFeedbacks:", err);
  }
}

// ==================== HIỆU ỨNG HALLOWEEN ====================
const HALLOWEEN_ENABLED = true;

function hwSprite(body, width = 64, height = 64) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'>${body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function hwCandy(main, accent) {
  return hwSprite(
    `<path d='M3 18 L19 28 V36 L3 46Z' fill='${accent}'/><path d='M61 18 L45 28 V36 L61 46Z' fill='${accent}'/><ellipse cx='32' cy='32' rx='18' ry='13' fill='${main}' stroke='rgba(0,0,0,0.25)' stroke-width='1.5'/><path d='M22 21 Q31 33 22 43 M33 19 Q42 32 33 45' fill='none' stroke='rgba(255,255,255,0.7)' stroke-width='3' stroke-linecap='round'/>`,
  );
}

function hwLeaf(fill) {
  return hwSprite(
    `<path d='M32 4 C37 15 45 14 54 11 C50 22 56 29 61 32 C51 35 51 43 55 52 C45 49 39 51 34 60 V63 H30 V60 C25 51 19 49 9 52 C13 43 13 35 3 32 C8 29 14 22 10 11 C19 14 27 15 32 4Z' fill='${fill}' stroke='rgba(0,0,0,0.2)' stroke-width='1'/><path d='M32 14 V58 M32 30 L20 22 M32 36 L44 28 M32 44 L22 40' stroke='rgba(0,0,0,0.28)' stroke-width='1.6' fill='none' stroke-linecap='round'/>`,
  );
}

const HW_SPRITES = {
  pumpkin: hwSprite(
    `<ellipse cx='20' cy='38' rx='14' ry='18' fill='#f2740f'/><ellipse cx='44' cy='38' rx='14' ry='18' fill='#f2740f'/><ellipse cx='32' cy='38' rx='15' ry='20' fill='#ff9a2e'/><rect x='29' y='10' width='7' height='11' rx='2.5' fill='#5b3a1a'/><path d='M36 12 C41 10 44 7 45 3' stroke='#4a7c2a' stroke-width='2.5' fill='none' stroke-linecap='round'/><path d='M20 34 L27 34 L23.5 26Z M37 34 L44 34 L40.5 26Z' fill='#3b1500'/><path d='M32 38 L28.5 44 H35.5Z' fill='#3b1500'/><path d='M20 47 Q32 58 44 47 L40.5 52 L36 48 L32 53 L28 48 L23.5 52Z' fill='#3b1500'/><path d='M21 33 L26 33 L23.5 28Z M38 33 L43 33 L40.5 28Z' fill='#ffd54a' opacity='0.7'/>`,
  ),
  ghost: hwSprite(
    `<path d='M10 57 V26 A22 22 0 0 1 54 26 V57 L48 51 L42 57 L36 51 L32 57 L28 51 L22 57 L16 51Z' fill='#f6f3ff' stroke='#cdc4ee' stroke-width='1.5' stroke-linejoin='round'/><ellipse cx='24' cy='28' rx='4' ry='5.5' fill='#2b2142'/><ellipse cx='40' cy='28' rx='4' ry='5.5' fill='#2b2142'/><ellipse cx='32' cy='40' rx='4' ry='5' fill='#2b2142'/><circle cx='17' cy='36' r='3' fill='#ffb3c8' opacity='0.6'/><circle cx='47' cy='36' r='3' fill='#ffb3c8' opacity='0.6'/>`,
  ),
  bat: hwSprite(
    `<path d='M32 18 C26 8 14 6 2 12 C8 14 10 18 9 24 C14 21 18 22 21 27 C24 23 28 23 32 29 C36 23 40 23 43 27 C46 22 50 21 55 24 C54 18 56 14 62 12 C50 6 38 8 32 18Z' fill='#1b1128'/><path d='M27 17 L29 7 L32 14 L35 7 L37 17Z' fill='#1b1128'/><circle cx='30' cy='18' r='1.4' fill='#ff4d4d'/><circle cx='34' cy='18' r='1.4' fill='#ff4d4d'/>`,
    64,
    40,
  ),
  spider: hwSprite(
    `<g fill='none' stroke='#17101f' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><path d='M16 24 L5 15 L2 22 M16 28 L3 29 L1 37 M17 32 L6 41 L9 46 M19 34 L13 44 L17 48'/><path d='M32 24 L43 15 L46 22 M32 28 L45 29 L47 37 M31 32 L42 41 L39 46 M29 34 L35 44 L31 48'/></g><circle cx='24' cy='28' r='9' fill='#17101f'/><circle cx='24' cy='17' r='6' fill='#17101f'/><circle cx='21.5' cy='16' r='1.3' fill='#ff4d4d'/><circle cx='26.5' cy='16' r='1.3' fill='#ff4d4d'/><path d='M22 25 H26 L24 28 L26 31 H22 L24 28Z' fill='#d42a2a'/>`,
    48,
    48,
  ),
  candyCorn: hwSprite(
    `<defs><clipPath id='c'><path d='M32 5 C36 5 40 13 52 50 C53 55 50 59 46 59 H18 C14 59 11 55 12 50 C24 13 28 5 32 5Z'/></clipPath></defs><g clip-path='url(#c)'><rect width='64' height='22' fill='#fff8e7'/><rect y='22' width='64' height='18' fill='#ff9a2e'/><rect y='40' width='64' height='24' fill='#ffd23f'/></g><path d='M32 5 C36 5 40 13 52 50 C53 55 50 59 46 59 H18 C14 59 11 55 12 50 C24 13 28 5 32 5Z' fill='none' stroke='rgba(0,0,0,0.18)' stroke-width='1.5'/>`,
  ),
  skull: hwSprite(
    `<path d='M32 6 C17 6 10 17 10 28 C10 36 14 40 18 43 V52 H46 V43 C50 40 54 36 54 28 C54 17 47 6 32 6Z' fill='#f2efe6' stroke='#cfc9b6' stroke-width='1.5'/><ellipse cx='23' cy='29' rx='6.5' ry='7.5' fill='#1a1320'/><ellipse cx='41' cy='29' rx='6.5' ry='7.5' fill='#1a1320'/><path d='M32 36 L28 44 H36Z' fill='#1a1320'/><path d='M24 52 V46 M32 52 V46 M40 52 V46' stroke='#cfc9b6' stroke-width='2'/>`,
  ),
  candyPink: hwCandy('#ff6fae', '#ffc2dc'),
  candyPurple: hwCandy('#9b5de5', '#d8b9ff'),
  candyGreen: hwCandy('#6fd66b', '#c4f2c1'),
  leafOrange: hwLeaf('#e8741a'),
  leafRed: hwLeaf('#c0392b'),
  leafBrown: hwLeaf('#a0522d'),
};

function initHalloweenEffect() {
  if (!HALLOWEEN_ENABLED || document.getElementById("halloweenLayer")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const layer = document.createElement("div");
  layer.id = "halloweenLayer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);

  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const count = mobile ? { fall: 9, ghost: 2, bat: 2, spider: 2 } : { fall: 18, ghost: 4, bat: 4, spider: 3 };
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const place = (parent, className, sprite, width, height, style) => {
    const el = document.createElement("div");
    el.className = className;
    el.style.backgroundImage = sprite;
    el.style.width = `${Math.round(width)}px`;
    el.style.height = `${Math.round(height)}px`;
    Object.entries(style).forEach(([key, value]) => {
      if (key.startsWith("--")) el.style.setProperty(key, value);
      else el.style[key] = value;
    });
    parent.appendChild(el);
    return el;
  };

  const fallSprites = [
    HW_SPRITES.pumpkin,
    HW_SPRITES.candyPink,
    HW_SPRITES.candyPurple,
    HW_SPRITES.candyGreen,
    HW_SPRITES.candyCorn,
    HW_SPRITES.leafOrange,
    HW_SPRITES.leafRed,
    HW_SPRITES.leafBrown,
    HW_SPRITES.skull,
  ];

  for (let i = 0; i < count.fall; i++) {
    const size = mobile ? rand(22, 36) : rand(28, 48);
    const duration = rand(10, 20);
    place(layer, "hw-item hw-fall", pick(fallSprites), size, size, {
      left: `${rand(0, 96)}%`,
      "--hw-drift": `${rand(-90, 90)}px`,
      "--hw-spin": `${rand(-420, 420)}deg`,
      animationDuration: `${duration}s`,
      animationDelay: `${-rand(0, duration)}s`,
    });
  }

  for (let i = 0; i < count.ghost; i++) {
    const size = mobile ? rand(38, 52) : rand(46, 68);
    const duration = rand(16, 26);
    place(layer, "hw-item hw-ghost", HW_SPRITES.ghost, size, size, {
      left: `${rand(4, 88)}%`,
      "--hw-drift": `${rand(-70, 70)}px`,
      animationDuration: `${duration}s`,
      animationDelay: `${-rand(0, duration)}s`,
    });
  }

  for (let i = 0; i < count.bat; i++) {
    const width = mobile ? rand(36, 48) : rand(44, 64);
    const duration = rand(20, 32);
    const flyLeft = Math.random() > 0.5;
    const bat = place(layer, "hw-item hw-bat", "none", width, width * 0.625, {
      top: `${rand(8, 55)}%`,
      animationName: flyLeft ? "hwBatLeft" : "hwBatRight",
      animationDuration: `${duration}s`,
      animationDelay: `${-rand(0, duration)}s`,
    });
    place(bat, "hw-bat-wing", HW_SPRITES.bat, width, width * 0.625, {
      "--hw-flip": flyLeft ? "-1" : "1",
    });
  }

  for (let i = 0; i < count.spider; i++) {
    const size = mobile ? rand(26, 34) : rand(32, 44);
    const duration = rand(9, 15);
    place(layer, "hw-item hw-spider", HW_SPRITES.spider, size, size, {
      left: `${rand(6, 92)}%`,
      "--hw-depth": `${Math.round(rand(110, mobile ? 220 : 300))}px`,
      animationDuration: `${duration}s`,
      animationDelay: `${-rand(0, duration)}s`,
    });
  }
}

// ==================== HIỆU ỨNG HẠT BỤI BAY TOÀN MÀN HÌNH ====================
// function initDustParticles() {
//   let canvas = document.getElementById("dustCanvas");
//   if (!canvas) {
//     canvas = document.createElement("canvas");
//     canvas.id = "dustCanvas";
//     document.body.appendChild(canvas);
//   }
//
//   const ctx = canvas.getContext("2d");
//   let width = (canvas.width = window.innerWidth);
//   let height = (canvas.height = window.innerHeight);
//
//   window.addEventListener("resize", () => {
//     width = canvas.width = window.innerWidth;
//     height = canvas.height = window.innerHeight;
//   });
//
//   const particleCount = Math.min(Math.floor((width * height) / 18000), 75);
//   const particles = [];
//
//   class DustParticle {
//     constructor() {
//       this.reset(true);
//     }
//
//     reset(initial = false) {
//       this.x = Math.random() * width;
//       this.y = initial ? Math.random() * height : -10;
//       this.radius = Math.random() * 2.2 + 0.8;
//       this.vx = (Math.random() - 0.5) * 0.4;
//       this.vy = Math.random() * 0.5 + 0.2;
//       this.opacity = Math.random() * 0.6 + 0.3;
//       this.fadeSpeed = Math.random() * 0.008 + 0.003;
//       this.growing = Math.random() > 0.5;
//
//       const colors = [
//         "255, 235, 170",
//         "212, 175, 55",
//         "245, 222, 179",
//         "255, 255, 255"
//       ];
//       this.color = colors[Math.floor(Math.random() * colors.length)];
//     }
//
//     update() {
//       this.x += this.vx;
//       this.y += this.vy;
//
//       if (this.growing) {
//         this.opacity += this.fadeSpeed;
//         if (this.opacity >= 0.85) this.growing = false;
//       } else {
//         this.opacity -= this.fadeSpeed;
//         if (this.opacity <= 0.15) this.growing = true;
//       }
//
//       if (this.y > height + 10 || this.x < -10 || this.x > width + 10) {
//         this.reset();
//       }
//     }
//
//     draw() {
//       ctx.beginPath();
//       ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
//       ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
//       ctx.shadowBlur = 6;
//       ctx.shadowColor = `rgba(${this.color}, 0.8)`;
//       ctx.fill();
//     }
//   }
//
//   for (let i = 0; i < particleCount; i++) {
//     particles.push(new DustParticle());
//   }
//
//   function animate() {
//     ctx.clearRect(0, 0, width, height);
//     for (let i = 0; i < particles.length; i++) {
//       particles[i].update();
//       particles[i].draw();
//     }
//     requestAnimationFrame(animate);
//   }
//
//   animate();
// }

function closeMobileMenu() {
  const navMenu = document.getElementById("navMenu");
  const menuToggle = document.getElementById("menuToggle");
  const musicPlayer = document.getElementById("musicPlayer");

  if (navMenu) navMenu.classList.remove("show");
  if (menuToggle) menuToggle.classList.remove("active");
  document.body.classList.remove("menu-open");

  if (musicPlayer) {
    musicPlayer.classList.remove("hidden-by-menu");
  }
}

// ==================== GENERAL UTILITIES ====================
function initMenuToggle() {
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("navMenu");
  const musicPlayer = document.getElementById("musicPlayer");

  menuToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = navMenu?.classList.toggle("show");
    menuToggle.classList.toggle("active", isOpen);
    document.body.classList.toggle("menu-open", isOpen);

    if (musicPlayer) {
      if (isOpen) {
        musicPlayer.classList.add("hidden-by-menu");
      } else {
        musicPlayer.classList.remove("hidden-by-menu");
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (
      navMenu &&
      navMenu.classList.contains("show") &&
      !navMenu.contains(e.target) &&
      !menuToggle?.contains(e.target)
    ) {
      closeMobileMenu();
    }
  });
}

function initBackToTop() {
  const btn = document.getElementById("backToTopBtn");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      btn?.classList.add("show");
    } else {
      btn?.classList.remove("show");
    }
  });

  btn?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function toggleDonateQR() {
  const qrBox = document.getElementById("donateQrBox");
  if (qrBox.style.display === "none" || qrBox.style.display === "") {
    qrBox.style.display = "block";
  } else {
    qrBox.style.display = "none";
  }
}

// ==================== HÀM LẤY DỮ LIỆU TỔNG HỢP (SUPABASE + FALLBACK HTML) ====================
let _allCharactersInflight = null;

async function getAllCharacters() {
  if (!_allCharactersInflight) {
    _allCharactersInflight = fetchAllCharacters().finally(() => {
      _allCharactersInflight = null;
    });
  }
  const list = await _allCharactersInflight;
  return Array.isArray(list) ? list.map((c) => ({ ...c })) : list;
}

async function fetchAllCharacters() {
  const supabase = await getSupabase();

  const cloudTask = (async () => {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from("characters").select("*");
      if (!error && data && data.length > 0) return data;
    } catch (err) {
      console.warn("Lỗi kết nối Supabase:", err);
    }
    return [];
  })();

  const readCard = (card) => ({
    name: card.querySelector(".bot-name")?.textContent.trim() || "",
    title: card.querySelector(".bot-tags")?.textContent.trim() || "",
    toc: card.getAttribute("data-toc") || "",
    opening: card.getAttribute("data-opening") || "",
    chipsHTML: card.querySelector(".bot-chips")?.innerHTML || "",
    created: card.getAttribute("data-created") || "",
  });

  const htmlTask = (async () => {
    const found = [];
    const domCards = document.querySelectorAll(".bot-card:not(.secret-cat-card)");
    let cards = Array.from(domCards);

    if (cards.length === 0) {
      try {
        const res = await fetch("characters.html");
        if (res.ok) {
          const htmlText = await res.text();
          const doc = new DOMParser().parseFromString(htmlText, "text/html");
          cards = Array.from(doc.querySelectorAll(".bot-card:not(.secret-cat-card)"));
        }
      } catch (err) {
        console.warn("Lỗi đọc file characters.html:", err);
      }
    }

    cards.forEach((card) => {
      const info = readCard(card);
      if (info.name && info.name !== "Coming Soon...") found.push(info);
    });
    return found;
  })();

  const [cloudCharacters, htmlCharacters] = await Promise.all([cloudTask, htmlTask]);

  const mergedList = htmlCharacters.map((hChar) => {
    const matchedCloud = cloudCharacters.find(
      (c) => c.name && c.name.trim().toLowerCase() === hChar.name.trim().toLowerCase()
    );
    return {
      name: hChar.name,
      title: (matchedCloud && matchedCloud.title) || hChar.title,
      votes: matchedCloud ? (matchedCloud.votes || 0) : 0,
      toc: (matchedCloud && matchedCloud.toc) || hChar.toc,
      opening: (matchedCloud && matchedCloud.opening) || hChar.opening,
      chipsHTML: (matchedCloud && matchedCloud.chipsHTML) || hChar.chipsHTML,
      created: hChar.created || "",
    };
  });

  return mergedList.length > 0 ? mergedList : cloudCharacters;
}

// ==================== ĐỒNG BỘ LƯỢT VOTE & TRẠNG THÁI TIM ====================
async function syncCharacterVotes() {
  const characters = await getAllCharacters();
  if (!characters || characters.length === 0) return;

  const voteMap = new Map();
  characters.forEach((char) => {
    if (char.name) voteMap.set(char.name.trim().toLowerCase(), char.votes || 0);
  });

  const userLikedList = getLocalLikedCharacters();

  const cards = document.querySelectorAll(".bot-card");
  cards.forEach((card) => {
    const nameEl = card.querySelector(".bot-name");
    const countEl = card.querySelector(".like-count");
    const likeBtn = card.querySelector(".btn-like");

    if (nameEl) {
      const charName = nameEl.textContent.trim();
      const key = charName.toLowerCase();

      if (countEl && voteMap.has(key)) {
        countEl.textContent = voteMap.get(key);
      }

      if (likeBtn) {
        const isLikedOnDevice = userLikedList.some((n) => n.trim().toLowerCase() === key);
        likeBtn.classList.toggle("liked", isLikedOnDevice);
      }
    }
  });

  const modalTitle = document.getElementById("modalTitle")?.textContent.trim();
  const modalVoteCount = document.getElementById("modalVoteCount");
  const modalVoteBtn = document.getElementById("modalVoteBtn");

  if (modalTitle && voteMap.has(modalTitle.toLowerCase())) {
    if (modalVoteCount) modalVoteCount.textContent = voteMap.get(modalTitle.toLowerCase());
    if (modalVoteBtn) {
      const isModalLiked = userLikedList.some((n) => n.trim().toLowerCase() === modalTitle.toLowerCase());
      modalVoteBtn.classList.toggle("liked", isModalLiked);
    }
  }
}

// ==================== BẢNG XẾP HẠNG TOP 3 ====================
async function loadTopRanking() {
  const container = document.getElementById("topRankingContainer");
  if (!container) return;

  container.innerHTML = `<span style="font-size: 0.9rem; opacity: 0.7;">Đang tải xếp hạng...</span>`;

  try {
    const characters = await getAllCharacters();

    if (!characters || characters.length === 0) {
      container.innerHTML = `<span style="font-size: 0.9rem; opacity: 0.7;">Chưa có dữ liệu xếp hạng.</span>`;
      return;
    }

    const sorted = [...characters]
      .sort((a, b) => (b.votes || 0) - (a.votes || 0))
      .slice(0, 3);

    container.innerHTML = sorted
      .map((char, index) => {
        const rank = index + 1;
        const badgeHTML = rank === 1
          ? `<i class="bi bi-trophy-fill"></i> Top 1`
          : `<i class="bi bi-award-fill"></i> Top ${rank}`;

        return `
          <div class="ranking-card rank-${rank}" style="cursor: pointer;" data-char-name="${escapeHTML(char.name || '')}">
            <span class="rank-badge">${badgeHTML}</span>
            <div class="rank-info">
              <h4 class="char-name">${escapeHTML(char.name || '')}</h4>
              <span class="char-title">${escapeHTML(char.title || "Nhân vật")}</span>
              <span class="vote-count">❤️ ${char.votes || 0} lượt thích</span>
            </div>
          </div>
        `;
      })
      .join("");

    container.querySelectorAll(".ranking-card").forEach((card) => {
      card.addEventListener("click", () => {
        const name = card.getAttribute("data-char-name");
        if (name) openBotModalByName(name);
      });
    });

  } catch (error) {
    console.error("Lỗi khi tải bảng xếp hạng:", error);
    container.innerHTML = `<span style="font-size: 0.9rem; opacity: 0.7; color: red;">Không thể tải dữ liệu xếp hạng.</span>`;
  }
}

// ==================== HIỂN THỊ NHÂN VẬT NGẪU NHIÊN ====================
async function displayRandomCharacter() {
  const container = document.getElementById("randomCharCard");
  if (!container) return;

  container.innerHTML = `<span class="random-placeholder-text">Đang tìm tri kỷ...</span>`;
  container.classList.add("fade-out");

  const characters = await getAllCharacters();

  setTimeout(() => {
    if (!characters || characters.length === 0) {
      container.innerHTML = `<span class="random-placeholder-text">Không tìm thấy dữ liệu.</span>`;
    } else {
      const validChars = characters.filter((c) => c.name && c.name !== "Coming Soon...");
      const randomChar = validChars[Math.floor(Math.random() * validChars.length)];
      const userLikedList = getLocalLikedCharacters();
      const isLiked = userLikedList.some(
        (n) => n.trim().toLowerCase() === randomChar.name.trim().toLowerCase()
      );

      container.innerHTML = `
        <div class="random-card-content" data-char-name="${escapeHTML(randomChar.name || '')}">
          <h4 class="random-char-name">${escapeHTML(randomChar.name)}</h4>
          <div class="random-char-stats">
            <div class="random-likes">
              <i class="bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}" style="color: ${isLiked ? '#ff4d4d' : '#8b3a3a'};"></i> 
              <span>${randomChar.votes || 0}</span> lượt thích
            </div>
            <div class="random-feedbacks">
              <i class="bi bi-bookmark-fill"></i> ${escapeHTML(randomChar.title || "Nhân vật")}
            </div>
          </div>
          <span class="random-hint-text">Nhấp để mở xem chi tiết nhân vật ✨</span>
        </div>
      `;

      const randomContent = container.querySelector(".random-card-content");
      if (randomContent) {
        randomContent.addEventListener("click", () => {
          const name = randomContent.getAttribute("data-char-name");
          if (name) openBotModalByName(name);
        });
      }
    }
    container.classList.remove("fade-out");
  }, 250);
}

document
  .getElementById("randomBtn")
  ?.addEventListener("click", displayRandomCharacter);

// ==================== CFS SUBMISSION ====================
function initColorPicker() {
  const colorBtns = document.querySelectorAll(".color-options .color-btn");
  if (colorBtns.length === 0) return;

  colorBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      colorBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      const radio = this.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
      }
    });
  });
}

window.submitCfsNote = async function () {
  const authorInput = document.getElementById("cfsAuthorInput");
  const contentInput = document.getElementById("cfsContentInput");
  const colorInput = document.querySelector('input[name="noteColor"]:checked');
  const submitBtn = document.getElementById("cfsSubmitBtn");

  const loggedInName = currentUser?.user_metadata?.display_name;
  const author = loggedInName || authorInput?.value.trim() || "Lữ khách ẩn danh";
  const content = contentInput?.value.trim();
  const color = colorInput ? colorInput.value : "#fff2b2";

  if (!content) {
    showToast("Bạn quên chưa viết nội dung tâm thư (cfs) rồi!", "error");
    contentInput?.focus();
    return;
  }

  if (!checkSpamGuard("note", content)) return;

  if (submitBtn) submitBtn.disabled = true;

  const cfsBoard = document.getElementById("cfsBoard");
  if (cfsBoard && cfsBoard.querySelector("div[style*='italic']")) {
    cfsBoard.innerHTML = "";
  }

  const isHolo = color === "hologram";
  const noteEl = document.createElement("div");
  noteEl.className = `cfs-note-item sticky-note ${isHolo ? "hologram-note" : ""}`;

  if (!isHolo) {
    noteEl.style.backgroundColor = color;
  }

  noteEl.innerHTML = `
    <p class="note-content">"${escapeHTML(content)}"</p>
    <span class="note-author">— ${escapeHTML(author)}</span>
  `;
  cfsBoard?.prepend(noteEl);

  const supabase = await getSupabase();
  if (supabase) {
    const noteData = {
      author: author,
      content: content,
      bg_color: color
    };

    if (currentUser) {
      noteData.user_id = currentUser.id;
    }

    const { error } = await supabase
      .from("cfs_notes")
      .insert([noteData]);

    if (error) {
      console.error("❌ Lỗi lưu Supabase:", error);
      noteEl.remove();
      if (submitBtn) submitBtn.disabled = false;
      showToast(spamErrorMessage(error, "Chưa gửi được tâm thư, bạn thử lại sau nhé!"), "error");
      return;
    }
    markSpamSent("note", content);
  }

  if (authorInput) authorInput.value = "";
  if (contentInput) contentInput.value = "";
  if (submitBtn) submitBtn.disabled = false;

  showThankYouLetterModal(author);
};

function showThankYouLetterModal(author) {
  let toast = document.getElementById("thankYouToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "thankYouToast";
    document.body.appendChild(toast);
  }

  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    background-color: #fcf8f2;
    color: #2b1c11;
    padding: 14px 22px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    font-size: 0.9rem;
    z-index: 9999;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.4s ease;
    max-width: 360px;
    line-height: 1.4;
  `;

  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
      <span style="font-size: 1.2rem; line-height: 1;">💌</span>
      <strong style="font-size: 0.95rem;">Cảm ơn ${escapeHTML(author || "Lữ khách")}!</strong>
    </div>
    <div>
      <span style="opacity: 0.9;">Cảm ơn những dòng tâm tư chân thành mà bạn đã gửi gắm vào góc Confession nhỏ của Tiệm sách. Chúc bạn luôn bình yên và có những phút giây trải nghiệm tuyệt vời tại đây!</span>
    </div>
  `;

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
  }, 3500);
}

window.closeThankYouModal = function () {
  const modal = document.getElementById("thankYouModal");
  if (modal) modal.classList.remove("show");
};

function formatNoteDate(createdAt) {
  if (!createdAt) return null;
  const iso = String(createdAt)
    .replace(" ", "T")
    .replace(/(\.\d{3})\d+/, "$1")
    .replace(/([+-]\d{2})$/, "$1:00");
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return {
    date: d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    full: d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

async function loadCfsNotes() {
  const cfsBoard = document.getElementById("cfsBoard");
  if (!cfsBoard) return;

  const supabase = await getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase
    .from("cfs_notes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Lỗi lấy danh sách CFS từ Supabase:", error);
    return;
  }

  cfsBoard.innerHTML = "";

  if (!data || data.length === 0) {
    cfsBoard.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #a0a0a0; opacity: 0.7; font-style: italic;">
        Chưa có dòng tâm thư nào trên bảng. Hãy là người đầu tiên dán ghi chú nhé!
      </div>
    `;
    return;
  }

  data.forEach((note) => {
    const noteEl = document.createElement("div");
    const isHolo = note.bg_color === "hologram";
    noteEl.className = `cfs-note-item sticky-note ${isHolo ? "hologram-note" : ""}`;

    if (!isHolo) {
      noteEl.style.backgroundColor = note.bg_color || "#fff2b2";
    }

    const noteDate = formatNoteDate(note.created_at);
    const dateHTML = noteDate
      ? `<span class="note-date" title="${escapeHTML(noteDate.full)}"><i class="bi bi-calendar3"></i> ${escapeHTML(noteDate.date)}</span>`
      : "";

    noteEl.innerHTML = `
      <p class="note-content">"${escapeHTML(note.content)}"</p>
      <div class="note-footer">
        <span class="note-author">— ${escapeHTML(note.author || "Lữ khách ẩn danh")}</span>
        ${dateHTML}
      </div>
    `;
    cfsBoard.appendChild(noteEl);
  });
  // initDustParticles();
  initHalloweenEffect();
}

function initCatMascot() {
  const catBtn = document.getElementById("catMascotBtn");
  const catBubble = document.getElementById("catBubble");
  if (!catBtn || !catBubble) return;

  if (catBtn.dataset.initialized === "true") return;
  catBtn.dataset.initialized = "true";

  let petCount = 0;

  const catQuotes = [
    "Meow~ Bạn vừa xoa đầu tớ à?",
    "Gừ gừ... Trà hôm nay ngon lắm đấy!",
    "Meow! Đừng quên đọc một chương sách trước khi ngủ nhé.",
    "Bạn xoa mát tay quá~ <i class='bi bi-stars'></i>",
    "Meoww! Bạn nhận được một chiếc Bookmark may mắn! <i class='bi bi-bookmark-heart-fill'></i>",
    "<i class='fa-solid fa-paw'></i> Chú mèo tiệm sách tặng bạn một cái ôm ấm áp!",
  ];

  catBtn.addEventListener("click", () => {
    catBtn.classList.remove("purr");
    void catBtn.offsetWidth;
    catBtn.classList.add("purr");

    petCount++;

    if (petCount === 10) {
      catBubble.innerHTML = catBubble.innerHTML =
        "<i class='fa-solid fa-key' style='color: #f1c40f;'></i> <b>Meow! Đã nhận 10 lần xoa đầu của Lữ khách! (Đừng nói cho Evans biết nha!)</b><br>Mimi trao cho bạn mảnh mật mã cuối cùng: <span style='font-weight: 900; color: #d35400; font-family: monospace; font-size: 1.05em;'>RVVSRUtB</span>.<br><span style='font-size:0.8rem; opacity:0.9;'>Chúc bạn may mắn! Meow~</span>";

      catBtn.style.transform = "scale(1.2)";
      setTimeout(() => (catBtn.style.transform = "scale(1)"), 200);
    } else if (petCount > 10) {
      catBubble.innerHTML = "🐱 Đang mở Két Sách Bí Mật...";

      if (typeof openDiplomaPasscodeModal === "function") {
        openDiplomaPasscodeModal();
      } else {
        showDiplomaModalDirect();
      }

      petCount = 0;
    } else {
      const randomQuote =
        catQuotes[Math.floor(Math.random() * catQuotes.length)];
      catBubble.innerHTML = randomQuote;
    }

    catBubble.classList.add("show");

    clearTimeout(window.catTimer);
    const displayTime = petCount >= 10 ? 4500 : 3000;

    window.catTimer = setTimeout(() => {
      catBubble.classList.remove("show");
    }, displayTime);
  });
}

// ==================== QUẢN LÝ THẢ TIM TRÊN THIẾT BỊ (LOCALSTORAGE) ====================
function getLocalLikedCharacters() {
  try {
    return JSON.parse(localStorage.getItem("liked_characters") || "[]");
  } catch (e) {
    return [];
  }
}

function saveLocalLikeState(charName, isLiked) {
  let likedList = getLocalLikedCharacters();
  if (isLiked) {
    if (!likedList.includes(charName)) likedList.push(charName);
  } else {
    likedList = likedList.filter((name) => name !== charName);
  }
  localStorage.setItem("liked_characters", JSON.stringify(likedList));
}

const characterSearchInput = document.getElementById("searchInput");
const secretBotCard = document.getElementById("secretBotCard");

if (characterSearchInput) {
  characterSearchInput.addEventListener("input", (e) => {
    const val = e.target.value.trim().toUpperCase();
    if (val === "BOOK_R77") {
      if (secretBotCard) {
        secretBotCard.style.display = "block";
        secretBotCard.scrollIntoView({ behavior: "smooth" });
      }
    }
  });
}

let wrongAttempts = 0;

function openDiplomaPasscodeModal() {
  let modal = document.getElementById("diplomaInputModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "diplomaInputModal";
    modal.className = "diploma-modal-overlay";

    modal.innerHTML = `
      <div class="diploma-modal-card">
        <div class="diploma-modal-icon">🎓</div>
        <h3 class="diploma-modal-title">Két Sách Bí Mật</h3>
        <p class="diploma-modal-desc">
          Hãy nhập Đáp án để mở khóa Giấy Chứng Nhận!
        </p>

        <!-- Dòng nhắc mật mã từ Chú Mèo -->
        <div class="cat-code-reminder">
          <i class='fa-solid fa-paw'></i> <b>Mật mã cuối cùng từ Mimi:</b> <span class="highlight-code">RVVSRUtB</span>
        </div>
        
        <input type="text" id="finalPasscode" class="diploma-modal-input" placeholder="NHẬP ĐẦY ĐỦ ĐÁP ÁN...">

        <input type="text" id="playerNameInput" class="diploma-modal-input" placeholder="Nhập tên/biệt danh của bạn..." style="margin-top: 10px;">
        
        <!-- THÊM PHẦN TỬ HIỂN THỊ THÔNG BÁO LỖI / GỢI Ý BÊN DƯỚI Ô NHẬP -->
        <div id="diplomaHint" class="diploma-error-msg"></div>

        <div class="diploma-modal-actions">
          <button onclick="closeDiplomaModal()" class="btn-diploma-cancel">Hủy</button>
          <button onclick="verifyFinalPasscode()" class="btn-diploma-confirm">Xác Nhận</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.classList.add("active");
  setTimeout(() => {
    const input = document.getElementById("finalPasscode");
    if (input) input.focus();
  }, 100);
}

function closeDiplomaModal() {
  const modal = document.getElementById("diplomaInputModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

async function verifyFinalPasscode() {
  const input = document.getElementById("finalPasscode");
  const hintEl = document.getElementById("diplomaHint");
  const nameInput = document.getElementById("playerNameInput");
  const confirmBtn = document.querySelector(".btn-diploma-confirm");

  const playerName =
    nameInput && nameInput.value.trim()
      ? nameInput.value.trim()
      : "Lữ khách ẩn danh";
  const codeVal = input ? input.value : "";
  const code = codeVal.trim().toLowerCase();

  const validAnswers = ["613himitsueureka"];

  if (validAnswers.includes(code)) {
    wrongAttempts = 0;
    if (hintEl) {
      hintEl.innerHTML = "";
      hintEl.classList.remove("show");
    }

    if (confirmBtn) confirmBtn.disabled = true;
    let solverOrder = null;

    const supabase = await getSupabase();
    if (supabase) {
      try {
        const rowToInsert = { player_name: playerName };
        if (currentUser) {
          rowToInsert.user_id = currentUser.id;
        }

        const { data, error: insertError } = await supabase
          .from("puzzle_solvers")
          .insert([rowToInsert])
          .select("id");

        if (insertError) {
          console.error("❌ Lỗi khi lưu người giải mã vào Supabase:", insertError);
        } else if (data && data.length > 0) {
          solverOrder = data[0].id;
        }

        if (currentUser) {
          await supabase.from("user_progress").upsert({
            user_id: currentUser.id,
            diploma_unlocked: true,
            solver_order: solverOrder || 1,
            player_name: playerName,
            updated_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error("❌ Lỗi kết nối Supabase:", err);
      }
    }

    localStorage.setItem("evans_diploma_unlocked", "true");
    if (solverOrder) {
      localStorage.setItem("evans_solver_order", solverOrder.toString());
    }

    closeDiplomaModal();
    if (confirmBtn) confirmBtn.disabled = false;

    showDiplomaSuccess(playerName, solverOrder);

    if (currentUser) {
      loadUserMedals(currentUser);
    }
  } else {
    wrongAttempts++;

    if (input) {
      input.classList.add("error-shake");
      setTimeout(() => input.classList.remove("error-shake"), 400);
    }

    if (hintEl) {
      if (wrongAttempts >= 10) {
        hintEl.innerHTML = `🔑 <b>Đáp án chính xác là:</b> <code style="color: #d4af37; font-weight: bold; font-size: 1.1rem;">613HimitsuEUREKA</code>`;
      } else if (wrongAttempts >= 3) {
        hintEl.innerHTML = `❌ Đáp án chưa đúng (Sai ${wrongAttempts}/10 lần). Cố lên nào!<br>💡 <b>Gợi ý:</b> Đáp án có định dạng <i>Số + Chữ + Chữ</i> !`;
      } else {
        hintEl.innerHTML = `❌ Đáp án chưa đúng (Sai ${wrongAttempts}/10 lần). Cố lên nào!`;
      }
      hintEl.classList.add("show");
    } else {
      alert("❌ Đáp án chưa đúng!");
    }
  }
}

async function submitFinalPuzzleCode() {
  const finalInput = document.getElementById("finalPasscode");
  const puzzleInput = document.getElementById("puzzleInputModal");

  const userCode = (
    finalInput ? finalInput.value : puzzleInput ? puzzleInput.value : ""
  )
    .trim()
    .toLowerCase();

  if (userCode === "613himitsueureka") {
    const usernameInput = document.getElementById("playerNameInput");
    const playerName =
      usernameInput && usernameInput.value.trim()
        ? usernameInput.value.trim()
        : "Lữ khách ẩn danh";

    const confirmBtn = document.querySelector(".btn-diploma-confirm");
    if (confirmBtn) confirmBtn.disabled = true;

    let solverOrder = null;

    const supabase = await getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from("puzzle_solvers")
          .insert([{ player_name: playerName }])
          .select("id");

        if (error) {
          console.error("❌ Lỗi khi lưu người giải mã vào Supabase:", error);
        } else if (data && data.length > 0) {
          solverOrder = data[0].id;
        }
      } catch (err) {
        console.error("❌ Lỗi kết nối Supabase:", err);
      }
    }

    closeDiplomaModal();

    showDiplomaSuccess(playerName, solverOrder);

    if (confirmBtn) confirmBtn.disabled = false;
  } else {
    alert("❌ Đáp án chưa đúng. Cố lên nào!");
  }
}

function showDiplomaSuccess(
  playerName = "Lữ khách ẩn danh",
  solverOrder = null,
) {
  let modal = document.getElementById("diplomaSuccessModal");

  const orderHTML = solverOrder
    ? `<div style="font-size: 0.95rem; color: #8b3a3a; font-weight: bold; margin-top: 8px; background: rgba(139, 58, 58, 0.08); padding: 6px 14px; border-radius: 20px; display: inline-block;">
        ✨ Bạn là lữ khách thứ <strong>#${solverOrder}</strong> giải thành công mật mã!
       </div>`
    : "";

  const today = new Date();
  const dateStr = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "diplomaSuccessModal";
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      display: flex; justify-content: center; align-items: center;
      z-index: 200000; padding: 20px; box-sizing: border-box;
    `;

    modal.innerHTML = `
      <div style="
        background: #fdfbf7;
        border: 10px solid #8b3a3a;
        outline: 2px solid #d4af37;
        padding: 40px 30px;
        border-radius: 12px;
        max-width: 600px;
        width: 100%;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        position: relative;
        font-family: 'Merriweather', serif;
      ">
        <div style="font-size: 3rem; margin-bottom: 10px;">🎓</div>
        <h2 style="font-family: 'Cormorant Garamond', serif; color: #8b3a3a; font-size: 2.2rem; margin-bottom: 5px;">GIẤY CHỨNG NHẬN</h2>
        <p style="font-size: 0.9rem; color: #6c584c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Lữ khách Xuất Sắc</p>
        
        <p style="font-size: 1rem; color: #2b1c11; margin-bottom: 0;">Chứng nhận lữ khách:</p>
        <h3 id="diplomaPlayerName" style="font-size: 1.6rem; color: #d4af37; margin: 8px 0; font-family: 'Charm', cursive;">${escapeHTML(playerName)}</h3>
        
        <div id="diplomaOrderBox">${orderHTML}</div>

        <p style="font-size: 0.95rem; color: #4a3a2c; line-height: 1.6; margin: 15px 0;">
          Đã giải mã thành công toàn bộ ẩn số và hoàn thành thử thách Két Sách Bí Mật tại Tiệm Sách Nhỏ của Evans.
        </p>

        <hr style="border: none; border-top: 1px solid #e2d7c7; margin: 20px 0 15px 0;" />

        <div style="font-size: 0.85rem; color: #6c584c; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>Hãy chụp Giấy Chứng Nhận này và liên hệ với Evans thông qua server Discord để được nhận role độc quyền!</span>
        </div>
        
        <div style="margin-top: 20px; font-size: 0.85rem; color: #8c7a6b; font-style: italic;" id="diplomaIssueDate">
          ${dateStr}
        </div>
        
        <button onclick="document.getElementById('diplomaSuccessModal').remove()" style="
          margin-top: 20px;
          background: #8b3a3a;
          color: white;
          border: none;
          padding: 10px 25px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        ">Đóng</button>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    const nameEl = document.getElementById("diplomaPlayerName");
    const orderBox = document.getElementById("diplomaOrderBox");
    const dateEl = document.getElementById("diplomaIssueDate");

    if (nameEl) nameEl.textContent = playerName;
    if (orderBox) orderBox.innerHTML = orderHTML;
    if (dateEl) dateEl.textContent = dateStr;

    modal.style.display = "flex";
    modal.classList.add("show");
  }

  if (typeof triggerCelebrationConfetti === "function") {
    triggerCelebrationConfetti();
  }
}

function triggerCelebrationConfetti() {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 200,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.75 },
      zIndex: 999999,
    });

    confetti({
      particleCount: 200,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.75 },
      zIndex: 999999,
    });
  } else {
    console.warn("Chưa nhúng thư viện canvas-confetti!");
  }
}

function closeDiplomaModal() {
  const modal = document.getElementById("diplomaInputModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

// ==================== HỆ THỐNG XÁC THỰC & HỒ SƠ ĐỘC GIẢ ====================
let isSignUpMode = false;
let currentUser = null;

async function checkUserSession() {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    currentUser = session.user;
    updateNavUserUI(currentUser);
    initNotifications(currentUser);
    autofillUserNames();
    await syncAllUserData(currentUser);
  } else {
    currentUser = null;
    updateNavUserUI(null);
    teardownNotifications();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    currentUser = session ? session.user : null;
    updateNavUserUI(currentUser);
    if (currentUser) initNotifications(currentUser);
    else teardownNotifications();
    if (currentUser && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      await syncAllUserData(currentUser);
    }
  });
}

async function syncAllUserData(user) {
  if (!user) return;
  await syncAccountFavorites(user);
  await syncAccountProgress(user);
  await syncAccountPuzzles(user);
}

function updateNavUserUI(user) {
  const navBtns = document.querySelectorAll(".nav-auth-btn");
  if (navBtns.length === 0) return;

  navBtns.forEach((navBtn) => {
    if (user) {
      const meta = user.user_metadata || {};
      const name = meta.display_name || (user.email ? user.email.split("@")[0] : "Lữ khách");
      const avatar = meta.avatar_url || "./images/cat_icon.jpg";

      navBtn.innerHTML = `
        <img src="${escapeHTML(avatar)}" class="nav-auth-avatar-mini" alt="Avatar" />
        <span>${escapeHTML(name)}</span>
      `;
      navBtn.setAttribute("aria-label", `Tài khoản của ${name}`);
      navBtn.title = name;
    } else {
      navBtn.innerHTML = `<i class="fa-solid fa-feather"></i> <span>Đóng Mộc / Nhận Thẻ</span>`;
      navBtn.setAttribute("aria-label", "Đóng Mộc / Nhận Thẻ");
      navBtn.title = "Đóng Mộc / Nhận Thẻ";
    }
  });
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";

  const icon = btn.querySelector("i");
  if (icon) {
    icon.className = isPassword ? "bi bi-eye-slash" : "bi bi-eye";
  }
}

async function openAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;

  const formState = document.getElementById("authFormState");
  const profileState = document.getElementById("authProfileState");

  if (currentUser) {
    if (formState) formState.style.display = "none";
    if (profileState) profileState.style.display = "block";

    const meta = currentUser.user_metadata || {};
    const displayName = meta.display_name || (currentUser.email ? currentUser.email.split("@")[0] : "Lữ khách");
    const avatarUrl = meta.avatar_url || "./images/cat_icon.jpg";
    const username = currentUser.email ? currentUser.email.split("@")[0] : displayName;

    document.getElementById("profileDisplayName").textContent = displayName;

    const emailEl = document.getElementById("profileDisplayEmail");
    if (emailEl) {
      emailEl.textContent = `@${username}`;
    }

    document.getElementById("userAvatarImg").src = avatarUrl;
    cancelEditName();

    await syncAllUserData(currentUser);
  } else {
    if (formState) formState.style.display = "block";
    if (profileState) profileState.style.display = "none";
  }

  modal.classList.add("show");
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.remove("show");
}

window.toggleForgotPasswordNotice = function() {
  const notice = document.getElementById("forgotPasswordNotice");
  if (notice) {
    notice.style.display = notice.style.display === "none" ? "block" : "none";
  }
};

function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  const title = document.getElementById("authFormTitle");
  const confirmPwGroup = document.getElementById("authConfirmPwGroup");
  const btnText = document.getElementById("authSubmitBtnText");
  const switchText = document.getElementById("authSwitchText");
  const switchBtn = document.getElementById("authSwitchBtn");
  const forgotPwGroup = document.getElementById("authForgotPwGroup");
  const forgotNotice = document.getElementById("forgotPasswordNotice");

  if (isSignUpMode) {
    if (title) title.textContent = "Đăng Ký Thẻ Độc Giả";
    if (confirmPwGroup) confirmPwGroup.style.display = "block";
    if (btnText) btnText.textContent = "Đăng Ký Nhận Thẻ";
    if (switchText) switchText.textContent = "Đã có thẻ độc giả?";
    if (switchBtn) switchBtn.textContent = "Đăng nhập ngay";

    if (forgotPwGroup) forgotPwGroup.style.display = "none";
    if (forgotNotice) forgotNotice.style.display = "none";
  } else {
    if (title) title.textContent = "Đăng Nhập Tiệm Sách";
    if (confirmPwGroup) confirmPwGroup.style.display = "none";
    if (btnText) btnText.textContent = "Xác Nhận Đăng Nhập";
    if (switchText) switchText.textContent = "Chưa có thẻ độc giả?";
    if (switchBtn) switchBtn.textContent = "Đăng ký nhận thẻ";

    if (forgotPwGroup) forgotPwGroup.style.display = "block";
  }
}

function formatVirtualEmail(username) {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  return `${cleanUsername}@tiemsach.local`;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const supabase = await getSupabase();
  if (!supabase) return;

  const rawUsername = document.getElementById("authUsernameInput").value.trim();
  const password = document.getElementById("authPasswordInput").value;
  const submitBtn = document.getElementById("authSubmitBtn");

  if (!rawUsername) {
    showToast("Vui lòng nhập tên tài khoản!", "error");
    return;
  }

  const virtualEmail = formatVirtualEmail(rawUsername);

  if (isSignUpMode) {
    const confirmPassword = document.getElementById("authConfirmPasswordInput").value;
    if (password !== confirmPassword) {
      showToast("Mật khẩu xác nhận không trùng khớp!", "error");
      return;
    }
  }

  submitBtn.disabled = true;

  try {
    if (isSignUpMode) {
      const { data, error } = await supabase.auth.signUp({
        email: virtualEmail,
        password: password,
        options: {
          data: {
            display_name: rawUsername,
            avatar_url: "./images/default_avt.jpg"
          }
        }
      });

      if (error) {
        if (error.message.includes("already registered") || error.message.includes("User already exists")) {
          throw new Error("Tên tài khoản này đã có người sử dụng!");
        }
        throw error;
      }

      currentUser = data.user;
      showToast(`Đăng ký thẻ thành công! Chào mừng ${rawUsername}.`, "success");
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: virtualEmail,
        password: password
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("Tên tài khoản hoặc mật khẩu không chính xác!");
        }
        throw error;
      }

      currentUser = data.user;
      showToast("Đăng nhập thành công!", "success");
    }

    if (currentUser) {
      await supabase
        .from("puzzle_solvers")
        .update({ user_id: currentUser.id })
        .eq("player_name", rawUsername)
        .is("user_id", null);
    }

    updateNavUserUI(currentUser);
    closeAuthModal();

    if (currentUser) {
      await syncAllUserData(currentUser);
      if (document.querySelector(".profile-page-container")) {
        await renderProfileInfo(currentUser);
      }
    }
  } catch (err) {
    console.error("Lỗi xác thực:", err);
    showToast(err.message || "Thao tác không thành công!", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file || !currentUser) return;

  const supabase = await getSupabase();
  if (!supabase) return;

  showToast("Đang xử lý ảnh đại diện...", "success");

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = async function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const size = 150;
      canvas.width = size;
      canvas.height = size;

      const minDim = Math.min(img.width, img.height);
      const startX = (img.width - minDim) / 2;
      const startY = (img.height - minDim) / 2;

      ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
      const compressedAvatarUrl = canvas.toDataURL("image/jpeg", 0.85);

      try {
        const { error: authError } = await supabase.auth.updateUser({
          data: { avatar_url: compressedAvatarUrl }
        });

        if (authError) throw authError;

        await supabase
          .from("profiles")
          .upsert({
            user_id: currentUser.id,
            avatar_url: compressedAvatarUrl,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });

        currentUser.user_metadata.avatar_url = compressedAvatarUrl;

        const profilePageAvatar = document.getElementById("profilePageAvatar");
        if (profilePageAvatar) {
          profilePageAvatar.src = compressedAvatarUrl;
        }

        const avatarModal = document.getElementById("userAvatarImg");
        if (avatarModal) {
          avatarModal.src = compressedAvatarUrl;
        }

        updateNavUserUI(currentUser);

        showToast("Đổi ảnh đại diện thành công!", "success");
      } catch (err) {
        console.error("Lỗi cập nhật avatar:", err);
        showToast("Không thể lưu ảnh, vui lòng thử lại!", "error");
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function startEditName() {
  const nameDisplayRow = document.getElementById("nameDisplayRow");
  const nameEditRow = document.getElementById("nameEditRow");
  const currentName = document.getElementById("profileDisplayName").textContent.trim();

  document.getElementById("inlineNameInput").value = currentName;
  nameDisplayRow.style.display = "none";
  nameEditRow.style.display = "flex";
  document.getElementById("inlineNameInput").focus();
}

function cancelEditName() {
  const nameDisplayRow = document.getElementById("nameDisplayRow");
  const nameEditRow = document.getElementById("nameEditRow");
  if (nameDisplayRow) nameDisplayRow.style.display = "flex";
  if (nameEditRow) nameEditRow.style.display = "none";
}

async function saveInlineName() {
  const newName = document.getElementById("inlineNameInput").value.trim();
  if (!newName) {
    showToast("Tên không được để trống!", "error");
    return;
  }

  const supabase = await getSupabase();
  if (!supabase || !currentUser) return;

  const oldName = currentUser.user_metadata?.display_name ||
                  (currentUser.email ? currentUser.email.split("@")[0] : "");

  try {
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });
    if (authError) throw authError;

    await supabase
      .from("profiles")
      .upsert({
        user_id: currentUser.id,
        display_name: newName,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (oldName) {
      await supabase
        .from("feedbacks")
        .update({ author_name: newName })
        .eq("author_name", oldName);
    }

    if (oldName) {
      await supabase
        .from("cfs_notes")
        .update({ author: newName })
        .or(`user_id.eq.${currentUser.id},author.eq.${oldName}`);
    }

    currentUser.user_metadata.display_name = newName;
    const profileNameEl = document.getElementById("profileDisplayName");
    if (profileNameEl) profileNameEl.textContent = newName;

    const profilePageNameEl = document.getElementById("profilePageDisplayName");
    if (profilePageNameEl) profilePageNameEl.textContent = newName;

    updateNavUserUI(currentUser);
    cancelEditName();

    await loadFeedbacks();
    await loadCfsNotes();

    showToast("Đã đổi tên và đồng bộ toàn bộ lời nhắn!", "success");
  } catch (err) {
    console.error("Lỗi đổi tên:", err);
    showToast("Không thể đổi tên, vui lòng thử lại!", "error");
  }
}

async function handleLogout() {
  const supabase = await getSupabase();
  if (!supabase) return;

  await supabase.auth.signOut();
  currentUser = null;
  closeAuthModal();
  updateNavUserUI(null);
  showToast("Đã đăng xuất khỏi tiệm sách.", "success");

  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  if (currentPath === "profile.html" || document.querySelector(".profile-page-container")) {
    loadPageViaAjax("index.html");
  }
}

// ==================== ĐỒNG BỘ LOCALSTORAGE & TÀI KHOẢN SUPABASE ====================

async function syncAccountFavorites(user) {
  if (!user) return;
  const supabase = await getSupabase();
  if (!supabase) return;

  try {
    let localLikes = getLocalLikedCharacters();

    const { data: cloudFavorites, error } = await supabase
      .from("user_favorites")
      .select("char_name")
      .eq("user_id", user.id);

    if (error) {
      console.warn("Lỗi đọc user_favorites từ Supabase:", error);
      return;
    }

    const cloudNames = cloudFavorites ? cloudFavorites.map((f) => f.char_name.trim()) : [];

    const mergedLikes = Array.from(new Set([...localLikes, ...cloudNames]));

    localStorage.setItem("liked_characters", JSON.stringify(mergedLikes));

    const newItemsToPush = localLikes.filter((name) => !cloudNames.includes(name));
    if (newItemsToPush.length > 0) {
      const rowsToInsert = newItemsToPush.map((charName) => ({
        user_id: user.id,
        char_name: charName.trim()
      }));

      await supabase
        .from("user_favorites")
        .upsert(rowsToInsert, { onConflict: "user_id, char_name" });
    }

    await syncCharacterVotes();
  } catch (err) {
    console.warn("Lỗi trong quá trình syncAccountFavorites:", err);
  }
}

async function syncAccountProgress(user) {
  if (!user) return;
  const supabase = await getSupabase();
  if (!supabase) return;

  try {
    const isLocalUnlocked = localStorage.getItem("evans_diploma_unlocked") === "true";
    const localOrder = localStorage.getItem("evans_solver_order");

    const { data, error } = await supabase
      .from("user_progress")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data && data.diploma_unlocked) {
      localStorage.setItem("evans_diploma_unlocked", "true");
      if (data.solver_order) {
        localStorage.setItem("evans_solver_order", data.solver_order.toString());
      }
    } else if (isLocalUnlocked) {
      await supabase.from("user_progress").upsert({
        user_id: user.id,
        diploma_unlocked: true,
        solver_order: localOrder ? parseInt(localOrder) : null,
        player_name: user.user_metadata?.display_name || "Lữ khách",
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn("Lỗi syncAccountProgress:", err);
  }
}

// ==================== QUẢN LÝ THEME DARK / LIGHT TỰ ĐỘNG & SYSTEM TRACKING ====================

function getSystemTheme() {
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").media !== "not all") {
    return prefersDark ? "dark" : "light";
  }

  const currentHour = new Date().getHours();
  return currentHour >= 6 && currentHour < 18 ? "light" : "dark";
}

function updateThemeUI(theme) {
  const body = document.body;
  const themeIcon = document.getElementById("themeIcon");
  const mobileMenuThemeIcon = document.getElementById("mobileMenuThemeIcon");
  const mobileMenuThemeText = document.getElementById("mobileMenuThemeText");

  if (theme === "dark") {
    body.classList.add("dark-theme");
    if (themeIcon) {
      themeIcon.className = "bi bi-sun-fill";
      themeIcon.style.color = "#ffd700";
    }
    if (mobileMenuThemeIcon) {
      mobileMenuThemeIcon.className = "bi bi-sun-fill";
      mobileMenuThemeIcon.style.color = "#ffd700";
    }
    if (mobileMenuThemeText) {
      mobileMenuThemeText.textContent = "Chế Độ Ban Ngày";
    }
  } else {
    body.classList.remove("dark-theme");
    if (themeIcon) {
      themeIcon.className = "bi bi-moon-stars-fill";
      themeIcon.style.color = "#fff8e7";
    }
    if (mobileMenuThemeIcon) {
      mobileMenuThemeIcon.className = "bi bi-moon-stars-fill";
      mobileMenuThemeIcon.style.color = "#fff8e7";
    }
    if (mobileMenuThemeText) {
      mobileMenuThemeText.textContent = "Chế Độ Ban Đêm";
    }
  }
}

function initThemeMode() {
  const savedTheme = localStorage.getItem("evans_theme");
  const activeTheme = savedTheme ? savedTheme : getSystemTheme();
  updateThemeUI(activeTheme);

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem("evans_theme")) {
        updateThemeUI(e.matches ? "dark" : "light");
      }
    });
  }
}

window.toggleThemeMode = function () {
  const isCurrentlyDark = document.body.classList.contains("dark-theme");
  const newTheme = isCurrentlyDark ? "light" : "dark";

  localStorage.setItem("evans_theme", newTheme);
  updateThemeUI(newTheme);

  if (newTheme === "dark") {
    showToast("Màn đêm đã buông xuống Tiệm Sách 🌙", "success");
  } else {
    showToast("Ánh bình minh đã le lói vào Tiệm Sách ☀️", "success");
  }
};

// ==================== LOGIC ĐIỀU HƯỚNG & QUẢN LÝ PROFILE PAGE ====================
async function initProfilePage() {
  const isProfileDOM = document.querySelector(".profile-page-container");
  if (!isProfileDOM) return;

  const supabase = await getSupabase();
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.user) {
    showToast("Vui lòng đăng nhập để mở Sổ Tay Độc Giả!", "error");
    setTimeout(() => {
      loadPageViaAjax("index.html");
    }, 1200);
    return;
  }

  currentUser = session.user;
  await renderProfileInfo(currentUser);
  await loadUserFavorites(currentUser);
  await loadUserNotes(currentUser);
  await loadUserMedals(currentUser);
}

const OWNER_USER_ID = "c836f3a3-eea1-41ff-8c89-df2a62eeb2b6";

async function renderProfileInfo(user) {
  const supabase = await getSupabase();
  let displayName = user.user_metadata?.display_name || (user.email ? user.email.split("@")[0] : "Lữ khách");
  let avatarUrl = user.user_metadata?.avatar_url || "./images/default_avt.jpg";
  let bio = user.user_metadata?.bio || "Một lữ khách trầm lặng yêu thích những trang sách của Evans.";
  const username = user.email ? user.email.split("@")[0] : displayName;

  if (supabase) {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData) {
        if (profileData.display_name) displayName = profileData.display_name;
        if (profileData.avatar_url) avatarUrl = profileData.avatar_url;
        if (profileData.bio) bio = profileData.bio;
      }
    } catch (err) {
      console.warn("Lỗi đọc profiles:", err);
    }
  }

  const avatarEl = document.getElementById("profilePageAvatar");
  const avatarFrame = document.querySelector(".passport-avatar-frame");
  const nameEl = document.getElementById("profilePageDisplayName");
  const usernameEl = document.getElementById("profilePageUsername");
  const bioEl = document.getElementById("profilePageBio");
  const joinDateEl = document.getElementById("profilePageJoinDate");
  const favTabTitle = document.getElementById("favTabTitle");
  const stampBadge = document.querySelector(".passport-stamp-badge");

  if (avatarEl) avatarEl.src = avatarUrl;
  if (nameEl) nameEl.textContent = displayName;
  if (usernameEl) usernameEl.textContent = `@${username}`;
  if (bioEl) bioEl.textContent = `"${bio}"`;

  if (favTabTitle) {
    favTabTitle.textContent = `Cuốn sách yêu thích của ${displayName}`;
  }

  if (joinDateEl && user.created_at) {
    const d = new Date(user.created_at);
    joinDateEl.textContent = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  const cleanUser = (username || "").toLowerCase().trim();
  const isOwner = (user && user.id && user.id.startsWith(OWNER_USER_ID)) ||
                  ["fevans", "evans", "iamevans"].includes(cleanUser);

  if (avatarFrame && stampBadge) {
    if (isOwner) {
      avatarFrame.classList.add("owner-avatar-frame");
      stampBadge.className = "passport-stamp-badge owner-stamp-badge";
      stampBadge.innerHTML = `<i class="fa-solid fa-crown"></i> CHỦ TIỆM SÁCH`;
    } else {
      avatarFrame.classList.remove("owner-avatar-frame");
      stampBadge.className = "passport-stamp-badge";
      stampBadge.innerHTML = `<i class="bi bi-patch-check-fill"></i> ĐỘC GIẢ CHÍNH THỨC`;
    }
  }
}

window.startEditName = function () {
  const viewRow = document.getElementById("viewNameRow");
  const editRow = document.getElementById("editNameRow");
  const currentName = document.getElementById("profilePageDisplayName")?.textContent.trim() || "";

  const input = document.getElementById("inlineNameInput");
  if (input) input.value = currentName;

  if (viewRow) viewRow.style.display = "none";
  if (editRow) editRow.style.display = "flex";
  if (input) input.focus();
};

window.cancelEditName = function () {
  const viewRow = document.getElementById("viewNameRow");
  const editRow = document.getElementById("editNameRow");
  if (viewRow) viewRow.style.display = "flex";
  if (editRow) editRow.style.display = "none";
};

window.saveInlineName = async function () {
  const input = document.getElementById("inlineNameInput");
  const newName = input ? input.value.trim() : "";
  if (!newName) {
    showToast("Tên không được để trống!", "error");
    return;
  }

  const supabase = await getSupabase();
  if (!supabase || !currentUser) return;

  const oldName = currentUser.user_metadata?.display_name ||
                  (currentUser.email ? currentUser.email.split("@")[0] : "");

  try {
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });
    if (authError) throw authError;

    const { error: profileError } = await supabase.from("profiles").upsert({
      user_id: currentUser.id,
      display_name: newName,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

    if (profileError) throw profileError;

    if (oldName) {
      await supabase.from("feedbacks").update({ author_name: newName }).eq("author_name", oldName);
      await supabase.from("cfs_notes").update({ author: newName }).or(`user_id.eq.${currentUser.id},author.eq.${oldName}`);
    }

    currentUser.user_metadata.display_name = newName;

    await renderProfileInfo(currentUser);
    window.cancelEditName();
    updateNavUserUI(currentUser);

    showToast("Đã đổi tên và đồng bộ thành công!", "success");
  } catch (err) {
    console.error("Lỗi đổi tên:", err);
    showToast("Không thể đổi tên, vui lòng thử lại!", "error");
  }
};

window.startEditBio = function () {
  const viewBio = document.getElementById("viewBioRow");
  const editBio = document.getElementById("editBioRow");
  const currentBio = document.getElementById("profilePageBio")?.textContent.replace(/^"|"$/g, "").trim() || "";

  const textarea = document.getElementById("inlineBioInput");
  if (textarea) textarea.value = currentBio;

  if (viewBio) viewBio.style.display = "none";
  if (editBio) editBio.style.display = "block";
  if (textarea) textarea.focus();
};

window.cancelEditBio = function () {
  const viewBio = document.getElementById("viewBioRow");
  const editBio = document.getElementById("editBioRow");
  if (viewBio) viewBio.style.display = "block";
  if (editBio) editBio.style.display = "none";
};

window.saveInlineBio = async function () {
  const textarea = document.getElementById("inlineBioInput");
  const newBio = textarea ? textarea.value.trim() : "";
  if (!newBio) {
    showToast("Dòng trạng thái không được để trống!", "error");
    return;
  }

  const supabase = await getSupabase();
  if (!supabase || !currentUser) return;

  try {
    const { error: authError } = await supabase.auth.updateUser({
      data: { bio: newBio }
    });
    if (authError) throw authError;

    await supabase.from("profiles").upsert({
      user_id: currentUser.id,
      bio: newBio,
      updated_at: new Date().toISOString()
    });

    currentUser.user_metadata.bio = newBio;
    const bioEl = document.getElementById("profilePageBio");
    if (bioEl) bioEl.textContent = `"${newBio}"`;

    window.cancelEditBio();
    showToast("Đã cập nhật dòng tâm niệm!", "success");
  } catch (err) {
    console.error("Lỗi cập nhật bio:", err);
    showToast("Không thể lưu trạng thái!", "error");
  }
};

function switchJournalTab(tabName, btn) {
  document.querySelectorAll(".journal-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".journal-tab-pane").forEach(p => p.style.display = "none");

  btn.classList.add("active");

  if (tabName === "favorites") {
    document.getElementById("tabFavorites").style.display = "block";
  } else if (tabName === "notes") {
    document.getElementById("tabNotes").style.display = "block";
  } else if (tabName === "medals") {
    document.getElementById("tabMedals").style.display = "block";
  }
}

async function loadUserFavorites(user) {
  const container = document.getElementById("profileFavoritesList");
  const countEl = document.getElementById("profileFavCount");
  if (!container) return;

  const supabase = await getSupabase();
  const { data: favorites, error } = await supabase
    .from("user_favorites")
    .select("char_name")
    .eq("user_id", user.id);

  if (error || !favorites || favorites.length === 0) {
    container.innerHTML = `<div class="empty-state-text">Bạn chưa lưu nhân vật nào vào Tủ Sách Tri Kỷ. Hãy ghé qua Tủ Sách Nhân Vật nhé!</div>`;
    if (countEl) countEl.textContent = "0 nhân vật";
    return;
  }

  if (countEl) countEl.textContent = `${favorites.length} nhân vật`;

  container.innerHTML = favorites.map(fav => `
    <div class="fav-char-mini-card" data-char-name="${escapeHTML(fav.char_name)}">
      <div>
        <h5 class="fav-char-name">${escapeHTML(fav.char_name)}</h5>
        <span class="fav-char-tag">Tri kỷ đồng hành</span>
      </div>
      <button type="button" class="btn-remove-fav" onclick="event.stopPropagation(); removeFavoriteDirectly('${escapeHTML(fav.char_name)}')" title="Bỏ lưu">
        <i class="bi bi-heart-fill"></i>
      </button>
    </div>
  `).join("");

  container.querySelectorAll(".fav-char-mini-card").forEach((card) => {
    card.addEventListener("click", () => {
      const name = card.getAttribute("data-char-name");
      if (name) openBotModalByName(name);
    });
  });
}

async function removeFavoriteDirectly(charName) {
  const supabase = await getSupabase();
  if (!supabase || !currentUser) return;

  await supabase.from("user_favorites").delete().eq("user_id", currentUser.id).eq("char_name", charName);

  let localLikes = getLocalLikedCharacters().filter(n => n.trim().toLowerCase() !== charName.trim().toLowerCase());
  localStorage.setItem("liked_characters", JSON.stringify(localLikes));

  showToast(`Đã xóa ${charName} khỏi Tủ Sách Tri Kỷ`, "success");
  await loadUserFavorites(currentUser);
  await syncCharacterVotes();
}

async function loadUserNotes(user) {
  const container = document.getElementById("profileNotesList");
  const countEl = document.getElementById("profileNoteCount");
  if (!container) return;

  const supabase = await getSupabase();
  const rawUsername = user.email ? user.email.split("@")[0] : "";
  const displayName = user.user_metadata?.display_name || rawUsername;

  const { data: notes, error } = await supabase
    .from("cfs_notes")
    .select("*")
    .or(`user_id.eq.${user.id},author.ilike.${displayName}`)
    .order("created_at", { ascending: false });

  if (error || !notes || notes.length === 0) {
    container.innerHTML = `<div class="empty-state-text">Bạn chưa dán tờ tâm thư nào tại Góc Nhắn Gửi.</div>`;
    if (countEl) countEl.textContent = "0 dòng";
    return;
  }

  if (countEl) countEl.textContent = `${notes.length} dòng`;

  container.innerHTML = notes.map(note => {
    const isHolo = note.bg_color === "hologram";
    return `
      <div class="cfs-note-item sticky-note ${isHolo ? "hologram-note" : ""}" style="${!isHolo ? `background-color: ${safeCssColor(note.bg_color)};` : ''}">
        <p class="note-content">"${escapeHTML(note.content)}"</p>
        <span class="note-author">— ${escapeHTML(note.author || displayName)}</span>
      </div>
    `;
  }).join("");
}

// ==================== TẢI TỦ KÍNH HUY HIỆU & DANH HIỆU TỪ SUPABASE ====================
async function loadUserMedals(user) {
  const container = document.getElementById("profileMedalsList");
  if (!container) return;

  const supabase = await getSupabase();
  let isDiplomaUnlocked = false;
  let solverOrder = null;
  let unlockedDateStr = "";

  if (supabase && user) {
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("title, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: solverData } = await supabase
        .from("puzzle_solvers")
        .select("id, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (solverData) {
        isDiplomaUnlocked = true;
        solverOrder = solverData.id;
        if (solverData.created_at) {
          const d = new Date(solverData.created_at);
          unlockedDateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
        }
      }
    } catch (err) {
      console.warn("Lỗi kiểm tra danh hiệu từ Supabase:", err);
    }
  }

  if (!isDiplomaUnlocked) {
    isDiplomaUnlocked = localStorage.getItem("evans_diploma_unlocked") === "true";
    solverOrder = localStorage.getItem("evans_solver_order");
    if (isDiplomaUnlocked && !unlockedDateStr) {
      const today = new Date();
      unlockedDateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
    }
  }

  let joinDateStr = "24/07/2026";
  if (user && user.created_at) {
    const d = new Date(user.created_at);
    joinDateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  const username = user.email ? user.email.split("@")[0] : "";
  const cleanUser = (username || "").toLowerCase().trim();
  const isOwner = (user && user.id && user.id.startsWith(OWNER_USER_ID)) ||
                  ["fevans", "evans", "iamevans"].includes(cleanUser);

  const secretUnlockedHTML = `
    <div class="showcase-medal-card unlocked-secret" onclick="viewSavedDiploma()" title="Nhấp để xem lại Bằng Chứng Nhận">
      <div class="medal-emblem-circle" style="background: radial-gradient(circle, #ffe082 0%, #d4af37 100%);"><i class="fa-solid fa-skeleton-key"></i></div>
      <div class="medal-info-wrap">
        <strong class="medal-title-text">Kẻ Vén Màn Bí Mật #${solverOrder}</strong>
        <span class="medal-desc-text">Đã giải mã thành công toàn bộ Két Sách Bí Mật</span>
        <span class="medal-date-tag"><i class="bi bi-calendar-check"></i> Đạt được: ${unlockedDateStr}</span>
      </div>
    </div>
  `;

  const secretLockedHTML = `
    <div class="showcase-medal-card locked-medal" title="Thành tựu ẩn">
      <div class="medal-emblem-circle locked-icon"><i class="fa-solid fa-lock"></i></div>
      <div class="medal-info-wrap">
        <strong class="medal-title-text">Kẻ Vén Màn Bí Mật</strong>
        <span class="medal-desc-text">??? (Chưa mở khóa)</span>
        <span class="medal-date-tag locked-tag"><i class="bi bi-lock-fill"></i> Chưa mở khóa</span>
      </div>
    </div>
  `;

  let memberMedalHTML = "";
  if (isOwner) {
    memberMedalHTML = `
      <div class="showcase-medal-card owner-exclusive-medal" style="border: 1px solid #d4af37; background: linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(139, 58, 58, 0.05));">
        <div class="medal-emblem-circle" style="background: radial-gradient(circle, #ffe082 0%, #d4af37 100%); color: #8b3a3a;"><i class="fa-solid fa-feather-pointed"></i></div>
        <div class="medal-info-wrap">
          <strong class="medal-title-text" style="color: #8b3a3a;"><i class="fa-solid fa-crown" style="color: #d4af37; margin-right: 4px;"></i> Chủ Tiệm Sách Evans</strong>
          <span class="medal-desc-text">Người kiến tạo và gìn giữ từng trang ký ức tại đây</span>
          <span class="medal-date-tag" style="color: #d4af37; font-weight: bold;"><i class="bi bi-shield-check"></i> Đặc quyền tối cao</span>
        </div>
      </div>
    `;
  } else {
    memberMedalHTML = `
      <div class="showcase-medal-card">
        <div class="medal-emblem-circle" style="background: radial-gradient(circle, #e2d7c7 0%, #8c7a6b 100%);"><i class="bi bi-ticket-perforated-fill"></i></div>
        <div class="medal-info-wrap">
          <strong class="medal-title-text">Độc Giả Thân Thiết</strong>
          <span class="medal-desc-text">Đã đăng ký Thẻ Độc Giả chính thức của Evans</span>
          <span class="medal-date-tag"><i class="bi bi-calendar-check"></i> Cấp ngày: ${joinDateStr}</span>
        </div>
      </div>
    `;
  }

  const ownerKeeperMedalHTML = `
    <div class="showcase-medal-card owner-exclusive-medal" style="border: 1px solid #d4af37; background: linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(139, 58, 58, 0.05));">
      <div class="medal-emblem-circle" style="background: radial-gradient(circle, #ffe082 0%, #d4af37 100%); color: #8b3a3a;"><i class="fa-solid fa-key"></i></div>
      <div class="medal-info-wrap">
        <strong class="medal-title-text" style="color: #8b3a3a;"><i class="fa-solid fa-lock-open" style="color: #d4af37; margin-right: 4px;"></i> Người Giữ Chìa Khóa</strong>
        <span class="medal-desc-text">Nắm trong tay đáp án của mọi Két Sách Bí Mật và là người mở cửa tiệm mỗi ngày</span>
        <span class="medal-date-tag" style="color: #d4af37; font-weight: bold;"><i class="bi bi-shield-check"></i> Đặc quyền tối cao</span>
      </div>
    </div>
  `;

  let finalMedalsHTML = "";
  if (isOwner) {
    finalMedalsHTML = memberMedalHTML + ownerKeeperMedalHTML;
  } else if (isDiplomaUnlocked && solverOrder) {
    finalMedalsHTML += secretUnlockedHTML + memberMedalHTML;
  } else {
    finalMedalsHTML += memberMedalHTML + secretLockedHTML;
  }

  if (!isOwner && user) {
    const progress = await fetchPuzzleProgress(true);
    if (progress) finalMedalsHTML += buildPuzzleAchievementsHTML(progress);
  }

  container.innerHTML = finalMedalsHTML;
}

window.viewSavedDiploma = function () {
  const name = currentUser?.user_metadata?.display_name || "Lữ khách";
  const order = localStorage.getItem("evans_solver_order") || "1";
  showDiplomaSuccess(name, order);
};

// ==================== HỆ THỐNG MẬT MÃ KHÓA NHÂN VẬT ====================
const puzzleConfigs = {
  delmare: {
    title: "Vực Sâu Danh Dự",
    subtitle: "Delmare's Abyss",
    toastMsg: "Cánh cửa dẫn đến Delmare's Abyss đã mở! Chúc ngài chinh phục bản ngã thành công."
  },
  huy: {
    title: "Một Cơn Say",
    subtitle: "Dương Khắc Huy",
    toastMsg: "Giỏi lắm. Giờ thì đến đây, đừng để tôi phải đợi lâu."
  },
  seol: {
    title: "Phía Sau Màn Sương",
    subtitle: "Seol Min-jae",
    toastMsg: "Màn sương đã tan. Chúc may mắn, đồ tể."
  },
  arashi: {
    title: "Thanh Âm Cấm Kỵ",
    subtitle: "Arashi「嵐」",
    toastMsg: "Đã giải mã giai điệu cấm kỵ của Arashi! Cánh cửa đêm nay chính thức rộng mở."
  },
  tam: {
    title: "Sợi Dây Liên Kết",
    subtitle: "Phó Kỳ Tâm",
    toastMsg: "Tôi nghe thấy tiếng mở cửa từ em rồi."
  },
  ngon: {
    title: "Bản Chất Sự Vật",
    subtitle: "Khương Tịch Ngôn",
    toastMsg: "Dù biết là giả, nhưng tôi vẫn trân trọng khoảnh khắc này."
  },
  salfozziel: {
    title: "Cái Giá Của Sự Lựa Chọn",
    subtitle: "Salfozziel",
    toastMsg: "Đã ghi nhận lựa chọn của ngươi. Hãy để 'Bữa Tiệc' của chúng ta được khai màn."
  }
};

window.openPuzzleModal = function(puzzleId) {
  const modal = document.getElementById("puzzleModal");
  if(modal) {
      modal.classList.add("active");
      modal.dataset.currentPuzzle = puzzleId;
      document.getElementById("puzzlePasscodeInput").value = "";
      document.getElementById("puzzleErrorMsg").classList.remove("show");

      const modalTitle = modal.querySelector(".modal-title");
      const modalSubtitle = modal.querySelector(".modal-subtitle");
      const hintBox = modal.querySelector(".book-hint-box");
      const formatHint = modal.querySelector(".book-form-group div");

      if (puzzleId === "huy") {
        huyWrongAttempts = 0;
        if (modalTitle) modalTitle.textContent = "Một Đêm Say";
        if (modalSubtitle) modalSubtitle.textContent = "Dương Khắc Huy";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.88rem;">
              Bạn có 1 thông báo từ ứng dụng <strong>Instagram</strong>
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.88rem;">
              Dương Khắc Huy <em>(@_hyvq.ft)</em> vừa đăng một Highlights / Tin nổi bật mới:
            </p>
            <p style="font-weight: bold; font-size: 0.95rem; color: #8b3a3a; margin: 10px 0; font-style: italic;">
              "Vết tích của một đêm quên lối về."
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <span style="font-style: italic; color: #8b3a3a; font-size: 0.75rem; line-height: 1.4;">Giải pass thử sức hoặc đọc phần "Tâm Thư Chủ Tiệm" ở Trang chủ để nhận link nhé! <span style="white-space: nowrap; display: inline-block;">ദ്ദി≽^-⩊•^≼ ✧</span></span>
          `;
        }
        if (formatHint) formatHint.textContent = "Gợi ý định dạng: 9 chữ cái, viết liền không dấu";
      } else if (puzzleId === "seol") {
        if (modalTitle) modalTitle.textContent = "Phía Sau Màn Sương";
        if (modalSubtitle) modalSubtitle.textContent = "Seol Min-jae";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.88rem;">
              Thanh tra Abberline vắt óc suy nghĩ trước những lời khai từ nhân chứng có mặt tại hiện trường.<br>
              Nhưng chân tướng thực sự nằm ở dòng chữ thầm lặng viết vội bằng máu khô trên góc bàn:
            </p>
            <p style="font-weight: bold; font-size: 1.05rem; color: #8b3a3a; margin: 10px 0; letter-spacing: 1px;">
              I U R P &nbsp; K H OO
            </p>
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.88rem;">Bên ngoài, văng vẳng tiếng đồng dao của trẻ con vang lên từ những con hẻm tối tăm.</p>
            <p style="margin-top: 10px; line-height: 1.5; font-size: 0.88rem;">Danh tính kẻ thủ ác chỉ có 1.</p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <p style="font-style: italic; color: #8b3a3a; font-size: 0.82rem; line-height: 1.4;">
              "Đi lùi 3 bước để tiến đến sự thật." - Đó là điều mà kẻ sát nhân đã để lại trên bức tường đỏ thắm tại hiện trường.
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <span style="font-style: italic; color: #8b3a3a; font-size: 0.75rem; line-height: 1.4;">Giải pass thử sức hoặc đọc phần "Tâm Thư Chủ Tiệm" ở Trang chủ để nhận link nhé! <span style="white-space: nowrap; display: inline-block;">ദ്ദി≽^-⩊•^≼ ✧</span></span>
          `;
        }
        if (formatHint) formatHint.textContent = "Gợi ý định dạng: 13 chữ cái, viết liền không dấu";
      } else if (puzzleId === "arashi") {
        if (modalTitle) modalTitle.textContent = "Thanh Âm Cấm Kỵ";
        if (modalSubtitle) modalSubtitle.textContent = "Arashi「嵐」";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.9rem; font-style: italic; color: #8b3a3a;">
              「こんばんは、今平気かな？<br>
              特に言いたいこともないんだけど<br>
              もうあれやこれや浮かぶ「いいな」<br>
              君が居なくちゃどれでもないや<br>
              仮面同士でイチャついてら」
            </p>
            <p style="font-size: 0.85rem; color: #4a3a2c; margin-bottom: 10px;">
              "Good evening, is now a good time?<br>
              I didn't really have anything specific I wanted to say, but<br>
              Now there's this and that, and an "it's alright" comes to mind<br>
              Without you, none of that matters<br>
              Both of us with our masks on, we flirted"
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <p style="font-style: italic; color: #6c584c; font-size: 0.82rem; line-height: 1.4;">
              "Find me, hear me."
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <span style="font-style: italic; color: #8b3a3a; font-size: 0.75rem; line-height: 1.4;">Giải pass thử sức hoặc đọc phần "Tâm Thư Chủ Tiệm" ở Trang chủ để nhận link nhé! <span style="white-space: nowrap; display: inline-block;">ദ്ദി≽^-⩊•^≼ ✧</span></span>
          `;
        }
        if (formatHint) formatHint.textContent = "Gợi ý định dạng: 11 chữ cái, viết liền không dấu";
      } else if (puzzleId === "tam") {
        if (modalTitle) modalTitle.textContent = "Sợi Dây Liên Kết";
        if (modalSubtitle) modalSubtitle.textContent = "Phó Kỳ Tâm";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.9rem; font-style: italic; color: #8b3a3a;">
              .. .... . .- .-. ..-
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <p style="font-style: italic; color: #6c584c; font-size: 0.82rem; line-height: 1.4;">
              "Tần số kết nối giữa hai tâm hồn, nơi âm thanh vượt qua màng nhĩ để chạm thẳng đến sự thấu cảm."
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <span style="font-style: italic; color: #8b3a3a; font-size: 0.75rem; line-height: 1.4;">Giải pass thử sức hoặc đọc phần "Tâm Thư Chủ Tiệm" ở Trang chủ để nhận link nhé! <span style="white-space: nowrap; display: inline-block;">ദ്ദി≽^-⩊•^≼ ✧</span></span>
          `;
        }
        if (formatHint) formatHint.textContent = "Gợi ý định dạng: 6 chữ cái, viết liền không dấu";
      } else if (puzzleId === "ngon") {
        if (modalTitle) modalTitle.textContent = "Bản Chất Sự Vật";
        if (modalSubtitle) modalSubtitle.textContent = "Khương Tịch Ngôn";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.9rem; font-style: italic; color: #8b3a3a;">
              Báo cáo giám định tác phẩm nghệ thuật tại hiện trường: Bức tranh được tuyên bố là bản gốc thế kỷ 17, nhưng chuyên gia phát hiện ra sợi vải canvas làm bằng chất liệu tổng hợp chưa từng tồn tại trước năm 1935.
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <p style="font-style: italic; color: #6c584c; font-size: 0.82rem; line-height: 1.4;">
              Tác phẩm này hoàn toàn không phải hàng nguyên bản. Bản chất của nó là gì?
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <span style="font-style: italic; color: #8b3a3a; font-size: 0.75rem; line-height: 1.4;">Giải pass thử sức hoặc đọc phần "Tâm Thư Chủ Tiệm" ở Trang chủ để nhận link nhé! <span style="white-space: nowrap; display: inline-block;">ദ്ദി≽^-⩊•^≼ ✧</span></span>
          `;
        }
        if (formatHint) formatHint.textContent = "Gợi ý định dạng: 1 từ tiếng Anh gồm 4 chữ cái";
      } else if (puzzleId === "salfozziel") {
        if (modalTitle) modalTitle.textContent = "Cái Giá Của Sự Lựa Chọn";
        if (modalSubtitle) modalSubtitle.textContent = "Salfozziel";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.9rem; font-style: italic; color: #8b3a3a;">
              Ta là chiếc gương phản chiếu tâm trí ngươi, nhưng để phá vỡ vòng lặp này, ngươi buộc phải thực hiện chính xác một hành động duy nhất bằng cách chọn một trong ba con đường sau:<br><strong>1.</strong> Uống chén độc dược ngưng đọng thời gian để trở thành kẻ bất tử trong cô độc vĩnh cửu.<br><strong>2.</strong> Tự tay bóp nát trái tim mình để tồn tại dưới dạng một thực thể vô định không cảm xúc.<br><strong>3.</strong> Nhảy xuống vực sâu không đáy để hòa làm một với bóng tối nguyên thủy.<br>
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <p style="font-style: italic; color: #6c584c; font-size: 0.82rem; line-height: 1.4;">
              <em>(Cảnh báo: Tấm gương dần xuất hiện những vết nứt, khiến hình ảnh phản chiếu của ngươi trở nên méo mó.)</em>
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <span style="font-style: italic; color: #8b3a3a; font-size: 0.75rem; line-height: 1.4;">Giải pass thử sức hoặc đọc phần "Tâm Thư Chủ Tiệm" ở Trang chủ để nhận link nhé! <span style="white-space: nowrap; display: inline-block;">ദ്ദി≽^-⩊•^≼ ✧</span></span>
          `;
        }
        if (formatHint) formatHint.textContent = "There's only one true answer.";
      } else {
        if (modalTitle) modalTitle.textContent = "Vực Sâu Danh Dự";
        if (modalSubtitle) modalSubtitle.textContent = "Delmare's Abyss";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 12px; line-height: 1.6;">
              Một kẻ bước đi vội.<br>
              Chẳng mang an yên nào.<br>
              Chỉ toàn những nỗi đau.<br>
              Ký ức nhuộm màu sầu.<br>
              Chờ đợi giấc mộng tan.<br>
              Tỉnh lại ám ảnh hoài.
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 12px 0;">
            <p style="font-style: italic; color: #8b3a3a; font-size: 0.85rem; line-height: 1.4;">
              "Sự thật về một người không nằm ở khởi đầu, cũng chẳng ở kết cục. Con người thật luôn bị kẹp chặt ở chính giữa những lằn ranh."
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <span style="font-style: italic; color: #8b3a3a; font-size: 0.75rem; line-height: 1.4;">Giải pass thử sức hoặc đọc phần "Tâm Thư Chủ Tiệm" ở Trang chủ để nhận link nhé! <span style="white-space: nowrap; display: inline-block;">ദ്ദി≽^-⩊•^≼ ✧</span></span>
          `;
        }
        if (formatHint) formatHint.textContent = "Gợi ý định dạng: 6 chữ cái, viết liền không dấu";
      }

      setTimeout(() => {
        document.getElementById("puzzlePasscodeInput").focus();
      }, 100);
  }
}

window.closePuzzleModal = function() {
  const modal = document.getElementById("puzzleModal");
  if(modal) modal.classList.remove("active");
}

let huyWrongAttempts = 0;

let puzzleVerifying = false;

function getPuzzleLink(puzzleId) {
  const link = localStorage.getItem(`puzzle_link_${puzzleId}`);
  return link && /^https:\/\//.test(link) ? link : null;
}

function storePuzzleUnlock(puzzleId, link) {
  if (!puzzleId || !link) return;
  localStorage.setItem(`unlocked_${puzzleId}`, "true");
  localStorage.setItem(`puzzle_link_${puzzleId}`, link);
}

window.verifyPuzzleCode = async function() {
  if (puzzleVerifying) return;

  const modal = document.getElementById("puzzleModal");
  const input = document.getElementById("puzzlePasscodeInput");
  const errorMsg = document.getElementById("puzzleErrorMsg");

  const puzzleId = modal.dataset.currentPuzzle;
  const code = input.value.trim().toLowerCase();

  const showPuzzleError = (html) => {
    errorMsg.innerHTML = `<span style="font-family: 'Merriweather', serif; color: #8b3a3a; font-weight: 600; font-size: 0.88rem; display: block; line-height: 1.4;">${html}</span>`;
    errorMsg.classList.add("show");
  };

  let result = { ok: false };
  if (code) {
    puzzleVerifying = true;
    try {
      const supabase = await getSupabase();
      if (!supabase) {
        showPuzzleError("Không kết nối được máy chủ, lữ khách thử lại sau nhé!");
        return;
      }
      const { data, error } = await supabase.rpc("verify_puzzle", {
        p_puzzle_id: puzzleId,
        p_answer: code,
      });
      if (error) throw error;
      result = data || { ok: false };
    } catch (err) {
      console.warn("Lỗi kiểm tra đáp án:", err);
      showPuzzleError("Có lỗi khi kiểm tra đáp án, lữ khách thử lại sau nhé!");
      return;
    } finally {
      puzzleVerifying = false;
    }
  }

  if (result.ok && result.link) {
    if (puzzleId === "huy") {
      huyWrongAttempts = 0;
    }
    storePuzzleUnlock(puzzleId, result.link);

    closePuzzleModal();
    unlockCharacterLinks(puzzleId);
    const customToastMsg = puzzleConfigs[puzzleId]?.toastMsg || "Đã giải mã thành công! Nút Google AI Studio đã mở.";
    showToast(customToastMsg, "success");
    announcePuzzleAchievement(puzzleId);
  } else if (result.error === "RATE_LIMITED") {
    showPuzzleError("Lữ khách thử hơi nhiều rồi, hãy nghỉ vài phút rồi quay lại nhé!");
  } else {
    input.classList.add("error-shake");
    setTimeout(() => input.classList.remove("error-shake"), 400);

    if (puzzleId === "huy") {
      huyWrongAttempts++;

      if (huyWrongAttempts === 1) {
        errorMsg.innerHTML = `<span style="font-family: 'Merriweather', serif; color: #8b3a3a; font-weight: 600; font-size: 0.88rem; display: block; line-height: 1.4;"><i class='fa-solid fa-paw'></i> Meow? (1/3)</span>`;
      } else if (huyWrongAttempts === 2) {
        errorMsg.innerHTML = `<span style="font-family: 'Merriweather', serif; color: #8b3a3a; font-weight: 600; font-size: 0.88rem; display: block; line-height: 1.4;"><i class='fa-solid fa-paw'></i> Meo meo? (2/3)</span>`;
      } else if (huyWrongAttempts === 3) {
        errorMsg.innerHTML = `<span style="font-family: 'Merriweather', serif; color: #8b3a3a; font-weight: 600; font-size: 0.88rem; display: block; line-height: 1.4;"><i class='fa-solid fa-paw'></i> Meo meo~ (3/3)</span>`;
      } else {
        errorMsg.innerHTML = `<span style="font-family: 'Merriweather', serif; color: #8b3a3a; font-weight: 600; font-size: 0.88rem; display: block; line-height: 1.4;">ฅ₍^>⩊<^₎ฅ⟆ Gợi ý từ Mimi:<br>Lữ khách đã kiểm tra tài khoản Instagram của Dương Khắc Huy chưa~?</span>`;
      }
    } else {
      errorMsg.innerHTML = `<span style="font-family: 'Merriweather', serif; color: #8b3a3a; font-weight: 600; font-size: 0.88rem; display: block; line-height: 1.4;">❌ Đáp án chưa chính xác. Cố lên nào!</span>`;
    }

    errorMsg.classList.add("show");
  }
}

function getLocalUnlockedPuzzlesMap() {
  const puzzleIds = ["delmare", "huy", "seol", "arashi", "tam", "ngon", "salfozziel"];
  const map = {};
  puzzleIds.forEach(id => {
    if (localStorage.getItem(`unlocked_${id}`) === "true") {
      map[id] = true;
    }
  });
  return map;
}

window.unlockCharacterLinks = function(puzzleId) {
    const realHref = getPuzzleLink(puzzleId);
    if (!realHref) return;

    document.querySelectorAll(`a[data-puzzle-id="${puzzleId}"]`).forEach(link => {
        link.href = realHref;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        const innerLock = link.querySelector(".inner-lock") || link.querySelector(".lock-icon");
        if (innerLock) {
            innerLock.className = "bi bi-unlock-fill inner-lock";
            innerLock.style.color = "#2ecc71";
            innerLock.style.opacity = "1";
            innerLock.title = "Đã mở khóa";
        }
    });
};

window.checkUnlockedPuzzles = function() {
  const puzzleIds = ["delmare", "huy", "seol", "arashi", "tam", "ngon", "salfozziel"];

  puzzleIds.forEach(puzzleId => {
    if (getPuzzleLink(puzzleId)) {
      unlockCharacterLinks(puzzleId);
    }
  });
};

async function syncAccountPuzzles(user) {
  if (!user) return;
  const supabase = await getSupabase();
  if (!supabase) return;

  try {
    const { data, error } = await supabase.rpc("get_my_puzzle_links");
    if (error) throw error;

    (data || []).forEach((row) => storePuzzleUnlock(row.puzzle_id, row.link));
    checkUnlockedPuzzles();
    await claimLocalPuzzleUnlocks(supabase, new Set((data || []).map((row) => row.puzzle_id)));
  } catch (err) {
    console.warn("Lỗi đồng bộ trạng thái puzzle tài khoản:", err);
  }
}

// ==================== THÀNH TỰU GIẢI MÃ NHÂN VẬT ====================
let puzzleProgressCache = null;

function puzzleCharName(puzzleId) {
  return puzzleConfigs[puzzleId]?.subtitle || puzzleId;
}

function formatShortDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

async function fetchPuzzleProgress(force = false) {
  if (!currentUser) return null;
  if (puzzleProgressCache && !force) return puzzleProgressCache;
  const supabase = await getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("get_my_puzzle_progress");
    if (error) throw error;
    if (!data || !Array.isArray(data.solved)) return null;
    puzzleProgressCache = { solved: data.solved };
    return puzzleProgressCache;
  } catch (err) {
    console.warn("Chưa tải được thành tựu giải mã (đã chạy supabase/005_puzzle_achievements.sql chưa?):", err);
    return null;
  }
}

function buildPuzzleAchievementsHTML(progress) {
  return (progress.solved || [])
    .filter((item) => puzzleConfigs[item.puzzle_id])
    .slice()
    .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at))
    .map((item) => {
      const cfg = puzzleConfigs[item.puzzle_id];
      const name = escapeHTML(puzzleCharName(item.puzzle_id));
      const dateTag = item.exact
        ? `<i class="bi bi-calendar-check"></i> Đạt được: ${escapeHTML(formatShortDate(item.unlocked_at))}`
        : `<i class="bi bi-clock-history"></i> Đã giải từ trước khi có hệ thống ghi nhận`;
      return `
        <div class="showcase-medal-card puzzle-achievement-card">
          <div class="medal-emblem-circle" style="background: radial-gradient(circle, #ffe082 0%, #d4af37 100%);"><i class="fa-solid fa-lock-open"></i></div>
          <div class="medal-info-wrap">
            <strong class="medal-title-text">Giải Mã: ${name}</strong>
            <span class="medal-desc-text">Đã mở khóa “${escapeHTML(cfg.title)}”</span>
            <span class="medal-date-tag">${dateTag}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

async function announcePuzzleAchievement(puzzleId) {
  if (!currentUser) {
    setTimeout(() => showToast("Đăng nhập để lưu thành tựu giải mã vào hồ sơ của bạn nhé!", "success"), 900);
    return;
  }
  const progress = await fetchPuzzleProgress(true);
  if (!progress) return;
  const count = progress.solved.length;
  setTimeout(() => {
    showToast(`🏅 Thành tựu mới: Giải Mã ${puzzleCharName(puzzleId)}! Bạn đã giải được ${count} Két Sách.`, "success");
  }, 900);
}

async function claimLocalPuzzleUnlocks(supabase, serverIds) {
  let claimed = false;
  for (const puzzleId of Object.keys(puzzleConfigs)) {
    const link = getPuzzleLink(puzzleId);
    if (!link || serverIds.has(puzzleId)) continue;
    try {
      const { data } = await supabase.rpc("claim_puzzle_unlock", { p_puzzle_id: puzzleId, p_link: link });
      if (data === true) claimed = true;
    } catch (_) {}
  }
  if (claimed) puzzleProgressCache = null;
}

// ==================== KIỂM TRA NHÂN VẬT MỚI TỪ SUPABASE ====================
async function checkNewCharacter() {
  const bannerContainer = document.getElementById("newCharBannerContainer");
  const bannerText = document.getElementById("newCharBannerText");
  if (!bannerContainer || !bannerText) return;

  const supabase = await getSupabase();
  if (!supabase) {
    bannerContainer.style.display = "none";
    return;
  }

  try {
    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .neq("name", "Coming Soon...")
      .order("link_updated_at", { ascending: false, nullsFirst: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      bannerContainer.style.display = "none";
      return;
    }

    const latestChar = data[0];
    const targetDate = latestChar.link_updated_at ? new Date(latestChar.link_updated_at) : null;
    const now = new Date();

    const isRecent = targetDate ? (now - targetDate) / (1000 * 60 * 60 * 24) <= 15 : false;

    if (latestChar && latestChar.name && isRecent) {
      bannerText.innerHTML = `Nhân vật mới cập nhật link: <b>${escapeHTML(latestChar.name)}</b> <span class="new-char-sub">— <i>${escapeHTML(latestChar.title || "Khám phá ngay")}</i></span>`;
      bannerContainer.style.display = "block";

      const bannerBtn = document.getElementById("newCharBannerBtn");
      if (bannerBtn) {
        bannerBtn.onclick = () => {
          openBotModalByName(latestChar.name);
        };
      }
    } else {
      bannerContainer.style.display = "none";
    }
  } catch (err) {
    console.warn("Lỗi kiểm tra nhân vật mới:", err);
    bannerContainer.style.display = "none";
  }
}

function autofillUserNames() {
  if (!currentUser) return;

  const displayName = currentUser.user_metadata?.display_name ||
                      (currentUser.email ? currentUser.email.split("@")[0] : "");

  if (!displayName) return;

  const cfsAuthorInput = document.getElementById("cfsAuthorInput");
  if (cfsAuthorInput && !cfsAuthorInput.value.trim()) {
    cfsAuthorInput.value = displayName;
  }

  const modalAuthorInput = document.getElementById("feedbackAuthor");
  if (modalAuthorInput && !modalAuthorInput.value.trim()) {
    modalAuthorInput.value = displayName;
  }

  document.querySelectorAll(".input-name").forEach((input) => {
    if (!input.value.trim()) {
      input.value = displayName;
    }
  });
}

async function checkMaintenanceMode() {
  const supabase = await getSupabase();
  if (!supabase) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session ? session.user : null;

    const { data } = await supabase.from("settings").select("value").eq("key", "maintenance").maybeSingle();

    if (data && data.value === true) {
      const email = user?.email || "";
      const username = email.split("@")[0].toLowerCase();
      const cleanUser = username.trim();

      const isOwner = (user && user.id && user.id.startsWith(OWNER_USER_ID)) ||
                      ["fevans", "evans", "iamevans"].includes(cleanUser);

      if (!isOwner) {
        document.body.innerHTML = `
        <style>
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.4; filter: drop-shadow(0 0 15px rgba(212, 175, 55, 0.4)); }
            50% { opacity: 0.9; filter: drop-shadow(0 0 25px rgba(212, 175, 55, 0.8)); }
          }
          .maintenance-bg-video {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            object-fit: cover; z-index: 0; filter: brightness(0.4);
          }
          .maintenance-container {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(28, 17, 11, 0.65);
            color: #fdfbf7; display: flex; flex-direction: column; justify-content: center; align-items: center;
            z-index: 999999; font-family: 'Merriweather', serif; text-align: center; padding: 25px; box-sizing: border-box;
          }
          .maintenance-card {
            background: rgba(43, 28, 17, 0.85);
            border: 2px solid #d4af37;
            padding: 40px 30px;
            border-radius: 16px;
            max-width: 480px; width: 100%;
            box-shadow: 0 15px 35px rgba(0,0,0,0.6);
            animation: floatSlow 5s ease-in-out infinite;
            position: relative;
          }
          .maintenance-icon { font-size: 3.2rem; color: #d4af37; margin-bottom: 15px; animation: pulseGlow 3s ease-in-out infinite; }
          .maintenance-title { font-family: 'Cormorant Garamond', serif; color: #d4af37; font-size: 2.3rem; margin-bottom: 12px; letter-spacing: 1px; }
          .maintenance-desc { font-size: 0.95rem; opacity: 0.85; line-height: 1.6; color: #e2d7c7; margin-bottom: 20px; }
          .maintenance-note { font-size: 0.85rem; font-style: italic; color: #b89848; opacity: 0.9; border-top: 1px dashed rgba(212, 175, 55, 0.3); padding-top: 15px; }
          #dustCanvas {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2; /* Nằm trên video nhưng dưới khung card */
          }
          .maintenance-card-inner { position: relative; z-index: 3; }
        </style>

        <canvas id="dustCanvas"></canvas>

        <div class="maintenance-container">
          <div class="maintenance-card">
            <div class="maintenance-card-inner">
              <div class="maintenance-icon">
                <i class="fa-solid fa-feather-pointed"></i>
              </div>
              <h1 class="maintenance-title">Tiệm Sách Đang Tạm Đóng Cửa</h1>
              <p class="maintenance-desc">
                Evans đang sắp xếp lại những kệ sách và cập nhật thêm vài điều kỳ diệu mới.
              </p>
              <div class="maintenance-note">
                Mimi đang cuộn tròn giữ cửa. Lữ khách hãy quay lại sau ít phút nữa nhé! <i class='fa-solid fa-paw'></i>
              </div>
            </div>
          </div>
        </div>
        `;

        // if (typeof initDustParticles === "function") {
        //   initDustParticles();
        // }
        initHalloweenEffect();

        throw new Error("Website is under maintenance.");
      }
    }
  } catch (err) {
    if (err.message !== "Website is under maintenance.") {
      console.warn("Lỗi kiểm tra trạng thái bảo trì:", err);
    }
  }
}
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

  // Danh sách CDN dự phòng (jsDelivr và unpkg)
  const cdnSources = [
    "https://cdn.jsdelivr.532799.cn/npm/@supabase/supabase-js@2", // Hoặc cdn.jsdelivr.net chính hãng
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

// Hàm kiểm tra và chờ thư viện Supabase CDN nạp hoàn tất (chờ tối đa 3 giây)
// Nhiều tác vụ khởi động gọi getSupabase() cùng lúc -> chỉ tạo MỘT client, mọi nơi dùng chung kết quả
let _supabasePromise = null;

async function getSupabase() {
  if (_supabaseInstance) return _supabaseInstance;
  if (!_supabasePromise) {
    _supabasePromise = createSupabaseInstance().then(
      (inst) => {
        if (!inst) _supabasePromise = null; // thất bại -> cho phép thử lại lần sau
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

  // Tăng thời gian chờ lên 6 giây và chủ động kiểm tra/nạp lại script dự phòng
  let retries = 60; // 60 lần x 100ms = 6 giây
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
// CSS (khối "MÀN HÌNH CHỜ" trong style.css) phủ kín trang cho tới khi body có class page-ready,
// nhờ vậy người xem không thấy nội dung mặc định/trống rồi mới nhảy sang dữ liệu thật.
function markPageReady() {
  document.body.classList.add("page-ready");
  // Nếu màn hình chờ dùng video nền thì dừng lại khi đã vào trang (đỡ tốn pin/CPU)
  const loaderVideo = document.getElementById("loaderVideo");
  if (loaderVideo) setTimeout(() => loaderVideo.pause(), 500);
}

// Chờ tối đa `ms` mili giây (không bao giờ ném lỗi) để màn hình chờ không kẹt khi mạng chậm
function waitAtMost(promises, ms) {
  return Promise.race([
    Promise.allSettled(promises),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
}

// Chạy một tác vụ khởi động mà không bao giờ ném lỗi ra ngoài: một phần lỗi không làm hỏng cả trang
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
  // Chốt an toàn: dù có chuyện gì cũng mở trang sau 9 giây
  const readyFailsafe = setTimeout(markPageReady, 9000);

  try {
    hoistSharedModals();
    renderCharacterCreatedDates();

    // 1. Phần không cần mạng: chạy ngay
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
      ["menuToggle", initMenuToggle],
      ["catMascot", initCatMascot],
      ["dustParticles", initDustParticles],
      ["unlockedPuzzles", checkUnlockedPuzzles],
    ].forEach(([label, fn]) => runStartupTask(label, fn));

    // 2. Phần cần Supabase: chạy SONG SONG thay vì nối đuôi nhau, tổng thời gian chờ ≈ lần gọi chậm nhất
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

    // Chờ dữ liệu + font tải xong (tối đa 6 giây) rồi mới mở màn hình chờ
    if (document.fonts && document.fonts.ready) startupTasks.push(document.fonts.ready);
    await waitAtMost(startupTasks, 6000);
  } finally {
    clearTimeout(readyFailsafe);
    markPageReady();
  }
});

// Chỉ chấp nhận mã màu hợp lệ trước khi đưa vào thuộc tính style (tránh chèn CSS/HTML lạ từ dữ liệu)
function safeCssColor(value, fallback = "#fff2b2") {
  const v = String(value || "").trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(v) ? v : fallback;
}

// Hàm escape HTML chống XSS
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
      // Bóc tách thủ công nếu JSON.parse lỗi do chứa ký tự ngoặc kép
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

  // DỰ PHÒNG: Nếu Supabase không có dữ liệu/lỗi/chưa có quote của nhân vật khác,
  // dùng danh sách dự phòng đa dạng nhân vật để giao diện luôn luôn xoay tua
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

  // Bốc ngẫu nhiên 1 câu
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
      bottom: 24px;
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
    // Chỉ nút/chip khóa mới mở bảng giải đố. Thẻ nhân vật (.bot-card) cũng mang
    // data-puzzle-id nên nếu dùng closest("[data-puzzle-id]") thì bấm bất kỳ đâu
    // trên thẻ cũng bật bảng giải đố, che mất modal thông tin nhân vật.
    const lockedChip = e.target.closest("a[data-puzzle-id], .chip-btn[data-puzzle-id]");
    if (lockedChip) {
      const puzzleId = lockedChip.getAttribute("data-puzzle-id");
      if (puzzleId) {
        // Đã giải đố (có link do server cấp) -> đắp href rồi để trình duyệt mở link mặc định
        if (getPuzzleLink(puzzleId)) {
          unlockCharacterLinks(puzzleId);
          const targetHref = lockedChip.href;
          if (targetHref && targetHref !== "#" && !targetHref.includes("javascript")) {
            return; // Cho phép sự kiện mở link mặc định diễn ra
          }
        }
      
        // Nếu chưa mở khóa thì chặn lại và bật Modal giải mã
        e.preventDefault();
        e.stopPropagation();
        if (typeof openPuzzleModal === "function") {
          openPuzzleModal(puzzleId);
        }
      }
    }
  });

  // Sự kiện gửi feedback trực tiếp trong Modal
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
        // 🌟 Hứng biến error để kiểm tra kết quả thực tế từ Supabase
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
          return; // Dừng lại không báo thành công giả mạo nữa
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

      // --- LOGIC HIỂN THỊ VÀ KHÔI PHỤC MÃ MORSE ---
      const trackTitleEl = document.querySelector(".track-title");
      const currentTime = Math.floor(audio.currentTime);

      if (trackTitleEl) {
        // 1. Nếu chưa lưu tên bài gốc thì tự lưu vào dataset
        if (
          !trackTitleEl.dataset.originalTitle &&
          !trackTitleEl.innerHTML.includes("Morse:")
        ) {
          trackTitleEl.dataset.originalTitle = trackTitleEl.textContent;
        }

        // 2. Kiểm tra khoảng thời gian 3:16 (196s) -> 3:20 (200s)
        if (currentTime >= 196 && currentTime <= 200) {
          trackTitleEl.innerHTML =
            "<span style='color: #6475f1; font-weight: bold;'>48696d69747375</span>";
        } else {
          // 3. Nếu nằm ngoài khoảng thời gian, trả về tên gốc đã lưu trong dataset
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

    // Đóng hoàn toàn menu và gỡ khóa scroll trước khi chuyển trang
    closeMobileMenu();

    loadPageViaAjax(href);
  });

  window.addEventListener("popstate", (e) => {
    closeMobileMenu();

    // Đang xem nhân vật -> Back chỉ đóng màn hình nhân vật, không tải lại trang
    if (isBotModalOpen()) {
      closeBotModal(true);
      return;
    }
    // Forward về lại màn hình nhân vật
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
    if (path === currentPagePath) return; // cùng trang: giữ nguyên danh sách/bộ lọc
    loadPageViaAjax(path, false);
  });
}

// Modal dùng chung (nhân vật + giải đố) phải nằm NGOÀI #main-content, nếu không chúng bị
// xóa khi chuyển trang AJAX (vd: Tủ sách -> Trang chủ) và top 3/random không mở được modal.
const SHARED_MODAL_IDS = ["botModal", "puzzleModal", "feedbackPopupModal"];

// Khai báo cho trình đọc màn hình biết đây là hộp thoại
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
      inMain.remove(); // đã có bản bền vững ngoài main -> bỏ bản trùng của trang mới
    } else {
      document.body.appendChild(inMain); // trang đầu tiên: nhấc modal ra khỏi main
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
      await waitAtMost(pageTasks || [], 3500); // dữ liệu trang mới sẵn sàng rồi mới hiện, tránh nháy nội dung mặc định

      mainContent.style.opacity = "1";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
  } catch (error) {
    console.error("Lỗi chuyển trang AJAX:", error);
    window.location.href = url;
  }
}

function reinitializePageScripts() {
  // Modal nằm trong #main-content nên bị thay khi chuyển trang -> gỡ khóa cuộn còn sót
  document.body.classList.remove("modal-open", "char-view-open");
  unlockPageScroll(false); // trang mới: không khôi phục vị trí cuộn của trang cũ
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
  initDustParticles();
  checkUnlockedPuzzles();
  autofillUserNames();
  
  if (document.querySelector(".profile-page-container")) {
    pageTasks.push(initProfilePage());
  }
  return pageTasks;
}
// Chuyển trang profile mượt mà qua AJAX
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

  // Hàm kiểm tra từ khóa manh mối
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
      // Nếu là thẻ ẩn chú mèo
      if (card.classList.contains("secret-cat-card")) {
        if (hasCatClue) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
        return;
      }

      // Logic lọc thẻ thông thường
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

  // Sự kiện nhập ô tìm kiếm
  searchInput?.addEventListener("input", filterCards);

  // Toggle Menu Thể loại
  filterToggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    genreContainer?.classList.toggle("show");
  });

  // Chọn thể loại
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

  // Đóng dropdown khi click ra ngoài
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
  // Tránh gắn trùng listener mỗi lần chuyển trang AJAX
  if (isModalInitialized) return;
  isModalInitialized = true;

  document.addEventListener("click", async (e) => {
    const modal = document.getElementById("botModal");

    // Tab Thông tin / Lời nhắn (mobile)
    const tabBtn = e.target.closest(".modal-tab");
    if (tabBtn && modal && modal.contains(tabBtn)) {
      setModalTab(tabBtn.dataset.tab);
      return;
    }

    // Nút chia sẻ nhân vật
    if (e.target.closest("#modalShareBtn")) {
      shareCurrentCharacter();
      return;
    }

    // Khi bấm nút đóng (×), nút quay lại (mobile) hoặc bấm ra vùng nền mờ bên ngoài
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
// Trên điện thoại, modal nhân vật hoạt động như một "màn hình" riêng:
// có history (nút Back / vuốt cạnh trái đóng được), deep link #nv=<tên>,
// giữ nguyên bộ lọc + vị trí cuộn của danh sách khi quay lại.
let charViewScrollY = 0;

// Khóa cuộn trang nền bằng position: fixed (body đang có overflow-y: auto !important
// nên overflow: hidden không có tác dụng; cách này cũng chặn được cuộn nền trên iOS).
function lockPageScroll() {
  const body = document.body;
  if (body.classList.contains("scroll-locked")) return;
  charViewScrollY = window.scrollY;
  body.style.top = `-${charViewScrollY}px`;
  document.documentElement.classList.add("scroll-locked"); // giữ chỗ thanh cuộn, tránh giật layout
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
  lockPageScroll(); // desktop + mobile: không cho trang nền cuộn khi modal đang mở
  modal.classList.add("show");
  if (!isMobileView()) return;

  document.body.classList.add("char-view-open");

  // Chỉ push khi chưa đang ở một entry của màn hình nhân vật (popstate/forward)
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
    // Desktop: bỏ #nv=... khỏi thanh địa chỉ sau khi đóng (mobile đã tự lùi history)
    if (!wasMobileView && /^#nv=/.test(window.location.hash)) {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search,
      );
    }
  };

  // Chặn đóng lặp khi popstate đến trong lúc đang chạy hiệu ứng
  const animate = wasMobileView && !reduceMotion;
  if (animate) charViewClosing = true;

  // Đóng bằng nút/vuốt -> lùi 1 bước history để bỏ entry #nv=
  if (!fromPopstate && window.history.state && window.history.state.charView) {
    window.history.back();
  }

  if (animate) {
    modal.classList.add("closing"); // trượt ra bên phải
    setTimeout(finish, 260);
  } else {
    finish();
  }
}

// Vuốt từ mép trái sang phải để quay lại (Android / trình duyệt không có cử chỉ back)
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

// Mở thẳng màn hình nhân vật khi vào bằng link/refresh có #nv=<tên>
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
    // Đưa entry hiện tại về trang danh sách, rồi push màn hình chi tiết lên trên
    window.history.replaceState(
      { path: currentPagePath },
      "",
      window.location.pathname + window.location.search,
    );
  }
  // Desktop: chỉ mở modal; hash được dọn khi đóng
  await openBotModalByName(name);
}

// Bổ sung quét lại thẻ khóa sau khi Modal thông tin nhân vật vừa tải xong
window.openBotModalByName = async function (name) {
  const modal = document.getElementById("botModal");
  if (!modal) return;

  // Khóa cứng cuộn nền ngay khi mở Modal
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

// 💥 HÀM ĐỒNG BỘ FEEDBACK TRIỆT ĐỂ
async function syncModalFeedbacks(charName, botCard) {
  const modalFeedbackList = document.getElementById("dynamicFeedbackList");
  if (!modalFeedbackList) return;

  // Xóa sạch nội dung cũ trong Modal trước khi tải
  modalFeedbackList.innerHTML = "";

  // 1. Nếu trên Card ngoài đã có các .feedback-item do đã render trước đó
  const cardFeedbackItems = botCard.querySelectorAll(
    ".feedback-list .feedback-item",
  );

  if (cardFeedbackItems.length > 0) {
    cardFeedbackItems.forEach((item) => {
      modalFeedbackList.appendChild(item.cloneNode(true));
    });
    return;
  }

  // 2. Nếu Card chưa có dữ liệu (hoặc chứa text mặc định từ HTML), thực hiện Fetch trực tiếp từ Supabase
  try {
    const supabase = await getSupabase();
    if (supabase && charName) {
      const { data, error } = await supabase
        .from("feedbacks")
        .select("*")
        .eq("char_name", charName)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        // Cập nhật lại vào cả Card ngoài lẫn Modal
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

  // 3. Nếu thực sự không có feedback nào trong CSDDL
  modalFeedbackList.innerHTML = `
    <p class="no-feedback-text" style="opacity:0.7; font-style:italic; padding: 8px 0;">
      Chưa có lời nhắn nào cho ${escapeHTML(charName)}. Hãy là người đầu tiên gửi feedback!
    </p>
  `;
}

// 💥 HÀM BỔ SUNG: Render danh sách feedback sang Modal
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

  // Chuẩn hóa dấu nháy đơn và khoảng trắng
  const normalize = (str) => (str || "").trim().toLowerCase().replace(/[’']/g, "'");
  const cleanTargetName = normalize(name);

  // 1. Lấy dữ liệu nhân vật
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

    // 2. Mở Modal (mobile: mở như một màn hình riêng, có history)
    openBotModalUI(modal, char.name);

    // 3. Tải feedback
    checkUnlockedPuzzles();
    await syncModalFeedbacksByName(char.name);
  } else {
    console.error("Không tìm thấy thông tin cho nhân vật:", name);
  }
};

// Hàm tải feedback trực tiếp theo tên nhân vật vào Modal
async function syncModalFeedbacksByName(charName, { silent = false } = {}) {
  const modalFeedbackList = document.getElementById("dynamicFeedbackList");
  if (!modalFeedbackList) return;

  // silent = làm mới ngầm sau khi gửi: giữ nguyên danh sách cũ cho tới khi có dữ liệu mới, không nháy chữ "Đang tải"
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
              <div class="feedback-reply-item" style="display: flex; gap: 8px; margin-left: 28px; margin-top: 8px; align-items: flex-start; padding-left: 8px; border-left: 2px solid #d4af37; font-size: 14px;">
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

// Đồng bộ số tim + trạng thái "đã thích" giữa nút vừa bấm, các thẻ và modal
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

  // Xác định trạng thái mới dựa trên việc nút đang được like hay chưa
  const willBeLiked = !btn.classList.contains("liked");

  // 1. Lưu trạng thái vào thiết bị người dùng (localStorage)
  saveLocalLikeState(charName, willBeLiked);

  // 2. Cập nhật số đếm và class trên UI
  btn.classList.toggle("liked", willBeLiked);
  count = willBeLiked ? count + 1 : Math.max(0, count - 1);
  countSpan.textContent = count;

  // 3. Đồng bộ giao diện giữa tất cả các thẻ và Modal
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

  // 4. Lưu lượt tim lên Supabase qua RPC (mỗi người chỉ được 1 tim / nhân vật, có giới hạn tần suất)
  const supabase = await getSupabase();
  if (supabase) {
    const { data: newTotal, error } = await supabase.rpc("set_vote", {
      p_name: charName,
      p_liked: willBeLiked,
      p_device: getDeviceId(),
    });

    if (error) {
      console.error("❌ Lỗi Supabase khi lưu tim:", error);
      // Hoàn tác giao diện vì server không ghi nhận
      const revertedCount = willBeLiked ? Math.max(0, count - 1) : count + 1;
      saveLocalLikeState(charName, !willBeLiked);
      applyLikeUI(charName, revertedCount, !willBeLiked, btn, countSpan);
      showToast(spamErrorMessage(error, "Không lưu được lượt tim, thử lại sau nhé!"), "error");
      return;
    }

    // Số tim chuẩn do server trả về
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
  if (!supabase) return; // Bảo vệ code không bị crash nếu mất mạng / lỗi SDK

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
// Thêm ngày tạo cho một nhân vật: gắn data-created="2026-08-26" (hoặc "26/08/2026") vào thẻ .bot-card
// trong characters.html. Không có thuộc tính này thì không hiển thị gì.
function formatCreatedDate(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // YYYY-MM-DD (không dùng Date để khỏi lệch múi giờ)
  if (m) return `${m[3].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[1]}`;
  m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/); // DD/MM/YYYY
  if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
  return v; // giữ nguyên nếu là chữ tự do, vd "Mùa hè 2026"
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

// ==================== CHỐNG SPAM (PHÍA CLIENT) ====================
// Lớp bảo vệ thật nằm ở Supabase (supabase/002_anti_spam.sql). Phần này chỉ giúp báo lỗi
// thân thiện và tránh gửi những yêu cầu chắc chắn bị từ chối.
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

// Đổi mã lỗi từ trigger/RPC của Supabase thành câu thân thiện
function spamErrorMessage(error, fallback) {
  const msg = String(error?.message || "");
  if (msg.includes("RATE_LIMITED")) return "Bạn thao tác hơi nhanh, đợi một lát rồi thử lại nhé!";
  if (msg.includes("CONTENT_TOO_LONG")) return "Nội dung quá dài, hãy rút gọn lại nhé.";
  if (msg.includes("TOO_MANY_LINKS")) return "Mỗi lời nhắn chỉ được chứa tối đa 1 liên kết.";
  if (msg.includes("DUPLICATE_CONTENT")) return "Bạn vừa gửi nội dung này rồi.";
  if (msg.includes("EMPTY_CONTENT")) return "Nội dung đang trống.";
  return fallback;
}

// Mã thiết bị ẩn danh: giúp server đếm "1 tim / thiết bị" cho khách chưa đăng nhập
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

// share/map.json do tools/build_share_pages.py tạo ra: { "tên nhân vật": "slug" }
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
  // Có trang chia sẻ riêng -> link có ảnh xem trước đúng nhân vật; không thì dùng link sâu thẳng vào modal
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

  // Điện thoại: mở bảng chia sẻ của hệ điều hành
  if (isMobileView() && navigator.share) {
    try {
      await navigator.share({
        title: `${name} — Tiệm Sách Evans`,
        text: subtitle ? `${name} · ${subtitle}` : name,
        url,
      });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // người dùng tự đóng bảng chia sẻ
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

// FEEDBACK SUBMISSION LOGIC
// Nút "Gửi Thư / Feedback" ngoài thẻ: mở popup (giống bảng giải đố) thay vì mở rộng thẻ.
// Nút feedback trong modal chi tiết nhân vật không đi qua hàm này.
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

// Đổ danh sách feedback của thẻ (đã được loadFeedbacks điền) vào popup
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

// Cuộn tới phần vừa gửi và nháy sáng nhẹ để người viết thấy ngay
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

  // Điền sẵn tên nếu đã đăng nhập
  const nameInput = popup.querySelector(".input-name");
  const loggedInName = currentUser?.user_metadata?.display_name || "";
  if (nameInput && !nameInput.value.trim() && loggedInName) {
    nameInput.value = loggedInName;
  }

  renderFeedbackPopupList();
  lockPageScroll();
  popup.classList.add("active");

  // Tải dữ liệu mới nhất rồi vẽ lại danh sách (loadFeedbacks tự làm mới popup khi đang mở)
  await loadFeedbacks();
};

window.closeFeedbackPopup = function () {
  const popup = document.getElementById("feedbackPopupModal");
  if (!popup || !popup.classList.contains("active")) return;
  popup.classList.remove("active");
  if (!isBotModalOpen()) unlockPageScroll();
};

// Phím Esc: đóng lớp trên cùng trước (giải đố -> popup feedback -> modal nhân vật)
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
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
  // Ngăn chặn mọi hành vi nổi bọt hoặc submit mặc định nếu có
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  console.log("👉 Đã nhấn nút gửi feedback!");

  // Tìm kiếm linh hoạt khung chứa input dựa vào card hoặc modal
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

  // Làm mới danh sách mà người viết đang xem để phản hồi hiện ra NGAY (không cần đóng/mở lại)
  const listSelector = feedbackListSelectorFor(btn);
  await loadFeedbacks(); // cập nhật các thẻ + popup (nếu đang mở)
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
              <div class="feedback-reply-item" style="display: flex; gap: 8px; margin-left: 28px; margin-top: 8px; align-items: flex-start; padding-left: 8px; border-left: 2px solid #d4af37; font-size: 14px;">
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

// // ==================== HIỆU ỨNG HẠT BỤI BAY TOÀN MÀN HÌNH ====================
function initDustParticles() {
  let canvas = document.getElementById("dustCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "dustCanvas";
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext("2d");
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  // Số lượng hạt bụi (tối ưu hiệu năng từ PC đến Mobile)
  const particleCount = Math.min(Math.floor((width * height) / 18000), 75);
  const particles = [];

  class DustParticle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : -10;
      this.radius = Math.random() * 2.2 + 0.8; // Kích thước hạt từ 0.8px - 3px
      this.vx = (Math.random() - 0.5) * 0.4; // Tốc độ dạt ngang nhẹ
      this.vy = Math.random() * 0.5 + 0.2;  // Tốc độ rơi từ từ
      this.opacity = Math.random() * 0.6 + 0.3;
      this.fadeSpeed = Math.random() * 0.008 + 0.003;
      this.growing = Math.random() > 0.5;
      
      // Màu sắc bụi vàng kim & bụi giấy ấm áp
      const colors = [
        "255, 235, 170", // Vàng sáng
        "212, 175, 55",  // Vàng đồng vintage
        "245, 222, 179", // Vàng lúa mạch
        "255, 255, 255"  // Đốm trắng sáng li ti
      ];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      // Hiệu ứng nhấp nháy mờ ảo
      if (this.growing) {
        this.opacity += this.fadeSpeed;
        if (this.opacity >= 0.85) this.growing = false;
      } else {
        this.opacity -= this.fadeSpeed;
        if (this.opacity <= 0.15) this.growing = true;
      }

      // Khi hạt trôi ra khỏi màn hình thì đưa trở lại phía trên
      if (this.y > height + 10 || this.x < -10 || this.x > width + 10) {
        this.reset();
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = `rgba(${this.color}, 0.8)`;
      ctx.fill();
    }
  }

  for (let i = 0; i < particleCount; i++) {
    particles.push(new DustParticle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }
    requestAnimationFrame(animate);
  }

  animate();
}

// Hàm đóng menu mobile và mở lại cuộn trang
function closeMobileMenu() {
  const navMenu = document.getElementById("navMenu");
  const menuToggle = document.getElementById("menuToggle");
  const musicPlayer = document.getElementById("musicPlayer");

  if (navMenu) navMenu.classList.remove("show");
  if (menuToggle) menuToggle.classList.remove("active");
  document.body.classList.remove("menu-open"); // Gỡ bỏ class khóa cuộn trang

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

  // Đóng menu và mở lại cuộn khi click ra ngoài vùng menu
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
  // Khi mở trang, nhiều tác vụ (tim, top 3, nhân vật ngẫu nhiên...) cùng cần danh sách này:
  // dùng chung một lần tải đang chạy. Lần gọi sau đó (vd: sau khi thả tim) vẫn tải mới.
  if (!_allCharactersInflight) {
    _allCharactersInflight = fetchAllCharacters().finally(() => {
      _allCharactersInflight = null;
    });
  }
  const list = await _allCharactersInflight;
  return Array.isArray(list) ? list.map((c) => ({ ...c })) : list; // mỗi nơi nhận bản riêng để sắp xếp thoải mái
}

async function fetchAllCharacters() {
  const supabase = await getSupabase();

  // 1. Dữ liệu mới nhất (đặc biệt là cột votes) từ Supabase
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

  // 2. Chi tiết (Mục lục, trích đoạn, chips) từ thẻ trên trang hoặc từ characters.html — chạy song song với bước 1
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

  // 3. Hợp nhất: Lấy số vote từ Supabase và chi tiết mô tả từ file HTML
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

  // 1. Cập nhật các thẻ bot-card ngoài trang
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

  // 2. Cập nhật cho Modal nếu đang hiển thị
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

    // Gán sự kiện click trực tiếp, an toàn tuyệt đối 100% với mọi ký tự đặc biệt
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

      // Gán sự kiện click trực tiếp cho thẻ Random
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

  // 1. Dán tờ note lên bảng ngay lập tức trên giao diện
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

  // 2. Thử lưu vào Supabase (nếu lỗi chỉ thông báo console, không chặn Modal)
  const supabase = await getSupabase();
  if (supabase) {
    const noteData = { 
      author: author, 
      content: content, 
      bg_color: color 
    };
    
    // Nếu user đã đăng nhập, gắn thêm user_id vào để sau này load lên Profile cá nhân chính xác tuyệt đối
    if (currentUser) {
      noteData.user_id = currentUser.id;
    }

    const { error } = await supabase
      .from("cfs_notes")
      .insert([noteData]);
      
    if (error) {
      console.error("❌ Lỗi lưu Supabase:", error);
      // Server từ chối (spam / lỗi) -> gỡ tờ note vừa dán thử và không báo thành công giả
      noteEl.remove();
      if (submitBtn) submitBtn.disabled = false;
      showToast(spamErrorMessage(error, "Chưa gửi được tâm thư, bạn thử lại sau nhé!"), "error");
      return;
    }
    markSpamSent("note", content);
  }

  // 3. Reset input và hiển thị Modal Cảm Ơn
  if (authorInput) authorInput.value = "";
  if (contentInput) contentInput.value = "";
  if (submitBtn) submitBtn.disabled = false;

  showThankYouLetterModal(author); // Gọi hiển thị Modal
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

// Định dạng created_at (timestamptz của Supabase) -> ngày theo múi giờ của người xem
function formatNoteDate(createdAt) {
  if (!createdAt) return null;
  // Chuẩn hóa: "2026-10-12 03:20:00.123456+00" -> ISO 8601 mà mọi trình duyệt đều đọc được
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

  // Lấy danh sách tâm thư từ bảng 'cfs_notes' sắp xếp mới nhất lên đầu
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

  // Đổ danh sách note ra bảng dán ghi chú
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

    // Footer: tên người viết (trái) + ngày viết (phải)
    noteEl.innerHTML = `
      <p class="note-content">"${escapeHTML(note.content)}"</p>
      <div class="note-footer">
        <span class="note-author">— ${escapeHTML(note.author || "Lữ khách ẩn danh")}</span>
        ${dateHTML}
      </div>
    `;
    cfsBoard.appendChild(noteEl);
  });
  initDustParticles();
}

// CAT MASCOT INTERACTION
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
    // Hiệu ứng nhún nhảy / nẩy mèo
    catBtn.classList.remove("purr");
    void catBtn.offsetWidth;
    catBtn.classList.add("purr");

    petCount++;

    // KIỂM TRA CHẶNG GIẢI ĐỐ: Đủ 10 lần bấm
    if (petCount === 10) {
      catBubble.innerHTML = catBubble.innerHTML =
        "<i class='fa-solid fa-key' style='color: #f1c40f;'></i> <b>Meow! Đã nhận 10 lần xoa đầu của Lữ khách! (Đừng nói cho Evans biết nha!)</b><br>Mimi trao cho bạn mảnh mật mã cuối cùng: <span style='font-weight: 900; color: #d35400; font-family: monospace; font-size: 1.05em;'>RVVSRUtB</span>.<br><span style='font-size:0.8rem; opacity:0.9;'>Chúc bạn may mắn! Meow~</span>";

      // Tạo hiệu ứng đặc biệt hoặc phát âm thanh nếu muốn
      catBtn.style.transform = "scale(1.2)";
      setTimeout(() => (catBtn.style.transform = "scale(1)"), 200);
    } else if (petCount > 10) {
      // Bấm thêm lần nữa sau khi đã nhận mã -> Hiện Modal nhập mật mã nhận bằng
      catBubble.innerHTML = "🐱 Đang mở Két Sách Bí Mật...";

      // Gọi hàm hiển thị Modal Nhận Bằng
      if (typeof openDiplomaPasscodeModal === "function") {
        openDiplomaPasscodeModal();
      } else {
        showDiplomaModalDirect(); // Hàm dự phòng nếu nhập trực tiếp
      }

      petCount = 0; // Reset lại đếm
    } else {
      // Các lần bấm từ 1 -> 9: Hiển thị quote ngẫu nhiên
      const randomQuote =
        catQuotes[Math.floor(Math.random() * catQuotes.length)];
      catBubble.innerHTML = randomQuote;
    }

    // Hiển thị bóng thoại
    catBubble.classList.add("show");

    // Giữ bóng thoại lâu hơn một chút (4.5s) ở mốc 10 để người chơi kịp đọc mã
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

// PUZZLE SYSTEM - PC & MOBILE COMPATIBLE
// 1. CHẶNG 2: Tương tác Player Nhạc theo Thời gian (đã có)
// 2. CHẶNG 3: Kích hoạt Thẻ Bí Mật từ ô Tìm Kiếm
const characterSearchInput = document.getElementById("searchInput");
const secretBotCard = document.getElementById("secretBotCard");

if (characterSearchInput) {
  characterSearchInput.addEventListener("input", (e) => {
    const val = e.target.value.trim().toUpperCase();
    if (val === "BOOK_R77") {
      // Hiện thẻ nhân vật bí mật
      if (secretBotCard) {
        secretBotCard.style.display = "block";
        secretBotCard.scrollIntoView({ behavior: "smooth" });
      }
    }
  });
}

// 3. CHẶNG 4: Nhận Bằng Cử Nhân
// HÀM MỞ MODAL NHẬN BẰNG CỬ NHÂN / CHỨNG NHẬN
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

  // Focus trực tiếp vào ô input khi mở
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

// Kiểm tra mật mã cuối cùng để nhận Giấy chứng nhận
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

  // Đáp án hợp lệ
  const validAnswers = ["613himitsueureka"];

  if (validAnswers.includes(code)) {
    wrongAttempts = 0;
    if (hintEl) {
      hintEl.innerHTML = "";
      hintEl.classList.remove("show");
    }

    if (confirmBtn) confirmBtn.disabled = true;
    let solverOrder = null;

    // Lưu vào Supabase & lấy STT giải mã
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

  // Kiểm tra đáp án
  if (userCode === "613himitsueureka") {
    const usernameInput = document.getElementById("playerNameInput");
    const playerName =
      usernameInput && usernameInput.value.trim()
        ? usernameInput.value.trim()
        : "Lữ khách ẩn danh";

    // Vô hiệu hóa nút bấm tạm thời để tránh bấm 2 lần
    const confirmBtn = document.querySelector(".btn-diploma-confirm");
    if (confirmBtn) confirmBtn.disabled = true;

    let solverOrder = null;

    // --- LƯU THÔNG TIN VÀO SUPABASE & LẤY SỐ THỨ TỰ ---
    const supabase = await getSupabase();
    if (supabase) {
      try {
        // Insert lữ khách vào database và trả về thông tin dòng vừa chèn
        const { data, error } = await supabase
          .from("puzzle_solvers")
          .insert([{ player_name: playerName }])
          .select("id");

        if (error) {
          console.error("❌ Lỗi khi lưu người giải mã vào Supabase:", error);
        } else if (data && data.length > 0) {
          solverOrder = data[0].id; // id tự tăng chính là số thứ tự lượt giải
        }
      } catch (err) {
        console.error("❌ Lỗi kết nối Supabase:", err);
      }
    }

    // Đóng Modal nhập mã
    closeDiplomaModal();

    // Hiển thị Giấy Chứng Nhận với tên và số thứ tự
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

  // Bắn pháo hoa chúc mừng
  if (typeof triggerCelebrationConfetti === "function") {
    triggerCelebrationConfetti();
  }
}

// Hàm tạo hiệu ứng Confetti chúc mừng
function triggerCelebrationConfetti() {
  if (typeof confetti === "function") {
    // Bắn từ bên TRÁI chéo sang
    confetti({
      particleCount: 200, // Số lượng hạt pháo hoa
      angle: 60, // Góc bắn chéo hướng vào giữa
      spread: 70, // Độ xòe của pháo hoa
      origin: { x: 0, y: 0.75 }, // Xuất phát từ mép trái
      zIndex: 999999, // Nổi lên trên Giấy chứng nhận
    });

    // Bắn từ bên PHẢI chéo sang
    confetti({
      particleCount: 200, // Số lượng hạt pháo hoa
      angle: 120, // Góc bắn chéo hướng vào giữa
      spread: 70, // Độ xòe của pháo hoa
      origin: { x: 1, y: 0.75 }, // Xuất phát từ mép phải
      zIndex: 999999, // Nổi lên trên Giấy chứng nhận
    });
  } else {
    console.warn("Chưa nhúng thư viện canvas-confetti!");
  }
}

// Hàm đóng Modal Bằng
function closeDiplomaModal() {
  const modal = document.getElementById("diplomaInputModal");
  if (modal) {
    modal.classList.remove("active");
  }
}

// ==================== HỆ THỐNG XÁC THỰC & HỒ SƠ ĐỘC GIẢ ====================
let isSignUpMode = false;
let currentUser = null;

// 1. Kiểm tra phiên đăng nhập hiện tại khi tải trang
async function checkUserSession() {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    currentUser = session.user;
    updateNavUserUI(currentUser);
    autofillUserNames();
    await syncAllUserData(currentUser);
  } else {
    currentUser = null;
    updateNavUserUI(null);
  }

  // Lắng nghe thay đổi trạng thái đăng nhập
  supabase.auth.onAuthStateChange(async (event, session) => {
    currentUser = session ? session.user : null;
    updateNavUserUI(currentUser);
    if (currentUser && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
      await syncAllUserData(currentUser);
    }
  });
}

// Hàm gộp toàn bộ quá trình đồng bộ dữ liệu
async function syncAllUserData(user) {
  if (!user) return;
  await syncAccountFavorites(user);
  await syncAccountProgress(user);
  await syncAccountPuzzles(user);
}

// 2. Cập nhật giao diện Navbar (Avatar + Tên lữ khách)
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
    } else {
      navBtn.innerHTML = `<i class="fa-solid fa-feather"></i> <span>Đóng Mộc / Nhận Thẻ</span>`;
    }
  });
}

// 3. Ẩn/Hiện mật khẩu
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

// 4. Mở/Đóng Modal Thẻ Độc Giả
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

    // Đồng bộ lại dữ liệu khi mở hồ sơ
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

// Hàm xử lý bật/tắt thông báo quên mật khẩu
window.toggleForgotPasswordNotice = function() {
  const notice = document.getElementById("forgotPasswordNotice");
  if (notice) {
    notice.style.display = notice.style.display === "none" ? "block" : "none";
  }
};

// 5. Chuyển đổi giữa Đăng Nhập & Đăng Ký
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
    
    // Ẩn phần quên mật khẩu khi ở chế độ Đăng ký
    if (forgotPwGroup) forgotPwGroup.style.display = "none";
    if (forgotNotice) forgotNotice.style.display = "none";
  } else {
    if (title) title.textContent = "Đăng Nhập Tiệm Sách";
    if (confirmPwGroup) confirmPwGroup.style.display = "none";
    if (btnText) btnText.textContent = "Xác Nhận Đăng Nhập";
    if (switchText) switchText.textContent = "Chưa có thẻ độc giả?";
    if (switchBtn) switchBtn.textContent = "Đăng ký nhận thẻ";
    
    // Hiển thị lại phần quên mật khẩu khi ở chế độ Đăng nhập
    if (forgotPwGroup) forgotPwGroup.style.display = "block";
  }
}

// Tạo email ảo từ Username
function formatVirtualEmail(username) {
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  return `${cleanUsername}@tiemsach.local`;
}

// 6. Xử lý Đăng Ký / Đăng Nhập
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
      // 1. ĐĂNG KÝ
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
      // 2. ĐĂNG NHẬP
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

// 7. Tự động nén & Đổi ảnh Avatar
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

        // Cập nhật state chung của user hiện tại
        currentUser.user_metadata.avatar_url = compressedAvatarUrl;
        
        // 🌟 1. Cập nhật ngay lập tức cho ảnh lớn trên hộ chiếu trang Profile (#profilePageAvatar)
        const profilePageAvatar = document.getElementById("profilePageAvatar");
        if (profilePageAvatar) {
          profilePageAvatar.src = compressedAvatarUrl;
        }

        // 🌟 2. Cập nhật cho ảnh trong Modal (nếu có trên trang)
        const avatarModal = document.getElementById("userAvatarImg");
        if (avatarModal) {
          avatarModal.src = compressedAvatarUrl;
        }

        // 🌟 3. Cập nhật đồng bộ ảnh nhỏ trên thanh Navbar
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

// 8. Chỉnh sửa tên hiển thị Inline
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

  // Lấy tên cũ trước khi đổi để dùng làm điều kiện tìm kiếm cập nhật
  const oldName = currentUser.user_metadata?.display_name || 
                  (currentUser.email ? currentUser.email.split("@")[0] : "");

  try {
    // 1. Cập nhật tên trong Auth Metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });
    if (authError) throw authError;

    // 2. Cập nhật / Upsert vào bảng profiles
    await supabase
      .from("profiles")
      .upsert({
        user_id: currentUser.id,
        display_name: newName,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    // 3. ĐỒNG BỘ: Cập nhật tên tác giả trong bảng feedbacks
    if (oldName) {
      await supabase
        .from("feedbacks")
        .update({ author_name: newName })
        .eq("author_name", oldName);
    }

    // 4. ĐỒNG BỘ: Cập nhật tên tác giả trong bảng cfs_notes
    if (oldName) {
      await supabase
        .from("cfs_notes")
        .update({ author: newName })
        .or(`user_id.eq.${currentUser.id},author.eq.${oldName}`);
    }

    // 5. Cập nhật state & giao diện tại chỗ
    currentUser.user_metadata.display_name = newName;
    const profileNameEl = document.getElementById("profileDisplayName");
    if (profileNameEl) profileNameEl.textContent = newName;
    
    const profilePageNameEl = document.getElementById("profilePageDisplayName");
    if (profilePageNameEl) profilePageNameEl.textContent = newName;

    updateNavUserUI(currentUser);
    cancelEditName();
    
    // Tải lại feedback và cfs ngoài UI nếu có mặt trên trang
    await loadFeedbacks();
    await loadCfsNotes();

    showToast("Đã đổi tên và đồng bộ toàn bộ lời nhắn!", "success");
  } catch (err) {
    console.error("Lỗi đổi tên:", err);
    showToast("Không thể đổi tên, vui lòng thử lại!", "error");
  }
}

// 9. Đăng xuất
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

// Đồng bộ danh sách tim từ localStorage lên bảng user_favorites
async function syncAccountFavorites(user) {
  if (!user) return;
  const supabase = await getSupabase();
  if (!supabase) return;

  try {
    // 1. Lấy danh sách tim đang có trên thiết bị hiện tại
    let localLikes = getLocalLikedCharacters();

    // 2. Lấy danh sách tim đã lưu trên Supabase Cloud của tài khoản này
    const { data: cloudFavorites, error } = await supabase
      .from("user_favorites")
      .select("char_name")
      .eq("user_id", user.id);

    if (error) {
      console.warn("Lỗi đọc user_favorites từ Supabase:", error);
      return;
    }

    const cloudNames = cloudFavorites ? cloudFavorites.map((f) => f.char_name.trim()) : [];

    // 3. Hợp nhất hai danh sách (Loại bỏ trùng lặp)
    const mergedLikes = Array.from(new Set([...localLikes, ...cloudNames]));
    
    // Lưu danh sách đầy đủ vào lại localStorage của thiết bị
    localStorage.setItem("liked_characters", JSON.stringify(mergedLikes));

    // 4. Nếu có tim từ localStorage mà trên Supabase chưa có -> Tự động Insert lên Cloud
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

    // 5. Cập nhật lại giao diện để toàn bộ nút tim chuyển sang màu đỏ
    await syncCharacterVotes();
  } catch (err) {
    console.warn("Lỗi trong quá trình syncAccountFavorites:", err);
  }
}

// Đồng bộ tiến trình giải đố / nhận bằng chứng nhận
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
      // Nếu trên cloud đã có -> lưu vào localStorage
      localStorage.setItem("evans_diploma_unlocked", "true");
      if (data.solver_order) {
        localStorage.setItem("evans_solver_order", data.solver_order.toString());
      }
    } else if (isLocalUnlocked) {
      // Nếu trên máy đã mở khóa mà cloud chưa có -> đẩy lên Supabase
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

// 1. Kiểm tra ưu tiên: Theme thủ công > Theme hệ điều hành của máy > Giờ thực tế
function getSystemTheme() {
  // Kiểm tra cài đặt Darkmode của hệ thống thiết bị (Windows/Mac/iOS/Android)
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").media !== "not all") {
    return prefersDark ? "dark" : "light";
  }

  // Dự phòng theo giờ thực tế (6h - 18h là ngày)
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
  // Nếu người dùng chưa từng bấm nút chọn theme, tự động đồng bộ theo hệ điều hành của máy
  const activeTheme = savedTheme ? savedTheme : getSystemTheme();
  updateThemeUI(activeTheme);

  // Tự động lắng nghe khi người dùng đổi theme trên máy tính/điện thoại ngoài desktop
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      // Chỉ tự động đổi nếu người dùng chưa chọn thủ công
      if (!localStorage.getItem("evans_theme")) {
        updateThemeUI(e.matches ? "dark" : "light");
      }
    });
  }
}

// Hàm bấm nút chuyển đổi thủ công
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
// Khởi tạo toàn bộ dữ liệu trang profile.html
async function initProfilePage() {
  // Kiểm tra tồn tại giao diện Profile trên DOM thay vì chỉ check URL
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

// Hiển thị thông tin Hộ Chiếu & Tiêu đề Cuốn Sách Yêu Thích
const OWNER_USER_ID = "c836f3a3-eea1-41ff-8c89-df2a62eeb2b6"; // Nhập User UID của bạn vào đây

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

  // KIỂM TRA ĐẶC QUYỀN CHỦ TIỆM SÁCH EVANS
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

// Các hàm chỉnh sửa Tên Inline trên Profile
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
    // 1. Cập nhật Auth metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });
    if (authError) throw authError;

    // 2. Ghi đè / Upsert trực tiếp vào bảng profiles
    const { error: profileError } = await supabase.from("profiles").upsert({
      user_id: currentUser.id,
      display_name: newName,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });

    if (profileError) throw profileError;

    // 3. Đồng bộ tên mới sang bảng feedbacks & cfs_notes
    if (oldName) {
      await supabase.from("feedbacks").update({ author_name: newName }).eq("author_name", oldName);
      await supabase.from("cfs_notes").update({ author: newName }).or(`user_id.eq.${currentUser.id},author.eq.${oldName}`);
    }

    currentUser.user_metadata.display_name = newName;

    // Cập nhật lại UI lập tức
    await renderProfileInfo(currentUser);
    window.cancelEditName();
    updateNavUserUI(currentUser);

    showToast("Đã đổi tên và đồng bộ thành công!", "success");
  } catch (err) {
    console.error("Lỗi đổi tên:", err);
    showToast("Không thể đổi tên, vui lòng thử lại!", "error");
  }
};

// Các hàm chỉnh sửa Bio Inline trên Profile
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
    // 1. Cập nhật Auth metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: { bio: newBio }
    });
    if (authError) throw authError;

    // 2. Cập nhật bảng profiles
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

// Chuyển Tab trong Sổ Tay
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

// Tải danh sách Nhân vật yêu thích của tài khoản
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

  // Gán sự kiện mở modal cho mini card trong sổ tay
  container.querySelectorAll(".fav-char-mini-card").forEach((card) => {
    card.addEventListener("click", () => {
      const name = card.getAttribute("data-char-name");
      if (name) openBotModalByName(name);
    });
  });
}

// Bỏ thích trực tiếp từ trang Profile
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

// Tải danh sách Tâm thư CFS của người dùng
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
      // 1. Lấy thông tin từ bảng profiles (chỉ cần lấy các cột thực tế đang dùng)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("title, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      // 2. Kiểm tra tiến trình giải đố từ bảng puzzle_solvers
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

  // Dự phòng local
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

  // --- KIỂM TRA QUYỀN CHỦ TIỆM SÁCH ---
  const username = user.email ? user.email.split("@")[0] : "";
  const cleanUser = (username || "").toLowerCase().trim();
  const isOwner = (user && user.id && user.id.startsWith(OWNER_USER_ID)) || 
                  ["fevans", "evans", "iamevans"].includes(cleanUser);

  // --- TEMPLATE HUY HIỆU ---
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

  let finalMedalsHTML = "";
  if (isDiplomaUnlocked && solverOrder) {
    finalMedalsHTML += secretUnlockedHTML + memberMedalHTML;
  } else {
    finalMedalsHTML += memberMedalHTML + secretLockedHTML;
  }

  container.innerHTML = finalMedalsHTML;
}

// Xem lại bằng chứng nhận
window.viewSavedDiploma = function () {
  const name = currentUser?.user_metadata?.display_name || "Lữ khách";
  const order = localStorage.getItem("evans_solver_order") || "1";
  showDiplomaSuccess(name, order);
};

// ==================== HỆ THỐNG MẬT MÃ KHÓA NHÂN VẬT ====================
// Cấu hình đáp án, tiêu đề và Toast riêng biệt cho từng nhân vật
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

// Mở Modal Giải Mã
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

// Đóng Modal Giải Mã
window.closePuzzleModal = function() {
  const modal = document.getElementById("puzzleModal");
  if(modal) modal.classList.remove("active");
}

// Kiểm tra mã nhập vào và Thêm biến đếm số lần nhập sai riêng cho Dương Khắc Huy
let huyWrongAttempts = 0;

let puzzleVerifying = false;

// Đáp án và link thật chỉ nằm trên Supabase (supabase/001_puzzle_secrets.sql).
// Trình duyệt chỉ gửi đáp án lên để kiểm tra và nhận link về nếu đúng.
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
  } else if (result.error === "RATE_LIMITED") {
    showPuzzleError("Lữ khách thử hơi nhiều rồi, hãy nghỉ vài phút rồi quay lại nhé!");
  } else {
    input.classList.add("error-shake");
    setTimeout(() => input.classList.remove("error-shake"), 400);

    // Xử lý riêng cho Dương Khắc Huy tăng dần qua từng lần sai
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

// Hàm phụ trợ lấy toàn bộ trạng thái unlock hiện tại từ localStorage dưới dạng Object
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

// Hàm "Giải phóng Link": đắp link thật (nhận từ Supabase khi giải đúng) vào các nút đã khóa
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
    // Server chỉ trả link của những câu mà tài khoản này đã thật sự giải đúng
    const { data, error } = await supabase.rpc("get_my_puzzle_links");
    if (error) throw error;

    (data || []).forEach((row) => storePuzzleUnlock(row.puzzle_id, row.link));
    checkUnlockedPuzzles();
  } catch (err) {
    console.warn("Lỗi đồng bộ trạng thái puzzle tài khoản:", err);
  }
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
    // Chỉ sắp xếp dựa trên thời gian cập nhật link/thêm nhân vật (link_updated_at)
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
    
    // Kiểm tra xem thời gian cập nhật link có nằm trong vòng 15 ngày gần đây không
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

// Hàm tự động điền tên tài khoản vào các ô nhập tên (CFS và Feedback) nếu user đã đăng nhập
function autofillUserNames() {
  if (!currentUser) return;
  
  // Lấy tên hiển thị ưu tiên từ metadata hoặc email
  const displayName = currentUser.user_metadata?.display_name || 
                      (currentUser.email ? currentUser.email.split("@")[0] : "");

  if (!displayName) return;

  // 1. Tự động điền vào ô nhập tên của bảng CFS (trang chủ)
  const cfsAuthorInput = document.getElementById("cfsAuthorInput");
  if (cfsAuthorInput && !cfsAuthorInput.value.trim()) {
    cfsAuthorInput.value = displayName;
  }

  // 2. Tự động điền vào ô nhập tên trong Modal chi tiết nhân vật (#feedbackAuthor)
  const modalAuthorInput = document.getElementById("feedbackAuthor");
  if (modalAuthorInput && !modalAuthorInput.value.trim()) {
    modalAuthorInput.value = displayName;
  }

  // 3. Tự động điền vào tất cả các ô nhập tên Feedback ngoài card trên trang
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
    // 🌟 Lấy trực tiếp session hiện tại để nhận diện chính xác chủ tiệm ngay từ giây đầu tiên
    const { data: { session } } = await supabase.auth.getSession();
    const user = session ? session.user : null;

    const { data } = await supabase.from("settings").select("value").eq("key", "maintenance").maybeSingle();
    
    if (data && data.value === true) {
      const email = user?.email || "";
      const username = email.split("@")[0].toLowerCase();
      const cleanUser = username.trim();
      
      // Kiểm tra đặc quyền chủ tiệm
      const isOwner = (user && user.id && user.id.startsWith(OWNER_USER_ID)) || 
                      ["fevans", "evans", "iamevans"].includes(cleanUser);

      // Nếu không phải chủ tiệm thì mới hiển thị màn hình bảo trì
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

        if (typeof initDustParticles === "function") {
          initDustParticles();
        }
        
        // Dừng toàn bộ các tiến trình tiếp theo của trang khi đang bảo trì
        throw new Error("Website is under maintenance.");
      }
    }
  } catch (err) {
    if (err.message !== "Website is under maintenance.") {
      console.warn("Lỗi kiểm tra trạng thái bảo trì:", err);
    }
  }
}
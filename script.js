const SUPABASE_URL =
  window.SUPABASE_URL || "https://yvngwbeprfcesjdnjwzh.supabase.co";
const SUPABASE_ANON_KEY =
  window.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2bmd3YmVwcmZjZXNqZG5qd3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDIzOTgsImV4cCI6MjEwMDcxODM5OH0.hEiP2gTcg0yU4HFBlUpmzcXQ3sydx0HxvG3ZbByjiUQ";

let _supabaseInstance = null;

// Hàm kiểm tra và chờ thư viện Supabase CDN nạp hoàn tất (chờ tối đa 3 giây)
async function getSupabase() {
  if (_supabaseInstance) return _supabaseInstance;

  let retries = 30; // Chờ tối đa 30 lần x 100ms = 3 giây
  while (
    retries > 0 &&
    (typeof window.supabase === "undefined" || !window.supabase.createClient)
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    retries--;
  }

  if (typeof window.supabase !== "undefined" && window.supabase.createClient) {
    _supabaseInstance = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    );
    return _supabaseInstance;
  }

  console.warn("⚠️ Thư viện Supabase CDN chưa nạp kịp sau 3 giây.");
  return null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = await getSupabase();
  if (supabase) {
    console.log("Supabase đã sẵn sàng!");
  }

  await syncCharacterVotes();
  loadRandomDailyQuote();
  loadTopRanking();
  loadCfsNotes();
  initColorPicker();
  initSearchAndFilter();
  initModal();
  initBackToTop();
  displayRandomCharacter();
  initGlobalListeners();
  initAjaxNavigation();
  initMusicPlayer();
  initMenuToggle();
  initCatMascot();
});

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
        text: "Hôm nay nếu có mệt mỏi quá, cứ nghỉ ngơi đi nhé. Mọi chuyện rồi sẽ ổn thôi.",
        author: "Khương Tịch Ngôn",
      },
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
      e.target.closest("#modalVoteCount")?.parentElement;
    if (likeBtn) {
      e.preventDefault();
      e.stopPropagation();
      window.toggleLike(likeBtn);
    }
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
    if (trackTitle) trackTitle.textContent = track.title;
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

    const navMenu = document.getElementById("navMenu");
    const menuToggle = document.getElementById("menuToggle");
    const musicPlayer = document.getElementById("musicPlayer");

    if (navMenu && navMenu.classList.contains("show")) {
      navMenu.classList.remove("show");
      menuToggle?.classList.remove("active");
      if (musicPlayer) {
        musicPlayer.classList.remove("hidden-by-menu");
      }
    }

    loadPageViaAjax(href);
  });

  window.addEventListener("popstate", () => {
    const path = window.location.pathname.split("/").pop() || "index.html";
    loadPageViaAjax(path, false);
  });
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

    setTimeout(() => {
      mainContent.innerHTML = newMain.innerHTML;
      if (newTitle) document.title = newTitle.textContent;

      if (pushHistory) {
        window.history.pushState({ path: url }, "", url);
      }

      reinitializePageScripts();

      mainContent.style.opacity = "1";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
  } catch (error) {
    console.error("Lỗi chuyển trang AJAX:", error);
    window.location.href = url;
  }
}

function reinitializePageScripts() {
  syncCharacterVotes();
  loadTopRanking();
  loadCfsNotes();
  initColorPicker();
  initSearchAndFilter();
  initModal();
  displayRandomCharacter();
  initCatMascot();
  loadRandomDailyQuote();
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
      const desc =
        card.querySelector(".bot-desc")?.textContent.toLowerCase() || "";

      const matchesSearch =
        name.includes(searchTerm) ||
        tags.includes(searchTerm) ||
        desc.includes(searchTerm);

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
let activeCardElement = null;

function initModal() {
  const modal = document.getElementById("botModal");
  const modalClose = document.getElementById("modalClose");
  const botCards = document.querySelectorAll(".bot-card");

  if (!modal) return;

  botCards.forEach((card) => {
    card.addEventListener("click", (e) => {
      if (
        e.target.closest(".chip-btn") ||
        e.target.closest(".bot-actions") ||
        e.target.closest(".feedback-section") ||
        e.target.closest(".btn-like")
      ) {
        return;
      }

      if (
        card.dataset.secret === "true" ||
        card.classList.contains("secret-cat-card")
      ) {
        e.stopPropagation();
        return;
      }

      activeCardElement = card;

      const name = card.querySelector(".bot-name")?.textContent || "Tên Sách";
      const tags = card.querySelector(".bot-tags")?.textContent || "Thể loại";
      const toc = card.getAttribute("data-toc") || "Chưa có thông tin mục lục.";
      const opening = card.getAttribute("data-opening") || "";
      const chipsHTML = card.querySelector(".bot-chips")?.innerHTML || "";
      const likeCount = card.querySelector(".like-count")?.textContent || "0";
      const isLiked =
        card.querySelector(".btn-like")?.classList.contains("liked") || false;

      const modalTitle = document.getElementById("modalTitle");
      const modalSubtitle = document.getElementById("modalSubtitle");
      const modalToc = document.getElementById("modalToc");
      const modalOpeningScenes = document.getElementById("modalOpeningScenes");
      const openingSectionBox = document.getElementById("openingSectionBox");
      const modalChipsContainer = document.getElementById(
        "modalChipsContainer",
      );
      const modalVoteCount = document.getElementById("modalVoteCount");

      if (modalTitle) modalTitle.textContent = name;
      if (modalSubtitle) modalSubtitle.textContent = tags;
      if (modalToc) modalToc.innerHTML = toc;

      if (openingSectionBox && modalOpeningScenes) {
        if (opening) {
          openingSectionBox.style.display = "block";
          modalOpeningScenes.innerHTML = opening;
        } else {
          openingSectionBox.style.display = "none";
        }
      }

      if (modalChipsContainer) modalChipsContainer.innerHTML = chipsHTML;

      if (modalVoteCount) {
        modalVoteCount.textContent = likeCount;
        const parentBtn =
          modalVoteCount.closest("button") || modalVoteCount.parentElement;
        if (parentBtn) {
          parentBtn.classList.add("like-btn");
          parentBtn.style.cursor = "pointer";
          parentBtn.classList.toggle("liked", isLiked);
        }
      }

      modal.classList.add("show");
    });
  });

  modalClose?.addEventListener("click", () => {
    modal.classList.remove("show");
    activeCardElement = null;
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("show");
      activeCardElement = null;
    }
  });
}

// ==================== XỬ LÝ MỞ MODAL CHI TIẾT NHÂN VẬT ====================
window.openBotModalByName = async function (name) {
  const cards = document.querySelectorAll(".bot-card");

  // Trường hợp 1: Nếu đang ở characters.html (tìm thấy thẻ .bot-card trực tiếp)
  if (cards.length > 0) {
    for (const card of cards) {
      const cardName = card.querySelector(".bot-name")?.textContent.trim();
      if (cardName === name) {
        card.click();
        return;
      }
    }
  }

  // Trường hợp 2: Nếu đang ở index.html (không có thẻ .bot-card trên DOM)
  const characters = await getAllCharacters();
  const char = characters.find((c) => c.name === name);
  if (!char) return;

  const modal = document.getElementById("botModal");
  if (!modal) return;

  const modalTitle = document.getElementById("modalTitle");
  const modalSubtitle = document.getElementById("modalSubtitle");
  const modalToc = document.getElementById("modalToc");
  const modalOpeningScenes = document.getElementById("modalOpeningScenes");
  const openingSectionBox = document.getElementById("openingSectionBox");
  const modalChipsContainer = document.getElementById("modalChipsContainer");
  const modalVoteCount = document.getElementById("modalVoteCount");

  if (modalTitle) modalTitle.textContent = char.name;
  if (modalSubtitle) modalSubtitle.textContent = char.title || "";
  if (modalToc) modalToc.innerHTML = char.toc || "Chưa có thông tin mục lục.";

  if (openingSectionBox && modalOpeningScenes) {
    if (char.opening) {
      openingSectionBox.style.display = "block";
      modalOpeningScenes.innerHTML = char.opening;
    } else {
      openingSectionBox.style.display = "none";
    }
  }

  if (modalChipsContainer) modalChipsContainer.innerHTML = char.chipsHTML || "";
  if (modalVoteCount) modalVoteCount.textContent = char.votes || 0;

  modal.classList.add("show");
};

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

  // 4. Lưu tổng lượt vote mới lên Supabase
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("characters")
      .update({ votes: count })
      .eq("name", charName)
      .select();

    if (error) {
      console.error("❌ Lỗi Supabase khi lưu tim:", error);
    } else {
      loadTopRanking();
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

// FEEDBACK SUBMISSION LOGIC

window.toggleFeedback = async function (btn) {
  const card = btn.closest(".bot-card");
  const feedbackSec = card?.querySelector(".feedback-section");
  const charName = card?.querySelector(".bot-name")?.textContent.trim();

  if (feedbackSec) {
    const isHidden =
      feedbackSec.style.display === "none" || !feedbackSec.style.display;
    feedbackSec.style.display = isHidden ? "block" : "none";

    // Nếu mở ô feedback ra thì tải dữ liệu từ Supabase về
    if (isHidden && charName) {
      await loadFeedbacks(charName, feedbackSec);
    }
  }
};

window.sendFeedback = async function (btn) {
  const box = btn.closest(".feedback-input-box");
  const nameInput = box?.querySelector(".input-name");
  const contentInput = box?.querySelector(".input-content");
  const feedbackSec = box?.closest(".feedback-section");
  const feedbackList = feedbackSec?.querySelector(".feedback-list");

  // Tìm tên nhân vật
  const card = btn.closest(".bot-card");
  let charName = card?.querySelector(".bot-name")?.textContent.trim();
  if (!charName) {
    charName = document.getElementById("modalTitle")?.textContent.trim();
  }

  const name = nameInput?.value.trim() || "Lữ khách ẩn danh";
  const content = contentInput?.value.trim();

  if (!content) {
    showToast("Bạn quên nhập nội dung rồi!", "error");
    return;
  }

  if (!charName) {
    showToast("Không xác định được tên nhân vật!", "error");
    return;
  }

  btn.disabled = true;

  const supabase = await getSupabase();
  if (supabase) {
    // Đẩy dữ liệu lên bảng 'feedbacks' của Supabase
    const { error } = await supabase.from("feedbacks").insert([
      {
        char_name: charName,
        author_name: name,
        content: content,
      },
    ]);

    if (error) {
      console.error("❌ Lỗi gửi feedback lên Supabase:", error);
      showToast("Gửi đánh giá thất bại, vui lòng thử lại!", "error");
      btn.disabled = false;
      return;
    }
  }

  // Nếu trong danh sách đang hiện thông báo "Chưa có lời cảm nhận..." thì xóa dòng đó đi
  if (feedbackList?.querySelector("em")) {
    feedbackList.innerHTML = "";
  }

  // Thêm ngay dòng vừa gửi vào giao diện
  const newItem = document.createElement("div");
  newItem.className = "feedback-item";
  newItem.innerHTML = `<strong>${escapeHTML(name)}:</strong> ${escapeHTML(content)}`;
  feedbackList?.appendChild(newItem);

  if (nameInput) nameInput.value = "";
  if (contentInput) contentInput.value = "";
  showToast("Gửi đánh giá thành công!", "success");

  btn.disabled = false;
};

// ==================== TẢI FEEDBACK TỪ SUPABASE ====================
async function loadFeedbacks(charName, feedbackSection) {
  if (!charName || !feedbackSection) return;

  const feedbackList = feedbackSection.querySelector(".feedback-list");
  if (!feedbackList) return;

  const supabase = await getSupabase();
  if (!supabase) return;

  // Lấy dữ liệu từ bảng 'feedbacks' trên Supabase
  const { data, error } = await supabase
    .from("feedbacks")
    .select("*")
    .eq("char_name", charName)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Lỗi lấy feedback từ Supabase:", error);
    return;
  }

  // Xóa danh sách cũ/mẫu
  feedbackList.innerHTML = "";

  if (!data || data.length === 0) {
    feedbackList.innerHTML = `<div class="feedback-item"><em>Chưa có lời cảm nhận nào. Hãy là người đầu tiên!</em></div>`;
    return;
  }

  // Đổ dữ liệu từ Supabase ra giao diện
  data.forEach((item) => {
    const newItem = document.createElement("div");
    newItem.className = "feedback-item";
    newItem.innerHTML = `<strong>${escapeHTML(item.author_name || "Lữ khách ẩn danh")}:</strong> ${escapeHTML(item.content)}`;
    feedbackList.appendChild(newItem);
  });
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
      navMenu.classList.remove("show");
      menuToggle?.classList.remove("active");
      if (musicPlayer) musicPlayer.classList.remove("hidden-by-menu");
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
async function getAllCharacters() {
  const supabase = await getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from("characters").select("*");

      if (error) {
        console.error("❌ Lỗi SELECT Supabase:", error);
      } else if (data && data.length > 0) {
        console.log("✅ Đã lấy thành công danh sách từ Supabase:", data);
        return data;
      } else {
        console.warn(
          "⚠️ Bảng 'characters' trên Supabase đang trống (chưa có hàng nào).",
        );
      }
    } catch (err) {
      console.warn("Lỗi kết nối Supabase:", err);
    }
  }

  // Dự phòng: Đọc từ characters.html nếu Supabase lỗi hoặc chưa có dữ liệu
  try {
    const res = await fetch("characters.html");
    if (!res.ok) return [];
    const htmlText = await res.text();
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const cards = doc.querySelectorAll(".bot-card");

    const list = [];
    cards.forEach((card) => {
      const name = card.querySelector(".bot-name")?.textContent.trim() || "";
      const title =
        card.querySelector(".bot-tags")?.textContent.trim() || "Nhân vật";
      const votesText =
        card.querySelector(".like-count")?.textContent.trim() || "0";
      const votes = parseInt(votesText, 10) || 0;
      const toc = card.getAttribute("data-toc") || "";
      const opening = card.getAttribute("data-opening") || "";
      const chipsHTML = card.querySelector(".bot-chips")?.innerHTML || "";

      if (name) {
        list.push({ name, title, votes, toc, opening, chipsHTML });
      }
    });
    return list;
  } catch (err) {
    console.error("Lỗi đọc dữ liệu dự phòng từ characters.html:", err);
    return [];
  }
}

// ==================== ĐỒNG BỘ LƯỢT VOTE TỪ SUPABASE VÀO THẺ NHÂN VẬT ====================
async function syncCharacterVotes() {
  const cards = document.querySelectorAll(".bot-card");
  if (cards.length === 0) return;

  const characters = await getAllCharacters();
  if (!characters || characters.length === 0) return;

  const voteMap = new Map();
  characters.forEach((char) => {
    if (char.name) voteMap.set(char.name.trim(), char.votes || 0);
  });

  // Lấy danh sách các nhân vật người dùng đã bấm thích trên thiết bị này
  const userLikedList = getLocalLikedCharacters();

  cards.forEach((card) => {
    const nameEl = card.querySelector(".bot-name");
    const countEl = card.querySelector(".like-count");
    const likeBtn = card.querySelector(".btn-like");

    if (nameEl) {
      const charName = nameEl.textContent.trim();

      // Cập nhật số lượt vote tổng từ Supabase
      if (countEl && voteMap.has(charName)) {
        countEl.textContent = voteMap.get(charName);
      }

      // Khôi phục màu đỏ cho nút tim nếu thiết bị này đã từng vote
      if (likeBtn) {
        const isLikedOnDevice = userLikedList.includes(charName);
        likeBtn.classList.toggle("liked", isLikedOnDevice);
      }
    }
  });
}

// ==================== BẢNG XẾP HẠNG TOP 3 ====================
async function loadTopRanking() {
  const container = document.getElementById("topRankingContainer");
  if (!container) return;

  container.innerHTML = `<span style="font-size: 0.9rem; opacity: 0.7;">Đang tải xếp hạng...</span>`;

  const characters = await getAllCharacters();

  if (!characters || characters.length === 0) {
    container.innerHTML = `<span style="font-size: 0.9rem; opacity: 0.7;">Chưa có dữ liệu xếp hạng.</span>`;
    return;
  }

  // Sắp xếp theo số lượt thích giảm dần và lấy 3 nhân vật đầu tiên
  const sorted = [...characters]
    .sort((a, b) => (b.votes || 0) - (a.votes || 0))
    .slice(0, 3);

  container.innerHTML = sorted
    .map((char, index) => {
      const rank = index + 1;
      let badgeHTML = `<i class="bi bi-award-fill"></i> Top ${rank}`;
      if (rank === 1) badgeHTML = `<i class="bi bi-trophy-fill"></i> Top 1`;

      return `
        <div class="ranking-card rank-${rank}" style="cursor: pointer;" onclick="openBotModalByName('${escapeHTML(char.name)}')">
          <span class="rank-badge">${badgeHTML}</span>
          <div class="rank-info">
            <h4 class="char-name">${escapeHTML(char.name)}</h4>
            <span class="char-title">${escapeHTML(char.title || "Nhân vật")}</span>
            <span class="vote-count">❤️ ${char.votes || 0} lượt thích</span>
          </div>
        </div>
      `;
    })
    .join("");
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
      const randomChar =
        characters[Math.floor(Math.random() * characters.length)];
      container.innerHTML = `
        <div class="random-card-content" style="cursor: pointer;" onclick="openBotModalByName('${escapeHTML(randomChar.name)}')">
          <h4 class="random-char-name">${escapeHTML(randomChar.name)}</h4>
          <div class="random-char-stats">
            <div class="random-likes"><i class="bi bi-heart-fill"></i> ${randomChar.votes || 0} lượt thích</div>
            <div class="random-feedbacks"><i class="bi bi-chat-quote-fill"></i> ${escapeHTML(randomChar.title || "Nhân vật")}</div>
          </div>
        </div>
      `;
    }
    container.classList.remove("fade-out");
  }, 300);
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

  const author = authorInput?.value.trim() || "Lữ khách ẩn danh";
  const content = contentInput?.value.trim();
  const color = colorInput ? colorInput.value : "#fff2b2";

  if (!content) {
    showToast("Bạn quên chưa viết nội dung tâm thư (cfs) rồi!", "error");
    contentInput?.focus();
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  // 1. Dán tờ note lên bảng ngay lập tức trên giao diện
  const cfsBoard = document.getElementById("cfsBoard");
  if (cfsBoard && cfsBoard.querySelector("div[style*='italic']")) {
    cfsBoard.innerHTML = "";
  }

  const noteEl = document.createElement("div");
  noteEl.className = "cfs-note-item sticky-note";
  noteEl.style.backgroundColor = color;
  noteEl.innerHTML = `
    <p class="note-content">"${escapeHTML(content)}"</p>
    <span class="note-author">— ${escapeHTML(author)}</span>
  `;
  cfsBoard?.prepend(noteEl);

  // 2. Thử lưu vào Supabase (nếu lỗi chỉ thông báo console, không chặn Modal)
  const supabase = await getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("cfs_notes")
      .insert([{ author: author, content: content, bg_color: color }]);
    if (error) console.error("❌ Lỗi lưu Supabase:", error);
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
      <strong style="font-size: 0.95rem;">Cảm ơn ${author || "Lữ khách"}!</strong>
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
    noteEl.className = "cfs-note-item sticky-note";
    noteEl.style.backgroundColor = note.bg_color || "#fff2b2";
    noteEl.innerHTML = `
      <p class="note-content">"${escapeHTML(note.content)}"</p>
      <span class="note-author">— ${escapeHTML(note.author || "Lữ khách ẩn danh")}</span>
    `;
    cfsBoard.appendChild(noteEl);
  });
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

    // Lưu vào Supabase & lấy ID (#STT)
    // Đếm số người hiện có + Insert vào Supabase
    const supabase = await getSupabase();
    if (supabase) {
      try {
        // Bước 1: Đếm chính xác số lượt đã lưu trong bảng puzzle_solvers
        const { count, error: countError } = await supabase
          .from("puzzle_solvers")
          .select("*", { count: "exact", head: true });

        if (countError) {
          console.error("❌ Lỗi khi đếm lượt giải:", countError);
        }

        // Số thứ tự của người hiện tại = Tổng số đang có + 1
        // (Ví dụ: Đã xóa hết dữ liệu test -> count = 0 -> solverOrder = 1)
        solverOrder = (count || 0) + 1;

        // Bước 2: Chèn tên người chơi mới vào database
        const { error: insertError } = await supabase
          .from("puzzle_solvers")
          .insert([{ player_name: playerName }]);

        if (insertError) {
          console.error(
            "❌ Lỗi khi lưu người giải mã vào Supabase:",
            insertError,
          );
        }
      } catch (err) {
        console.error("❌ Lỗi kết nối Supabase:", err);
      }
    }

    closeDiplomaModal();
    if (confirmBtn) confirmBtn.disabled = false;

    // Hiển thị Giấy chứng nhận
    showDiplomaSuccess(playerName, solverOrder);
  } else {
    wrongAttempts++; // Tăng số lần nhập sai

    // Rung lắc ô input báo lỗi
    if (input) {
      input.classList.add("error-shake");
      setTimeout(() => input.classList.remove("error-shake"), 400);
    }

    // Xử lý hiển thị Gợi ý / Mật mã theo số lần sai
    if (hintEl) {
      if (wrongAttempts >= 10) {
        // Sai từ 10 lần trở lên -> Hiển thị thẳng đáp án
        hintEl.innerHTML = `🔑 <b>Đáp án chính xác là:</b> <code style="color: #d4af37; font-weight: bold; font-size: 1.1rem;">613HimitsuEUREKA</code>`;
      } else if (wrongAttempts >= 3) {
        // Sai từ 3 đến 9 lần -> Cho gợi ý cấu trúc
        hintEl.innerHTML = `<❌ Đáp án chưa đúng (Sai ${wrongAttempts}/10 lần). Cố lên nào!<br>💡 <b>Gợi ý:</b> Đáp án có định dạng <i>Số + Chữ + Chữ</i> !`;
      } else {
        // Sai dưới 3 lần -> Báo sai chung
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

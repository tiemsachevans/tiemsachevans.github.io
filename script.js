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
  initThemeMode();
  await initProfilePage();
  const supabase = await getSupabase();
  if (supabase) {
    console.log("Supabase đã sẵn sàng!");
  }

  await syncCharacterVotes();
  await loadFeedbacks();
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
  initDustParticles();
  checkUserSession();
  checkUnlockedPuzzles();
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

  // Sự kiện gửi feedback trực tiếp trong Modal
  document
    .getElementById("submitFeedbackBtn")
    ?.addEventListener("click", async () => {
      const authorInput = document.getElementById("feedbackAuthor");
      const contentInput = document.getElementById("feedbackContent");
      const currentTitle = document
        .getElementById("modalTitle")
        ?.textContent.trim();

      const author = authorInput?.value.trim() || "Lữ khách ẩn danh";
      const content = contentInput?.value.trim();

      if (!content) {
        showToast("Vui lòng nhập nội dung cảm nhận!", "error");
        return;
      }

      // 1. Tạo phần tử feedback HTML mới
      const newFeedbackHTML = `
    <div class="feedback-item">
      <strong>${escapeHTML(author)}:</strong> ${escapeHTML(content)}
    </div>
  `;

      // 2. Cập nhật giao diện Cột Phải trong Modal
      const modalList = document.getElementById("dynamicFeedbackList");
      if (modalList) {
        const noFeedbackText = modalList.querySelector(".no-feedback-text");
        if (noFeedbackText) noFeedbackText.remove();
        modalList.insertAdjacentHTML("afterbegin", newFeedbackHTML);
      }

      // 3. Cập nhật song song vào Card ngoài giao diện chính
      const allCards = document.querySelectorAll(".bot-card");
      allCards.forEach((card) => {
        const cardName = card.querySelector(".bot-name")?.textContent.trim();
        if (cardName === currentTitle) {
          const cardFeedbackList = card.querySelector(".feedback-list");
          if (cardFeedbackList) {
            cardFeedbackList.insertAdjacentHTML("afterbegin", newFeedbackHTML);
          }
        }
      });

      // 4. Lưu dữ liệu lên Supabase
      const supabase = await getSupabase();
      if (supabase && currentTitle) {
        await supabase
          .from("feedbacks")
          .insert([
            { char_name: currentTitle, author_name: author, content: content },
          ]);
      }

      // Reset ô nhập & thông báo
      if (authorInput) authorInput.value = "";
      if (contentInput) contentInput.value = "";
      showToast("Gửi đánh giá thành công!", "success");
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

    // Đóng hoàn toàn menu và gỡ khóa scroll trước khi chuyển trang
    closeMobileMenu();

    loadPageViaAjax(href);
  });

  window.addEventListener("popstate", () => {
    closeMobileMenu();
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
  initDustParticles();
  checkUnlockedPuzzles();
  
  if (document.querySelector(".profile-page-container")) {
    initProfilePage();
  }
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
  // 1. GATEKEEPER: TỰ ĐỘNG CHẶN KHI BẤM VÀO CÁC NÚT ĐANG GIẤU LINK
  document.addEventListener("click", (e) => {
    // Chỉ kích hoạt khi click vào một cái nút có chứa thuộc tính data-real-href
    const lockedBtn = e.target.closest("a[data-real-href]");
    
    if (lockedBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Lấy trực tiếp ID puzzle từ chính cái nút đó
      const puzzleId = lockedBtn.dataset.puzzleId || "delmare";
      openPuzzleModal(puzzleId);
    }
  }, true);

  // 2. LOGIC MỞ BẢNG THÔNG TIN NHÂN VẬT (Bấm vào vùng trống của thẻ)
  document.addEventListener("click", async (e) => {
    const modal = document.getElementById("botModal");
    if (e.target.closest("#modalClose") || (modal && e.target === modal)) {
      modal.classList.remove("show");
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

  // 3. TÍNH NĂNG BẤM RA NGOÀI ĐỂ TẮT BẢNG CÂU ĐỐ
  document.addEventListener("click", (e) => {
    const puzzleModal = document.getElementById("puzzleModal");
    // Nếu bảng câu đố đang mở và người dùng click vào vùng nền mờ (overlay)
    if (puzzleModal && puzzleModal.classList.contains("active")) {
      if (e.target === puzzleModal) {
        closePuzzleModal();
      }
    }
  });
}

// Bổ sung quét lại thẻ khóa sau khi Modal thông tin nhân vật vừa tải xong
window.openBotModalByName = async function (name) {
  /* ... Giữ nguyên toàn bộ logic mở modal hiện tại của bạn ... */
  const modal = document.getElementById("botModal");
  if (!modal) return;

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
    
    // GỌI HÀM QUÉT KIỂM TRA MỞ KHÓA NGAY SAU KHI MODAL TẠO XONG NÚT
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

    // 2. Mở Modal
    modal.classList.add("show");

    // 3. Tải feedback
    await syncModalFeedbacksByName(char.name);
  } else {
    console.error("Không tìm thấy thông tin cho nhân vật:", name);
  }
};

// Hàm tải feedback trực tiếp theo tên nhân vật vào Modal
async function syncModalFeedbacksByName(charName) {
  const modalFeedbackList = document.getElementById("dynamicFeedbackList");
  if (!modalFeedbackList) return;

  modalFeedbackList.innerHTML = `<span style="font-size:0.85rem; opacity:0.7; font-style:italic;">Đang tải cảm nhận...</span>`;

  try {
    const supabase = await getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("feedbacks")
        .select("*")
        .eq("char_name", charName)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        modalFeedbackList.innerHTML = data.map((fb) => `
          <div class="feedback-item">
            <strong>${escapeHTML(fb.author_name || "Lữ khách ẩn danh")}:</strong> ${escapeHTML(fb.content)}
          </div>
        `).join("");
        return;
      }
    }
  } catch (err) {
    console.warn("Lỗi tải feedback:", err);
  }

  modalFeedbackList.innerHTML = `
    <p class="no-feedback-text">
      Chưa có lời nhắn nào cho ${escapeHTML(charName)}. Hãy là người đầu tiên gửi feedback!
    </p>
  `;
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

// FEEDBACK SUBMISSION LOGIC
window.toggleFeedback = async function (btn) {
  const card = btn.closest(".bot-card");
  const feedbackSec = card?.querySelector(".feedback-section");

  if (feedbackSec) {
    const isHidden =
      feedbackSec.style.display === "none" || !feedbackSec.style.display;
    feedbackSec.style.display = isHidden ? "block" : "none";

    // Nếu mở ô feedback ra thì tải lại dữ liệu từ Supabase về
    if (isHidden) {
      await loadFeedbacks();
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

  const loggedInName = currentUser?.user_metadata?.display_name;
  const author = loggedInName || nameInput?.value.trim() || "Lữ khách ẩn danh";
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
async function loadFeedbacks() {
  const supabase = await getSupabase();
  if (!supabase) return;

  try {
    // 1. Lấy tất cả feedback từ Supabase (sắp xếp mới nhất lên đầu)
    const { data: feedbacks, error } = await supabase
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Lỗi khi tải feedback từ Supabase:", error);
      return;
    }

    if (!feedbacks || feedbacks.length === 0) return;

    // 2. Duyệt qua từng bot-card trên trang để chèn feedback tương ứng
    const botCards = document.querySelectorAll(".bot-card");

    botCards.forEach((card) => {
      const charNameEl = card.querySelector(".bot-name");
      if (!charNameEl) return;

      const charName = charNameEl.textContent.trim();
      const feedbackListEl = card.querySelector(".feedback-list");

      if (!feedbackListEl) return;

      // Lọc các feedback thuộc về nhân vật này
      const charFeedbacks = feedbacks.filter(
        (item) => item.char_name === charName,
      );

      if (charFeedbacks.length > 0) {
        // Xóa feedback mẫu cứng trên HTML
        feedbackListEl.innerHTML = "";

        // Chèn danh sách feedback thực tế từ Supabase
        charFeedbacks.forEach((item) => {
          const itemEl = document.createElement("div");
          itemEl.className = "feedback-item";
          itemEl.innerHTML = `<strong>${escapeHTML(item.author_name || "Lữ khách ẩn danh")}:</strong> ${escapeHTML(item.content)}`;
          feedbackListEl.appendChild(itemEl);
        });
      }
    });
  } catch (err) {
    console.warn("Lỗi loadFeedbacks:", err);
  }
}

// ==================== HIỆU ỨNG HẠT BỤI BAY TOÀN MÀN HÌNH ====================
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
async function getAllCharacters() {
  const supabase = await getSupabase();
  let cloudCharacters = [];

  // 1. Luôn truy vấn dữ liệu mới nhất (đặc biệt là cột votes) từ Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase.from("characters").select("*");
      if (!error && data && data.length > 0) {
        cloudCharacters = data;
      }
    } catch (err) {
      console.warn("Lỗi kết nối Supabase:", err);
    }
  }

  // 2. Lấy thêm thông tin chi tiết (Mục lục, trích đoạn, chips) từ characters.html nếu Supabase thiếu cột
  let htmlCharacters = [];
  const domCards = document.querySelectorAll(".bot-card:not(.secret-cat-card)");

  if (domCards.length > 0) {
    domCards.forEach((card) => {
      const name = card.querySelector(".bot-name")?.textContent.trim() || "";
      const title = card.querySelector(".bot-tags")?.textContent.trim() || "";
      const toc = card.getAttribute("data-toc") || "";
      const opening = card.getAttribute("data-opening") || "";
      const chipsHTML = card.querySelector(".bot-chips")?.innerHTML || "";
      if (name && name !== "Coming Soon...") {
        htmlCharacters.push({ name, title, toc, opening, chipsHTML });
      }
    });
  } else {
    try {
      const res = await fetch("characters.html");
      if (res.ok) {
        const htmlText = await res.text();
        const doc = new DOMParser().parseFromString(htmlText, "text/html");
        const cards = doc.querySelectorAll(".bot-card:not(.secret-cat-card)");
        cards.forEach((card) => {
          const name = card.querySelector(".bot-name")?.textContent.trim() || "";
          const title = card.querySelector(".bot-tags")?.textContent.trim() || "";
          const toc = card.getAttribute("data-toc") || "";
          const opening = card.getAttribute("data-opening") || "";
          const chipsHTML = card.querySelector(".bot-chips")?.innerHTML || "";
          if (name && name !== "Coming Soon...") {
            htmlCharacters.push({ name, title, toc, opening, chipsHTML });
          }
        });
      }
    } catch (err) {
      console.warn("Lỗi đọc file characters.html:", err);
    }
  }

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
    const isHolo = note.bg_color === "hologram";
    noteEl.className = `cfs-note-item sticky-note ${isHolo ? "hologram-note" : ""}`;
    
    if (!isHolo) {
      noteEl.style.backgroundColor = note.bg_color || "#fff2b2";
    }

    noteEl.innerHTML = `
      <p class="note-content">"${escapeHTML(note.content)}"</p>
      <span class="note-author">— ${escapeHTML(note.author || "Lữ khách ẩn danh")}</span>
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
        <img src="${avatar}" class="nav-auth-avatar-mini" alt="Avatar" />
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

      if (currentUser) {
        await supabase.from("profiles").upsert({
          id: currentUser.id,
          display_name: rawUsername,
          avatar_url: "./images/default_avt.jpg",
          updated_at: new Date().toISOString()
        });
      }

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

      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", currentUser.id)
          .maybeSingle();

        const nameToSave = profile?.display_name || currentUser.user_metadata?.display_name || rawUsername;
        
        await supabase.from("profiles").upsert({
          id: currentUser.id,
          display_name: nameToSave,
          avatar_url: currentUser.user_metadata?.avatar_url || "./images/default_avt.jpg",
          updated_at: new Date().toISOString()
        });
      }

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
            id: currentUser.id,
            avatar_url: compressedAvatarUrl,
            updated_at: new Date().toISOString()
          });

        currentUser.user_metadata.avatar_url = compressedAvatarUrl;
        
        const avatarModal = document.getElementById("userAvatarImg");
        if (avatarModal) avatarModal.src = compressedAvatarUrl;

        // 🌟 Bổ sung cập nhật ngay lập tức cho ảnh đại diện trên trang Hồ sơ / Hộ chiếu
        const profilePageAvatar = document.getElementById("profilePageAvatar");
        if (profilePageAvatar) profilePageAvatar.src = compressedAvatarUrl;

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
        id: currentUser.id,
        display_name: newName,
        updated_at: new Date().toISOString()
      });

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
        .eq("id", user.id)
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
      id: currentUser.id,
      display_name: newName,
      updated_at: new Date().toISOString()
    });
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
      id: currentUser.id,
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
      <div class="cfs-note-item sticky-note ${isHolo ? "hologram-note" : ""}" style="${!isHolo ? `background-color: ${note.bg_color || '#fff2b2'};` : ''}">
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
  let customBadges = []; // Danh hiệu tùy chỉnh từ bảng profiles

  if (supabase && user) {
    try {
      // 1. Lấy thông tin badges & title từ bảng profiles
      const { data: profileData } = await supabase
        .from("profiles")
        .select("title, badges, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData && Array.isArray(profileData.badges)) {
        customBadges = profileData.badges;
      }

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

  // --- TEMPLATE HUY HIỆU ---
  // 1. Kẻ Vén Màn Bí Mật
  const secretUnlockedHTML = `
    <div class="showcase-medal-card unlocked-secret" onclick="viewSavedDiploma()" title="Nhấp để xem lại Bằng Chứng Nhận">
      <div class="medal-emblem-circle" style="background: radial-gradient(circle, #ffe082 0%, #d4af37 100%);">🎓</div>
      <div class="medal-info-wrap">
        <strong class="medal-title-text">Kẻ Vén Màn Bí Mật #${solverOrder}</strong>
        <span class="medal-desc-text">Đã giải mã thành công toàn bộ Két Sách Bí Mật</span>
        <span class="medal-date-tag"><i class="bi bi-calendar-check"></i> Đạt được: ${unlockedDateStr}</span>
      </div>
    </div>
  `;

  const secretLockedHTML = `
    <div class="showcase-medal-card locked-medal" title="Thành tựu ẩn">
      <div class="medal-emblem-circle locked-icon">🔒</div>
      <div class="medal-info-wrap">
        <strong class="medal-title-text">Kẻ Vén Màn Bí Mật</strong>
        <span class="medal-desc-text">??? (Chưa mở khóa)</span>
        <span class="medal-date-tag locked-tag"><i class="bi bi-lock-fill"></i> Chưa mở khóa</span>
      </div>
    </div>
  `;

  // 2. Độc Giả Thân Thiết
  const memberMedalHTML = `
    <div class="showcase-medal-card">
      <div class="medal-emblem-circle" style="background: radial-gradient(circle, #e2d7c7 0%, #8c7a6b 100%);">📜</div>
      <div class="medal-info-wrap">
        <strong class="medal-title-text">Độc Giả Thân Thiết</strong>
        <span class="medal-desc-text">Đã đăng ký Thẻ Độc Giả chính thức của Evans</span>
        <span class="medal-date-tag"><i class="bi bi-calendar-check"></i> Cấp ngày: ${joinDateStr}</span>
      </div>
    </div>
  `;

  // 3. Render các danh hiệu tùy chỉnh thêm từ cột `badges` trên Supabase
  let customBadgesHTML = "";
  if (customBadges.length > 0) {
    customBadgesHTML = customBadges.map((badgeName) => `
      <div class="showcase-medal-card custom-badge-card">
        <div class="medal-emblem-circle" style="background: radial-gradient(circle, #ffd700 0%, #b8860b 100%);">👑</div>
        <div class="medal-info-wrap">
          <strong class="medal-title-text">${escapeHTML(badgeName)}</strong>
          <span class="medal-desc-text">Danh hiệu vinh dự được cấp bởi Tiệm Sách</span>
          <span class="medal-date-tag"><i class="bi bi-patch-check-fill"></i> Đã kích hoạt</span>
        </div>
      </div>
    `).join("");
  }

  // Sắp xếp: Custom badges & Mở khóa -> Độc giả thân thiết -> Khóa (xếp cuối)
  let finalMedalsHTML = customBadgesHTML;
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
    answer: "bannga",
    title: "Vực Sâu Danh Dự",
    subtitle: "Delmare's Abyss",
    toastMsg: "Cánh cửa dẫn đến Delmare's Abyss đã mở! Chúc ngài chinh phục bản ngã thành công."
  },
  huy: {
    answer: "candyland",
    title: "Một Cơn Say",
    subtitle: "Dương Khắc Huy (@_hyvq.ft)",
    toastMsg: "Giỏi lắm. Giờ thì đến đây, đừng để tôi phải đợi lâu."
  },
  seol: {
    answer: "jacktheripper",
    title: "Phía Sau Màn Sương",
    subtitle: "Seol Min-jae",
    toastMsg: "Màn sương đã tan. Chúc may mắn, đồ tể."
  },
  arashi: {
    answer: "otomekaibou",
    title: "Thanh Âm Cấm Kỵ",
    subtitle: "Arashi「嵐」",
    toastMsg: "Đã giải mã giai điệu cấm kỵ của Arashi! Cánh cửa đêm nay chính thức rộng mở."
  },
  tam: {
    answer: "ihearu",
    title: "Sợi Dây Liên Kết",
    subtitle: "Phó Kỳ Tâm",
    toastMsg: "Tôi nghe thấy tiếng mở cửa từ em rồi."
  },
  ngon: {
    answer: "fake",
    title: "Bản Chất Sự Vật",
    subtitle: "Khương Tịch Ngôn",
    toastMsg: "Dù biết là giả, nhưng tôi vẫn trân trọng khoảnh khắc này."
  },
  salfozziel: {
    answer: ["1", "2", "3"],
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
        if (modalTitle) modalTitle.textContent = "Một Đêm Say";
        if (modalSubtitle) modalSubtitle.textContent = "Dương Khắc Huy (@_hyvq.ft)";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.88rem;">
              Dương Khắc Huy (@_hyvq.ft) vừa đăng một Highlights / Tin nổi bật mới:
            </p>
            <p style="font-weight: bold; font-size: 0.95rem; color: #8b3a3a; margin: 10px 0; font-style: italic;">
              "Vết tích của một đêm quên lối về."
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <p style="font-style: italic; color: #8b3a3a; font-size: 0.82rem; line-height: 1.4;">
              "Nơi chốn ngập tràn sự ngọt ngào giả tạo, nơi những viên kẹo đủ màu sắc che giấu cạm bẫy phía sau ánh đèn mập mờ."
            </p>
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
          `;
        }
        if (formatHint) formatHint.textContent = "Gợi ý định dạng: 13 chữ cái, viết liền không dấu";
      } else if (puzzleId === "arashi") {
        if (modalTitle) modalTitle.textContent = "Thanh Âm Cấm Kỵ";
        if (modalSubtitle) modalSubtitle.textContent = "Arashi「嵐」";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.9rem; font-style: italic; color: #8b3a3a;">
              「もっと痛くしてよ 君の体温を感じたいんだ<br>
              めいっぱい愛してよ 壊れるくらいに」
            </p>
            <p style="font-size: 0.85rem; color: #4a3a2c; margin-bottom: 10px;">
              "Motto itaku shite yo, kimi no taion o kanjitain da<br>
              Meippai aishite yo, kowareru kurai ni"
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <p style="font-style: italic; color: #6c584c; font-size: 0.82rem; line-height: 1.4;">
              "Find me, hear me."
            </p>
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
          `;
        }
        if (formatHint) formatHint.textContent = "Gợi ý định dạng: 4 chữ cái, viết liền không dấu";
      } else if (puzzleId === "salfozziel") {
        if (modalTitle) modalTitle.textContent = "Cái Giá Của Sự Lựa Chọn";
        if (modalSubtitle) modalSubtitle.textContent = "Salfozziel";
        if (hintBox) {
          hintBox.innerHTML = `
            <p style="margin-bottom: 10px; line-height: 1.5; font-size: 0.9rem; font-style: italic; color: #8b3a3a;">
              Ta là chiếc gương phản chiếu tâm trí ngươi, nhưng để phá vỡ vòng lặp này, ngươi buộc phải thực hiện chính xác một hành động duy nhất bằng cách chọn một trong ba con đường sau:<br>🔹 <strong>1.</strong> Uống chén độc dược ngưng đọng thời gian để trở thành kẻ bất tử trong cô độc vĩnh cửu.<br>🔹 <strong>2.</strong> Tự tay bóp nát trái tim mình để tồn tại dưới dạng một thực thể vô định không cảm xúc.<br>🔹 <strong>3.</strong> Nhảy xuống vực sâu không đáy để hòa làm một với bóng tối nguyên thủy.<br>
            </p>
            <hr style="border: 0; border-top: 1px dashed #d4af37; margin: 10px 0;">
            <p style="font-style: italic; color: #6c584c; font-size: 0.82rem; line-height: 1.4;">
              <em>(Cảnh báo: Tấm gương dần xuất hiện những vết nứt, khiến hình ảnh phản chiếu của ngươi trở nên méo mó.)</em>
            </p>
          `;
        }
        if (formatHint) formatHint.textContent = "There's only one true answer.";
      } else {
        // Mặc định: Delmare's Abyss
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
          `;
        }
        if (formatHint) formatHint.textContent = "* Gợi ý định dạng: 6 chữ cái, viết liền không dấu";
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

// Kiểm tra mã nhập vào
window.verifyPuzzleCode = function() {
  const modal = document.getElementById("puzzleModal");
  const input = document.getElementById("puzzlePasscodeInput");
  const errorMsg = document.getElementById("puzzleErrorMsg");
  
  const puzzleId = modal.dataset.currentPuzzle;
  const code = input.value.trim().toLowerCase();
  
let validAnswers = ["bannga"];
  if (puzzleId === "huy") {
    validAnswers = ["candyland"];
  }
  if (puzzleId === "seol") {
    validAnswers = ["jacktheripper"];
  }
  if (puzzleId === "arashi") {
    validAnswers = ["otomekaibou"];
  }
  if (puzzleId === "tam") {
    validAnswers = ["ihearu"];
  }
  if (puzzleId === "ngon") {
    validAnswers = ["fake"];
  }
  if (puzzleId === "salfozziel") {
    validAnswers = ["1", "2", "3"];
  }

if (validAnswers.includes(code)) {
      localStorage.setItem(`unlocked_${puzzleId}`, "true");
      closePuzzleModal();
      unlockCharacterLinks(puzzleId);
      showToast("Đã giải mã thành công! Nút Google AI Studio đã mở.", "success");
} else {
      input.classList.add("error-shake");
      setTimeout(() => input.classList.remove("error-shake"), 400);
      errorMsg.innerHTML = "❌ Đáp án chưa chính xác. Vui lòng thử lại!";
      errorMsg.classList.add("show");
  }
}

// Hàm "Giải phóng Link": Lấy data-real-href đắp ngược lại vào href
window.unlockCharacterLinks = function(puzzleId) {
    // Đổi màu ổ khóa ở Header card bên ngoài
    const cards = document.querySelectorAll(`.bot-card[data-puzzle-id="${puzzleId}"]`);
    cards.forEach(card => {
        const icon = card.querySelector(".bot-title-wrap .lock-icon");
        if(icon) {
            icon.className = "bi bi-unlock-fill lock-icon";
            icon.style.color = "#2ecc71"; 
            icon.title = "Đã mở khóa";
        }
    });

    // Trả lại đường dẫn thật cho nút Google AI Studio
    const lockedLinks = document.querySelectorAll(`a[data-real-href][data-puzzle-id="${puzzleId}"]`);
    lockedLinks.forEach(link => {
        link.href = link.getAttribute("data-real-href"); 
        link.removeAttribute("data-real-href");          
        link.target = "_blank";
        
        const innerLock = link.querySelector(".inner-lock"); 
        if(innerLock) innerLock.remove();
    });
}

// Kiểm tra khi vừa tải trang, nếu đã giải mã rồi thì thả link ra luôn
window.checkUnlockedPuzzles = function() {
  document.querySelectorAll("a[data-real-href]").forEach(link => {
      const puzzleId = link.dataset.puzzleId;
      if (puzzleId && localStorage.getItem(`unlocked_${puzzleId}`) === "true") {
          unlockCharacterLinks(puzzleId);
      }
  });
}
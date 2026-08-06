const SUPABASE_URL = "https://yvngwbeprfcesjdnjwzh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2bmd3YmVwcmZjZXNqZG5qd3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDIzOTgsImV4cCI6MjEwMDcxODM5OH0.hEiP2gTcg0yU4HFBlUpmzcXQ3sydx0HxvG3ZbByjiUQ";
const supabase = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

document.addEventListener("DOMContentLoaded", () => {
  loadTopRanking();
  initSearchAndFilter();
  initModal();
  initBackToTop();
  displayRandomCharacter();
  initGlobalListeners();
  initAjaxNavigation();
  initMusicPlayer();
  initMenuToggle();
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
  if (!musicPlayer) return;
  if (navMenu && navMenu.classList.contains("active")) return;

  let currentScroll = window.pageYOffset || document.documentElement.scrollTop;
  if (currentScroll > lastScrollTop && currentScroll > 60) {
    // Cuộn xuống -> Thu nhỏ và ra chính giữa
    musicPlayer.classList.add("minimized-scroll");
  } else {
    // Cuộn lên -> Hiển thị lại đầy đủ ở vị trí ban đầu
    musicPlayer.classList.remove("minimized-scroll");
  }
  lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
});

async function loadRandomDailyQuote() {
  if (!supabase) return;

  try {
    // Lấy danh sách nhân vật có chứa quote từ Supabase
    const { data: characters, error } = await supabase
      .from("characters")
      .select("name, quotes")
      .not("quotes", "is", null);

    if (error || !characters || characters.length === 0) return;

    // Lọc ra các nhân vật thực sự có ít nhất 1 quote
    const validChars = characters.filter(
      (c) => c.quotes && c.quotes.length > 0,
    );
    if (validChars.length === 0) return;

    // Chọn ngẫu nhiên nhân vật và câu quote
    const randomChar =
      validChars[Math.floor(Math.random() * validChars.length)];
    const randomQuote =
      randomChar.quotes[Math.floor(Math.random() * randomChar.quotes.length)];

    const quoteTextEl = document.getElementById("dailyQuoteText");
    const quoteAuthorEl = document.getElementById("dailyQuoteAuthor");

    if (quoteTextEl) quoteTextEl.textContent = `"${randomQuote}"`;
    if (quoteAuthorEl) quoteAuthorEl.textContent = `— ${randomChar.name}`;
  } catch (err) {
    console.error("Lỗi lấy quote ngẫu nhiên:", err);
  }
}

// Chạy hàm khi trang được tải xong (hoặc đặt trong hàm khởi tạo sự kiện chung của bạn)
document.addEventListener("DOMContentLoaded", loadRandomDailyQuote);

// ==================== TOAST NOTIFICATION SYSTEM ====================
function showToast(message, type = "success") {
  console.log("Đang gọi showToast với nội dung:", message);

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

  // 1. Thiết lập trạng thái BAN ĐẦU (chưa trượt lên, ẩn mờ)
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

  // 2. Kích hoạt hiệu ứng trượt lên bằng cách đổi về trạng thái cuối sau một nhịp render nhỏ
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  // Tự động thu hồi và xóa sau 3.2 giây
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
    setTimeout(() => toast.remove(), 300); // Chờ hiệu ứng ẩn kết thúc rồi mới xóa DOM
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

// ==================== MUSIC PLAYER LOGIC (PERSISTENT) ====================
const playlist = [
  { title: "60%_的遐想静谧", src: "bgm/60-的遐想静谧.mp3" },
  { title: "60%_的日常自由", src: "bgm/60-的日常自由.mp3" },
  { title: "赤いドレスの女", src: "bgm/赤いドレスの女.mp3" },
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

  // Lắng nghe sự kiện audio để tự động cập nhật trạng thái soundwave
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

// ==================== 2. AJAX NAVIGATION SYSTEM ====================
function initAjaxNavigation() {
  // Bắt sự kiện click trên các đường dẫn menu điều hướng
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a.nav-link, .nav-logo");
    if (!link) return;

    const href = link.getAttribute("href");
    // Chỉ xử lý các file HTML nội bộ (bỏ qua liên kết ngoài, neo trang #, mailto)
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

    // 👉 BỔ SUNG: Tự động đóng menu mobile và hiện lại player khi chọn link
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

  // Hỗ trợ nút Back / Forward trên trình duyệt
  window.addEventListener("popstate", () => {
    const path = window.location.pathname.split("/").pop() || "index.html";
    loadPageViaAjax(path, false);
  });
}

async function loadPageViaAjax(url, pushHistory = true) {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) {
    window.location.href = url; // Fallback an toàn nếu thiếu layout
    return;
  }

  try {
    // Hiệu ứng mờ dần nội dung cũ trước khi fetch
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
      // Thay thế phần thân nội dung chính
      mainContent.innerHTML = newMain.innerHTML;
      if (newTitle) document.title = newTitle.textContent;

      if (pushHistory) {
        window.history.pushState({ path: url }, "", url);
      }

      // Kích hoạt lại các thành phần script cho trang mới vừa load
      reinitializePageScripts();

      // Hiện lại nội dung mới với hiệu ứng mượt
      mainContent.style.opacity = "1";
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
  } catch (error) {
    console.error("Lỗi chuyển trang AJAX:", error);
    window.location.href = url; // Fallback tải lại trang truyền thống nếu có lỗi mạng
  }
}

function reinitializePageScripts() {
  loadTopRanking();
  initSearchAndFilter();
  initModal();
  displayRandomCharacter();
  initCatMascot();
  loadRandomDailyQuote();
}

// ==================== 3. SEARCH & FILTER LOGIC ====================
function initSearchAndFilter() {
  const searchInput = document.getElementById("searchInput");
  const genreContainer = document.getElementById("genreContainer");
  const filterToggleBtn = document.getElementById("filterToggleBtn");
  const filterDropdownWrapper = document.getElementById(
    "filterDropdownWrapper",
  );
  const currentFilterText = document.getElementById("currentFilterText");
  const botCards = document.querySelectorAll(".bot-card");

  if (filterToggleBtn && genreContainer) {
    filterToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      genreContainer.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (filterDropdownWrapper && !filterDropdownWrapper.contains(e.target)) {
        genreContainer.classList.remove("show");
      }
    });
  }

  let currentFilter = "all";
  let searchTerm = "";

  function filterCards() {
    botCards.forEach((card) => {
      const name =
        card.querySelector(".bot-name")?.textContent.toLowerCase() || "";
      const tags =
        card.querySelector(".bot-tags")?.textContent.toLowerCase() || "";
      const desc =
        card.querySelector(".bot-desc")?.textContent.toLowerCase() || "";

      const matchSearch =
        name.includes(searchTerm) ||
        tags.includes(searchTerm) ||
        desc.includes(searchTerm);

      let matchFilter = true;
      if (currentFilter !== "all") {
        matchFilter = tags.includes(currentFilter.toLowerCase());
      }

      if (matchSearch && matchFilter) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  }

  searchInput?.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    filterCards();
  });

  genreContainer?.querySelectorAll(".genre-card-option").forEach((option) => {
    option.addEventListener("click", () => {
      genreContainer
        .querySelectorAll(".genre-card-option")
        .forEach((opt) => opt.classList.remove("active"));
      option.classList.add("active");

      currentFilter = option.getAttribute("data-filter") || "all";
      if (currentFilterText) {
        currentFilterText.textContent = option.textContent;
      }
      genreContainer.classList.remove("show");
      filterCards();
    });
  });
}

// ==================== 4. MODAL CARD SYSTEM LOGIC ====================
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
          parentBtn.classList.add("like-btn", "like-btn");
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

window.openBotModalByName = function (name) {
  const cards = document.querySelectorAll(".bot-card");
  for (const card of cards) {
    const cardName = card.querySelector(".bot-name")?.textContent.trim();
    if (cardName === name) {
      card.click();
      break;
    }
  }
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
  const willBeLiked = !btn.classList.contains("liked");

  // Cập nhật giao diện trước cho mượt
  btn.classList.toggle("liked", willBeLiked);
  count = willBeLiked ? count + 1 : Math.max(0, count - 1);
  countSpan.textContent = count;

  if (willBeLiked) {
    showToast(`Đã gửi tình yêu của bạn đến ${charName}!`, "success");
  } else {
    showToast(`Bạn không còn yêu thích ${charName} nữa rồi`, "error");
  }

  // Cập nhật số lượt thích thật vào Supabase
  if (supabase) {
    await supabase
      .from("characters")
      .update({ votes: count })
      .eq("name", charName);

    // Tải lại bảng xếp hạng sau khi thả tim thành công
    loadTopRanking();
  }
};

window.toggleFeedback = function (btn) {
  const card = btn.closest(".bot-card");
  const feedbackSec = card?.querySelector(".feedback-section");
  if (feedbackSec) {
    feedbackSec.style.display =
      feedbackSec.style.display === "block" ? "none" : "block";
  }
};

window.sendFeedback = function (btn) {
  const box = btn.closest(".feedback-input-box");
  const nameInput = box?.querySelector(".input-name");
  const contentInput = box?.querySelector(".input-content");
  const feedbackList = box
    ?.closest(".feedback-section")
    ?.querySelector(".feedback-list");

  const name = nameInput?.value.trim() || "Lữ khách ẩn danh";
  const content = contentInput?.value.trim();

  if (!content) {
    showToast("Bạn quên nhập nội dung rồi!", "error");
    return;
  }

  const newItem = document.createElement("div");
  newItem.className = "feedback-item";
  newItem.innerHTML = `<strong>${escapeHTML(name)}:</strong> ${escapeHTML(content)}`;
  feedbackList?.appendChild(newItem);

  if (nameInput) nameInput.value = "";
  if (contentInput) contentInput.value = "";
  showToast("Gửi đánh giá thành công!", "success");
};

// ==================== 5. GENERAL UTILITIES ====================
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

  // Click ra ngoài thì đóng menu và hiện lại player
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

async function loadTopRanking() {
  const container = document.getElementById("topRankingContainer");
  if (!container) return;

  if (!supabase) {
    container.innerHTML = `<span style="font-size: 0.9rem; opacity: 0.7;">Chưa kết nối cơ sở dữ liệu.</span>`;
    return;
  }

  try {
    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .order("votes", { ascending: false })
      .limit(3);

    if (error || !data || data.length === 0) {
      container.innerHTML = `<span style="font-size: 0.9rem; opacity: 0.7;">Chưa có dữ liệu xếp hạng.</span>`;
      return;
    }

    container.innerHTML = data
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
  } catch (err) {
    console.error("Lỗi khi tải bảng xếp hạng:", err);
  }
}

async function displayRandomCharacter() {
  const container = document.getElementById("randomCharCard");
  if (!container) return;

  container.innerHTML = `<span class="random-placeholder-text">Đang tìm tri kỷ...</span>`;
  container.classList.add("fade-out");

  if (!supabase) {
    setTimeout(() => {
      container.innerHTML = `<span class="random-placeholder-text">Chưa kết nối database.</span>`;
      container.classList.remove("fade-out");
    }, 300);
    return;
  }

  try {
    const { data, error } = await supabase.from("characters").select("*");

    setTimeout(() => {
      if (error || !data || data.length === 0) {
        container.innerHTML = `<span class="random-placeholder-text">Không tìm thấy dữ liệu.</span>`;
      } else {
        const randomChar = data[Math.floor(Math.random() * data.length)];
        container.innerHTML = `
          <div class="random-card-content" style="cursor: pointer;" onclick="openBotModalByName('${escapeHTML(randomChar.name)}')">
            <h4 class="random-char-name">${escapeHTML(randomChar.name)}</h4>
            <div class="random-char-stats">
              <span class="random-likes"><i class="bi bi-heart-fill"></i> ${randomChar.votes || 0} lượt thích</span>
              <span class="random-feedbacks"><i class="bi bi-chat-quote-fill"></i> ${escapeHTML(randomChar.title || "Nhân vật")}</span>
            </div>
          </div>
        `;
      }
      container.classList.remove("fade-out");
    }, 300);
  } catch (err) {
    console.error("Lỗi random nhân vật:", err);
    container.classList.remove("fade-out");
  }
}

document
  .getElementById("randomBtn")
  ?.addEventListener("click", displayRandomCharacter);

// ==================== CFS SUBMISSION & THANK YOU LETTER ====================
window.submitCfsNote = async function () {
  const authorInput = document.getElementById("cfsAuthorInput");
  const contentInput = document.getElementById("cfsContentInput");
  const colorInput = document.querySelector('input[name="noteColor"]:checked');

  const author = authorInput?.value.trim() || "Lữ khách ẩn danh";
  const content = contentInput?.value.trim();
  const color = colorInput ? colorInput.value : "#fff2b2";

  if (!content) {
    showToast("Bạn quên chưa viết nội dung tâm thư (cfs) rồi!", "error");
    contentInput?.focus();
    return;
  }

  // Lưu vào Supabase
  if (supabase) {
    const { error } = await supabase
      .from("cfs_notes")
      .insert([{ author, content, bg_color: color }]);

    if (error) {
      showToast("Không thể gửi CFS, vui lòng thử lại!", "error");
      return;
    }
  }

  // Hiển thị ra màn hình tạm thời
  const noteEl = document.createElement("div");
  noteEl.className = "cfs-note-item";
  noteEl.style.backgroundColor = color;
  noteEl.innerHTML = `
    <p class="note-content">"${escapeHTML(content)}"</p>
    <span class="note-author">— ${escapeHTML(author)}</span>
  `;
  document.getElementById("cfsBoard")?.prepend(noteEl);

  if (authorInput) authorInput.value = "";
  if (contentInput) contentInput.value = "";

  showThankYouLetterModal(author);
};

function showThankYouLetterModal(author) {
  let modal = document.getElementById("thankYouModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "thankYouModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="bot-modal" style="max-width: 420px; text-align: center; padding: 35px 25px; border-radius: 16px;">
        <div style="font-size: 3rem; margin-bottom: 12px;">💌</div>
        <h3 style="margin-bottom: 15px; color: var(--primary-color, #4a3525);">Thư Cảm Ơn Từ Tiệm Sách</h3>
        <p id="thankYouMessage" style="font-size: 0.95rem; line-height: 1.7; margin-bottom: 25px; opacity: 0.85;"></p>
        <button onclick="closeThankYouModal()" class="chip-btn" style="background: var(--primary-color, #4a3525); color: #fff; padding: 10px 24px; border-radius: 20px; border: none; cursor: pointer; font-weight: 500;">Nhận lấy yêu thương</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeThankYouModal();
    });
  }

  const msgEl = document.getElementById("thankYouMessage");
  if (msgEl) {
    msgEl.textContent = `Gửi bạn '${author}', cảm ơn những dòng tâm tư chân thành mà bạn đã gửi gắm vào góc Confession nhỏ của tiệm. Chúc bạn luôn bình yên và có những phút giây trải nghiệm tuyệt vời tại đây!`;
  }
  modal.classList.add("show");
}

window.closeThankYouModal = function () {
  const modal = document.getElementById("thankYouModal");
  if (modal) modal.classList.remove("show");
};

// Mascot mèo
function initCatMascot() {
  const catBtn = document.getElementById("catMascotBtn");
  const catBubble = document.getElementById("catBubble");
  if (!catBtn || !catBubble) return;

  // Kiểm tra nếu đã gán sự kiện rồi thì không gán lại
  if (catBtn.dataset.initialized === "true") return;
  catBtn.dataset.initialized = "true";

  let petCount = 0;

  const catQuotes = [
    "Meow~ Bạn vừa xoa đầu tớ à?",
    "Gừ gừ... Trà hôm nay ngon lắm đấy!",
    "Meow! Đừng quên đọc một chương sách trước khi ngủ nhé.",
    "Bạn xoa mát tay quá~ <i class='bi bi-stars'></i>",
    "Meoww! Bạn nhận được một chiếc Bookmark may mắn! <i class='bi bi-bookmark-heart-fill'></i>",
  ];

  catBtn.addEventListener("click", () => {
    // Hiệu ứng nhún nhảy
    catBtn.classList.remove("purr");
    void catBtn.offsetWidth; // Trigger reflow
    catBtn.classList.add("purr");

    petCount++;

    if (petCount >= 5) {
      catBubble.innerHTML =
        "<i class='fa-solid fa-paw'></i> Chú mèo tiệm sách tặng bạn một cái ôm ấm áp!";
      petCount = 0;
    } else {
      const randomQuote =
        catQuotes[Math.floor(Math.random() * catQuotes.length)];
      catBubble.innerHTML = randomQuote;
    }

    // Hiện bong bóng thoại
    catBubble.classList.add("show");

    // Tự ẩn bong bóng thoại sau 3.5 giây
    clearTimeout(window.catTimer);
    window.catTimer = setTimeout(() => {
      catBubble.classList.remove("show");
    }, 3000);
  });
}

// Gọi khởi tạo chú mèo
document.addEventListener("DOMContentLoaded", initCatMascot);

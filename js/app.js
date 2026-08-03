const API_URL = "https://notes-backend.ulxn.workers.dev";
const LIMIT = 8;
const STORAGE_KEY_HISTORY = "notes_history_log";

// ── DOM refs ──
const listEl = document.getElementById("notesList");
const emptyEl = document.getElementById("emptyState");
const noteInput = document.getElementById("noteInput");
const imageInput = document.getElementById("imageInput");
const imageBtn = document.getElementById("imageBtn");
const charCountEl = document.getElementById("charCount");
const addBtn = document.getElementById("addBtn");
const themeBtn = document.getElementById("themeToggle");
const toastEl = document.getElementById("toast");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const filterSelect = document.getElementById("filterSelect");
const pagTop = document.getElementById("paginationTop");
const pagBottom = document.getElementById("paginationBottom");

// Modals
const imageModal = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalNote = document.getElementById("imageModalNote");
const imageModalMeta = document.getElementById("imageModalMeta");
const imageModalClose = document.getElementById("imageModalClose");

const editModal = document.getElementById("editModal");
const editInput = document.getElementById("editInput");
const editCharCount = document.getElementById("editCharCount");
const editSave = document.getElementById("editSave");
const editCancel = document.getElementById("editCancel");

const confirmModal = document.getElementById("confirmModal");
const confirmDelete = document.getElementById("confirmDelete");
const confirmCancel = document.getElementById("confirmCancel");

const historyModal = document.getElementById("historyModal");
const historyList = document.getElementById("historyList");
const historyClose = document.getElementById("historyClose");

const detailModal = document.getElementById("detailModal");
const detailImage = document.getElementById("detailImage");
const detailContent = document.getElementById("detailContent");
const detailMeta = document.getElementById("detailMeta");
const detailEdit = document.getElementById("detailEdit");
const detailHistory = document.getElementById("detailHistory");
const detailDeleteBtn = document.getElementById("detailDelete");
const detailClose = document.getElementById("detailClose");
const detailHistoryPanel = document.getElementById("detailHistoryPanel");

// ── State ──
let editingId = null;
let deletingId = null;
let detailNoteId = null; // track which note is open in detail modal
let currentPage = 1;
let totalPages = 1;
let searchTerm = "";
let filterVal = "newest";

// ── Helpers ──
document.getElementById("year").textContent = new Date().getFullYear();

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeBtn.querySelector(".theme-icon").textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("theme", theme);
}
applyTheme(localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
themeBtn.addEventListener("click", () => {
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
});

let _toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  const label = btn.querySelector(".btn-label");
  const spinner = btn.querySelector(".spinner");
  if (label) label.style.visibility = loading ? "hidden" : "visible";
  if (spinner) spinner.hidden = !loading;
}

function esc(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

const decoder = document.createElement("textarea");
decoder.style.display = "none";
document.body.appendChild(decoder);
function unesc(str) {
  decoder.innerHTML = str;
  return decoder.value;
}

// Convert newlines to <br> tags for display
function nl2br(str) {
  return esc(str).replace(/\n/g, "<br>");
}

// ── Character counter ──
noteInput.addEventListener("input", () => {
  charCountEl.textContent = noteInput.value.length + "/100";
});
editInput.addEventListener("input", () => {
  editCharCount.textContent = editInput.value.length + "/100";
});

// ── Image button ──
imageBtn.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => {
  if (imageInput.files.length > 0) {
    imageBtn.classList.add("image-selected");
    imageBtn.title = imageInput.files[0].name;
  } else {
    imageBtn.classList.remove("image-selected");
    imageBtn.title = "Add image";
  }
});

// ── Edit history (localStorage) ──
function getHistoryLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || "{}"); }
  catch { return {}; }
}
function saveHistoryLog(log) {
  try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(log)); }
  catch { /* quota exceeded – silently ignore */ }
}
function addHistoryEntry(noteId, content, action) {
  const log = getHistoryLog();
  if (!log[noteId]) log[noteId] = [];
  log[noteId].push({ content, action, time: new Date().toISOString() });
  // Keep only last 20 entries per note
  if (log[noteId].length > 20) log[noteId] = log[noteId].slice(-20);
  saveHistoryLog(log);
}
function getHistory(noteId) {
  return (getHistoryLog()[noteId] || []).slice().reverse();
}

// ── Render pagination ──
function renderPagination() {
  const html = buildPaginationHTML();
  pagTop.innerHTML = html;
  pagBottom.innerHTML = html;

  // Bind click events
  [pagTop, pagBottom].forEach(el => {
    el.querySelectorAll(".pg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = parseInt(btn.dataset.page);
        if (p && p !== currentPage && p >= 1 && p <= totalPages) {
          currentPage = p;
          loadNotes();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });
  });
}

function buildPaginationHTML() {
  if (totalPages <= 1) return "";
  let html = "";
  html += `<button class="pg-btn" data-page="${currentPage - 1}"${currentPage <= 1 ? " disabled" : ""}>←</button>`;

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("…");
    const s = Math.max(2, currentPage - 1);
    const e = Math.min(totalPages - 1, currentPage + 1);
    for (let i = s; i <= e; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  for (const p of pages) {
    if (p === "…") {
      html += `<span class="pg-ellipsis">…</span>`;
    } else {
      html += `<button class="pg-btn${p === currentPage ? " active" : ""}" data-page="${p}">${p}</button>`;
    }
  }

  html += `<button class="pg-btn" data-page="${currentPage + 1}"${currentPage >= totalPages ? " disabled" : ""}>→</button>`;
  return html;
}

// ── Load notes ──
async function loadNotes() {
  try {
    const params = new URLSearchParams();
    params.set("limit", LIMIT);
    params.set("offset", (currentPage - 1) * LIMIT);
    if (searchTerm) params.set("search", searchTerm);
    if (filterVal === "oldest") params.set("order", "asc");
    if (filterVal === "with-image") params.set("hasImage", "1");
    if (filterVal === "text-only") params.set("hasImage", "0");

    const res = await fetch(`${API_URL}?${params.toString()}`);
    const json = await res.json();
    const notes = json.data || [];
    const pag = json.pagination || {};

    totalPages = Math.max(1, Math.ceil((pag.total || 0) / LIMIT));
    if (currentPage > totalPages) { currentPage = totalPages; return loadNotes(); }

    if (notes.length === 0) {
      emptyEl.style.display = "block";
      listEl.innerHTML = "";
    } else {
      emptyEl.style.display = "none";
    }

    listEl.innerHTML = notes.map(n => {
      const imgHtml = n.image_key
        ? `<img src="${API_URL}/image/${n.image_key}" class="note-thumb" data-full="${API_URL}/image/${n.image_key}" data-content="${esc(n.content)}" data-meta="${esc(n.created_at)}" alt="">`
        : "";
      return `
      <li class="note-card" data-id="${n.id}" data-content="${esc(n.content)}" data-image="${n.image_key ? API_URL + '/image/' + n.image_key : ''}" data-meta="${esc(n.created_at)}">
        <div class="note-body">
          ${n.content ? `<div class="note-content">${nl2br(n.content)}</div>` : ""}
          <div class="note-meta">${esc(n.created_at)}</div>
        </div>
        ${imgHtml}
        <div class="note-actions">
          <button class="btn btn-ghost" data-edit="${n.id}" data-content="${esc(n.content)}">Edit</button>
          <button class="btn btn-ghost btn-delete-inline" data-delete="${n.id}">Delete</button>
        </div>
      </li>`;
    }).join("");

    // Bind note card clicks → open detail modal
    listEl.querySelectorAll(".note-card").forEach(card => {
      card.addEventListener("click", e => {
        // Don't open detail if clicking a button or thumbnail
        if (e.target.closest("button") || e.target.closest(".note-thumb")) return;
        openDetailModal(card);
      });
    });

    // Bind thumbnail clicks
    listEl.querySelectorAll(".note-thumb").forEach(img => {
      img.addEventListener("click", () => openImageModal(img.dataset.full, img.dataset.content, img.dataset.meta));
    });

    renderPagination();
  } catch {
    showToast("Failed to load notes");
  }
}

// ── Image modal ──
function openImageModal(src, content, meta) {
  imageModalImg.src = src;
  imageModalNote.innerHTML = content ? nl2br(unesc(content)) : "<em style='color:var(--sub)'>No note text</em>";
  imageModalMeta.textContent = unesc(meta);
  imageModal.hidden = false;
}
imageModalClose.addEventListener("click", () => { imageModal.hidden = true; });
imageModal.addEventListener("click", e => { if (e.target === imageModal) imageModal.hidden = true; });

// ── Note detail modal ──
function openDetailModal(card) {
  detailNoteId = card.dataset.id;
  const content = unesc(card.dataset.content);
  const imageUrl = card.dataset.image;
  const meta = unesc(card.dataset.meta);

  detailContent.textContent = content || "(no text)";
  detailContent.style.color = content ? "" : "var(--sub)";
  detailMeta.textContent = meta;
  if (imageUrl) {
    detailImage.src = imageUrl;
    detailImage.hidden = false;
  } else {
    detailImage.hidden = true;
  }
  detailHistoryPanel.hidden = true;
  detailModal.hidden = false;
}

detailClose.addEventListener("click", () => { detailModal.hidden = true; detailNoteId = null; });
detailModal.addEventListener("click", e => { if (e.target === detailModal) { detailModal.hidden = true; detailNoteId = null; } });

// Edit from detail
detailEdit.addEventListener("click", () => {
  detailModal.hidden = true;
  editingId = detailNoteId;
  editInput.value = detailContent.textContent === "(no text)" ? "" : detailContent.textContent;
  editCharCount.textContent = editInput.value.length + "/100";
  editModal.hidden = false;
  editInput.focus();
});

// Delete from detail
detailDeleteBtn.addEventListener("click", () => {
  detailModal.hidden = true;
  deletingId = detailNoteId;
  confirmModal.hidden = false;
});

// History toggle inside detail
detailHistory.addEventListener("click", () => {
  const entries = getHistory(detailNoteId);
  if (detailHistoryPanel.hidden) {
    if (entries.length === 0) {
      detailHistoryPanel.innerHTML = "<p style='color:var(--sub);font-size:12px;margin:0'>No edit history recorded.</p>";
    } else {
      detailHistoryPanel.innerHTML = entries.map(e => {
        const date = new Date(e.time);
        const timeStr = date.toLocaleString();
        const badge = e.action === "created" ? "Created" : e.action === "edited" ? "Edited" : "Deleted";
        const body = e.action === "deleted" ? "<em style='color:var(--sub)'>Note deleted</em>" : nl2br(e.content);
        return `<div class="history-item">
          <span class="history-badge">${badge}</span>
          <span class="history-time">${timeStr}</span>
          <div class="history-content">${body}</div>
        </div>`;
      }).join("");
    }
    detailHistoryPanel.hidden = false;
    detailHistory.textContent = "📋";
  } else {
    detailHistoryPanel.hidden = true;
  }
});

// ── Add note ──
addBtn.addEventListener("click", async () => {
  const content = noteInput.value.trim();
  const imageFile = imageInput.files[0];

  if (!content && !imageFile) {
    showToast("Note cannot be empty");
    return;
  }

  setLoading(addBtn, true);
  try {
    let image_key = null;
    if (imageFile) {
      const fd = new FormData();
      fd.append("image", imageFile);
      const up = await fetch(`${API_URL}/upload`, { method: "POST", body: fd });
      const upData = await up.json();
      image_key = upData.key;
    }

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, image_key }),
    });
    const created = await res.json();
    const newId = created.id || created.data?.id;

    if (content) addHistoryEntry(newId, content, "created");

    noteInput.value = "";
    imageInput.value = "";
    imageBtn.classList.remove("image-selected");
    imageBtn.title = "Add image";
    charCountEl.textContent = "0/100";
    currentPage = 1;
    await loadNotes();
    showToast("Note added");
  } catch {
    showToast("Something went wrong");
  } finally {
    setLoading(addBtn, false);
  }
});
noteInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addBtn.click(); }
});

// ── Edit / Delete delegation ──
listEl.addEventListener("click", e => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.delete;

  if (editId) {
    editingId = editId;
    editInput.value = unesc(e.target.dataset.content);
    editCharCount.textContent = editInput.value.length + "/100";
    editModal.hidden = false;
    editInput.focus();
  }
  if (delId) {
    deletingId = delId;
    confirmModal.hidden = false;
  }
});

editCancel.addEventListener("click", () => { editModal.hidden = true; editingId = null; });
editModal.addEventListener("click", e => { if (e.target === editModal) editCancel.click(); });

editSave.addEventListener("click", async () => {
  const trimmed = editInput.value.trim();
  if (!trimmed) { showToast("Note cannot be empty"); return; }
  setLoading(editSave, true);
  try {
    await fetch(`${API_URL}/notes/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed }),
    });
    addHistoryEntry(editingId, trimmed, "edited");
    editModal.hidden = true;
    await loadNotes();
    showToast("Note updated");
  } catch {
    showToast("Something went wrong");
  } finally {
    setLoading(editSave, false);
  }
});

confirmCancel.addEventListener("click", () => { confirmModal.hidden = true; deletingId = null; });
confirmModal.addEventListener("click", e => { if (e.target === confirmModal) confirmCancel.click(); });

confirmDelete.addEventListener("click", async () => {
  setLoading(confirmDelete, true);
  try {
    await fetch(`${API_URL}/notes/${deletingId}`, { method: "DELETE" });
    addHistoryEntry(deletingId, "[deleted]", "deleted");
    confirmModal.hidden = true;
    await loadNotes();
    showToast("Note deleted");
  } catch {
    showToast("Something went wrong");
  } finally {
    setLoading(confirmDelete, false);
  }
});

// ── History modal ──
function showHistoryModal(noteId) {
  const entries = getHistory(noteId);
  if (entries.length === 0) {
    historyList.innerHTML = "<p style='color:var(--sub);font-size:13px'>No edit history recorded.</p>";
  } else {
    historyList.innerHTML = entries.map(e => {
      const date = new Date(e.time);
      const timeStr = date.toLocaleString();
      const badge = e.action === "created" ? "Created" : e.action === "edited" ? "Edited" : "Deleted";
      const content = e.action === "deleted" ? "<em style='color:var(--sub)'>Note deleted</em>" : nl2br(e.content);
      return `<div class="history-item">
        <span class="history-badge">${badge}</span>
        <span class="history-time">${timeStr}</span>
        <div class="history-content">${content}</div>
      </div>`;
    }).join("");
  }
  historyModal.hidden = false;
}
historyClose.addEventListener("click", () => { historyModal.hidden = true; });
historyModal.addEventListener("click", e => { if (e.target === historyModal) historyModal.hidden = true; });

// ── Search & filter ──
let searchTimeout;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchClear.hidden = searchInput.value === "";
  searchTimeout = setTimeout(() => {
    searchTerm = searchInput.value.trim();
    currentPage = 1;
    loadNotes();
  }, 300);
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.hidden = true;
  searchTerm = "";
  currentPage = 1;
  loadNotes();
});

filterSelect.addEventListener("change", () => {
  filterVal = filterSelect.value;
  currentPage = 1;
  loadNotes();
});

// ── Init ──
loadNotes();
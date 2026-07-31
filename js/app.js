const API_URL = "https://notes-backend.ulxn.workers.dev";

const listEl = document.getElementById("notesList");
const emptyEl = document.getElementById("emptyState");
const inputEl = document.getElementById("noteInput");
const imageInput = document.getElementById("imageInput");
const charCountEl = document.getElementById("charCount");
const addBtn = document.getElementById("addBtn");
const themeBtn = document.getElementById("themeToggle");
const toastEl = document.getElementById("toast");

const editModal = document.getElementById("editModal");
const editInput = document.getElementById("editInput");
const editCharCount = document.getElementById("editCharCount");
const editSave = document.getElementById("editSave");
const editCancel = document.getElementById("editCancel");

const confirmModal = document.getElementById("confirmModal");
const confirmDelete = document.getElementById("confirmDelete");
const confirmCancel = document.getElementById("confirmCancel");

let editingId = null;
let deletingId = null;

// Pagination state
let currentOffset = 0;
const LIMIT = 10; // notes per page
let hasMore = true;
let isLoading = false;

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

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  btn.querySelector(".btn-label").style.visibility = loading ? "hidden" : "visible";
  btn.querySelector(".spinner").hidden = !loading;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Reusable decoder – handles any HTML entity automatically
const decoder = document.createElement("textarea");
decoder.style.display = "none";
document.body.appendChild(decoder);

function unescapeHtml(str) {
  decoder.innerHTML = str;
  return decoder.value;
}

inputEl.addEventListener("input", () => { charCountEl.textContent = inputEl.value.length; });
editInput.addEventListener("input", () => { editCharCount.textContent = editInput.value.length; });

// Load a page of notes (appends to list)
async function loadNotes(append = false) {
  if (isLoading) return;
  if (!append) {
    // Reset pagination for fresh load
    currentOffset = 0;
    hasMore = true;
    listEl.innerHTML = "";
  }
  if (!hasMore && append) return;

  isLoading = true;
  try {
    const url = `${API_URL}?limit=${LIMIT}&offset=${currentOffset}`;
    const res = await fetch(url);
    const json = await res.json();

    const notes = json.data || [];
    const pagination = json.pagination || {};

    if (notes.length === 0 && currentOffset === 0) {
      emptyEl.style.display = "block";
      listEl.innerHTML = "";
    } else {
      emptyEl.style.display = "none";
    }

    // Render notes (append or replace)
    const html = notes.map(n => `
      <li class="note-card">
        <div>
          ${n.image_key ? `<img src="${API_URL}/image/${n.image_key}" class="note-img" alt="">` : ""}
          <div class="note-content">${escapeHtml(n.content)}</div>
          <div class="note-meta">${n.created_at}</div>
        </div>
        <div class="note-actions">
          <button class="btn btn-ghost" data-edit="${n.id}" data-content="${escapeHtml(n.content)}">Edit</button>
          <button class="btn btn-ghost btn-delete-inline" data-delete="${n.id}">Delete</button>
        </div>
      </li>
    `).join("");

    if (append) {
      listEl.insertAdjacentHTML("beforeend", html);
    } else {
      listEl.innerHTML = html;
    }

    // Update pagination state
    currentOffset += notes.length;
    hasMore = pagination.hasMore || false;

    // Show/hide "Load more" button
    updateLoadMoreButton();
  } catch (err) {
    showToast("Failed to load notes");
  } finally {
    isLoading = false;
  }
}

// Helper to add a "Load more" button if needed
function updateLoadMoreButton() {
  const existing = document.getElementById("loadMoreBtn");
  if (hasMore) {
    if (!existing) {
      const btn = document.createElement("button");
      btn.id = "loadMoreBtn";
      btn.className = "btn btn-ghost";
      btn.textContent = "Load more";
      btn.addEventListener("click", () => loadNotes(true));
      listEl.parentNode.appendChild(btn);
    }
  } else {
    if (existing) existing.remove();
  }
}

// Add note
addBtn.addEventListener("click", async () => {
  const content = inputEl.value.trim();
  const imageFile = imageInput.files[0];
  if (!content) return;

  setLoading(addBtn, true);
  try {
    let image_key = null;

    if (imageFile) {
      const formData = new FormData();
      formData.append("image", imageFile);
      const uploadRes = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      image_key = uploadData.key;
    }

    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, image_key }),
    });

    inputEl.value = "";
    imageInput.value = "";
    charCountEl.textContent = "0";
    // Reload from beginning (fresh)
    await loadNotes(false);
    showToast("Note added");
  } catch {
    showToast("Something went wrong");
  } finally {
    setLoading(addBtn, false);
  }
});
inputEl.addEventListener("keydown", e => { if (e.key === "Enter") addBtn.click(); });

// Edit / Delete click delegation
listEl.addEventListener("click", (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.delete;

  if (editId) {
    editingId = editId;
    editInput.value = unescapeHtml(e.target.dataset.content);
    editCharCount.textContent = editInput.value.length;
    editModal.hidden = false;
    editInput.focus();
  }
  if (delId) {
    deletingId = delId;
    confirmModal.hidden = false;
  }
});

editCancel.addEventListener("click", () => { editModal.hidden = true; editingId = null; });
editModal.addEventListener("click", (e) => { if (e.target === editModal) editCancel.click(); });

editSave.addEventListener("click", async () => {
  const trimmed = editInput.value.trim();
  if (!trimmed) return;
  setLoading(editSave, true);
  try {
    await fetch(`${API_URL}/notes/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed }),
    });
    editModal.hidden = true;
    await loadNotes(false);
    showToast("Note updated");
  } catch {
    showToast("Something went wrong");
  } finally {
    setLoading(editSave, false);
  }
});

confirmCancel.addEventListener("click", () => { confirmModal.hidden = true; deletingId = null; });
confirmModal.addEventListener("click", (e) => { if (e.target === confirmModal) confirmCancel.click(); });

confirmDelete.addEventListener("click", async () => {
  setLoading(confirmDelete, true);
  try {
    await fetch(`${API_URL}/notes/${deletingId}`, { method: "DELETE" });
    confirmModal.hidden = true;
    await loadNotes(false);
    showToast("Note deleted");
  } catch {
    showToast("Something went wrong");
  } finally {
    setLoading(confirmDelete, false);
  }
});

// Initial load
loadNotes(false);
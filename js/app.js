const API_URL = "https://notes-backend.ulxn.workers.dev";

async function loadNotes() {
  const res = await fetch(API_URL);
  const notes = await res.json();

  const tbody = document.getElementById("notesTableBody");
  tbody.innerHTML = "";

  notes.forEach(note => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${note.content}</td>
      <td>${note.created_at}</td>
      <td>
        <button onclick="editNote(${note.id}, '${note.content.replace(/'/g, "\\'")}')">Edit</button>
        <button onclick="deleteNote(${note.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

document.getElementById("addBtn").addEventListener("click", async () => {
  const input = document.getElementById("noteInput");
  const content = input.value.trim();

  if (!content) return;

  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  input.value = "";
  loadNotes();
});

async function editNote(id, currentContent) {
  const newContent = prompt("Edit note:", currentContent);

  if (newContent === null) return; // user hit Cancel
  const trimmed = newContent.trim();
  if (!trimmed) return; // don't allow saving empty content

  await fetch(`${API_URL}/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: trimmed }),
  });

  loadNotes();
}

async function deleteNote(id) {
  const confirmed = confirm("Delete this note?");
  if (!confirmed) return;

  await fetch(`${API_URL}/notes/${id}`, {
    method: "DELETE",
  });

  loadNotes();
}

loadNotes();
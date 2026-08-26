const $ = id => document.getElementById(id);

let books = JSON.parse(localStorage.getItem("libraryBooksV2")) || [];
let members = JSON.parse(localStorage.getItem("libraryMembersV2")) || [];
let history = JSON.parse(localStorage.getItem("libraryHistoryV2")) || [];

let editingBookId = null;
let editingMemberId = null;
let selectedBookId = null;

function save() {
  localStorage.setItem("libraryBooksV2", JSON.stringify(books));
  localStorage.setItem("libraryMembersV2", JSON.stringify(members));
  localStorage.setItem("libraryHistoryV2", JSON.stringify(history));
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function isOverdue(book) {
  return book.status === "borrowed" && book.dueDate < today();
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function updateSummary() {
  const borrowed = books.filter(b => b.status === "borrowed").length;
  const overdue = books.filter(isOverdue).length;

  $("totalBooks").textContent = books.length;
  $("availableBooks").textContent = books.length - borrowed;
  $("borrowedBooks").textContent = borrowed;
  $("overdueBooks").textContent = overdue;
}

function renderBooks() {
  const search = $("searchBooks").value.toLowerCase().trim();
  const status = $("statusFilter").value;
  const category = $("categoryFilter").value;

  const filtered = books.filter(book => {
    const textMatch =
      book.title.toLowerCase().includes(search) ||
      book.author.toLowerCase().includes(search);

    const statusMatch =
      status === "all" ||
      (status === "overdue" ? isOverdue(book) : book.status === status);

    const categoryMatch =
      category === "all" || book.category === category;

    return textMatch && statusMatch && categoryMatch;
  }).sort((a,b) => a.title.localeCompare(b.title));

  $("books").innerHTML = "";
  $("emptyBooks").style.display = filtered.length ? "none" : "block";

  filtered.forEach(book => {
    const overdue = isOverdue(book);
    const statusClass = overdue ? "overdue" : book.status;
    const statusText = overdue ? "Overdue" : book.status === "borrowed" ? "Borrowed" : "Available";

    const item = document.createElement("article");
    item.className = "book";
    item.innerHTML = `
      <div class="info">
        <h3>${escapeHTML(book.title)}</h3>
        <p>${escapeHTML(book.author)}${book.year ? ` · ${book.year}` : ""} · ${escapeHTML(book.category)}</p>
        ${book.status === "borrowed" ? `<div class="details">Borrowed by ${escapeHTML(book.borrowerName)} · Due ${book.dueDate}</div>` : ""}
      </div>
      <div class="actions">
        <span class="badge ${statusClass}">${statusText}</span>
        ${book.status === "borrowed"
          ? `<button class="return-btn" data-action="return-book" data-id="${book.id}">Return</button>`
          : `<button class="borrow-btn" data-action="borrow-book" data-id="${book.id}">Borrow</button>`}
        <button class="edit-btn" data-action="edit-book" data-id="${book.id}">Edit</button>
        <button class="delete-btn" data-action="delete-book" data-id="${book.id}">Delete</button>
      </div>`;
    $("books").appendChild(item);
  });

  updateSummary();
}

function renderMembers() {
  const search = $("searchMembers").value.toLowerCase().trim();
  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search) || m.email.toLowerCase().includes(search)
  );

  $("members").innerHTML = "";
  $("emptyMembers").style.display = filtered.length ? "none" : "block";

  filtered.forEach(member => {
    const borrowedCount = books.filter(b => b.status === "borrowed" && b.memberId === member.id).length;
    const item = document.createElement("article");
    item.className = "member";
    item.innerHTML = `
      <div class="info">
        <h3>${escapeHTML(member.name)}</h3>
        <p>${escapeHTML(member.email)} · ${borrowedCount} borrowed</p>
      </div>
      <div class="actions">
        <button class="edit-btn" data-action="edit-member" data-id="${member.id}">Edit</button>
        <button class="delete-btn" data-action="delete-member" data-id="${member.id}">Delete</button>
      </div>`;
    $("members").appendChild(item);
  });
}

function renderHistory() {
  const items = [...history].sort((a,b) => b.borrowedAt.localeCompare(a.borrowedAt));
  $("history").innerHTML = "";
  $("emptyHistory").style.display = items.length ? "none" : "block";

  items.forEach(record => {
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <div class="info">
        <h3>${escapeHTML(record.bookTitle)}</h3>
        <p>${escapeHTML(record.memberName)} · Borrowed ${record.borrowedAt} · Due ${record.dueDate}</p>
        <div class="details">${record.returnedAt ? `Returned ${record.returnedAt}` : "Currently borrowed"}</div>
      </div>
      <span class="badge ${record.returnedAt ? "available" : "borrowed"}">
        ${record.returnedAt ? "Returned" : "Active"}
      </span>`;
    $("history").appendChild(item);
  });
}

function renderAll() {
  renderBooks();
  renderMembers();
  renderHistory();
}

$("bookForm").addEventListener("submit", e => {
  e.preventDefault();

  const data = {
    title: $("title").value.trim(),
    author: $("author").value.trim(),
    year: $("year").value,
    category: $("category").value
  };

  if (!data.title || !data.author) return;

  if (editingBookId !== null) {
    const book = books.find(b => b.id === editingBookId);
    Object.assign(book, data);
  } else {
    books.push({
      id: Date.now(),
      ...data,
      status: "available",
      memberId: null,
      borrowerName: "",
      dueDate: ""
    });
  }

  save();
  resetBookForm();
  renderAll();
});

function resetBookForm() {
  editingBookId = null;
  $("bookForm").reset();
  $("bookFormTitle").textContent = "Add Book";
  $("bookSubmit").textContent = "Add Book";
  $("cancelBookEdit").classList.add("hidden");
}

$("books").addEventListener("click", e => {
  const button = e.target.closest("button");
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const book = books.find(b => b.id === id);
  if (!book) return;

  if (action === "borrow-book") openBorrowModal(book);
  if (action === "return-book") returnBook(book);
  if (action === "edit-book") editBook(book);

  if (action === "delete-book" && confirm(`Delete "${book.title}"?`)) {
    books = books.filter(b => b.id !== id);
    save();
    renderAll();
  }
});

function editBook(book) {
  editingBookId = book.id;
  $("title").value = book.title;
  $("author").value = book.author;
  $("year").value = book.year;
  $("category").value = book.category;
  $("bookFormTitle").textContent = "Edit Book";
  $("bookSubmit").textContent = "Update Book";
  $("cancelBookEdit").classList.remove("hidden");
  window.scrollTo({top:0, behavior:"smooth"});
}

$("cancelBookEdit").addEventListener("click", resetBookForm);

$("memberForm").addEventListener("submit", e => {
  e.preventDefault();

  const name = $("memberName").value.trim();
  const email = $("memberEmail").value.trim();
  if (!name || !email) return;

  if (editingMemberId !== null) {
    const member = members.find(m => m.id === editingMemberId);
    Object.assign(member, {name, email});
  } else {
    members.push({id: Date.now(), name, email});
  }

  save();
  resetMemberForm();
  renderAll();
});

function resetMemberForm() {
  editingMemberId = null;
  $("memberForm").reset();
  $("memberFormTitle").textContent = "Add Member";
  $("memberSubmit").textContent = "Add Member";
  $("cancelMemberEdit").classList.add("hidden");
}

$("members").addEventListener("click", e => {
  const button = e.target.closest("button");
  if (!button) return;

  const id = Number(button.dataset.id);
  const member = members.find(m => m.id === id);
  if (!member) return;

  if (button.dataset.action === "edit-member") {
    editingMemberId = id;
    $("memberName").value = member.name;
    $("memberEmail").value = member.email;
    $("memberFormTitle").textContent = "Edit Member";
    $("memberSubmit").textContent = "Update Member";
    $("cancelMemberEdit").classList.remove("hidden");
  }

  if (button.dataset.action === "delete-member") {
    const hasBorrowed = books.some(b => b.memberId === id && b.status === "borrowed");
    if (hasBorrowed) {
      alert("This member currently has a borrowed book. Return the book before deleting the member.");
      return;
    }

    if (confirm(`Delete member "${member.name}"?`)) {
      members = members.filter(m => m.id !== id);
      save();
      renderAll();
    }
  }
});

$("cancelMemberEdit").addEventListener("click", resetMemberForm);

function openBorrowModal(book) {
  selectedBookId = book.id;
  $("borrowBookTitle").textContent = `Borrowing: ${book.title}`;

  const select = $("borrowerSelect");
  select.innerHTML = "";

  if (!members.length) {
    $("noMembersMessage").classList.remove("hidden");
    select.disabled = true;
  } else {
    $("noMembersMessage").classList.add("hidden");
    select.disabled = false;
    members.forEach(member => {
      const option = document.createElement("option");
      option.value = member.id;
      option.textContent = `${member.name} (${member.email})`;
      select.appendChild(option);
    });
  }

  $("dueDate").value = "";
  $("borrowModal").classList.remove("hidden");
}

$("borrowForm").addEventListener("submit", e => {
  e.preventDefault();

  const book = books.find(b => b.id === selectedBookId);
  const member = members.find(m => m.id === Number($("borrowerSelect").value));
  const dueDate = $("dueDate").value;

  if (!book || !member || !dueDate) return;

  book.status = "borrowed";
  book.memberId = member.id;
  book.borrowerName = member.name;
  book.dueDate = dueDate;

  history.push({
    id: Date.now(),
    bookId: book.id,
    bookTitle: book.title,
    memberId: member.id,
    memberName: member.name,
    borrowedAt: today(),
    dueDate,
    returnedAt: null
  });

  save();
  closeModal();
  renderAll();
});

function returnBook(book) {
  const record = [...history].reverse().find(
    h => h.bookId === book.id && !h.returnedAt
  );

  if (record) record.returnedAt = today();

  book.status = "available";
  book.memberId = null;
  book.borrowerName = "";
  book.dueDate = "";

  save();
  renderAll();
}

$("closeModal").addEventListener("click", closeModal);
$("borrowModal").addEventListener("click", e => {
  if (e.target.id === "borrowModal") closeModal();
});

function closeModal() {
  $("borrowModal").classList.add("hidden");
  selectedBookId = null;
}

$("clearHistory").addEventListener("click", () => {
  if (!history.length) return;
  if (confirm("Clear all borrowing history?")) {
    history = [];
    save();
    renderHistory();
  }
});

["searchBooks","statusFilter","categoryFilter"].forEach(id => {
  $(id).addEventListener("input", renderBooks);
});

$("searchMembers").addEventListener("input", renderMembers);

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

    tab.classList.add("active");
    $(tab.dataset.tab).classList.add("active");
  });
});

renderAll();

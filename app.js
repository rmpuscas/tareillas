const API_BASE = "https://task-api-v79e.onrender.com/api";
//const API_BASE = "http://localhost:3000/api";

// ---- DOM refs ----
const loginPage = document.getElementById("login-page");
const tasksPage = document.getElementById("tasks-page");
const statsPage = document.getElementById("stats-page");
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");
const tasksLoading = document.getElementById("tasks-loading");
const tasksError = document.getElementById("tasks-error");
const tasksList = document.getElementById("tasks-list");
const noTasks = document.getElementById("no-tasks");
const pagination = document.getElementById("pagination");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageInfo = document.getElementById("page-info");

const addTaskBtn = document.getElementById("add-task-btn");
const modalOverlay = document.getElementById("modal-overlay");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const taskForm = document.getElementById("task-form");
const taskFormError = document.getElementById("task-form-error");
const taskMember = document.getElementById("task-member");
const taskCategory = document.getElementById("task-category");
const taskDate = document.getElementById("task-date");
const taskTime = document.getElementById("task-time");
const taskDesc = document.getElementById("task-desc");

const categoriesBtn = document.getElementById("categories-btn");
const catModalOverlay = document.getElementById("cat-modal-overlay");
const catModalCloseBtn = document.getElementById("cat-modal-close-btn");
const catList = document.getElementById("cat-list");
const catListError = document.getElementById("cat-list-error");
const catForm = document.getElementById("cat-form");
const catName = document.getElementById("cat-name");
const catFormError = document.getElementById("cat-form-error");

const statsLoading = document.getElementById("stats-loading");
const statsError = document.getElementById("stats-error");
const statsList = document.getElementById("stats-list");
const noStats = document.getElementById("no-stats");
const filterChips = document.querySelectorAll(".filter-chip");
const statsWeek = document.getElementById("stats-week");
const statsMonth = document.getElementById("stats-month");
const statsYear = document.getElementById("stats-year");
const bottomNav = document.querySelector(".bottom-nav");
const bottomNavItems = document.querySelectorAll(".bottom-nav-item");

// ---- State ----
let token = sessionStorage.getItem("jwt");
let membersCache = null;
let categoriesCache = null;
let currentPage = "tasks";
let tasksCurrentPage = 1;
let tasksTotalPages = 1;

// Bar colors for categories
const BAR_COLORS = ["#4361ee", "#2ec4b6", "#ff6b6b", "#feca57", "#7b61ff", "#ff9f43", "#54a0ff", "#5f27cd"];

// ---- Helpers ----
function showPage(page) {
  loginPage.classList.add("hidden");
  tasksPage.classList.add("hidden");
  statsPage.classList.add("hidden");
  page.classList.remove("hidden");
  bottomNav.classList.toggle("hidden", page === loginPage);
}

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---- Auth ----
async function login(password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || data?.error || "Login failed");
  }

  const data = await res.json();
  return data.token;
}

// ---- Tasks ----
async function fetchTasks(page = 1) {
  const res = await fetch(`${API_BASE}/tasks?page=${page}&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error("Failed to load tasks");
  }

  return res.json();
}

function renderTasks(tasks, members, categories) {
  tasksList.innerHTML = "";
  tasksError.classList.add("hidden");
  tasksLoading.classList.add("hidden");

  if (tasks.length === 0) {
    tasksList.classList.add("hidden");
    noTasks.classList.remove("hidden");
    pagination.classList.add("hidden");
    return;
  }

  noTasks.classList.add("hidden");
  tasksList.classList.remove("hidden");

  for (const task of tasks) {
    const memberName = lookupName(members, task.member_id);
    const categoryName = lookupName(categories, task.category_id);
    const card = document.createElement("div");
    card.className = "task-card";
    card.innerHTML = `
      <div class="task-card-body">
        <div class="task-card-content">
          <span class="task-card-date">${task.date}</span>
          <div class="task-card-meta">
            <span class="task-card-badge">${categoryName}</span>
            <span class="task-card-badge">${memberName}</span>
          </div>
          <div class="task-card-desc">${task.description}</div>
        </div>
        <span class="task-card-time">${formatMinutes(task.time_spent)}</span>
        <button class="btn-delete-task" data-id="${task.id}" title="Delete">✕</button>
      </div>
    `;
    tasksList.appendChild(card);
  }

  tasksList.querySelectorAll(".btn-delete-task").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta tarea?")) return;
      try {
        await deleteTask(btn.dataset.id);
        loadTasks(tasksCurrentPage);
      } catch (err) {
        tasksError.textContent = err.message;
        tasksError.classList.remove("hidden");
      }
    });
  });

  // Pagination controls
  if (tasksTotalPages > 1) {
    pagination.classList.remove("hidden");
    pageInfo.textContent = `${tasksCurrentPage} / ${tasksTotalPages}`;
    prevPageBtn.disabled = tasksCurrentPage <= 1;
    nextPageBtn.disabled = tasksCurrentPage >= tasksTotalPages;
  } else {
    pagination.classList.add("hidden");
  }
}

function lookupName(list, id) {
  const item = list?.find((i) => i.id === id);
  return item?.name || `#${id}`;
}

async function loadTasks(page = 1) {
  tasksLoading.classList.remove("hidden");
  tasksList.classList.add("hidden");
  noTasks.classList.add("hidden");
  tasksError.classList.add("hidden");
  pagination.classList.add("hidden");

  try {
    const [result, members, categories] = await Promise.all([
      fetchTasks(page),
      fetchMembers(),
      fetchCategories(),
    ]);
    tasksCurrentPage = result.page;
    tasksTotalPages = result.total_pages;
    renderTasks(result.data, members, categories);
  } catch (err) {
    tasksError.textContent = err.message;
    tasksError.classList.remove("hidden");
    tasksLoading.classList.add("hidden");
  }
}

// ---- Members & Categories ----
async function fetchMembers() {
  if (membersCache) return membersCache;
  const res = await fetch(`${API_BASE}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load members");
  membersCache = await res.json();
  return membersCache;
}

async function fetchCategories() {
  if (categoriesCache) return categoriesCache;
  const res = await fetch(`${API_BASE}/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load categories");
  categoriesCache = await res.json();
  return categoriesCache;
}

function populateSelect(select, items, labelKey) {
  select.innerHTML = '<option value="" disabled selected>Select…</option>';
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item[labelKey] || item.name || `#${item.id}`;
    select.appendChild(opt);
  }
}

async function openModal() {
  taskForm.reset();
  taskFormError.classList.add("hidden");
  taskDate.value = new Date().toISOString().slice(0, 10);
  modalOverlay.classList.remove("hidden");

  try {
    const [members, categories] = await Promise.all([fetchMembers(), fetchCategories()]);
    populateSelect(taskMember, members, "name");
    populateSelect(taskCategory, categories, "name");
  } catch (err) {
    taskFormError.textContent = err.message;
    taskFormError.classList.remove("hidden");
  }
}

function closeModal() {
  modalOverlay.classList.add("hidden");
}

async function createTask(payload) {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || data?.error || "Failed to create task");
  }

  return res.json();
}

async function deleteTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || data?.error || "Failed to delete task");
  }
}

// ---- Categories CRUD ----
async function createCategory(name) {
  const res = await fetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || data?.error || "Failed to create category");
  }

  categoriesCache = null;
  return res.json();
}

async function deleteCategory(id) {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || data?.error || "Failed to delete category");
  }

  categoriesCache = null;
}

function renderCatList(categories) {
  catList.innerHTML = "";
  catListError.classList.add("hidden");

  if (categories.length === 0) {
    catList.innerHTML = '<p style="color:#888;text-align:center;padding:0.5rem;">No categories yet.</p>';
    return;
  }

  for (const cat of categories) {
    const item = document.createElement("div");
    item.className = "cat-item";
    item.innerHTML = `
      <span class="cat-item-name">${cat.name}</span>
      <button class="btn-delete-sm" data-id="${cat.id}" title="Delete">✕</button>
    `;
    catList.appendChild(item);
  }

  catList.querySelectorAll(".btn-delete-sm").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta categoría?")) return;
      try {
        await deleteCategory(btn.dataset.id);
        const cats = await fetchCategories();
        renderCatList(cats);
      } catch (err) {
        catListError.textContent = err.message;
        catListError.classList.remove("hidden");
      }
    });
  });
}

async function openCatModal() {
  catFormError.classList.add("hidden");
  catListError.classList.add("hidden");
  catName.value = "";
  catModalOverlay.classList.remove("hidden");

  try {
    categoriesCache = null;
    const cats = await fetchCategories();
    renderCatList(cats);
  } catch (err) {
    catListError.textContent = err.message;
    catListError.classList.remove("hidden");
  }
}

function closeCatModal() {
  catModalOverlay.classList.add("hidden");
}

// ---- Date range helpers ----
function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function getDateRange(range) {
  const today = new Date();
  let start, end;

  switch (range) {
    case "current-week": {
      start = getMonday(today);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      break;
    }
    case "last-week": {
      const mon = getMonday(today);
      mon.setDate(mon.getDate() - 7);
      start = mon;
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      break;
    }
    case "current-month": {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    }
    case "last-month": {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    }
    case "current-year": {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      break;
    }
    case "last-year": {
      start = new Date(today.getFullYear() - 1, 0, 1);
      end = new Date(today.getFullYear() - 1, 11, 31);
      break;
    }
    case "always":
      return { start_date: null, end_date: null };
  }
  return { start_date: fmt(start), end_date: fmt(end) };
}

function weekInputToRange(val) {
  // val = "2026-W17"
  const [year, wStr] = val.split("-W");
  const jan4 = new Date(Number(year), 0, 4);
  const mon = getMonday(jan4);
  mon.setDate(mon.getDate() + (Number(wStr) - 1) * 7);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return { start_date: fmt(mon), end_date: fmt(sun) };
}

function monthInputToRange(val) {
  // val = "2026-04"
  const [year, month] = val.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start_date: fmt(start), end_date: fmt(end) };
}

// ---- Statistics ----
async function fetchStats(startDate, endDate) {
  let url = `${API_BASE}/statistics`;
  if (startDate && endDate) {
    url += `?start_date=${startDate}&end_date=${endDate}`;
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error("Session expired. Please log in again.");
  }
  if (!res.ok) throw new Error("Failed to load statistics");
  return res.json();
}

function renderStats(data) {
  statsList.innerHTML = "";
  statsError.classList.add("hidden");
  statsLoading.classList.add("hidden");

  if (!data || data.length === 0) {
    statsList.classList.add("hidden");
    noStats.classList.remove("hidden");
    return;
  }

  noStats.classList.add("hidden");
  statsList.classList.remove("hidden");

  // --- Member totals section ---
  const membersSection = document.createElement("div");
  membersSection.className = "stats-section";
  membersSection.innerHTML = '<h3 class="stats-section-title">Miembros</h3>';

  const membersGrid = document.createElement("div");
  membersGrid.className = "stats-members-grid";

  for (const member of data) {
    const card = document.createElement("div");
    card.className = "stats-summary-card";
    card.innerHTML = `
      <span class="stats-summary-name">${member.name}</span>
      <span class="stats-summary-time">${formatMinutes(member.total_time_spent)}</span>
      <span class="stats-summary-tasks">${member.total_tasks} tarea${member.total_tasks !== 1 ? 's' : ''}</span>
    `;
    membersGrid.appendChild(card);
  }
  membersSection.appendChild(membersGrid);
  statsList.appendChild(membersSection);

  // --- Build category map ensuring all members appear ---
  const allMembers = data.map((m) => m.name);
  const categoryMap = new Map();
  for (const member of data) {
    for (const cat of member.categories) {
      if (!categoryMap.has(cat.category_name)) {
        categoryMap.set(cat.category_name, new Map());
      }
      categoryMap.get(cat.category_name).set(member.name, cat.time_spent);
    }
  }

  // --- Category cards ---
  const catsSection = document.createElement("div");
  catsSection.className = "stats-section";
  catsSection.innerHTML = '<h3 class="stats-section-title">Por categoría</h3>';

  const catsGrid = document.createElement("div");
  catsGrid.className = "stats-cats-grid";

  for (const [catName, memberMap] of categoryMap) {
    const entries = allMembers.map((name) => ({
      name,
      time_spent: memberMap.get(name) || 0,
    }));
    const maxTime = Math.max(...entries.map((m) => m.time_spent), 1);
    const card = document.createElement("div");
    card.className = "stats-cat-card";

    let rowsHtml = "";
    entries.forEach((m, i) => {
      const pct = Math.round((m.time_spent / maxTime) * 100);
      const color = BAR_COLORS[i % BAR_COLORS.length];
      rowsHtml += `
        <div class="stats-category-row">
          <span class="stats-cat-name">${m.name}</span>
          <div class="stats-bar-track">
            <div class="stats-bar-fill" style="width:${pct}%;background:${color};"></div>
          </div>
          <span class="stats-cat-time">${formatMinutes(m.time_spent)}</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="stats-cat-card-title">${catName}</div>
      ${rowsHtml}
    `;
    catsGrid.appendChild(card);
  }

  catsSection.appendChild(catsGrid);
  statsList.appendChild(catsSection);
}

async function loadStats(startDate, endDate) {
  statsLoading.classList.remove("hidden");
  statsList.classList.add("hidden");
  noStats.classList.add("hidden");
  statsError.classList.add("hidden");

  try {
    const data = await fetchStats(startDate, endDate);
    renderStats(data);
  } catch (err) {
    statsError.textContent = err.message;
    statsError.classList.remove("hidden");
    statsLoading.classList.add("hidden");
  }
}

function setActiveChip(range) {
  filterChips.forEach((c) => c.classList.toggle("active", c.dataset.range === range));
}

// ---- Navigation ----
function navigateTo(page) {
  currentPage = page;
  bottomNavItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.page === page));

  if (page === "tasks") {
    showPage(tasksPage);
    loadTasks();
  } else if (page === "stats") {
    showPage(statsPage);
    const { start_date, end_date } = getDateRange("current-week");
    setActiveChip("current-week");
    statsWeek.value = "";
    statsMonth.value = "";
    statsYear.value = "";
    loadStats(start_date, end_date);
  }
}

function logout() {
  token = null;
  sessionStorage.removeItem("jwt");
  showPage(loginPage);
  passwordInput.value = "";
}

// ---- Event listeners ----
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector("button");
  btn.disabled = true;
  loginError.classList.add("hidden");

  try {
    token = await login(passwordInput.value);
    sessionStorage.setItem("jwt", token);
    navigateTo("tasks");
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

addTaskBtn.addEventListener("click", openModal);
modalCancelBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

prevPageBtn.addEventListener("click", () => {
  if (tasksCurrentPage > 1) loadTasks(tasksCurrentPage - 1);
});
nextPageBtn.addEventListener("click", () => {
  if (tasksCurrentPage < tasksTotalPages) loadTasks(tasksCurrentPage + 1);
});

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = taskForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  taskFormError.classList.add("hidden");

  try {
    await createTask({
      member_id: Number(taskMember.value),
      category_id: Number(taskCategory.value),
      date: taskDate.value,
      time_spent: Number(taskTime.value),
      description: taskDesc.value.trim(),
    });
    closeModal();
    loadTasks();
  } catch (err) {
    taskFormError.textContent = err.message;
    taskFormError.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

// -- Categories modal --
categoriesBtn.addEventListener("click", openCatModal);
catModalCloseBtn.addEventListener("click", closeCatModal);
catModalOverlay.addEventListener("click", (e) => {
  if (e.target === catModalOverlay) closeCatModal();
});

catForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = catForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  catFormError.classList.add("hidden");

  try {
    await createCategory(catName.value.trim());
    catName.value = "";
    const cats = await fetchCategories();
    renderCatList(cats);
  } catch (err) {
    catFormError.textContent = err.message;
    catFormError.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

// -- Stats filters --
filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const range = chip.dataset.range;
    setActiveChip(range);
    statsWeek.value = "";
    statsMonth.value = "";
    statsYear.value = "";
    const { start_date, end_date } = getDateRange(range);
    loadStats(start_date, end_date);
  });
});

statsWeek.addEventListener("change", () => {
  if (!statsWeek.value) return;
  setActiveChip(null);
  statsMonth.value = "";
  statsYear.value = "";
  const { start_date, end_date } = weekInputToRange(statsWeek.value);
  loadStats(start_date, end_date);
});

statsMonth.addEventListener("change", () => {
  if (!statsMonth.value) return;
  setActiveChip(null);
  statsWeek.value = "";
  statsYear.value = "";
  const { start_date, end_date } = monthInputToRange(statsMonth.value);
  loadStats(start_date, end_date);
});

statsYear.addEventListener("change", () => {
  if (!statsYear.value) return;
  setActiveChip(null);
  statsWeek.value = "";
  statsMonth.value = "";
  const y = Number(statsYear.value);
  const start_date = `${y}-01-01`;
  const end_date = `${y}-12-31`;
  loadStats(start_date, end_date);
});

// -- Bottom nav --
bottomNavItems.forEach((btn) => {
  btn.addEventListener("click", () => navigateTo(btn.dataset.page));
});

// ---- Init ----
if (token) {
  navigateTo("tasks");
} else {
  showPage(loginPage);
}

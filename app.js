const API_BASE = "https://task-api-v79e.onrender.com/api";

// ---- DOM refs ----
const loginPage = document.getElementById("login-page");
const tasksPage = document.getElementById("tasks-page");
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const tasksLoading = document.getElementById("tasks-loading");
const tasksError = document.getElementById("tasks-error");
const tasksTable = document.getElementById("tasks-table");
const tasksBody = document.getElementById("tasks-body");
const noTasks = document.getElementById("no-tasks");

// ---- State ----
let token = sessionStorage.getItem("jwt");

// ---- Helpers ----
function showPage(page) {
  loginPage.classList.add("hidden");
  tasksPage.classList.add("hidden");
  page.classList.remove("hidden");
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
async function fetchTasks() {
  const res = await fetch(`${API_BASE}/tasks`, {
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

function renderTasks(tasks) {
  tasksBody.innerHTML = "";
  tasksError.classList.add("hidden");
  tasksLoading.classList.add("hidden");

  if (tasks.length === 0) {
    tasksTable.classList.add("hidden");
    noTasks.classList.remove("hidden");
    return;
  }

  noTasks.classList.add("hidden");
  tasksTable.classList.remove("hidden");

  for (const task of tasks) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${task.id}</td>
      <td>${task.date}</td>
      <td>${task.description}</td>
      <td>${task.category_id}</td>
      <td>${formatMinutes(task.time_spent)}</td>
    `;
    tasksBody.appendChild(tr);
  }
}

async function loadTasks() {
  tasksLoading.classList.remove("hidden");
  tasksTable.classList.add("hidden");
  noTasks.classList.add("hidden");
  tasksError.classList.add("hidden");

  try {
    const tasks = await fetchTasks();
    renderTasks(tasks);
  } catch (err) {
    tasksError.textContent = err.message;
    tasksError.classList.remove("hidden");
    tasksLoading.classList.add("hidden");
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
    showPage(tasksPage);
    loadTasks();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

logoutBtn.addEventListener("click", logout);

// ---- Init ----
if (token) {
  showPage(tasksPage);
  loadTasks();
} else {
  showPage(loginPage);
}

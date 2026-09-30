const STORAGE_KEY = "office-todo-v1";
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MEMBERS = [
  "하수진 차장",
  "김의연 과장",
  "서리나 과장",
  "김철구 대리",
  "임은정 대리",
  "진현호 사원",
];
const ALL = "ALL";

const els = {
  memberTabs: document.getElementById("member-tabs"),
  monthLabel: document.getElementById("month-label"),
  calendarGrid: document.getElementById("calendar-grid"),
  prevMonth: document.getElementById("prev-month"),
  nextMonth: document.getElementById("next-month"),
  goToday: document.getElementById("go-today"),
  progress: document.getElementById("progress"),
  selectedDateLabel: document.getElementById("selected-date-label"),
  todoForm: document.getElementById("todo-form"),
  todoTitle: document.getElementById("todo-title"),
  todoAssignee: document.getElementById("todo-assignee"),
  todoPriority: document.getElementById("todo-priority"),
  todoDeadline: document.getElementById("todo-deadline"),
  todoList: document.getElementById("todo-list"),
  emptyState: document.getElementById("empty-state"),
};

const today = startOfDay(new Date());
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();
let selectedDate = formatDate(today);
let selectedMember = ALL;
let todos = loadTodos();

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // 저장소를 쓸 수 없는 환경(시크릿 모드 등)에서는 메모리에만 유지
  }
}

function padMonth(value) {
  return String(value).padStart(2, "0");
}

function visibleTodos() {
  if (selectedMember === ALL) return todos;
  return todos.filter((todo) => todo.assignee === selectedMember);
}

function renderMemberTabs() {
  els.memberTabs.replaceChildren();
  const dayTodos = todos.filter((todo) => todo.date === selectedDate);

  for (const member of [ALL, ...MEMBERS]) {
    const mine = member === ALL ? dayTodos : dayTodos.filter((t) => t.assignee === member);
    const done = mine.filter((t) => t.done).length;

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "member-tab";
    tab.setAttribute("aria-pressed", String(member === selectedMember));
    if (member === selectedMember) tab.classList.add("is-active");
    if (mine.length > 0 && done === mine.length) tab.classList.add("is-complete");

    const name = document.createElement("span");
    name.className = "member-name";
    name.textContent = member === ALL ? "TEAM ALL" : member;
    const count = document.createElement("span");
    count.className = "member-count";
    count.textContent = mine.length ? `${done}/${mine.length}` : "—";
    tab.append(name, count);

    tab.addEventListener("click", () => {
      selectedMember = member;
      if (member !== ALL) els.todoAssignee.value = member;
      render();
    });

    els.memberTabs.appendChild(tab);
  }
}

function renderCalendar() {
  els.monthLabel.textContent = `${viewYear}. ${padMonth(viewMonth + 1)}`;
  els.calendarGrid.replaceChildren();

  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const todayKey = formatDate(today);

  const counts = {};
  const urgentDays = new Set();
  for (const todo of visibleTodos()) {
    counts[todo.date] = (counts[todo.date] || 0) + 1;
    if (todo.priority === "urgent" && !todo.done) {
      urgentDays.add(todo.date);
    }
  }

  for (let i = 0; i < startWeekday; i += 1) {
    const cell = document.createElement("div");
    cell.className = "day empty";
    cell.setAttribute("aria-hidden", "true");
    els.calendarGrid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(viewYear, viewMonth, day);
    const key = formatDate(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day";
    button.dataset.date = key;
    button.setAttribute("aria-label", key);

    if (key === todayKey) button.classList.add("is-today");
    if (key === selectedDate) button.classList.add("is-selected");

    const num = document.createElement("span");
    num.className = "day-num";
    num.textContent = String(day);
    button.appendChild(num);

    const dot = document.createElement("span");
    dot.className = "day-dot";
    if (!counts[key]) {
      dot.classList.add("hidden");
    } else if (urgentDays.has(key)) {
      dot.classList.add("urgent");
    }
    button.appendChild(dot);

    button.addEventListener("click", () => {
      selectedDate = key;
      render();
    });

    els.calendarGrid.appendChild(button);
  }
}

function formatSelectedLabel(iso) {
  const date = parseDate(iso);
  const weekday = WEEKDAYS[date.getDay()];
  return `${iso.replaceAll("-", ".")}  ${weekday}`;
}

// 마감일 표시: "DUE 10.02 · D-2" / "D-DAY" / "OVERDUE"
function formatDeadline(todo) {
  if (!todo.deadline) return null;
  const due = parseDate(todo.deadline);
  const diff = Math.round((due - today) / 86400000);
  const label = `DUE ${padMonth(due.getMonth() + 1)}.${padMonth(due.getDate())}`;
  if (todo.done) return { text: label, overdue: false };
  if (diff < 0) return { text: `${label} · OVERDUE`, overdue: true };
  if (diff === 0) return { text: `${label} · D-DAY`, overdue: false };
  return { text: `${label} · D-${diff}`, overdue: false };
}

function createTodoItem(todo) {
  const item = document.createElement("li");
  item.className = "todo-item";
  if (todo.priority === "urgent") item.classList.add("is-urgent");
  if (todo.done) item.classList.add("is-done");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "todo-check";
  checkbox.checked = todo.done;
  checkbox.setAttribute("aria-label", `${todo.title} 완료`);
  checkbox.addEventListener("change", () => {
    todo.done = checkbox.checked;
    saveTodos();
    render();
  });

  const body = document.createElement("div");
  const title = document.createElement("p");
  title.className = "todo-title";
  title.textContent = todo.title;

  const meta = document.createElement("p");
  meta.className = "todo-meta";
  const tag = document.createElement("span");
  tag.className = "priority-tag";
  tag.textContent = todo.priority === "urgent" ? "URGENT" : "NORMAL";
  meta.appendChild(tag);

  const deadline = formatDeadline(todo);
  if (deadline) {
    const due = document.createElement("span");
    due.className = "deadline-tag";
    if (deadline.overdue) due.classList.add("is-overdue");
    due.textContent = deadline.text;
    meta.appendChild(due);
  }
  body.append(title, meta);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "delete-btn";
  del.textContent = "Delete";
  del.addEventListener("click", () => {
    todos = todos.filter((entry) => entry.id !== todo.id);
    saveTodos();
    render();
  });

  item.append(checkbox, body, del);
  return item;
}

function renderTodos() {
  els.selectedDateLabel.textContent = formatSelectedLabel(selectedDate);

  // 미완료 → 완료 순, 그 안에서 긴급 우선, 마감 임박 우선
  const rank = (todo) => (todo.done ? 2 : 0) + (todo.priority === "urgent" ? 0 : 1);
  const dayTodos = visibleTodos()
    .filter((todo) => todo.date === selectedDate)
    .sort(
      (a, b) =>
        rank(a) - rank(b) || (a.deadline || "9999").localeCompare(b.deadline || "9999")
    );
  const doneCount = dayTodos.filter((todo) => todo.done).length;
  els.progress.textContent = dayTodos.length ? `${doneCount} / ${dayTodos.length} DONE` : "";
  els.progress.classList.toggle("is-complete", dayTodos.length > 0 && doneCount === dayTodos.length);
  els.todoList.replaceChildren();
  els.emptyState.classList.toggle("hidden", dayTodos.length > 0);

  if (selectedMember !== ALL) {
    for (const todo of dayTodos) els.todoList.appendChild(createTodoItem(todo));
    return;
  }

  // 전체 보기: 팀원별로 묶어서 표시 (담당자 없는 예전 데이터는 맨 아래)
  const groups = [...MEMBERS, ""];
  for (const member of groups) {
    const mine = dayTodos.filter((todo) => (todo.assignee || "") === member);
    if (!mine.length) continue;

    const heading = document.createElement("li");
    heading.className = "group-heading";
    heading.textContent = member || "미지정";
    els.todoList.appendChild(heading);
    for (const todo of mine) els.todoList.appendChild(createTodoItem(todo));
  }
}

function render() {
  renderMemberTabs();
  renderCalendar();
  renderTodos();
}

for (const member of MEMBERS) {
  const option = document.createElement("option");
  option.value = member;
  option.textContent = member;
  els.todoAssignee.appendChild(option);
}

els.prevMonth.addEventListener("click", () => {
  if (viewMonth === 0) {
    viewYear -= 1;
    viewMonth = 11;
  } else {
    viewMonth -= 1;
  }
  renderCalendar();
});

els.nextMonth.addEventListener("click", () => {
  if (viewMonth === 11) {
    viewYear += 1;
    viewMonth = 0;
  } else {
    viewMonth += 1;
  }
  renderCalendar();
});

els.goToday.addEventListener("click", () => {
  viewYear = today.getFullYear();
  viewMonth = today.getMonth();
  selectedDate = formatDate(today);
  render();
});

els.todoPriority.addEventListener("change", () => {
  els.todoPriority.classList.toggle("is-urgent", els.todoPriority.value === "urgent");
});

els.todoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = els.todoTitle.value.trim();
  if (!title) return;

  const assignee = els.todoAssignee.value;
  todos.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: selectedDate,
    title,
    assignee,
    priority: els.todoPriority.value === "urgent" ? "urgent" : "normal",
    deadline: els.todoDeadline.value || "",
    done: false,
  });
  saveTodos();
  els.todoForm.reset();
  els.todoAssignee.value = assignee;
  els.todoPriority.value = "normal";
  els.todoPriority.classList.remove("is-urgent");
  render();
  els.todoTitle.focus();
});

render();

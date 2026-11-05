const STORAGE_KEY = "clubExpenseData";

let data;
try {
  data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { events: [], transactions: [] };
} catch {
  data = { events: [], transactions: [] };
}

const el = (id) => document.getElementById(id);

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmt(n) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function eventTotals(eventId) {
  const txs = data.transactions.filter((t) => t.eventId === eventId);
  const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense };
}

/* ---------- Rendering ---------- */

function renderEventOptions() {
  const txEvent = el("txEvent");
  const filter = el("filterEvent");
  const currentFilter = filter.value;

  txEvent.innerHTML = data.events.length
    ? data.events.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join("")
    : `<option value="">Create an event first</option>`;

  filter.innerHTML = `<option value="all">All events</option>` +
    data.events.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join("");

  if ([...filter.options].some((o) => o.value === currentFilter)) {
    filter.value = currentFilter;
  }
}

function renderSummary() {
  const income = data.transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = data.transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  el("totalIncome").textContent = fmt(income);
  el("totalExpense").textContent = fmt(expense);

  const balEl = el("balance");
  balEl.textContent = fmt(balance);
  balEl.className = balance < 0 ? "negative" : "positive";
}

function renderBudgets() {
  const container = el("budgetList");
  if (!data.events.length) {
    container.innerHTML = `<p class="empty">No events yet. Create one to set a budget.</p>`;
    return;
  }

  container.innerHTML = data.events.map((e) => {
    const { income, expense } = eventTotals(e.id);
    const pct = e.budget > 0 ? Math.min((expense / e.budget) * 100, 100) : 0;
    const cls = expense > e.budget ? "over" : pct >= 80 ? "warn" : "";
    const remaining = e.budget - expense;

    return `
      <div class="budget-item">
        <div class="budget-head">
          <strong>${esc(e.name)}</strong>
          <span>${fmt(expense)} / ${fmt(e.budget)}</span>
        </div>
        <div class="bar"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="budget-head">
          <span>Raised: ${fmt(income)}</span>
          <span>${remaining >= 0 ? "Left: " + fmt(remaining) : "Over by " + fmt(-remaining)}</span>
        </div>
      </div>`;
  }).join("");
}

function renderTransactions() {
  const filterId = el("filterEvent").value;
  const eventName = Object.fromEntries(data.events.map((e) => [e.id, e.name]));

  const rows = data.transactions
    .filter((t) => filterId === "all" || t.eventId === filterId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const body = el("txBody");
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7" class="empty">No transactions to show.</td></tr>`;
    return;
  }

  body.innerHTML = rows.map((t) => `
    <tr>
      <td>${esc(t.date)}</td>
      <td>${esc(eventName[t.eventId] || "Deleted event")}</td>
      <td>${esc(t.desc)}</td>
      <td><span class="tag">${esc(t.category)}</span></td>
      <td>${esc(t.person || "-")}</td>
      <td class="right ${t.type === "income" ? "amt-income" : "amt-expense"}">
        ${t.type === "income" ? "+" : "-"}${fmt(t.amount)}
      </td>
      <td><button class="btn-danger" data-id="${t.id}">Delete</button></td>
    </tr>`).join("");
}

function renderCategories() {
  const totals = {};
  data.transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const container = el("categoryChart");

  if (!entries.length) {
    container.innerHTML = `<p class="empty">No expenses recorded yet.</p>`;
    return;
  }

  const max = entries[0][1];
  container.innerHTML = entries.map(([cat, amount]) => `
    <div class="cat-row">
      <span>${esc(cat)}</span>
      <div class="bar"><div class="bar-fill" style="width:${(amount / max) * 100}%"></div></div>
      <span class="amount">${fmt(amount)}</span>
    </div>`).join("");
}

function renderAll() {
  renderEventOptions();
  renderSummary();
  renderBudgets();
  renderTransactions();
  renderCategories();
}

/* ---------- Actions ---------- */

el("eventForm").addEventListener("submit", (e) => {
  e.preventDefault();
  data.events.push({
    id: Date.now().toString(),
    name: el("eventName").value.trim(),
    budget: parseFloat(el("eventBudget").value) || 0
  });
  save();
  e.target.reset();
  renderAll();
});

el("txForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!el("txEvent").value) {
    alert("Please create an event first.");
    return;
  }
  data.transactions.push({
    id: Date.now().toString(),
    eventId: el("txEvent").value,
    type: el("txType").value,
    desc: el("txDesc").value.trim(),
    amount: parseFloat(el("txAmount").value),
    category: el("txCategory").value,
    person: el("txPerson").value.trim(),
    date: el("txDate").value
  });
  save();
  e.target.reset();
  el("txDate").value = new Date().toISOString().slice(0, 10);
  renderAll();
});

el("txBody").addEventListener("click", (e) => {
  if (!e.target.matches("button[data-id]")) return;
  if (!confirm("Delete this transaction?")) return;
  data.transactions = data.transactions.filter((t) => t.id !== e.target.dataset.id);
  save();
  renderAll();
});

el("filterEvent").addEventListener("change", renderTransactions);

el("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = current;
  localStorage.setItem("theme", current);
});

/* ---------- Init ---------- */

document.documentElement.dataset.theme = localStorage.getItem("theme") || "dark";
el("txDate").value = new Date().toISOString().slice(0, 10);
renderAll();
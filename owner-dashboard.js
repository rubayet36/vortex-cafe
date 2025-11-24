const SUPABASE_URL = 'https://ovxxnsrqzdlyzdmubwaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92eHhuc3JxemRseXpkbXVid2F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY4MTgsImV4cCI6MjA3OTU1MjgxOH0.uwU9aQGbUO7OEv4HI8Rtq7awANWNubt3yJTSUMZRAJU';

const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loading = document.getElementById('loading');
const analyticsContent = document.getElementById('analytics-content');
const noDataMsg = document.getElementById('no-data-msg');

const filterBtns = document.querySelectorAll('.filter-btn');
const dateRangePickerEl = document.getElementById('date-range-picker');

const totalRevenueEl = document.getElementById('total-revenue');
const totalOrdersEl = document.getElementById('total-orders');
const netProfitEl = document.getElementById('net-profit');
const lowStockCountEl = document.getElementById('low-stock-count');

const cafeTransactionsEl = document.getElementById('cafe-transactions');
const suppTransactionsEl = document.getElementById('supp-transactions');

const topSuppByRevenueEl = document.getElementById('top-supp-by-revenue');
const topSuppByUnitsEl = document.getElementById('top-supp-by-units');
const lowStockListEl = document.getElementById('low-stock-list');

const expenseForm = document.getElementById('expense-form');
const expDescEl = document.getElementById('exp-description');
const expAmountEl = document.getElementById('exp-amount');
const expCategoryEl = document.getElementById('exp-category');
const expenseListEl = document.getElementById('expense-list');

const exportCafeBtn = document.getElementById('export-cafe');
const exportSuppBtn = document.getElementById('export-supp');

let range = { from: null, to: null };
let cafeOrders = [];
let suppOrders = [];
let suppItems = [];
let supplementProductsById = {};
let expenses = [];
let cafeOrderItems = [];
let menuItemsById = {};

function formatBDT(n) {
  return (
    '৳' +
    Number(n || 0).toLocaleString('en-BD', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// normalize payment method names
function prettyPaymentMethod(m) {
  if (!m) return '—';
  const val = String(m).toLowerCase();
  if (val === 'bkash') return 'bKash';
  if (val === 'card') return 'Card';
  if (val === 'cash') return 'Cash';
  return 'Other';
}

// sum revenue per payment method for a list of orders
function getPaymentBreakdown(orders) {
  const totals = { cash: 0, bkash: 0, card: 0, other: 0 };

  orders.forEach((o) => {
    const payments = o.payments || [];
    if (!payments.length) return;
    const last = payments[payments.length - 1];
    const method = (last.method || '').toLowerCase();
    const amt = Number(o.total_amount || 0);

    if (method === 'cash') totals.cash += amt;
    else if (method === 'bkash') totals.bkash += amt;
    else if (method === 'card') totals.card += amt;
    else totals.other += amt;
  });

  return totals;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function applyQuickRange(code) {
  const now = new Date();
  if (code === 'today') {
    range = { from: startOfDay(now), to: endOfDay(now) };
  } else if (code === '7d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    range = { from: startOfDay(from), to: endOfDay(now) };
  } else if (code === '30d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    range = { from: startOfDay(from), to: endOfDay(now) };
  }
}

const iso = (d) => d.toISOString();

function initDatePicker() {
  flatpickr(dateRangePickerEl, {
    mode: 'range',
    dateFormat: 'Y-m-d',
    onClose: (selectedDates) => {
      if (selectedDates.length === 2) {
        range = {
          from: startOfDay(selectedDates[0]),
          to: endOfDay(selectedDates[1]),
        };
        refresh();
      }
    },
  });
}

async function fetchCafeOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, payments(*)') // include payments
    .eq('status', 'Delivery Complete')
    .gte('created_at', iso(range.from))
    .lte('created_at', iso(range.to))
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function fetchCafeOrderItems(orderIds) {
  if (!orderIds.length) return [];
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id,menu_item_id,quantity,price_at_order')
    .in('order_id', orderIds);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function fetchMenuItems() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('id,name,category');
  if (error) {
    console.error(error);
    return {};
  }
  const map = {};
  (data || []).forEach((item) => (map[item.id] = item));
  return map;
}

async function fetchSuppOrders() {
  const { data, error } = await supabase
    .from('supplement_orders')
    // alias FK just like in the staff dashboard: payments for supplements
    .select('*, payments:payments_supplement_order_id_fkey(*)')
    .eq('status', 'Completed')
    .gte('created_at', iso(range.from))
    .lte('created_at', iso(range.to))
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function fetchSuppOrderItemsFor(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('supplement_order_items')
    .select('order_id,supplement_product_id,quantity,price_at_order')
    .in('order_id', ids);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function fetchSuppProductsMap() {
  const { data, error } = await supabase
    .from('supplement_products')
    .select('id,name,brand,buying_price,stock');
  if (error) {
    console.error(error);
    return {};
  }
  const map = {};
  (data || []).forEach((p) => (map[p.id] = p));
  return map;
}

async function fetchExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .gte('created_at', iso(range.from))
    .lte('created_at', iso(range.to))
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function fetchLowStock() {
  const { data, error } = await supabase
    .from('supplement_products')
    .select('id,name,brand,stock')
    .lte('stock', 5)
    .order('stock', { ascending: true })
    .limit(12);
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

function renderTransactionsList(target, rows, kind) {
  target.innerHTML = '';
  if (!rows.length) {
    target.innerHTML = `<p class="empty-message">No ${kind} transactions found.</p>`;
    return;
  }
  const display = rows.slice(0, 10);
  display.forEach((tx) => {
    const el = document.createElement('div');
    el.className = 'tx-item';
    el.innerHTML = `
      <div class="tx-left">
        <span class="tx-title">${tx.customer_name || 'Walk-in'}</span>
        <span class="tx-sub">${new Date(tx.created_at).toLocaleString()} • ${
          kind === 'cafe' ? 'Cafe #' : 'Supp #'
        }${String(tx.id).slice(0, 6).toUpperCase()}</span>
      </div>
      <div class="tx-amount">${formatBDT(tx.total_amount)}</div>
    `;
    target.appendChild(el);
  });
}

function renderCafeStats() {
  const totalSales = cafeOrders.reduce(
    (s, o) => s + Number(o.total_amount || 0),
    0
  );
  const orderCount = cafeOrders.length;

  document.getElementById('cafe-total-sales').textContent =
    formatBDT(totalSales);
  document.getElementById('cafe-total-orders').textContent =
    String(orderCount);

  // Show payment breakdown instead of average order value
  const cafePay = getPaymentBreakdown(cafeOrders);
  let cafeBreakdown =
    `Cash: ${formatBDT(cafePay.cash)} • ` +
    `bKash: ${formatBDT(cafePay.bkash)} • ` +
    `Card: ${formatBDT(cafePay.card)}`;
  if (cafePay.other > 0) {
    cafeBreakdown += ` • Other: ${formatBDT(cafePay.other)}`;
  }
  document.getElementById('cafe-avg-order').textContent = cafeBreakdown;

  const itemStats = {};
  cafeOrderItems.forEach((item) => {
    const menuId = item.menu_item_id;
    if (!itemStats[menuId]) {
      itemStats[menuId] = { quantity: 0, revenue: 0 };
    }
    itemStats[menuId].quantity += Number(item.quantity || 0);
    itemStats[menuId].revenue +=
      Number(item.price_at_order || 0) * Number(item.quantity || 0);
  });

  const sortedByRevenue = Object.entries(itemStats).sort(
    (a, b) => b[1].revenue - a[1].revenue
  );

  const mostSold = sortedByRevenue.slice(0, 5);
  const leastSold = sortedByRevenue.slice(-5).reverse();

  const mostSoldEl = document.getElementById('cafe-most-sold');
  if (mostSold.length) {
    mostSoldEl.innerHTML = mostSold
      .map(([id, stats]) => {
        const menuItem = menuItemsById[id] || {};
        return `
        <div class="product-card">
          <div class="product-info">
            <h3>${menuItem.name || 'Unknown Item'}</h3>
            <p>${menuItem.category || 'Uncategorized'}</p>
          </div>
          <div class="product-stats">
            <p class="product-stat">${formatBDT(stats.revenue)}</p>
            <p class="product-stat-label">${stats.quantity} sold</p>
          </div>
        </div>
      `;
      })
      .join('');
  } else {
    mostSoldEl.innerHTML =
      '<p class="empty-message">No sales data available.</p>';
  }

  const leastSoldEl = document.getElementById('cafe-least-sold');
  if (leastSold.length) {
    leastSoldEl.innerHTML = leastSold
      .map(([id, stats]) => {
        const menuItem = menuItemsById[id] || {};
        return `
        <div class="product-card">
          <div class="product-info">
            <h3>${menuItem.name || 'Unknown Item'}</h3>
            <p>${menuItem.category || 'Uncategorized'}</p>
          </div>
          <div class="product-stats">
            <p class="product-stat">${formatBDT(stats.revenue)}</p>
            <p class="product-stat-label">${stats.quantity} sold</p>
          </div>
        </div>
      `;
      })
      .join('');
  } else {
    leastSoldEl.innerHTML =
      '<p class="empty-message">No sales data available.</p>';
  }

  const allItemsEl = document.getElementById('cafe-all-items');
  if (sortedByRevenue.length) {
    allItemsEl.innerHTML = sortedByRevenue
      .map(([id, stats]) => {
        const menuItem = menuItemsById[id] || {};
        return `
        <div class="tx-item">
          <div class="tx-left">
            <span class="tx-title">${menuItem.name || 'Unknown Item'}</span>
            <span class="tx-sub">${menuItem.category || 'Uncategorized'} • ${
          stats.quantity
        } units sold</span>
          </div>
          <div class="tx-amount">${formatBDT(stats.revenue)}</div>
        </div>
      `;
      })
      .join('');
  } else {
    allItemsEl.innerHTML =
      '<p class="empty-message">No menu items sold in this period.</p>';
  }
}

function renderSupplementStats() {
  const totalSales = suppOrders.reduce(
    (s, o) => s + Number(o.total_amount || 0),
    0
  );
  const totalUnits = suppItems.reduce(
    (s, i) => s + Number(i.quantity || 0),
    0
  );

  const buyMap = supplementProductsById;
  const totals = suppItems.reduce(
    (acc, it) => {
      const id = it.supplement_product_id;
      const qty = Number(it.quantity || 0);
      const sale = Number(it.price_at_order || 0) * qty;
      const cost = Number(buyMap[id]?.buying_price || 0) * qty;
      acc.sale += sale;
      acc.cost += cost;
      return acc;
    },
    { sale: 0, cost: 0 }
  );

  // we still compute margin (in case you want it later),
  // but we don't display it – we show payment breakdown instead
  const profitMargin =
    totals.sale > 0 ? ((totals.sale - totals.cost) / totals.sale) * 100 : 0;

  document.getElementById('supp-total-sales').textContent =
    formatBDT(totalSales);
  document.getElementById('supp-units-sold').textContent =
    String(totalUnits);

  const suppPay = getPaymentBreakdown(suppOrders);
  let suppBreakdown =
    `Cash: ${formatBDT(suppPay.cash)} • ` +
    `bKash: ${formatBDT(suppPay.bkash)} • ` +
    `Card: ${formatBDT(suppPay.card)}`;
  if (suppPay.other > 0) {
    suppBreakdown += ` • Other: ${formatBDT(suppPay.other)}`;
  }
  document.getElementById('supp-profit-margin').textContent = suppBreakdown;
}

function renderTopSupplements(items, prodMap) {
  const revenueById = {};
  const unitsById = {};
  (items || []).forEach((it) => {
    const id = it.supplement_product_id;
    const qty = Number(it.quantity || 0);
    const sale = Number(it.price_at_order || 0) * qty;
    revenueById[id] = (revenueById[id] || 0) + sale;
    unitsById[id] = (unitsById[id] || 0) + qty;
  });

  const topRev = Object.entries(revenueById)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const topQty = Object.entries(unitsById)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const leastQty = Object.entries(unitsById)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 8);

  topSuppByRevenueEl.innerHTML = topRev.length
    ? topRev
        .map(([id, amt]) => {
          const p = prodMap[id] || {};
          return `<li><span>${p.name || 'Unknown'} <span class="tx-sub">(${
            p.brand || '—'
          })</span></span><span class="badge badge-success">${formatBDT(
            amt
          )}</span></li>`;
        })
        .join('')
    : `<li class="tx-sub">No supplement revenue in this period.</li>`;

  topSuppByUnitsEl.innerHTML = topQty.length
    ? topQty
        .map(([id, qty]) => {
          const p = prodMap[id] || {};
          return `<li><span>${p.name || 'Unknown'} <span class="tx-sub">(${
            p.brand || '—'
          })</span></span><span class="badge badge-info">${qty} pcs</span></li>`;
        })
        .join('')
    : `<li class="tx-sub">No supplement units in this period.</li>`;

  const leastSuppEl = document.getElementById('least-supp-by-units');
  if (leastSuppEl) {
    leastSuppEl.innerHTML = leastQty.length
      ? leastQty
          .map(([id, qty]) => {
            const p = prodMap[id] || {};
            return `<li><span>${p.name || 'Unknown'} <span class="tx-sub">(${
              p.brand || '—'
            })</span></span><span class="badge badge-warning">${qty} pcs</span></li>`;
          })
          .join('')
      : `<li class="tx-sub">No supplement data available.</li>`;
  }
}

function renderLowStock(list) {
  lowStockListEl.innerHTML = list.length
    ? list
        .map(
          (p) =>
            `<li><span>${p.name} <span class="tx-sub">(${
              p.brand || '—'
            })</span></span><span class="badge badge-danger">${p.stock} left</span></li>`
        )
        .join('')
    : `<li class="tx-sub">All good. No low-stock items.</li>`;
  lowStockCountEl.textContent = list.length;

  const suppLowStockEl = document.getElementById('supp-low-stock-list');
  if (suppLowStockEl) {
    suppLowStockEl.innerHTML = lowStockListEl.innerHTML;
  }
}

function renderExpenses(list) {
  expenseListEl.innerHTML = list.length
    ? list
        .map(
          (e) => `
      <li>
        <span>${e.description} <span class="tx-sub">(${
            e.category || '—'
          }) • ${new Date(e.created_at).toLocaleDateString()}</span></span>
        <span class="badge badge-danger">-${formatBDT(e.amount)}</span>
      </li>
    `
        )
        .join('')
    : `<li class="tx-sub">No expenses logged for this period.</li>`;

  const expTotal = list.reduce((s, e) => s + Number(e.amount || 0), 0);
  const expCount = list.length;
  const expAvg = expCount > 0 ? expTotal / expCount : 0;

  const expTotalEl = document.getElementById('exp-total');
  const expCountEl = document.getElementById('exp-count');
  const expAvgEl = document.getElementById('exp-avg');

  if (expTotalEl) expTotalEl.textContent = formatBDT(expTotal);
  if (expCountEl) expCountEl.textContent = String(expCount);
  if (expAvgEl) expAvgEl.textContent = formatBDT(expAvg);
}

function renderAllTransactions() {
  const allTx = [];

  cafeOrders.forEach((order) => {
    const payments = order.payments || [];
    const last = payments[payments.length - 1] || null;
    const methodLabel = last ? prettyPaymentMethod(last.method) : '—';

    allTx.push({
      date: new Date(order.created_at),
      type: 'Café',
      customer: methodLabel, // show payment type
      orderId: String(order.id).slice(0, 8).toUpperCase(),
      amount: Number(order.total_amount || 0),
    });
  });

  suppOrders.forEach((order) => {
    const payments = order.payments || [];
    const last = payments[payments.length - 1] || null;
    const methodLabel = last ? prettyPaymentMethod(last.method) : '—';

    allTx.push({
      date: new Date(order.created_at),
      type: 'Supplement',
      customer: methodLabel, // show payment type
      orderId: String(order.id).slice(0, 8).toUpperCase(),
      amount: Number(order.total_amount || 0),
    });
  });

  expenses.forEach((exp) => {
    allTx.push({
      date: new Date(exp.created_at),
      type: 'Expense',
      customer: exp.category || 'General',
      orderId: exp.description,
      amount: -Number(exp.amount || 0),
    });
  });

  allTx.sort((a, b) => b.date - a.date);

  const tbody = document.getElementById('all-transactions-body');
  tbody.innerHTML = allTx
    .map(
      (tx) => `
    <tr>
      <td>${tx.date.toLocaleString()}</td>
      <td><span class="badge ${
        tx.type === 'Expense' ? 'badge-danger' : 'badge-info'
      }">${tx.type}</span></td>
      <td>${tx.customer}</td>
      <td>${tx.orderId}</td>
      <td class="${
        tx.amount < 0 ? 'tx-amount negative' : 'tx-amount'
      }">${formatBDT(Math.abs(tx.amount))}</td>
    </tr>
  `
    )
    .join('');

  const totalRevenue =
    cafeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0) +
    suppOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const totalExpenses = expenses.reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );
  const netIncome = totalRevenue - totalExpenses;

  document.getElementById('all-tx-count').textContent = String(
    allTx.length
  );
  document.getElementById('all-tx-revenue').textContent =
    formatBDT(totalRevenue);
  document.getElementById('all-tx-expenses').textContent =
    formatBDT(totalExpenses);
  document.getElementById('all-tx-net').textContent =
    formatBDT(netIncome);

  const searchBox = document.getElementById('tx-search');
  searchBox.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allTx.filter(
      (tx) =>
        tx.customer.toLowerCase().includes(query) ||
        tx.orderId.toLowerCase().includes(query) ||
        tx.type.toLowerCase().includes(query)
    );
    tbody.innerHTML = filtered
      .map(
        (tx) => `
      <tr>
        <td>${tx.date.toLocaleString()}</td>
        <td><span class="badge ${
          tx.type === 'Expense' ? 'badge-danger' : 'badge-info'
        }">${tx.type}</span></td>
        <td>${tx.customer}</td>
        <td>${tx.orderId}</td>
        <td class="${
          tx.amount < 0 ? 'tx-amount negative' : 'tx-amount'
        }">${formatBDT(Math.abs(tx.amount))}</td>
      </tr>
    `
      )
      .join('');
  });
}

function aggregates() {
  const cafeRevenue = cafeOrders.reduce(
    (s, o) => s + Number(o.total_amount || 0),
    0
  );
  const suppRevenue = suppOrders.reduce(
    (s, o) => s + Number(o.total_amount || 0),
    0
  );
  const totalRevenue = cafeRevenue + suppRevenue;
  const ordersCount = cafeOrders.length + suppOrders.length;

  totalRevenueEl.textContent = formatBDT(totalRevenue);
  totalOrdersEl.textContent = String(ordersCount);

  const buyMap = supplementProductsById;
  const totals = (suppItems || []).reduce(
    (acc, it) => {
      const id = it.supplement_product_id;
      const qty = Number(it.quantity || 0);
      const sale = Number(it.price_at_order || 0) * qty;
      const cost = Number(buyMap[id]?.buying_price || 0) * qty;
      acc.sale += sale;
      acc.cost += cost;
      return acc;
    },
    { sale: 0, cost: 0 }
  );

  const netProfit = totals.sale - totals.cost;
  netProfitEl.textContent = formatBDT(netProfit);
}

function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const head = cols.join(',');
  const body = rows
    .map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))
    .join('\n');
  return head + '\n' + body;
}

function download(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  document.body.removeChild(a);
}

async function refresh() {
  loading.classList.add('visible');
  analyticsContent.classList.add('hidden');
  noDataMsg.classList.add('hidden');

  const [cafe, supp, exp, prodMap, menuMap] = await Promise.all([
    fetchCafeOrders(),
    fetchSuppOrders(),
    fetchExpenses(),
    fetchSuppProductsMap(),
    fetchMenuItems(),
  ]);
  cafeOrders = cafe;
  suppOrders = supp;
  expenses = exp;
  supplementProductsById = prodMap;
  menuItemsById = menuMap;

  suppItems = await fetchSuppOrderItemsFor(suppOrders.map((o) => o.id));
  cafeOrderItems = await fetchCafeOrderItems(cafeOrders.map((o) => o.id));

  renderTransactionsList(cafeTransactionsEl, cafeOrders, 'cafe');
  renderTransactionsList(suppTransactionsEl, suppOrders, 'supplements');
  renderTopSupplements(suppItems, supplementProductsById);
  renderCafeStats();
  renderSupplementStats();
  renderAllTransactions();

  const lowStock = await fetchLowStock();
  renderLowStock(lowStock);
  renderExpenses(expenses);

  aggregates();

  const hasAny = cafeOrders.length || suppOrders.length;
  noDataMsg.classList.toggle('hidden', !!hasAny);
  loading.classList.remove('visible');
  analyticsContent.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
}

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach((content) => {
        content.classList.remove('active');
      });

      const targetContent = document.getElementById(`tab-${targetTab}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      if (window.lucide) lucide.createIcons();
    });
  });
}

function setupEvents() {
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const r = btn.dataset.range;
      if (r === 'custom') return;
      applyQuickRange(r);
      refresh();
    });
  });

  applyQuickRange('today');

  exportCafeBtn.addEventListener('click', () => {
    if (!cafeOrders.length)
      return alert('No Café transactions to export for this period.');
    const csv = toCSV(cafeOrders);
    download(
      `cafe-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      csv
    );
  });

  exportSuppBtn.addEventListener('click', () => {
    if (!suppOrders.length)
      return alert(
        'No Supplements transactions to export for this period.'
      );
    const csv = toCSV(suppOrders);
    download(
      `supp-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      csv
    );
  });

  expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      description: expDescEl.value.trim(),
      amount: parseFloat(expAmountEl.value),
      category: (expCategoryEl.value || '').trim() || null,
    };
    if (!payload.description || isNaN(payload.amount)) return;

    const { error } = await supabase.from('expenses').insert([payload]);
    if (error) {
      console.error(error);
      alert('Failed to add expense.');
      return;
    }

    expenses = await fetchExpenses();
    renderExpenses(expenses);
    renderAllTransactions();
    aggregates();

    expDescEl.value = '';
    expAmountEl.value = '';
    expCategoryEl.value = '';
  });

  initDatePicker();
  setupTabs();
}

document.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  refresh();
  if (window.lucide) lucide.createIcons();
});

// ============= Supabase =============
// IMPORTANT: replace with your own project's URL/key if rotated
const SUPABASE_URL = 'https://ybrdqxetprlhscfuebyy.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmRxeGV0cHJsaHNjZnVlYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg2NjksImV4cCI6MjA3NzQ5NDY2OX0.N7pxPNmi1ZowVd9Nik9KABhqTtp3NP-XlEcEiNlJ-8M';

// if you load supabase-js via <script src=".../supabase.min.js"></script>
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============= DOM =============
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

// ============= State =============
let range = { from: null, to: null };
let cafeOrders = []; // orders (Delivery Complete)
let suppOrders = []; // supplement_orders (Completed)
let suppItems = [];  // supplement_order_items in range
let supplementProductsById = {}; // supplement_products keyed by id
let expenses = [];

// ============= Date Helpers =============
function formatBDT(n){ return '৳' + Number(n || 0).toLocaleString(); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }

function applyQuickRange(code){
  const now = new Date();
  if (code === 'today'){
    range = { from: startOfDay(now), to: endOfDay(now) };
  } else if (code === '7d'){
    const from = new Date(now); from.setDate(from.getDate()-6);
    range = { from: startOfDay(from), to: endOfDay(now) };
  } else if (code === '30d'){
    const from = new Date(now); from.setDate(from.getDate()-29);
    range = { from: startOfDay(from), to: endOfDay(now) };
  }
}
const iso = (d) => d.toISOString();

// ============= Init flatpickr =============
function initDatePicker(){
  flatpickr(dateRangePickerEl, {
    mode: 'range',
    dateFormat: 'Y-m-d',
    onClose: (selectedDates)=>{
      if (selectedDates.length === 2){
        range = { from: startOfDay(selectedDates[0]), to: endOfDay(selectedDates[1]) };
        refresh();
      }
    }
  });
}

// ============= Fetchers =============
async function fetchCafeOrders(){
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('status','Delivery Complete')
    .gte('created_at', iso(range.from))
    .lte('created_at', iso(range.to))
    .order('created_at',{ascending:false});
  if (error){ console.error(error); return []; }
  return data || [];
}

async function fetchSuppOrders(){
  const { data, error } = await supabase
    .from('supplement_orders')
    .select('*')
    .eq('status','Completed')
    .gte('created_at', iso(range.from))
    .lte('created_at', iso(range.to))
    .order('created_at',{ascending:false});
  if (error){ console.error(error); return []; }
  return data || [];
}

async function fetchSuppOrderItemsFor(ids){
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('supplement_order_items')
    .select('order_id,supplement_product_id,quantity,price_at_order')
    .in('order_id', ids);
  if (error){ console.error(error); return []; }
  return data || [];
}

async function fetchSuppProductsMap(){
  const { data, error } = await supabase
    .from('supplement_products')
    .select('id,name,brand,buying_price,stock');
  if (error){ console.error(error); return {}; }
  const map = {};
  (data||[]).forEach(p=> map[p.id]=p);
  return map;
}

async function fetchExpenses(){
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .gte('created_at', iso(range.from))
    .lte('created_at', iso(range.to))
    .order('created_at',{ascending:false});
  if (error){ console.error(error); return []; }
  return data || [];
}

async function fetchLowStock(){
  const { data, error } = await supabase
    .from('supplement_products')
    .select('id,name,brand,stock')
    .lte('stock',5)
    .order('stock',{ascending:true})
    .limit(12);
  if (error){ console.error(error); return []; }
  return data || [];
}

// ============= Renderers =============
function renderTransactionsList(target, rows, kind){
  target.innerHTML = '';
  if (!rows.length){
    target.innerHTML = `<p class="empty-message">No ${kind} transactions found.</p>`;
    return;
  }
  rows.forEach(tx=>{
    const el = document.createElement('div');
    el.className = 'tx-item';
    el.innerHTML = `
      <div class="tx-left">
        <span class="tx-title">${(tx.customer_name||'Walk-in')}</span>
        <span class="tx-sub">${new Date(tx.created_at).toLocaleString()} • ${kind==='cafe'?'Cafe #':'Supp #'}${String(tx.id).slice(0,6).toUpperCase()}</span>
      </div>
      <div class="tx-amount">${formatBDT(tx.total_amount)}</div>
    `;
    target.appendChild(el);
  });
}

function renderTopSupplements(items, prodMap){
  // revenue & units by supplement_product_id
  const revenueById = {};
  const unitsById = {};
  (items||[]).forEach(it=>{
    const id = it.supplement_product_id; // <-- FIXED
    const qty = Number(it.quantity || 0);
    const sale = Number(it.price_at_order || 0) * qty;
    revenueById[id] = (revenueById[id]||0) + sale;
    unitsById[id] = (unitsById[id]||0) + qty;
  });

  const topRev = Object.entries(revenueById)
    .sort((a,b)=>b[1]-a[1]).slice(0,8);
  const topQty = Object.entries(unitsById)
    .sort((a,b)=>b[1]-a[1]).slice(0,8);

  topSuppByRevenueEl.innerHTML = topRev.length
    ? topRev.map(([id,amt])=>{
        const p = prodMap[id]||{};
        return `<li><span>${p.name||'Unknown'} <span class="tx-sub">(${p.brand||'—'})</span></span><span class="badge">${formatBDT(amt)}</span></li>`;
      }).join('')
    : `<li class="tx-sub">No supplement revenue in this period.</li>`;

  topSuppByUnitsEl.innerHTML = topQty.length
    ? topQty.map(([id,qty])=>{
        const p = prodMap[id]||{};
        return `<li><span>${p.name||'Unknown'} <span class="tx-sub">(${p.brand||'—'})</span></span><span class="badge">${qty} pcs</span></li>`;
      }).join('')
    : `<li class="tx-sub">No supplement units in this period.</li>`;
}

function renderLowStock(list){
  lowStockListEl.innerHTML = list.length
    ? list.map(p=>`<li><span>${p.name} <span class="tx-sub">(${p.brand||'—'})</span></span><span class="badge badge-danger">${p.stock} left</span></li>`).join('')
    : `<li class="tx-sub">All good. No low-stock items.</li>`;
  lowStockCountEl.textContent = list.length;
}

function renderExpenses(list){
  expenseListEl.innerHTML = list.length
    ? list.map(e=>`<li><span>${e.description} <span class="tx-sub">(${e.category||'—'})</span></span><span class="badge">-${formatBDT(e.amount)}</span></li>`).join('')
    : `<li class="tx-sub">No expenses logged for this period.</li>`;
}

// ============= Aggregates =============
function aggregates(){
  const cafeRevenue = cafeOrders.reduce((s,o)=>s + Number(o.total_amount||0), 0);
  const suppRevenue = suppOrders.reduce((s,o)=>s + Number(o.total_amount||0), 0);
  const totalRevenue = cafeRevenue + suppRevenue;
  const ordersCount = cafeOrders.length + suppOrders.length;

  totalRevenueEl.textContent = formatBDT(totalRevenue);
  totalOrdersEl.textContent = String(ordersCount);

  // Supplements profit = Σ(items.price*qty) − Σ(items.qty * product.buying_price) − expenses
  const buyMap = supplementProductsById;
  const totals = (suppItems||[]).reduce((acc,it)=>{
    const id = it.supplement_product_id; // <-- FIXED
    const qty = Number(it.quantity || 0);
    const sale = Number(it.price_at_order || 0) * qty;
    const cost = Number((buyMap[id]?.buying_price) || 0) * qty;
    acc.sale += sale; acc.cost += cost;
    return acc;
  }, {sale:0, cost:0});

  const expenseSum = (expenses||[]).reduce((s,e)=> s + Number(e.amount||0), 0);
  const netProfit = (totals.sale - totals.cost) - expenseSum;
  netProfitEl.textContent = formatBDT(netProfit);
}

// ============= Export CSV =============
function toCSV(rows){
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const head = cols.join(',');
  const body = rows.map(r=>cols.map(c=>JSON.stringify(r[c] ?? '')).join(',')).join('\n');
  return head + '\n' + body;
}
function download(filename, text){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'text/csv'}));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  document.body.removeChild(a);
}

// ============= Refresh Flow =============
async function refresh(){
  loading.classList.add('visible');
  analyticsContent.classList.add('hidden');
  noDataMsg.classList.add('hidden');

  // parallel fetch
  const [cafe, supp, exp, prodMap] = await Promise.all([
    fetchCafeOrders(),
    fetchSuppOrders(),
    fetchExpenses(),
    fetchSuppProductsMap()
  ]);
  cafeOrders = cafe;
  suppOrders = supp;
  expenses = exp;
  supplementProductsById = prodMap;

  // order items (for profit & top lists)
  suppItems = await fetchSuppOrderItemsFor(suppOrders.map(o=>o.id));

  // Render
  renderTransactionsList(cafeTransactionsEl, cafeOrders, 'cafe');
  renderTransactionsList(suppTransactionsEl, suppOrders, 'supplements');
  renderTopSupplements(suppItems, supplementProductsById);

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

// ============= Events =============
function setupEvents(){
  // filter buttons
  filterBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      filterBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const r = btn.dataset.range;
      if (r === 'custom') return; // wait for date picker
      applyQuickRange(r);
      refresh();
    });
  });

  // default today
  applyQuickRange('today');

  // exports
  exportCafeBtn.addEventListener('click', ()=>{
    if (!cafeOrders.length) return alert('No Café transactions to export for this period.');
    const csv = toCSV(cafeOrders);
    download(`cafe-transactions-${new Date().toISOString().slice(0,10)}.csv`, csv);
  });
  exportSuppBtn.addEventListener('click', ()=>{
    if (!suppOrders.length) return alert('No Supplements transactions to export for this period.');
    const csv = toCSV(suppOrders);
    download(`supp-transactions-${new Date().toISOString().slice(0,10)}.csv`, csv);
  });

  // expense form
  expenseForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const payload = {
      description: expDescEl.value.trim(),
      amount: parseFloat(expAmountEl.value),
      category: (expCategoryEl.value||'').trim() || null
    };
    if (!payload.description || isNaN(payload.amount)) return;

    const { error } = await supabase.from('expenses').insert([payload]);
    if (error){ console.error(error); alert('Failed to add expense.'); return; }

    // reload expenses only
    expenses = await fetchExpenses();
    renderExpenses(expenses);
    aggregates();

    expDescEl.value=''; expAmountEl.value=''; expCategoryEl.value='';
  });

  initDatePicker();
}

// ============= Boot =============
document.addEventListener('DOMContentLoaded', ()=>{
  setupEvents();
  refresh();
  if (window.lucide) lucide.createIcons();
});

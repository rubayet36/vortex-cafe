// =======================================================
//  Cafe / Staff Dashboard - with Supplements Portal CRUD
//  - Orders (existing)
//  - Menu Management (existing)
//  - Transactions: SPLIT (Menu vs Supplements) with AGG totals
//  - Supplements Portal CRUD (supplement_products)
// =======================================================

// ---------- Supabase Client ----------
const SUPABASE_URL = 'https://ybrdqxetprlhscfuebyy.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmRxeGV0cHJsaHNjZnVlYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg2NjksImV4cCI6MjA3NzQ5NDY2OX0.N7pxPNmi1ZowVd9Nik9KABhqTtp3NP-XlEcEiNlJ-8M';

const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- DOM (existing) ----------
// ---- Storage helpers (safe filename) ----
const SUPP_BUCKET = 'supplement-images';

function slugifyName(filename) {
  const dot = filename.lastIndexOf('.');
  const base = (dot >= 0 ? filename.slice(0, dot) : filename)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')      // keep a-z 0-9 - _
    .replace(/^-+|-+$/g, '')            // trim dashes
    .slice(0, 40);                      // shorten
  const ext = (dot >= 0 ? filename.slice(dot + 1) : 'jpg').toLowerCase();
  return { base, ext };
}

const mainTabs = document.querySelector('.main-tabs');
const tabContents = document.querySelectorAll('.tab-content');

const menuTableBody = document.getElementById('menu-table-body');
const notificationSound = document.getElementById('notification-sound');
const colNotTaken = document.getElementById('orders-col-not-taken');
const colPaymentComplete = document.getElementById('orders-col-payment-complete');
const loadingOrders = document.getElementById('loading-orders');

const transactionsList = document.getElementById('transactions-list');
const transactionsSummary = document.getElementById('transactions-summary');
const loadingTransactions = document.getElementById('loading-transactions');
const noTransactionsMsg = document.getElementById('no-transactions-msg');

const addItemBtn = document.getElementById('add-item-btn');
const itemModal = document.getElementById('item-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const itemForm = document.getElementById('item-form');
const modalTitle = document.getElementById('modal-title');
const loadingMenu = document.getElementById('loading-menu');
const menuTable = document.getElementById('menu-table');

// ---------- NEW: Supplements DOM ----------
const supplementsSection = document.getElementById('supplements-section');
const supplementsTable = document.getElementById('supplements-table');
const supplementsTableBody = document.getElementById('supplements-table-body');
const loadingSupplements = document.getElementById('loading-supplements');
const addSuppBtn = document.getElementById('add-supplement-btn');

const suppModal = document.getElementById('supplement-modal');
const suppModalTitle = document.getElementById('supplement-modal-title');
const suppForm = document.getElementById('supplement-form');
const suppCloseBtn = document.getElementById('supplement-close-btn');
const suppCancelBtn = document.getElementById('supp-cancel-btn');

// ---------- State ----------
let editingItemId = null;          // for menu_items
let currentOrderCount = 0;         // for new-order sound
let currentEditingSuppId = null;   // for supplement_products

// ---------- Tabs ----------
mainTabs.addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  mainTabs.querySelector('.active')?.classList.remove('active');
  e.target.classList.add('active');

  tabContents.forEach(c => c.classList.remove('active'));
  const toShow = document.getElementById(`${e.target.dataset.tab}-section`);
  toShow?.classList.add('active');

  const tab = e.target.dataset.tab;
  if (tab === 'orders') fetchAndRenderOrders();
  if (tab === 'transactions') fetchAndRenderTransactionsSplit();
  if (tab === 'menu') loadMenuItems();
  if (tab === 'supplements') loadSupplements();
});

// ---------- Auto Refresh ----------
function startAutoRefresh() {
  setInterval(async () => {
    const activeTab = document.querySelector('.main-tab-btn.active')?.dataset.tab;
    if (activeTab === 'orders') await fetchAndRenderOrders();
    if (activeTab === 'transactions') await fetchAndRenderTransactionsSplit();
  }, 10000);
}

// =======================================================
// Orders (existing)
// =======================================================
async function fetchAndRenderOrders() {
  loadingOrders.classList.remove('hidden');

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`*, order_items ( * )`)
    .neq('status', 'Delivery Complete')
    .order('created_at', { ascending: true });

  if (error) { console.error('Error fetching orders:', error); loadingOrders.classList.add('hidden'); return; }

  if (orders.length > currentOrderCount && currentOrderCount > 0) {
    notificationSound?.play();
  }
  currentOrderCount = orders.length;

  colNotTaken.innerHTML = '';
  colPaymentComplete.innerHTML = '';

  const ordersNotTaken = orders.filter(o => o.status === 'Not Taken');
  const ordersPaymentComplete = orders.filter(o => o.status === 'Payment Complete');

  colNotTaken.innerHTML = ordersNotTaken.length
    ? ''
    : '<p class="empty-message">No new orders.</p>';
  ordersNotTaken.forEach(o => colNotTaken.appendChild(createOrderCard(o)));

  colPaymentComplete.innerHTML = ordersPaymentComplete.length
    ? ''
    : '<p class="empty-message">No orders awaiting pickup.</p>';
  ordersPaymentComplete.forEach(o => colPaymentComplete.appendChild(createOrderCard(o)));

  loadingOrders.classList.add('hidden');
}

function createOrderCard(order) {
  const orderCard = document.createElement('div');
  const statusClass = order.status.toLowerCase().replace(' ', '-');
  const statusColor = order.status === 'Not Taken' ? 'var(--blue)' : '#ffc107';
  orderCard.className = `order-card status-${statusClass}`;
  orderCard.style.cssText = `--status-color: ${statusColor}`;

  const itemsHtml = (order.order_items || []).map(item => `
    <div class="order-item">
      <span><span class="quantity">${item.quantity}x</span> ${item.item_name}</span>
      <span>৳${(item.price_at_order * item.quantity).toFixed(2)}</span>
    </div>
  `).join('');

  orderCard.innerHTML = `
    <div class="order-header">
      <div>
        <h3>Order #${order.id.slice(0, 6).toUpperCase()}</h3>
        <p class="order-customer">${order.customer_name}</p>
        <p class="order-time">${new Date(order.created_at).toLocaleTimeString()}</p>
      </div>
      <p class="total">৳${Number(order.total_amount).toFixed(2)}</p>
    </div>
    <div class="order-items-list">${itemsHtml}</div>
    <div class="order-actions">
      ${order.status === 'Not Taken'
        ? `<button class="btn btn-primary" data-id="${order.id}" data-next-status="Payment Complete">Mark Payment Complete</button>` : ''}
      ${order.status === 'Payment Complete'
        ? `<button class="btn btn-primary" data-id="${order.id}" data-next-status="Delivery Complete">Mark Delivery Complete</button>` : ''}
    </div>
  `;
  return orderCard;
}

document.getElementById('orders-section')?.addEventListener('click', async (e) => {
  if (e.target.tagName === 'BUTTON' && e.target.dataset.id) {
    const btn = e.target;
    const orderId = btn.dataset.id;
    const nextStatus = btn.dataset.nextStatus;
    const original = btn.textContent;

    btn.disabled = true; btn.textContent = 'Updating…';

    const { error } = await supabase
      .from('orders')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      console.error('Error updating status:', error);
      alert('Could not update order status.');
      btn.disabled = false; btn.textContent = original;
    } else {
      await fetchAndRenderOrders();
      await fetchAndRenderTransactionsSplit();
    }
  }
});

// =======================================================
// Menu Management (existing)
// =======================================================
async function loadMenuItems() {
  loadingMenu.classList.remove('hidden');
  menuTable.classList.add('hidden');

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching menu items:', error); alert('Could not fetch menu items.'); return; }

  menuTableBody.innerHTML = '';
  data.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="item-info">
          <img src="${item.image_url || 'https://via.placeholder.com/50'}" alt="${item.name}" class="item-image">
          <div class="item-name-desc">
            <div class="item-name">${item.name} ${item.is_popular ? '⭐' : ''}</div>
          </div>
        </div>
      </td>
      <td><span class="item-category">${item.category}</span></td>
      <td>৳${Number(item.price).toFixed(2)}</td>
      <td>
        <button class="status-toggle ${item.available ? 'available' : 'unavailable'}"
                data-id="${item.id}" data-current-status="${item.available}">
          ${item.available ? 'Available' : 'Unavailable'}
        </button>
      </td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit" data-id="${item.id}"><i data-lucide="edit"></i></button>
          <button class="action-btn delete" data-id="${item.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    `;
    menuTableBody.appendChild(row);
  });

  lucide.createIcons();
  loadingMenu.classList.add('hidden');
  menuTable.classList.remove('hidden');
}

async function toggleAvailability(id, current) {
  const { error } = await supabase.from('menu_items').update({ available: !current }).eq('id', id);
  if (error) alert('Failed to update status.'); else loadMenuItems();
}

async function openEditModal(id) {
  const { data, error } = await supabase.from('menu_items').select('*').eq('id', id).single();
  if (error) { console.error('Error fetching item:', error); alert('Could not load item data.'); return; }

  editingItemId = id;
  modalTitle.textContent = 'Edit Menu Item';

  document.getElementById('item-id').value = data.id;
  document.getElementById('name').value = data.name;
  document.getElementById('description').value = data.description;
  document.getElementById('category').value = data.category;
  document.getElementById('price').value = data.price;
  document.getElementById('is_popular').checked = !!data.is_popular;

  document.getElementById('calories').value = data.calories ?? '';
  document.getElementById('protein').value = data.protein ?? '';
  document.getElementById('carbohydrates').value = data.carbohydrates ?? '';
  document.getElementById('fats').value = data.fats ?? '';
  document.getElementById('fiber').value = data.fiber ?? '';
  document.getElementById('sugar').value = data.sugar ?? '';
  document.getElementById('sodium').value = data.sodium ?? '';
  document.getElementById('vitamins').value = data.vitamins ?? '';
  document.getElementById('allergens').value = data.allergens ?? '';
  document.getElementById('dietary_tags').value = data.dietary_tags ?? '';
  document.getElementById('current-image').textContent =
    data.image_url ? `Current: ${data.image_url.split('/').pop()}` : 'No image uploaded.';

  itemModal.classList.remove('hidden');
  lucide.createIcons();
}

function openAddModal() {
  editingItemId = null;
  modalTitle.textContent = 'Add Menu Item';
  itemForm.reset();
  document.getElementById('is_popular').checked = false;
  document.getElementById('current-image').textContent = '';
  itemModal.classList.remove('hidden');
  lucide.createIcons();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const submitButton = e.target.querySelector('button[type="submit"]');
  submitButton.disabled = true; submitButton.textContent = 'Saving…';

  // upload image (menu-images)
  let imageUrl = null;
  const imageFile = document.getElementById('image').files[0];
  if (imageFile) {
    const filePath = `public/${Date.now()}-${imageFile.name}`;
    const { data: uploadData, error: uploadError } =
      await supabase.storage.from('menu-images').upload(filePath, imageFile);
    if (uploadError) {
      console.error('Image upload error:', uploadError);
      alert('Failed to upload image.');
      submitButton.disabled = false; submitButton.textContent = 'Save Item';
      return;
    }
    const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(uploadData.path);
    imageUrl = urlData.publicUrl;
  }

  const formData = {
    name: document.getElementById('name').value,
    description: document.getElementById('description').value,
    category: document.getElementById('category').value,
    price: parseFloat(document.getElementById('price').value),
    is_popular: document.getElementById('is_popular').checked,
    calories: parseInt(document.getElementById('calories').value) || null,
    protein: parseInt(document.getElementById('protein').value) || null,
    carbohydrates: parseInt(document.getElementById('carbohydrates').value) || null,
    fats: parseInt(document.getElementById('fats').value) || null,
    fiber: parseInt(document.getElementById('fiber').value) || null,
    sugar: parseInt(document.getElementById('sugar').value) || null,
    sodium: parseInt(document.getElementById('sodium').value) || null,
    vitamins: document.getElementById('vitamins').value || null,
    allergens: document.getElementById('allergens').value || null,
    dietary_tags: document.getElementById('dietary_tags').value || null,
    updated_at: new Date().toISOString(),
  };
  if (imageUrl) formData.image_url = imageUrl;

  let dbErr;
  if (editingItemId) {
    const { error } = await supabase.from('menu_items').update(formData).eq('id', editingItemId);
    dbErr = error;
  } else {
    formData.available = true;
    const { error } = await supabase.from('menu_items').insert([formData]);
    dbErr = error;
  }

  if (dbErr) { console.error('Database error:', dbErr); alert('Failed to save the item.'); }
  else { itemModal.classList.add('hidden'); await loadMenuItems(); }

  submitButton.disabled = false; submitButton.textContent = 'Save Item';
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) { console.error('Error deleting item:', error); alert('Failed to delete item.'); }
  else { await loadMenuItems(); }
}

// =======================================================
// NEW: Supplements Portal Management (supplement_products)
// =======================================================
async function loadSupplements() {
  loadingSupplements.classList.remove('hidden');
  supplementsTable.classList.add('hidden');

  const { data, error } = await supabase
    .from('supplement_products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching supplements:', error);
    alert('Could not fetch supplements.');
    loadingSupplements.classList.add('hidden');
    return;
  }

  supplementsTableBody.innerHTML = '';
  data.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="item-info">
          <img src="${p.image_url || 'https://via.placeholder.com/50'}" class="item-image" alt="${p.name}">
          <div class="item-name-desc">
            <div class="item-name">${p.name} ${p.is_featured ? '⭐' : ''}</div>
            <div class="item-desc">${p.tags || ''}</div>
          </div>
        </div>
      </td>
      <td>${p.brand || '-'}</td>
      <td>${p.category}</td>
      <td>৳${Number(p.price).toFixed(2)} ${
        p.compare_at_price ? `<span class="old-price">৳${Number(p.compare_at_price).toFixed(2)}</span>` : ''
      }</td>
      <td>${p.stock > 0 ? p.stock : '<span class="status-badge danger">Out of stock</span>'}</td>
      <td>
        <button class="status-toggle ${p.available ? 'available' : 'unavailable'}"
                data-supp-id="${p.id}" data-current-status="${p.available}">
          ${p.available ? 'Available' : 'Unavailable'}
        </button>
      </td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit-supp" data-supp-id="${p.id}"><i data-lucide="edit"></i></button>
          <button class="action-btn delete-supp" data-supp-id="${p.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </td>
    `;
    supplementsTableBody.appendChild(tr);
  });

  lucide.createIcons();
  loadingSupplements.classList.add('hidden');
  supplementsTable.classList.remove('hidden');
}

function openAddSupplementModal() {
  currentEditingSuppId = null;
  suppModalTitle.textContent = 'Add Product';
  suppForm.reset();
  document.getElementById('supp-current-image').textContent = '';
  suppModal.classList.remove('hidden');
  lucide.createIcons();
}

async function openEditSupplementModal(id) {
  const { data, error } = await supabase
    .from('supplement_products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) { 
    console.error(error);
    alert('Could not load product.'); 
    return; 
  }

  currentEditingSuppId = id;
  suppModalTitle.textContent = 'Edit Product';

  // safe setter
  const setVal = (elId, val = '') => {
    const el = document.getElementById(elId);
    if (el) el.value = val ?? '';
  };

  setVal('supplement-id', data.id);
  setVal('supp-name', data.name);
  setVal('supp-brand', data.brand || '');
  setVal('supp-category', data.category);
  setVal('supp-price', data.price);
  setVal('supp-buying', data.buying_price ?? 0);
  setVal('supp-stock', data.stock);
  setVal('supp-description', data.description || '');
  setVal('supp-tags', data.tags || '');
  setVal('supp-rating', data.rating || '');

  const feat = document.getElementById('supp-featured');
  if (feat) feat.checked = !!data.is_featured;

  const currentImg = document.getElementById('supp-current-image');
  if (currentImg) {
    currentImg.textContent = data.image_url
      ? `Current: ${data.image_url.split('/').pop()}`
      : 'No image uploaded.';
  }

  suppModal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// Assumes: const SUPP_BUCKET = 'supplement-images'; and slugifyName(name) exist.

async function handleSupplementSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  // --- helpers ---
  const gv = (id) => document.getElementById(id)?.value ?? '';
  const gvn = (id) => {
    const v = document.getElementById(id)?.value;
    return v === '' || v == null ? null : Number(v);
  };

  // --- basic validation (required fields) ---
  const required = {
    name: gv('supp-name').trim(),
    category: gv('supp-category'),
    price: Number(gv('supp-price')),
    buying_price: Number(gv('supp-buying')),
    stock: Number(gv('supp-stock')),
  };
  if (!required.name || !required.category || isNaN(required.price) || isNaN(required.buying_price) || isNaN(required.stock)) {
    alert('Please fill in Name, Category, Price, Buying Price, and Stock.');
    btn.disabled = false;
    btn.textContent = 'Save Product';
    return;
  }

  // --- optional image upload ---
  let imageUrl = null;
  const imageFile = document.getElementById('supp-image')?.files?.[0];

  if (imageFile) {
    try {
      const { base, ext } = slugifyName(imageFile.name);
      const filePath = `public/${Date.now()}-${base}.${ext}`;

      const { data: uploadData, error: upErr } = await supabase
        .storage
        .from(SUPP_BUCKET)
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: imageFile.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from(SUPP_BUCKET).getPublicUrl(uploadData.path);
      imageUrl = urlData?.publicUrl || null;
    } catch (err) {
      console.error('Image upload failed:', err);
      alert(
        err?.message?.includes('Bucket not found')
          ? 'Storage bucket not found. Create a PUBLIC bucket named "supplement-images" in Supabase.'
          : 'Image upload failed. Please try another image.'
      );
      btn.disabled = false;
      btn.textContent = 'Save Product';
      return;
    }
  }

  // --- build payload ---
  const payload = {
    name: required.name,
    brand: gv('supp-brand') || null,
    category: required.category,
    price: required.price,                 // selling price
    buying_price: required.buying_price,   // cost price
    stock: required.stock,
    description: gv('supp-description') || null,
    is_featured: !!document.getElementById('supp-featured')?.checked,
    tags: gv('supp-tags') || null,
    rating: gvn('supp-rating'),
    updated_at: new Date().toISOString(),
  };
  if (imageUrl) payload.image_url = imageUrl;

  // Optional: auto-toggle availability by stock
  payload.available = payload.stock > 0;

  // --- save ---
  let error;
  if (currentEditingSuppId) {
    ({ error } = await supabase
      .from('supplement_products')
      .update(payload)
      .eq('id', currentEditingSuppId));
  } else {
    ({ error } = await supabase
      .from('supplement_products')
      .insert([payload]));
  }

  if (error) {
    console.error(error);
    alert('Failed to save product.');
  } else {
    suppModal.classList.add('hidden');
    await loadSupplements();
  }

  btn.disabled = false;
  btn.textContent = 'Save Product';
}


async function toggleSupplementAvailability(id, current) {
  const { error } = await supabase
    .from('supplement_products').update({ available: !current }).eq('id', id);
  if (error) alert('Failed to update status.'); else loadSupplements();
}

async function deleteSupplement(id) {
  if (!confirm('Delete this product?')) return;
  const { error } = await supabase.from('supplement_products').delete().eq('id', id);
  if (error) alert('Failed to delete.'); else loadSupplements();
}

// Table-level actions (supplements)
supplementsSection?.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.classList.contains('status-toggle')) {
    toggleSupplementAvailability(btn.dataset.suppId, btn.dataset.currentStatus === 'true');
  }
  if (btn.classList.contains('edit-supp')) {
    openEditSupplementModal(btn.dataset.suppId);
  }
  if (btn.classList.contains('delete-supp')) {
    deleteSupplement(btn.dataset.suppId);
  }
});

// Modal events (supplements)
addSuppBtn?.addEventListener('click', openAddSupplementModal);
suppCloseBtn?.addEventListener('click', () => suppModal.classList.add('hidden'));
suppCancelBtn?.addEventListener('click', () => suppModal.classList.add('hidden'));
suppForm?.addEventListener('submit', handleSupplementSubmit);

// =======================================================
// Transactions (SPLIT view)
// - Left: Cafe Menu (orders with status 'Delivery Complete', today)
// - Right: Supplements (supplement_orders with status 'Completed', today)
// - Top summary still shows AGGREGATE totals
// =======================================================
async function fetchAndRenderTransactionsSplit() {
  loadingTransactions.classList.remove('hidden');
  transactionsList.innerHTML = '';
  noTransactionsMsg.classList.add('hidden');

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const fromISO = dayStart.toISOString();

  // Cafe Menu transactions (existing)
  const { data: cafeTx, error: cafeErr } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'Delivery Complete')
    .gte('created_at', fromISO)
    .order('created_at', { ascending: false });

  // Supplements transactions (new)
  const { data: suppTx, error: suppErr } = await supabase
    .from('supplement_orders')
    .select('*')
    .eq('status', 'Completed')
    .gte('created_at', fromISO)
    .order('created_at', { ascending: false });

  if (cafeErr) console.error('Cafe transactions error:', cafeErr);
  if (suppErr) console.error('Supp transactions error:', suppErr);

  const cafe = cafeTx || [];
  const supp = suppTx || [];

  // Totals (aggregate both)
  const totalRevenue = [...cafe, ...supp].reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const completedCount = cafe.length + supp.length;

  transactionsSummary.innerHTML = `
    <div class="summary-item"><h4>Total Revenue (Today)</h4><p>৳${totalRevenue.toFixed(2)}</p></div>
    <div class="summary-item"><h4>Completed Orders (Today)</h4><p>${completedCount}</p></div>
  `;

  // Two columns inside the existing container
  const wrapper = document.createElement('div');
  wrapper.style.display = 'grid';
  wrapper.style.gridTemplateColumns = '1fr 1fr';
  wrapper.style.gap = '16px';

  // Cafe column
  const cafeCol = document.createElement('div');
  cafeCol.innerHTML = `<h3 class="tx-title">Cafe Menu Sales (Today)</h3>`;
  if (!cafe.length) {
    cafeCol.innerHTML += `<p class="empty-message">No cafe transactions yet.</p>`;
  } else {
    cafe.forEach(tx => {
      const el = document.createElement('div');
      el.className = 'transaction-item';
      el.innerHTML = `
        <div class="transaction-details">
          <p><strong>${tx.customer_name}</strong> – Order #${tx.id.slice(0,6).toUpperCase()}</p>
          <p class="order-time">${new Date(tx.created_at).toLocaleString()}</p>
        </div>
        <p class="transaction-amount">৳${Number(tx.total_amount).toFixed(2)}</p>
      `;
      cafeCol.appendChild(el);
    });
  }

  // Supplements column
  const suppCol = document.createElement('div');
  suppCol.innerHTML = `<h3 class="tx-title">Supplements Sales (Today)</h3>`;
  if (!supp.length) {
    suppCol.innerHTML += `<p class="empty-message">No supplements transactions yet.</p>`;
  } else {
    supp.forEach(tx => {
      const el = document.createElement('div');
      el.className = 'transaction-item';
      el.innerHTML = `
        <div class="transaction-details">
          <p><strong>${tx.customer_name || 'Walk-in'}</strong> – Supp #${tx.id.slice(0,6).toUpperCase()}</p>
          <p class="order-time">${new Date(tx.created_at).toLocaleString()}</p>
        </div>
        <p class="transaction-amount">৳${Number(tx.total_amount).toFixed(2)}</p>
      `;
      suppCol.appendChild(el);
    });
  }

  wrapper.appendChild(cafeCol);
  wrapper.appendChild(suppCol);

  transactionsList.appendChild(wrapper);
  loadingTransactions.classList.add('hidden');

  if (!cafe.length && !supp.length) {
    noTransactionsMsg.classList.remove('hidden');
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  // Default loads
  fetchAndRenderOrders();
  fetchAndRenderTransactionsSplit();
  loadMenuItems();

  // Menu events
  addItemBtn?.addEventListener('click', openAddModal);
  closeModalBtn?.addEventListener('click', () => itemModal.classList.add('hidden'));
  cancelBtn?.addEventListener('click', () => itemModal.classList.add('hidden'));
  itemForm?.addEventListener('submit', handleFormSubmit);

  menuTableBody?.addEventListener('click', (e) => {
    const target = e.target.closest('button'); if (!target) return;
    const id = target.dataset.id;
    if (target.classList.contains('status-toggle')) toggleAvailability(id, target.dataset.currentStatus === 'true');
    if (target.classList.contains('edit')) openEditModal(id);
    if (target.classList.contains('delete')) deleteItem(id);
  });

  // Supplements events wired above
  startAutoRefresh();
  lucide.createIcons();
});

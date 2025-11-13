// Combined single-file bundle of app JS (for testing)

// ===== supabaseClient =====
const SUPABASE_URL = 'https://ybrdqxetprlhscfuebyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmRxeGV0cHJsaHNjZnVlYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg2NjksImV4cCI6MjA3NzQ5NDY2OX0.N7pxPNmi1ZowVd9Nik9KABhqTtp3NP-XlEcEiNlJ-8M';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== utils =====
const SUPP_BUCKET = 'supplement-images';
function slugifyName(filename) {
  const dot = filename.lastIndexOf('.');
  const base = (dot >= 0 ? filename.slice(0, dot) : filename)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const ext = (dot >= 0 ? filename.slice(dot + 1) : 'jpg').toLowerCase();
  return { base, ext };
}
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmtBDT = (n) => `৳${Number(n || 0).toFixed(2)}`;

// ===== tabs =====
function initTabs() {
  const mainTabs = $('.main-tabs');
  const tabContents = $$('.tab-content');
  if (!mainTabs) return;
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
}
function startAutoRefresh() {
  setInterval(async () => {
    const activeTab = document.querySelector('.main-tab-btn.active')?.dataset.tab;
    if (activeTab === 'orders') await fetchAndRenderOrders();
    if (activeTab === 'transactions') await fetchAndRenderTransactionsSplit();
  }, 10000);
}

// ===== orders =====
const notificationSound = $('#notification-sound');
const colNotTaken = $('#orders-col-not-taken');
const colPaymentComplete = $('#orders-col-payment-complete');
const colSuppPending = $('#supp-orders-pending');
const loadingOrders = $('#loading-orders');
let currentOrderCount = 0;
let currentSuppPendingCount = 0;

async function fetchAndRenderOrders() {
  if (loadingOrders) loadingOrders.classList.remove('hidden');
  const { data: orders, error: errCafe } = await supabase
    .from('orders')
    .select(`*, order_items ( * )`)
    .neq('status', 'Delivery Complete')
    .order('created_at', { ascending: true });
  const { data: suppOrders, error: errSupp } = await supabase
    .from('supplement_orders')
    .select(`*, supplement_order_items ( * )`)
    .eq('status', 'Pending')
    .order('created_at', { ascending: true });
  if (errCafe) console.error('Error fetching cafe orders:', errCafe);
  if (errSupp) console.error('Error fetching supplement orders:', errSupp);
  const totalNewCount = (orders?.length || 0) + (suppOrders?.length || 0);
  if (totalNewCount > (currentOrderCount + currentSuppPendingCount) && (currentOrderCount + currentSuppPendingCount) > 0) {
    notificationSound?.play();
  }
  currentOrderCount = orders?.length || 0;
  currentSuppPendingCount = suppOrders?.length || 0;
  renderCafeKanban(orders || []);
  renderSuppPending(suppOrders || []);
  if (loadingOrders) loadingOrders.classList.add('hidden');
}

function createCafeOrderCard(order) {
  const orderCard = document.createElement('div');
  const statusClass = (order.status || '').toLowerCase().replace(' ', '-');
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
        <h3>Order #${String(order.id).slice(0, 6).toUpperCase()}</h3>
        <p class="order-customer">${order.customer_name}</p>
        <p class="order-time">${new Date(order.created_at).toLocaleTimeString()}</p>
      </div>
      <p class="total">৳${Number(order.total_amount).toFixed(2)}</p>
    </div>
    <div class="order-items-list">${itemsHtml}</div>
    <div class="order-actions">
      ${order.status === 'Not Taken' ? `<button class="btn btn-primary" data-id="${order.id}" data-next-status="Payment Complete">Mark Payment Complete</button>` : ''}
      ${order.status === 'Payment Complete' ? `<button class="btn btn-primary" data-id="${order.id}" data-next-status="Delivery Complete">Mark Delivery Complete</button>` : ''}
    </div>
  `;
  return orderCard;
}

function renderCafeKanban(orders) {
  if (colNotTaken) colNotTaken.innerHTML = '';
  if (colPaymentComplete) colPaymentComplete.innerHTML = '';
  const ordersNotTaken = (orders || []).filter(o => o.status === 'Not Taken');
  const ordersPaymentComplete = (orders || []).filter(o => o.status === 'Payment Complete');
  if (colNotTaken) {
    colNotTaken.innerHTML = ordersNotTaken.length ? '' : '<p class="empty-message">No new orders.</p>';
    ordersNotTaken.forEach(o => colNotTaken.appendChild(createCafeOrderCard(o)));
  }
  if (colPaymentComplete) {
    colPaymentComplete.innerHTML = ordersPaymentComplete.length ? '' : '<p class="empty-message">No orders awaiting pickup.</p>';
    ordersPaymentComplete.forEach(o => colPaymentComplete.appendChild(createCafeOrderCard(o)));
  }
}

function createSuppPendingCard(order) {
  const card = document.createElement('div');
  card.className = 'order-card status-pending';
  card.style.cssText = `--status-color: var(--teal, #0fb);`;
  const itemsHtml = (order.supplement_order_items || []).map(item => `
    <div class="order-item">
      <span><span class="quantity">${item.quantity}x</span> ${item.item_name}</span>
      <span>৳${(item.price_at_order * item.quantity).toFixed(2)}</span>
    </div>
  `).join('');
  card.innerHTML = `
    <div class="order-header">
      <div>
        <h3>Supp #${String(order.id).slice(0, 6).toUpperCase()}</h3>
        <p class="order-customer">${order.customer_name || 'Walk-in'}</p>
        <p class="order-time">${new Date(order.created_at).toLocaleTimeString()}</p>
      </div>
      <p class="total">৳${Number(order.total_amount).toFixed(2)}</p>
    </div>
    <div class="order-items-list">${itemsHtml}</div>
    <div class="order-actions">
      <button class="btn btn-danger" data-supp-delete="${order.id}">Delete</button>
      <button class="btn btn-primary" data-supp-confirm="${order.id}">Confirm Order</button>
    </div>
  `;
  return card;
}

function renderSuppPending(rows) {
  if (!colSuppPending) return;
  colSuppPending.innerHTML = rows.length ? '' : '<p class="empty-message">No supplement orders pending.</p>';
  rows.forEach(o => colSuppPending.appendChild(createSuppPendingCard(o)));
}

function bindOrderStatusEvents() {
  const ordersSection = document.getElementById('orders-section');
  if (!ordersSection) return;
  ordersSection.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    // cafe flows
    if (btn.dataset.id && btn.dataset.nextStatus) {
      const orderId = btn.dataset.id; const nextStatus = btn.dataset.nextStatus; const original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Updating…';
      const { error } = await supabase.from('orders').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
      if (error) { console.error('Error updating status:', error); alert('Could not update order status.'); btn.disabled = false; btn.textContent = original; }
      else await fetchAndRenderOrders();
    }
    if (btn.dataset.suppConfirm) {
      const suppId = btn.dataset.suppConfirm; const original = btn.textContent; btn.disabled = true; btn.textContent = 'Confirming…';
      const { error } = await supabase.from('supplement_orders').update({ status: 'Completed', updated_at: new Date().toISOString() }).eq('id', suppId);
      if (error) { console.error('Error confirming supplement order:', error); alert('Could not confirm supplement order.'); btn.disabled = false; btn.textContent = original; }
      else await fetchAndRenderOrders();
    }
    if (btn.dataset.suppDelete) {
      const orderId = btn.dataset.suppDelete; if (!confirm('Delete this supplement order? Items will be restocked.')) return;
      const { data: items } = await supabase.from('supplement_order_items').select('*').eq('order_id', orderId);
      for (const it of items || []) {
        const pid = it.supplement_product_id; const qty = Number(it.quantity || 0); if (!pid || !qty) continue;
        const { data: prod } = await supabase.from('supplement_products').select('stock').eq('id', pid).single();
        const newStock = Number(prod?.stock || 0) + qty;
        await supabase.from('supplement_products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', pid);
      }
      await supabase.from('supplement_order_items').delete().eq('order_id', orderId);
      await supabase.from('supplement_orders').delete().eq('id', orderId);
      alert('Supplement order deleted.');
      await fetchAndRenderOrders();
    }
  });
}

// ===== menu =====
const menuTableBody = $('#menu-table-body');
const loadingMenu = $('#loading-menu');
const menuTable = $('#menu-table');
const addItemBtn = $('#add-item-btn');
const itemModal = $('#item-modal');
const closeModalBtn = $('#close-modal-btn');
const cancelBtn = $('#cancel-btn');
const itemForm = $('#item-form');
const modalTitle = $('#modal-title');
let editingItemId = null;

async function loadMenuItems() {
  loadingMenu?.classList.remove('hidden');
  menuTable?.classList.add('hidden');
  const { data, error } = await supabase.from('menu_items').select('*').order('created_at', { ascending: false });
  if (error) { console.error('Error fetching menu items:', error); alert('Could not fetch menu items.'); return; }
  menuTableBody.innerHTML = '';
  (data || []).forEach(item => {
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
      <td>${fmtBDT(item.price)}</td>
      <td>
        <button class="status-toggle ${item.available ? 'available' : 'unavailable'}" data-id="${item.id}" data-current-status="${item.available}">${item.available ? 'Available' : 'Unavailable'}</button>
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
  window.lucide?.createIcons();
  loadingMenu?.classList.add('hidden');
  menuTable?.classList.remove('hidden');
}

async function toggleAvailability(id, current) { const { error } = await supabase.from('menu_items').update({ available: !current }).eq('id', id); if (error) alert('Failed to update status.'); else loadMenuItems(); }
async function openEditModal(id) {
  const { data, error } = await supabase.from('menu_items').select('*').eq('id', id).single();
  if (error) { console.error('Error fetching item:', error); alert('Could not load item data.'); return; }
  editingItemId = id; modalTitle.textContent = 'Edit Menu Item';
  $('#item-id').value = data.id; $('#name').value = data.name; $('#description').value = data.description; $('#category').value = data.category; $('#price').value = data.price; $('#is_popular').checked = !!data.is_popular;
  $('#calories').value = data.calories ?? ''; $('#protein').value = data.protein ?? ''; $('#carbohydrates').value = data.carbohydrates ?? '';
  $('#fats').value = data.fats ?? ''; $('#fiber').value = data.fiber ?? ''; $('#sugar').value = data.sugar ?? '';
  $('#sodium').value = data.sodium ?? ''; $('#vitamins').value = data.vitamins ?? ''; $('#allergens').value = data.allergens ?? '';
  $('#dietary_tags').value = data.dietary_tags ?? '';
  $('#current-image').textContent = data.image_url ? `Current: ${data.image_url.split('/').pop()}` : 'No image uploaded.';
  itemModal.classList.remove('hidden'); window.lucide?.createIcons();
}
function openAddModal() { editingItemId = null; modalTitle.textContent = 'Add Menu Item'; itemForm.reset(); $('#is_popular').checked = false; $('#current-image').textContent = ''; itemModal.classList.remove('hidden'); window.lucide?.createIcons(); }
async function handleFormSubmit(e) {
  e.preventDefault(); const submitButton = e.target.querySelector('button[type="submit"]'); submitButton.disabled = true; submitButton.textContent = 'Saving…';
  let imageUrl = null; const imageFile = $('#image')?.files?.[0];
  if (imageFile) {
    const filePath = `public/${Date.now()}-${imageFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from('menu-images').upload(filePath, imageFile);
    if (uploadError) { console.error('Image upload error:', uploadError); alert('Failed to upload image.'); submitButton.disabled = false; submitButton.textContent = 'Save Item'; return; }
    const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(uploadData.path); imageUrl = urlData.publicUrl;
  }
  const formData = { name: $('#name').value, description: $('#description').value, category: $('#category').value, price: parseFloat($('#price').value), is_popular: $('#is_popular').checked, calories: parseInt($('#calories').value) || null };
  if (imageUrl) formData.image_url = imageUrl;
  let dbErr; if (editingItemId) ({ error: dbErr } = await supabase.from('menu_items').update(formData).eq('id', editingItemId)); else { formData.available = true; ({ error: dbErr } = await supabase.from('menu_items').insert([formData])); }
  if (dbErr) { console.error('Database error:', dbErr); alert('Failed to save the item.'); } else { itemModal.classList.add('hidden'); await loadMenuItems(); }
  submitButton.disabled = false; submitButton.textContent = 'Save Item';
}
function bindMenuEvents() { addItemBtn?.addEventListener('click', openAddModal); closeModalBtn?.addEventListener('click', () => itemModal.classList.add('hidden')); cancelBtn?.addEventListener('click', () => itemModal.classList.add('hidden')); itemForm?.addEventListener('submit', handleFormSubmit); menuTableBody?.addEventListener('click', (e) => { const target = e.target.closest('button'); if (!target) return; const id = target.dataset.id; if (target.classList.contains('status-toggle')) toggleAvailability(id, target.dataset.currentStatus === 'true'); if (target.classList.contains('edit')) openEditModal(id); if (target.classList.contains('delete')) deleteItem(id); }); }

// ===== supplements =====
const supplementsSection = $('#supplements-section');
const supplementsTable = $('#supplements-table');
const supplementsTableBody = $('#supplements-table-body');
const loadingSupplements = $('#loading-supplements');
const addSuppBtn = $('#add-supplement-btn');
const suppModal = $('#supplement-modal');
const suppModalTitle = $('#supplement-modal-title');
const suppForm = $('#supplement-form');
const suppCloseBtn = $('#supplement-close-btn');
const suppCancelBtn = $('#supp-cancel-btn');
let currentEditingSuppId = null;

function parseStoragePath(publicUrl) {
  try { const u = new URL(publicUrl); const ix = u.pathname.indexOf('/object/public/'); if (ix === -1) return null; const after = u.pathname.slice(ix + '/object/public/'.length); const [bucket, ...rest] = after.split('/'); return { bucket, path: rest.join('/') }; } catch { return null; }
}
async function hasOrderHistory(productId) { const { count, error } = await supabase.from('supplement_order_items').select('id', { count: 'exact', head: true }).eq('supplement_product_id', productId); if (error) { console.error('check history error:', error); return true; } return (count ?? 0) > 0; }

async function loadSupplements() {
  loadingSupplements?.classList.remove('hidden'); supplementsTable?.classList.add('hidden');
  const { data, error } = await supabase.from('supplement_products').select('*').order('created_at', { ascending: false });
  if (error) { console.error('Error fetching supplements:', error); alert('Could not fetch supplements.'); loadingSupplements?.classList.add('hidden'); return; }
  supplementsTableBody.innerHTML = '';
  (data || []).forEach(p => {
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
      <td>${fmtBDT(p.price)}</td>
      <td>${p.stock > 0 ? p.stock : '<span class="status-badge danger">Out of stock</span>'}</td>
      <td>
        <button class="status-toggle ${p.available ? 'available' : 'unavailable'}" data-supp-id="${p.id}" data-current-status="${p.available}">${p.available ? 'Available' : 'Unavailable'}</button>
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
  window.lucide?.createIcons(); loadingSupplements?.classList.add('hidden'); supplementsTable?.classList.remove('hidden');
}

function openAddSupplementModal() { currentEditingSuppId = null; suppModalTitle.textContent = 'Add Product'; suppForm.reset(); $('#supp-current-image').textContent = ''; suppModal.classList.remove('hidden'); window.lucide?.createIcons(); }
async function openEditSupplementModal(id) { const { data, error } = await supabase.from('supplement_products').select('*').eq('id', id).single(); if (error) { console.error(error); alert('Could not load product.'); return; } currentEditingSuppId = id; suppModalTitle.textContent = 'Edit Product'; const setVal = (elId, val = '') => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; }; setVal('supplement-id', data.id); setVal('supp-name', data.name); setVal('supp-brand', data.brand || ''); setVal('supp-category', data.category); setVal('supp-price', data.price); setVal('supp-buying', data.buying_price ?? 0); setVal('supp-stock', data.stock); setVal('supp-description', data.description || ''); setVal('supp-tags', data.tags || ''); setVal('supp-rating', data.rating || ''); const feat = $('#supp-featured'); if (feat) feat.checked = !!data.is_featured; const currentImg = $('#supp-current-image'); if (currentImg) { currentImg.textContent = data.image_url ? `Current: ${data.image_url.split('/').pop()}` : 'No image uploaded.'; } suppModal.classList.remove('hidden'); window.lucide?.createIcons(); }

async function handleSupplementSubmit(e) { e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = 'Saving…'; const gv = (id) => document.getElementById(id)?.value ?? ''; const required = { name: gv('supp-name').trim(), category: gv('supp-category'), price: Number(gv('supp-price')), buying_price: Number(gv('supp-buying')), stock: Number(gv('supp-stock')) }; if (!required.name || !required.category || isNaN(required.price) || isNaN(required.buying_price) || isNaN(required.stock)) { alert('Please fill in Name, Category, Price, Buying Price, and Stock.'); btn.disabled = false; btn.textContent = 'Save Product'; return; } let imageUrl = null; const imageFile = document.getElementById('supp-image')?.files?.[0]; if (imageFile) { try { const { base, ext } = slugifyName(imageFile.name); const filePath = `public/${Date.now()}-${base}.${ext}`; const { data: uploadData, error: upErr } = await supabase.storage.from(SUPP_BUCKET).upload(filePath, imageFile, { cacheControl: '3600', upsert: false, contentType: imageFile.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`, }); if (upErr) throw upErr; const { data: urlData } = supabase.storage.from(SUPP_BUCKET).getPublicUrl(uploadData.path); imageUrl = urlData?.publicUrl || null; } catch (err) { console.error('Image upload failed:', err); alert(err?.message?.includes('Bucket not found') ? 'Storage bucket not found. Create a PUBLIC bucket named "supplement-images" in Supabase.' : 'Image upload failed. Please try another image.'); btn.disabled = false; btn.textContent = 'Save Product'; return; } } const payload = { name: required.name, brand: gv('supp-brand') || null, category: required.category, price: required.price, buying_price: required.buying_price, stock: required.stock, description: gv('supp-description') || null, is_featured: !!document.getElementById('supp-featured')?.checked, tags: gv('supp-tags') || null, rating: (() => { const v = document.getElementById('supp-rating')?.value; return v === '' || v == null ? null : Number(v); })(), updated_at: new Date().toISOString(), available: required.stock > 0 }; if (imageUrl) payload.image_url = imageUrl; let error; if (currentEditingSuppId) ({ error } = await supabase.from('supplement_products').update(payload).eq('id', currentEditingSuppId)); else ({ error } = await supabase.from('supplement_products').insert([payload])); if (error) { console.error(error); alert('Failed to save product.'); } else { suppModal.classList.add('hidden'); await loadSupplements(); } btn.disabled = false; btn.textContent = 'Save Product'; }

async function toggleSupplementAvailability(id, current) { const { error } = await supabase.from('supplement_products').update({ available: !current }).eq('id', id); if (error) alert('Failed to update status.'); else loadSupplements(); }
async function deleteSupplement(id) { if (!confirm('Delete this product?')) return; const linked = await hasOrderHistory(id); if (linked) { if (!confirm('This product has order history.\nYou cannot delete it.\n\nMark it as "Unavailable" instead?')) return; const { error } = await supabase.from('supplement_products').update({ available: false }).eq('id', id); if (error) { console.error(error); alert('Failed to mark as unavailable.'); } else { await loadSupplements(); } return; } const { data: row, error: rowErr } = await supabase.from('supplement_products').select('image_url').eq('id', id).single(); if (!rowErr && row?.image_url) { const parsed = parseStoragePath(row.image_url); if (parsed && parsed.bucket) { try { await supabase.storage.from(parsed.bucket).remove([parsed.path]); } catch (e) { console.warn('storage remove failed:', e); } } } const { error } = await supabase.from('supplement_products').delete().eq('id', id); if (error) { console.error(error); alert(error.code === '23503' || error.status === 409 ? 'Cannot delete: this product has related order records.' : 'Failed to delete product.'); } else { await loadSupplements(); } }
function bindSupplementsEvents() { addSuppBtn?.addEventListener('click', openAddSupplementModal); suppCloseBtn?.addEventListener('click', () => suppModal.classList.add('hidden')); suppCancelBtn?.addEventListener('click', () => suppModal.classList.add('hidden')); suppForm?.addEventListener('submit', handleSupplementSubmit); supplementsSection?.addEventListener('click', (e) => { const btn = e.target.closest('button'); if (!btn) return; if (btn.classList.contains('status-toggle')) { toggleSupplementAvailability(btn.dataset.suppId, btn.dataset.currentStatus === 'true'); } if (btn.classList.contains('edit-supp')) { openEditSupplementModal(btn.dataset.suppId); } if (btn.classList.contains('delete-supp')) { deleteSupplement(btn.dataset.suppId); } }); }

// Supplement pending orders UI (lightweight)
async function fetchPendingSuppOrders() { const { data: orders, error: oErr } = await supabase.from('supplement_orders').select('*').eq('status', 'Pending').order('created_at', { ascending: false }); if (oErr) { console.error(oErr); return []; } return orders || []; }
async function fetchSuppItemsByOrder(orderId) { const { data, error } = await supabase.from('supplement_order_items').select('id, order_id, supplement_product_id, item_name, quantity, price_at_order').eq('order_id', orderId); if (error) { console.error(error); return []; } return data || []; }
function renderPendingSuppOrders(orders, itemsMap) { const root = document.getElementById('supp-pending-list'); if (!root) return; root.innerHTML = ''; if (!orders.length) { root.innerHTML = `<div class="empty-message">No pending supplement orders.</div>`; return; } for (const o of orders) { const items = itemsMap[o.id] || []; const prettyId = String(o.id).slice(0, 6).toUpperCase(); const lines = items.map(it => { const lineAmt = Number(it.price_at_order) * Number(it.quantity); return `<div class="tx-line"><span>${it.quantity}x ${it.item_name}</span><span>৳${lineAmt.toFixed(2)}</span></div>`; }).join(''); const card = document.createElement('div'); card.className = 'order-card'; card.innerHTML = `<div class="order-card__head"><div class="left"><div class="order-title">Supp #${prettyId}</div><div class="order-sub">${o.customer_name || 'Walk-in'}<span class="dot"></span>${new Date(o.created_at).toLocaleTimeString()}</div></div><div class="amount">৳${Number(o.total_amount).toFixed(2)}</div></div><div class="order-lines">${lines || '<div class="tx-line muted">No items</div>'}</div><div class="order-card__actions"><button class="btn btn-danger" data-action="delete-supp-order" data-oid="${o.id}">Delete</button><button class="btn btn-primary" data-action="confirm-supp-order" data-oid="${o.id}">Confirm Order</button></div>`; root.appendChild(card); } }
async function confirmSuppOrder(orderId) { const { error } = await supabase.from('supplement_orders').update({ status: 'Completed', updated_at: new Date().toISOString() }).eq('id', orderId); if (error) { console.error(error); alert('Failed to confirm order.'); } else { await refreshPendingSupp(); } }
async function deleteSuppOrder(orderId) { if (!confirm('Delete this supplement order? This will remove the order and its items, and restock products.')) return; const items = await fetchSuppItemsByOrder(orderId); for (const it of items) { const pid = it.supplement_product_id; const qty = Number(it.quantity || 0); if (!pid || !qty) continue; const { data: prod, error: sErr } = await supabase.from('supplement_products').select('stock').eq('id', pid).single(); if (sErr) { console.error(sErr); continue; } const newStock = Number(prod?.stock || 0) + qty; const { error: uErr } = await supabase.from('supplement_products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', pid); if (uErr) { console.error(uErr); } } const { error: diErr } = await supabase.from('supplement_order_items').delete().eq('order_id', orderId); if (diErr) { console.error(diErr); alert('Failed to delete order items.'); return; } const { error: doErr } = await supabase.from('supplement_orders').delete().eq('id', orderId); if (doErr) { console.error(doErr); alert('Failed to delete order.'); return; } await refreshPendingSupp(); alert('Order deleted.'); }
async function refreshPendingSupp() { const orders = await fetchPendingSuppOrders(); const itemsMap = {}; await Promise.all(orders.map(async (o) => { itemsMap[o.id] = await fetchSuppItemsByOrder(o.id); })); renderPendingSuppOrders(orders, itemsMap); }
function bindPendingSuppEvents() { const root = document.getElementById('supp-pending-list'); if (!root) return; root.addEventListener('click', async (e) => { const btn = e.target.closest('button[data-action]'); if (!btn) return; const orderId = btn.dataset.oid; const act = btn.dataset.action; if (act === 'confirm-supp-order') await confirmSuppOrder(orderId); else if (act === 'delete-supp-order') await deleteSuppOrder(orderId); }); }

// ===== transactions =====
const transactionsList = $('#transactions-list');
const transactionsSummary = $('#transactions-summary');
const loadingTransactions = $('#loading-transactions');
const noTransactionsMsg = $('#no-transactions-msg');
async function fetchAndRenderTransactionsSplit() {
  loadingTransactions?.classList.remove('hidden'); transactionsList.innerHTML = ''; noTransactionsMsg?.classList.add('hidden');
  const dayStart = new Date(); dayStart.setHours(0,0,0,0); const fromISO = dayStart.toISOString();
  const { data: cafeTx, error: cafeErr } = await supabase.from('orders').select('*').eq('status','Delivery Complete').gte('created_at', fromISO).order('created_at',{ascending:false});
  const { data: suppTx, error: suppErr } = await supabase.from('supplement_orders').select('*').eq('status','Completed').gte('created_at', fromISO).order('created_at',{ascending:false});
  if (cafeErr) console.error('Cafe transactions error:', cafeErr); if (suppErr) console.error('Supp transactions error:', suppErr);
  const cafe = cafeTx || []; const supp = suppTx || [];
  const totalRevenue = [...cafe, ...supp].reduce((s,o)=>s+Number(o.total_amount||0),0); const completedCount = cafe.length + supp.length;
  transactionsSummary && (transactionsSummary.innerHTML = `<div class="summary-item"><h4>Total Revenue (Today)</h4><p>${fmtBDT(totalRevenue)}</p></div><div class="summary-item"><h4>Completed Orders (Today)</h4><p>${completedCount}</p></div>`);
  const wrapper = document.createElement('div'); wrapper.style.display='grid'; wrapper.style.gridTemplateColumns='1fr 1fr'; wrapper.style.gap='16px';
  const cafeCol = document.createElement('div'); cafeCol.innerHTML = `<h3 class="tx-title">Cafe Menu Sales (Today)</h3>`; if (!cafe.length) cafeCol.innerHTML += `<p class="empty-message">No cafe transactions yet.</p>`; else cafe.forEach(tx=>{ const el=document.createElement('div'); el.className='transaction-item'; el.innerHTML = `<div class="transaction-details"><p><strong>${tx.customer_name}</strong> – Order #${String(tx.id).slice(0,6).toUpperCase()}</p><p class="order-time">${new Date(tx.created_at).toLocaleString()}</p></div><p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>`; cafeCol.appendChild(el); });
  const suppCol = document.createElement('div'); suppCol.innerHTML = `<h3 class="tx-title">Supplements Sales (Today)</h3>`; if (!supp.length) suppCol.innerHTML += `<p class="empty-message">No supplements transactions yet.</p>`; else supp.forEach(tx=>{ const el=document.createElement('div'); el.className='transaction-item'; el.innerHTML = `<div class="transaction-details"><p><strong>${tx.customer_name || 'Walk-in'}</strong> – Supp #${String(tx.id).slice(0,6).toUpperCase()}</p><p class="order-time">${new Date(tx.created_at).toLocaleString()}</p></div><p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>`; suppCol.appendChild(el); });
  wrapper.appendChild(cafeCol); wrapper.appendChild(suppCol); transactionsList && transactionsList.appendChild(wrapper); loadingTransactions?.classList.add('hidden'); if (!cafe.length && !supp.length) noTransactionsMsg?.classList.remove('hidden');
}

// ===== app init =====
document.addEventListener('DOMContentLoaded', () => {
  initTabs(); bindOrderStatusEvents(); bindMenuEvents(); bindSupplementsEvents();
  fetchAndRenderOrders(); fetchAndRenderTransactionsSplit(); loadMenuItems(); window.lucide?.createIcons(); startAutoRefresh();
});
// ========== COMBINED JS FILES ==========
// All code from the js folder combined into one file

// ========== js/supabaseClient.js ==========
// Central Supabase client used by all modules
// NOTE: The supabase client and keys are already declared at the top of this combined file,
// so do not redeclare them here to avoid "Cannot redeclare block-scoped variable" errors.
// Reuse the existing SUPABASE_URL, SUPABASE_ANON_KEY and supabase constants defined earlier.

// ========== js/utils.js ==========
// NOTE: SUPP_BUCKET, slugifyName, $, $$, and fmtBDT are already declared at the top of this combined file.
// Do not redeclare them here to avoid "Cannot redeclare block-scoped variable" errors.

// ========== js/tabs.js ==========
// NOTE: initTabs and startAutoRefresh are already defined at the top of this file.
// This section is kept for reference but the actual runtime uses the earlier definitions.
      const orderId = btn.dataset.suppDelete;
      if (!confirm('Delete this supplement order? Items will be restocked.')) return;

      const { data: items } = await supabase
        .from('supplement_order_items')
        .select('*')
        .eq('order_id', orderId);

      for (const it of items || []) {
        const pid = it.supplement_product_id;
        const qty = Number(it.quantity || 0);
        if (!pid || !qty) continue;

        const { data: prod } = await supabase
          .from('supplement_products')
          .select('stock')
          .eq('id', pid)
          .single();
        const newStock = Number(prod?.stock || 0) + qty;

        await supabase
          .from('supplement_products')
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', pid);
      }

      await supabase.from('supplement_order_items').delete().eq('order_id', orderId);
      await supabase.from('supplement_orders').delete().eq('id', orderId);

      alert('Supplement order deleted.');
      await fetchAndRenderOrders();
    }
  });
}

// ========== js/menu.js ==========

async function loadMenuItems() {
  loadingMenu.classList.remove('hidden');
  menuTable.classList.add('hidden');

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching menu items:', error); alert('Could not fetch menu items.'); return; }

  menuTableBody.innerHTML = '';
  (data || []).forEach(item => {
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
      <td>${fmtBDT(item.price)}</td>
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

  window.lucide?.createIcons();
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

  $('#item-id').value = data.id;
  $('#name').value = data.name;
  $('#description').value = data.description;
  $('#category').value = data.category;
  $('#price').value = data.price;
  $('#is_popular').checked = !!data.is_popular;

  $('#calories').value = data.calories ?? '';
  $('#protein').value = data.protein ?? '';
  $('#carbohydrates').value = data.carbohydrates ?? '';
  $('#fats').value = data.fats ?? '';
  $('#fiber').value = data.fiber ?? '';
  $('#sugar').value = data.sugar ?? '';
  $('#sodium').value = data.sodium ?? '';
  $('#vitamins').value = data.vitamins ?? '';
  $('#allergens').value = data.allergens ?? '';
  $('#dietary_tags').value = data.dietary_tags ?? '';
  $('#current-image').textContent =
    data.image_url ? `Current: ${data.image_url.split('/').pop()}` : 'No image uploaded.';

  itemModal.classList.remove('hidden');
  window.lucide?.createIcons();
}

function openAddModal() {
  editingItemId = null;
  modalTitle.textContent = 'Add Menu Item';
  itemForm.reset();
  $('#is_popular').checked = false;
  $('#current-image').textContent = '';
  itemModal.classList.remove('hidden');
  window.lucide?.createIcons();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const submitButton = e.target.querySelector('button[type="submit"]');
  submitButton.disabled = true; submitButton.textContent = 'Saving…';

  let imageUrl = null;
  const imageFile = $('#image').files[0];
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
    name: $('#name').value,
    description: $('#description').value,
    category: $('#category').value,
    price: parseFloat($('#price').value),
    is_popular: $('#is_popular').checked,
    calories: parseInt($('#calories').value) || null,
    protein: parseInt($('#protein').value) || null,
    carbohydrates: parseInt($('#carbohydrates').value) || null,
    fats: parseInt($('#fats').value) || null,
    fiber: parseInt($('#fiber').value) || null,
    sugar: parseInt($('#sugar').value) || null,
    sodium: parseInt($('#sodium').value) || null,
    vitamins: $('#vitamins').value || null,
    allergens: $('#allergens').value || null,
    dietary_tags: $('#dietary_tags').value || null,
    updated_at: new Date().toISOString(),
  };
  if (imageUrl) formData.image_url = imageUrl;

  let dbErr;
  if (editingItemId) {
    ({ error: dbErr } = await supabase.from('menu_items').update(formData).eq('id', editingItemId));
  } else {
    formData.available = true;
    ({ error: dbErr } = await supabase.from('menu_items').insert([formData]));
  }

  if (dbErr) { console.error('Database error:', dbErr); alert('Failed to save the item.'); }
  else { itemModal.classList.add('hidden'); await loadMenuItems(); }

  submitButton.disabled = false; submitButton.textContent = 'Save Item';
}

function bindMenuEvents() {
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
}

// ========== js/supplements.js ==========
// NOTE: supplementsSection, supplementsTable, supplementsTableBody, loadingSupplements, addSuppBtn,
//       suppModal, suppModalTitle, suppForm, suppCloseBtn, suppCancelBtn, and currentEditingSuppId
//       are already declared at the top of this file, so we reuse them here.

function parseStoragePath(publicUrl) {
  try {
    const u = new URL(publicUrl);
    const ix = u.pathname.indexOf('/object/public/');
    if (ix === -1) return null;
    const after = u.pathname.slice(ix + '/object/public/'.length);
    const [bucket, ...rest] = after.split('/');
    return { bucket, path: rest.join('/') };
  } catch {
    return null;
  }
}

async function hasOrderHistory(productId) {
  const { count, error } = await supabase
    .from('supplement_order_items')
    .select('id', { count: 'exact', head: true })
    .eq('supplement_product_id', productId);

  if (error) {
    console.error('check history error:', error);
    return true;
  }
  return (count ?? 0) > 0;
}

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
  (data || []).forEach(p => {
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
      <td>${fmtBDT(p.price)}</td>
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

  window.lucide?.createIcons();
  loadingSupplements.classList.add('hidden');
  supplementsTable.classList.remove('hidden');
}

function openAddSupplementModal() {
  currentEditingSuppId = null;
  suppModalTitle.textContent = 'Add Product';
  suppForm.reset();
  $('#supp-current-image').textContent = '';
  suppModal.classList.remove('hidden');
  window.lucide?.createIcons();
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

  const setVal = (elId, val = '') => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };

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

  const feat = $('#supp-featured');
  if (feat) feat.checked = !!data.is_featured;

  const currentImg = $('#supp-current-image');
  if (currentImg) {
    currentImg.textContent = data.image_url
      ? `Current: ${data.image_url.split('/').pop()}`
      : 'No image uploaded.';
  }

  suppModal.classList.remove('hidden');
  window.lucide?.createIcons();
}

async function handleSupplementSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Saving…';

  const gv = (id) => document.getElementById(id)?.value ?? '';
  const required = {
    name: gv('supp-name').trim(),
    category: gv('supp-category'),
    price: Number(gv('supp-price')),
    buying_price: Number(gv('supp-buying')),
    stock: Number(gv('supp-stock')),
  };
  if (!required.name || !required.category || isNaN(required.price) || isNaN(required.buying_price) || isNaN(required.stock)) {
    alert('Please fill in Name, Category, Price, Buying Price, and Stock.');
    btn.disabled = false; btn.textContent = 'Save Product';
    return;
  }

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
      btn.disabled = false; btn.textContent = 'Save Product';
      return;
    }
  }

  const payload = {
    name: required.name,
    brand: gv('supp-brand') || null,
    category: required.category,
    price: required.price,
    buying_price: required.buying_price,
    stock: required.stock,
    description: gv('supp-description') || null,
    is_featured: !!document.getElementById('supp-featured')?.checked,
    tags: gv('supp-tags') || null,
    rating: (()=>{ const v = document.getElementById('supp-rating')?.value; return v === '' || v == null ? null : Number(v); })(),
    updated_at: new Date().toISOString(),
    available: required.stock > 0
  };
  if (imageUrl) payload.image_url = imageUrl;

  let error;
  if (currentEditingSuppId) {
    ({ error } = await supabase.from('supplement_products').update(payload).eq('id', currentEditingSuppId));
  } else {
    ({ error } = await supabase.from('supplement_products').insert([payload]));
  }

  if (error) { console.error(error); alert('Failed to save product.'); }
  else { suppModal.classList.add('hidden'); await loadSupplements(); }

  btn.disabled = false; btn.textContent = 'Save Product';
}

async function toggleSupplementAvailability(id, current) {
  const { error } = await supabase
    .from('supplement_products').update({ available: !current }).eq('id', id);
  if (error) alert('Failed to update status.'); else loadSupplements();
}

async function deleteSupplement(id) {
  if (!confirm('Delete this product?')) return;

  const linked = await hasOrderHistory(id);
  if (linked) {
    if (!confirm(
      'This product has order history.\nYou cannot delete it.\n\nMark it as "Unavailable" instead?'
    )) return;

    const { error } = await supabase
      .from('supplement_products')
      .update({ available: false })
      .eq('id', id);

    if (error) {
      console.error(error);
      alert('Failed to mark as unavailable.');
    } else {
      await loadSupplements();
    }
    return;
  }

  const { data: row, error: rowErr } = await supabase
    .from('supplement_products')
    .select('image_url')
    .eq('id', id)
    .single();

  if (!rowErr && row?.image_url) {
    const parsed = parseStoragePath(row.image_url);
    if (parsed && parsed.bucket) {
      try {
        await supabase.storage.from(parsed.bucket).remove([parsed.path]);
      } catch (e) {
        console.warn('storage remove failed:', e);
      }
    }
  }

  const { error } = await supabase
    .from('supplement_products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(error);
    alert(
      error.code === '23503' || error.status === 409
        ? 'Cannot delete: this product has related order records.'
        : 'Failed to delete product.'
    );
  } else {
    await loadSupplements();
  }
}

function bindSupplementsEvents() {
  addSuppBtn?.addEventListener('click', openAddSupplementModal);
  suppCloseBtn?.addEventListener('click', () => suppModal.classList.add('hidden'));
  suppCancelBtn?.addEventListener('click', () => suppModal.classList.add('hidden'));
  suppForm?.addEventListener('submit', handleSupplementSubmit);

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
}

async function fetchPendingSuppOrders() {
  const { data: orders, error: oErr } = await supabase
    .from('supplement_orders')
    .select('*')
    .eq('status', 'Pending')
    .order('created_at', { ascending: false });

  if (oErr) { console.error(oErr); return []; }
  return orders || [];
}

async function fetchSuppItemsByOrder(orderId) {
  const { data, error } = await supabase
    .from('supplement_order_items')
    .select('id, order_id, supplement_product_id, item_name, quantity, price_at_order')
    .eq('order_id', orderId);

  if (error) { console.error(error); return []; }
  return data || [];
}

function renderPendingSuppOrders(orders, itemsMap) {
  const root = document.getElementById('supp-pending-list');
  if (!root) return;

  root.innerHTML = '';

  if (!orders.length) {
    root.innerHTML = `<div class="empty-message">No pending supplement orders.</div>`;
    return;
  }

  for (const o of orders) {
    const items = itemsMap[o.id] || [];
    const prettyId = String(o.id).slice(0, 6).toUpperCase();
    const lines = items.map(it => {
      const lineAmt = Number(it.price_at_order) * Number(it.quantity);
      return `
        <div class="tx-line">
          <span>${it.quantity}x ${it.item_name}</span>
          <span>৳${lineAmt.toFixed(2)}</span>
        </div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `
      <div class="order-card__head">
        <div class="left">
          <div class="order-title">Supp #${prettyId}</div>
          <div class="order-sub">${o.customer_name || 'Walk-in'}<span class="dot"></span>${new Date(o.created_at).toLocaleTimeString()}</div>
        </div>
        <div class="amount">৳${Number(o.total_amount).toFixed(2)}</div>
      </div>

      <div class="order-lines">
        ${lines || '<div class="tx-line muted">No items</div>'}
      </div>

      <div class="order-card__actions">
        <button class="btn btn-danger" data-action="delete-supp-order" data-oid="${o.id}">
          Delete
        </button>
        <button class="btn btn-primary" data-action="confirm-supp-order" data-oid="${o.id}">
          Confirm Order
        </button>
      </div>
    `;
    root.appendChild(card);
  }
}

async function confirmSuppOrder(orderId) {
  const { error } = await supabase
    .from('supplement_orders')
    .update({ status: 'Completed', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    console.error(error);
    alert('Failed to confirm order.');
  } else {
    await refreshPendingSupp();
  }
}

async function deleteSuppOrder(orderId) {
  if (!confirm('Delete this supplement order? This will remove the order and its items, and restock products.')) {
    return;
  }

  const items = await fetchSuppItemsByOrder(orderId);

  for (const it of items) {
    const pid = it.supplement_product_id;
    const qty = Number(it.quantity || 0);
    if (!pid || !qty) continue;

    const { data: prod, error: sErr } = await supabase
      .from('supplement_products')
      .select('stock')
      .eq('id', pid)
      .single();
    if (sErr) { console.error(sErr); continue; }

    const newStock = Number(prod?.stock || 0) + qty;

    const { error: uErr } = await supabase
      .from('supplement_products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', pid);

    if (uErr) { console.error(uErr); }
  }

  const { error: diErr } = await supabase
    .from('supplement_order_items')
    .delete()
    .eq('order_id', orderId);
  if (diErr) {
    console.error(diErr);
    alert('Failed to delete order items.');
    return;
  }

  const { error: doErr } = await supabase
    .from('supplement_orders')
    .delete()
    .eq('id', orderId);
  if (doErr) {
    console.error(doErr);
    alert('Failed to delete order.');
    return;
  }

  await refreshPendingSupp();
  alert('Order deleted.');
}

async function refreshPendingSupp() {
  const orders = await fetchPendingSuppOrders();

  const itemsMap = {};
  await Promise.all(
    orders.map(async (o) => {
      itemsMap[o.id] = await fetchSuppItemsByOrder(o.id);
    })
  );

  renderPendingSuppOrders(orders, itemsMap);
}

function bindPendingSuppEvents() {
  const root = document.getElementById('supp-pending-list');
  if (!root) return;

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const orderId = btn.dataset.oid;
    const act = btn.dataset.action;

    if (act === 'confirm-supp-order') {
      await confirmSuppOrder(orderId);
    } else if (act === 'delete-supp-order') {
      await deleteSuppOrder(orderId);
    }
  });
}

async function mountSupplementPendingOrders() {
  bindPendingSuppEvents();
  await refreshPendingSupp();
}

// ========== js/transactions.js ==========
// NOTE: transactionsList, transactionsSummary, loadingTransactions, and noTransactionsMsg
// are already declared at the top of this combined file, so we reuse them here.

async function fetchAndRenderTransactionsSplit() {
  loadingTransactions.classList.remove('hidden');
  transactionsList.innerHTML = '';
  noTransactionsMsg.classList.add('hidden');

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const fromISO = dayStart.toISOString();

  const { data: cafeTx, error: cafeErr } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'Delivery Complete')
    .gte('created_at', fromISO)
    .order('created_at', { ascending: false });

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

  const totalRevenue = [...cafe, ...supp].reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const completedCount = cafe.length + supp.length;

  transactionsSummary.innerHTML = `
    <div class="summary-item"><h4>Total Revenue (Today)</h4><p>${fmtBDT(totalRevenue)}</p></div>
    <div class="summary-item"><h4>Completed Orders (Today)</h4><p>${completedCount}</p></div>
  `;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'grid';
  wrapper.style.gridTemplateColumns = '1fr 1fr';
  wrapper.style.gap = '16px';

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
        <p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>
      `;
      cafeCol.appendChild(el);
    });
  }

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
        <p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>
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

// ========== js/main.js - Initialize on DOMContentLoaded ==========
document.addEventListener('DOMContentLoaded', () => {
  // Tabs + listeners
  initTabs();
  bindOrderStatusEvents();
  bindMenuEvents();
  bindSupplementsEvents();

  // Initial data loads
  fetchAndRenderOrders();
  fetchAndRenderTransactionsSplit();
  loadMenuItems();

  // Icons + auto refresh
  window.lucide?.createIcons();
  startAutoRefresh();
});



// ===== File: tabs.js =====

// js/tabs.js
import { $,$$ } from './utils.js';
import { fetchAndRenderOrders } from './orders.js';
import { fetchAndRenderTransactionsSplit } from './transactions.js';
import { loadMenuItems } from './menu.js';
import { loadSupplements } from './supplements.js';

export function initTabs() {
  const mainTabs = $('.main-tabs');
  const tabContents = $$('.tab-content');

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
}

export function startAutoRefresh() {
  setInterval(async () => {
    const activeTab = document.querySelector('.main-tab-btn.active')?.dataset.tab;
    if (activeTab === 'orders') await fetchAndRenderOrders();
    if (activeTab === 'transactions') await fetchAndRenderTransactionsSplit();
  }, 10000);
}



// ===== File: transactions.js =====

// js/transactions.js
// NOTE: supabase, $, fmtBDT are already declared at the top of this combined file
// NOTE: transactionsList, transactionsSummary, loadingTransactions, and noTransactionsMsg
// are already declared at the top of this combined file, so we reuse them here.

async function fetchAndRenderTransactionsSplit() {
  loadingTransactions.classList.remove('hidden');
  transactionsList.innerHTML = '';
  noTransactionsMsg.classList.add('hidden');

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const fromISO = dayStart.toISOString();

  const { data: cafeTx, error: cafeErr } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'Delivery Complete')
    .gte('created_at', fromISO)
    .order('created_at', { ascending: false });

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

  const totalRevenue = [...cafe, ...supp].reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const completedCount = cafe.length + supp.length;

  transactionsSummary.innerHTML = `
    <div class="summary-item"><h4>Total Revenue (Today)</h4><p>${fmtBDT(totalRevenue)}</p></div>
    <div class="summary-item"><h4>Completed Orders (Today)</h4><p>${completedCount}</p></div>
  `;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'grid';
  wrapper.style.gridTemplateColumns = '1fr 1fr';
  wrapper.style.gap = '16px';

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
        <p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>
      `;
      cafeCol.appendChild(el);
    });
  }

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
        <p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>
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



// ===== File: supplements.js =====

// js/supplements.js
// NOTE: supabase, $, fmtBDT, SUPP_BUCKET, slugifyName are already declared at the top of this combined file
// NOTE: supplementsSection, supplementsTable, supplementsTableBody, loadingSupplements, addSuppBtn,
//       suppModal, suppModalTitle, suppForm, suppCloseBtn, suppCancelBtn, currentEditingSuppId
//       are already declared in the combined bundle above, so we reuse them here.

/* ---------------- utils for delete flow ---------------- */

// Extract storage bucket & path from a public URL
function parseStoragePath(publicUrl) {
  // expected:
  // https://<proj>.supabase.co/storage/v1/object/public/supplement-images/public/123-file.jpg
  try {
    const u = new URL(publicUrl);
    const ix = u.pathname.indexOf('/object/public/');
    if (ix === -1) return null;
    const after = u.pathname.slice(ix + '/object/public/'.length); // "supplement-images/<path>"
    const [bucket, ...rest] = after.split('/');
    return { bucket, path: rest.join('/') };
  } catch {
    return null;
  }
}

// Did this product appear in any order items?
async function hasOrderHistory(productId) {
  const { count, error } = await supabase
    .from('supplement_order_items')
    .select('id', { count: 'exact', head: true })
    .eq('supplement_product_id', productId);

  if (error) {
    console.error('check history error:', error);
    // be conservative: assume it has history so we don't hard-delete
    return true;
  }
  return (count ?? 0) > 0;
}

/* ---------------- list / render ---------------- */

export async function loadSupplements() {
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
  (data || []).forEach(p => {
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
      <td>${fmtBDT(p.price)}</td>
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

  window.lucide?.createIcons();
  loadingSupplements.classList.add('hidden');
  supplementsTable.classList.remove('hidden');
}

/* ---------------- modal open/edit ---------------- */

export function openAddSupplementModal() {
  currentEditingSuppId = null;
  suppModalTitle.textContent = 'Add Product';
  suppForm.reset();
  $('#supp-current-image').textContent = '';
  suppModal.classList.remove('hidden');
  window.lucide?.createIcons();
}

export async function openEditSupplementModal(id) {
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

  const setVal = (elId, val = '') => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };

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

  const feat = $('#supp-featured');
  if (feat) feat.checked = !!data.is_featured;

  const currentImg = $('#supp-current-image');
  if (currentImg) {
    currentImg.textContent = data.image_url
      ? `Current: ${data.image_url.split('/').pop()}`
      : 'No image uploaded.';
  }

  suppModal.classList.remove('hidden');
  window.lucide?.createIcons();
}

/* ---------------- submit (add / update) ---------------- */

export async function handleSupplementSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Saving…';

  const gv = (id) => document.getElementById(id)?.value ?? '';
  const required = {
    name: gv('supp-name').trim(),
    category: gv('supp-category'),
    price: Number(gv('supp-price')),
    buying_price: Number(gv('supp-buying')),
    stock: Number(gv('supp-stock')),
  };
  if (!required.name || !required.category || isNaN(required.price) || isNaN(required.buying_price) || isNaN(required.stock)) {
    alert('Please fill in Name, Category, Price, Buying Price, and Stock.');
    btn.disabled = false; btn.textContent = 'Save Product';
    return;
  }

  // optional image upload
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
      btn.disabled = false; btn.textContent = 'Save Product';
      return;
    }
  }

  const payload = {
    name: required.name,
    brand: gv('supp-brand') || null,
    category: required.category,
    price: required.price,
    buying_price: required.buying_price,
    stock: required.stock,
    description: gv('supp-description') || null,
    is_featured: !!document.getElementById('supp-featured')?.checked,
    tags: gv('supp-tags') || null,
    rating: (()=>{ const v = document.getElementById('supp-rating')?.value; return v === '' || v == null ? null : Number(v); })(),
    updated_at: new Date().toISOString(),
    available: required.stock > 0
  };
  if (imageUrl) payload.image_url = imageUrl;

  let error;
  if (currentEditingSuppId) {
    ({ error } = await supabase.from('supplement_products').update(payload).eq('id', currentEditingSuppId));
  } else {
    ({ error } = await supabase.from('supplement_products').insert([payload]));
  }

  if (error) { console.error(error); alert('Failed to save product.'); }
  else { suppModal.classList.add('hidden'); await loadSupplements(); }

  btn.disabled = false; btn.textContent = 'Save Product';
}

/* ---------------- status toggle ---------------- */

export async function toggleSupplementAvailability(id, current) {
  const { error } = await supabase
    .from('supplement_products').update({ available: !current }).eq('id', id);
  if (error) alert('Failed to update status.'); else loadSupplements();
}

/* ---------------- delete (safe) ---------------- */

export async function deleteSupplement(id) {
  // ask first
  if (!confirm('Delete this product?')) return;

  // If the product has sales, do NOT hard-delete -> mark unavailable
  const linked = await hasOrderHistory(id);
  if (linked) {
    if (!confirm(
      'This product has order history.\nYou cannot delete it.\n\nMark it as "Unavailable" instead?'
    )) return;

    const { error } = await supabase
      .from('supplement_products')
      .update({ available: false })
      .eq('id', id);

    if (error) {
      console.error(error);
      alert('Failed to mark as unavailable.');
    } else {
      await loadSupplements();
    }
    return;
  }

  // No history -> try to remove stored image first (optional)
  const { data: row, error: rowErr } = await supabase
    .from('supplement_products')
    .select('image_url')
    .eq('id', id)
    .single();

  if (!rowErr && row?.image_url) {
    const parsed = parseStoragePath(row.image_url);
    if (parsed && parsed.bucket) {
      try {
        await supabase.storage.from(parsed.bucket).remove([parsed.path]);
      } catch (e) {
        console.warn('storage remove failed:', e);
      }
    }
  }

  // Hard delete
  const { error } = await supabase
    .from('supplement_products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(error);
    alert(
      error.code === '23503' || error.status === 409
        ? 'Cannot delete: this product has related order records.'
        : 'Failed to delete product.'
    );
  } else {
    await loadSupplements();
  }
}

/* ---------------- bind events ---------------- */

export function bindSupplementsEvents() {
  addSuppBtn?.addEventListener('click', openAddSupplementModal);
  suppCloseBtn?.addEventListener('click', () => suppModal.classList.add('hidden'));
  suppCancelBtn?.addEventListener('click', () => suppModal.classList.add('hidden'));
  suppForm?.addEventListener('submit', handleSupplementSubmit);

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
      deleteSupplement(btn.dataset.suppId); // uses the safe delete
    }
  });
}
// ---------- Supplement orders (PENDING) UI + actions ----------

async function fetchPendingSuppOrders() {
  // Orders with status 'Pending'
  const { data: orders, error: oErr } = await supabase
    .from('supplement_orders')
    .select('*')
    .eq('status', 'Pending')
    .order('created_at', { ascending: false });

  if (oErr) { console.error(oErr); return []; }
  return orders || [];
}

async function fetchSuppItemsByOrder(orderId) {
  // We stored item_name, price_at_order, quantity, supplement_product_id
  const { data, error } = await supabase
    .from('supplement_order_items')
    .select('id, order_id, supplement_product_id, item_name, quantity, price_at_order')
    .eq('order_id', orderId);

  if (error) { console.error(error); return []; }
  return data || [];
}

function renderPendingSuppOrders(orders, itemsMap) {
  const root = document.getElementById('supp-pending-list');
  if (!root) return;

  root.innerHTML = '';

  if (!orders.length) {
    root.innerHTML = `<div class="empty-message">No pending supplement orders.</div>`;
    return;
  }

  for (const o of orders) {
    const items = itemsMap[o.id] || [];
    const prettyId = String(o.id).slice(0, 6).toUpperCase();
    const lines = items.map(it => {
      const lineAmt = Number(it.price_at_order) * Number(it.quantity);
      return `
        <div class="tx-line">
          <span>${it.quantity}x ${it.item_name}</span>
          <span>৳${lineAmt.toFixed(2)}</span>
        </div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML = `
      <div class="order-card__head">
        <div class="left">
          <div class="order-title">Supp #${prettyId}</div>
          <div class="order-sub">${o.customer_name || 'Walk-in'}<span class="dot"></span>${new Date(o.created_at).toLocaleTimeString()}</div>
        </div>
        <div class="amount">৳${Number(o.total_amount).toFixed(2)}</div>
      </div>

      <div class="order-lines">
        ${lines || '<div class="tx-line muted">No items</div>'}
      </div>

      <div class="order-card__actions">
        <button class="btn btn-danger" data-action="delete-supp-order" data-oid="${o.id}">
          Delete
        </button>
        <button class="btn btn-primary" data-action="confirm-supp-order" data-oid="${o.id}">
          Confirm Order
        </button>
      </div>
    `;
    root.appendChild(card);
  }
}

async function confirmSuppOrder(orderId) {
  const { error } = await supabase
    .from('supplement_orders')
    .update({ status: 'Completed', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (error) {
    console.error(error);
    alert('Failed to confirm order.');
  } else {
    await refreshPendingSupp(); // re-render list
  }
}

async function deleteSuppOrder(orderId) {
  if (!confirm('Delete this supplement order? This will remove the order and its items, and restock products.')) {
    return;
  }

  // 1) Fetch items for this order
  const items = await fetchSuppItemsByOrder(orderId);

  // 2) Restock each product (reverse whatever stock was reduced at checkout)
  for (const it of items) {
    const pid = it.supplement_product_id;
    const qty = Number(it.quantity || 0);
    if (!pid || !qty) continue;

    // read current stock
    const { data: prod, error: sErr } = await supabase
      .from('supplement_products')
      .select('stock')
      .eq('id', pid)
      .single();
    if (sErr) { console.error(sErr); continue; }

    const newStock = Number(prod?.stock || 0) + qty;

    const { error: uErr } = await supabase
      .from('supplement_products')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', pid);

    if (uErr) { console.error(uErr); }
  }

  // 3) Delete items first (FK safety), then delete the order
  const { error: diErr } = await supabase
    .from('supplement_order_items')
    .delete()
    .eq('order_id', orderId);
  if (diErr) {
    console.error(diErr);
    alert('Failed to delete order items.');
    return;
  }

  const { error: doErr } = await supabase
    .from('supplement_orders')
    .delete()
    .eq('id', orderId);
  if (doErr) {
    console.error(doErr);
    alert('Failed to delete order.');
    return;
  }

  await refreshPendingSupp();
  alert('Order deleted.');
}

async function refreshPendingSupp() {
  const orders = await fetchPendingSuppOrders();

  // get items for each order in parallel
  const itemsMap = {};
  await Promise.all(
    orders.map(async (o) => {
      itemsMap[o.id] = await fetchSuppItemsByOrder(o.id);
    })
  );

  renderPendingSuppOrders(orders, itemsMap);
}

// Hook click handlers on the “Supplement Orders (Pending)” list
function bindPendingSuppEvents() {
  const root = document.getElementById('supp-pending-list');
  if (!root) return;

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const orderId = btn.dataset.oid;
    const act = btn.dataset.action;

    if (act === 'confirm-supp-order') {
      await confirmSuppOrder(orderId);
    } else if (act === 'delete-supp-order') {
      await deleteSuppOrder(orderId);
    }
  });
}

// Call these when you enter the Orders tab:
export async function mountSupplementPendingOrders() {
  bindPendingSuppEvents();
  await refreshPendingSupp();
}



// ===== File: orders.js =====

// js/orders.js
import { supabase } from './supabaseClient.js';
import { $ } from './utils.js';

const notificationSound = $('#notification-sound');
const colNotTaken = $('#orders-col-not-taken');
const colPaymentComplete = $('#orders-col-payment-complete');
// NEW: supplements pending column
const colSuppPending = $('#supp-orders-pending');

const loadingOrders = $('#loading-orders');

let currentOrderCount = 0;
let currentSuppPendingCount = 0;

export async function fetchAndRenderOrders() {
  loadingOrders.classList.remove('hidden');

  // Cafe orders (unchanged)
  const { data: orders, error: errCafe } = await supabase
    .from('orders')
    .select(`*, order_items ( * )`)
    .neq('status', 'Delivery Complete')
    .order('created_at', { ascending: true });

  // Supplement orders (pending)
  const { data: suppOrders, error: errSupp } = await supabase
    .from('supplement_orders')
    .select(`*, supplement_order_items ( * )`)
    .eq('status', 'Pending')
    .order('created_at', { ascending: true });

  if (errCafe) console.error('Error fetching cafe orders:', errCafe);
  if (errSupp) console.error('Error fetching supplement orders:', errSupp);

  const totalNewCount = (orders?.length || 0) + (suppOrders?.length || 0);
  if (totalNewCount > (currentOrderCount + currentSuppPendingCount) &&
      (currentOrderCount + currentSuppPendingCount) > 0) {
    notificationSound?.play();
  }
  currentOrderCount = orders?.length || 0;
  currentSuppPendingCount = suppOrders?.length || 0;

  renderCafeKanban(orders || []);
  renderSuppPending(suppOrders || []);

  loadingOrders.classList.add('hidden');
}

function renderCafeKanban(orders) {
  colNotTaken.innerHTML = '';
  colPaymentComplete.innerHTML = '';

  const ordersNotTaken = orders.filter(o => o.status === 'Not Taken');
  const ordersPaymentComplete = orders.filter(o => o.status === 'Payment Complete');

  colNotTaken.innerHTML = ordersNotTaken.length ? '' : '<p class="empty-message">No new orders.</p>';
  ordersNotTaken.forEach(o => colNotTaken.appendChild(createCafeOrderCard(o)));

  colPaymentComplete.innerHTML = ordersPaymentComplete.length ? '' : '<p class="empty-message">No orders awaiting pickup.</p>';
  ordersPaymentComplete.forEach(o => colPaymentComplete.appendChild(createCafeOrderCard(o)));
}

function createCafeOrderCard(order) {
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

// --------- Supplements Pending ---------
function renderSuppPending(rows) {
  colSuppPending.innerHTML = rows.length ? '' : '<p class="empty-message">No supplement orders pending.</p>';
  rows.forEach(o => colSuppPending.appendChild(createSuppPendingCard(o)));
}

function createSuppPendingCard(order) {
  const card = document.createElement('div');
  card.className = 'order-card status-pending';
  card.style.cssText = `--status-color: var(--teal, #0fb);`;

  const itemsHtml = (order.supplement_order_items || []).map(item => `
    <div class="order-item">
      <span><span class="quantity">${item.quantity}x</span> ${item.item_name}</span>
      <span>৳${(item.price_at_order * item.quantity).toFixed(2)}</span>
    </div>
  `).join('');

  card.innerHTML = `
    <div class="order-header">
      <div>
        <h3>Supp #${order.id.slice(0, 6).toUpperCase()}</h3>
        <p class="order-customer">${order.customer_name || 'Walk-in'}</p>
        <p class="order-time">${new Date(order.created_at).toLocaleTimeString()}</p>
      </div>
      <p class="total">৳${Number(order.total_amount).toFixed(2)}</p>
    </div>
    <div class="order-items-list">${itemsHtml}</div>
    <div class="order-actions">
      <button class="btn btn-danger" data-supp-delete="${order.id}">Delete</button>
      <button class="btn btn-primary" data-supp-confirm="${order.id}">Confirm Order</button>
    </div>
  `;
  return card;
}

// --------- Event binding ---------
export function bindOrderStatusEvents() {
  document.getElementById('orders-section')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // Cafe flow
    if (btn.dataset.id && btn.dataset.nextStatus) {
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
      }
    }

    // Supplements confirm
    if (btn.dataset.suppConfirm) {
      const suppId = btn.dataset.suppConfirm;
      const original = btn.textContent;
      btn.disabled = true; btn.textContent = 'Confirming…';

      const { error } = await supabase
        .from('supplement_orders')
        .update({ status: 'Completed', updated_at: new Date().toISOString() })
        .eq('id', suppId);

      if (error) {
        console.error('Error confirming supplement order:', error);
        alert('Could not confirm supplement order.');
        btn.disabled = false; btn.textContent = original;
      } else {
        await fetchAndRenderOrders();
      }
    }

    // ✅ Supplements delete (NEW)
    if (btn.dataset.suppDelete) {
      const orderId = btn.dataset.suppDelete;
      if (!confirm('Delete this supplement order? Items will be restocked.')) return;

      // fetch items
      const { data: items } = await supabase
        .from('supplement_order_items')
        .select('*')
        .eq('order_id', orderId);

      // restock each
      for (const it of items || []) {
        const pid = it.supplement_product_id;
        const qty = Number(it.quantity || 0);
        if (!pid || !qty) continue;

        const { data: prod } = await supabase
          .from('supplement_products')
          .select('stock')
          .eq('id', pid)
          .single();
        const newStock = Number(prod?.stock || 0) + qty;

        await supabase
          .from('supplement_products')
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', pid);
      }

      // delete order items and order
      await supabase.from('supplement_order_items').delete().eq('order_id', orderId);
      await supabase.from('supplement_orders').delete().eq('id', orderId);

      alert('Supplement order deleted.');
      await fetchAndRenderOrders();
    }
  });
}



// ===== File: menu.js =====
// js/menu.js
import { supabase } from './supabaseClient.js';
import { $, fmtBDT } from './utils.js';

const menuTableBody = $('#menu-table-body');
const loadingMenu = $('#loading-menu');
const menuTable = $('#menu-table');
const addItemBtn = $('#add-item-btn');
const itemModal = $('#item-modal');
const closeModalBtn = $('#close-modal-btn');
const cancelBtn = $('#cancel-btn');
const itemForm = $('#item-form');
const modalTitle = $('#modal-title');

let editingItemId = null;

export async function loadMenuItems() {
  loadingMenu.classList.remove('hidden');
  menuTable.classList.add('hidden');

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('Error fetching menu items:', error); alert('Could not fetch menu items.'); return; }

  menuTableBody.innerHTML = '';
  (data || []).forEach(item => {
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
      <td>${fmtBDT(item.price)}</td>
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

  window.lucide?.createIcons();
  loadingMenu.classList.add('hidden');
  menuTable.classList.remove('hidden');
}

export async function toggleAvailability(id, current) {
  const { error } = await supabase.from('menu_items').update({ available: !current }).eq('id', id);
  if (error) alert('Failed to update status.'); else loadMenuItems();
}

export async function openEditModal(id) {
  const { data, error } = await supabase.from('menu_items').select('*').eq('id', id).single();
  if (error) { console.error('Error fetching item:', error); alert('Could not load item data.'); return; }

  editingItemId = id;
  modalTitle.textContent = 'Edit Menu Item';

  $('#item-id').value = data.id;
  $('#name').value = data.name;
  $('#description').value = data.description;
  $('#category').value = data.category;
  $('#price').value = data.price;
  $('#is_popular').checked = !!data.is_popular;

  $('#calories').value = data.calories ?? '';
  $('#protein').value = data.protein ?? '';
  $('#carbohydrates').value = data.carbohydrates ?? '';
  $('#fats').value = data.fats ?? '';
  $('#fiber').value = data.fiber ?? '';
  $('#sugar').value = data.sugar ?? '';
  $('#sodium').value = data.sodium ?? '';
  $('#vitamins').value = data.vitamins ?? '';
  $('#allergens').value = data.allergens ?? '';
  $('#dietary_tags').value = data.dietary_tags ?? '';
  $('#current-image').textContent =
    data.image_url ? `Current: ${data.image_url.split('/').pop()}` : 'No image uploaded.';

  itemModal.classList.remove('hidden');
  window.lucide?.createIcons();
}

export function openAddModal() {
  editingItemId = null;
  modalTitle.textContent = 'Add Menu Item';
  itemForm.reset();
  $('#is_popular').checked = false;
  $('#current-image').textContent = '';
  itemModal.classList.remove('hidden');
  window.lucide?.createIcons();
}

export async function handleFormSubmit(e) {
  e.preventDefault();
  const submitButton = e.target.querySelector('button[type="submit"]');
  submitButton.disabled = true; submitButton.textContent = 'Saving…';

  // optional image upload
  let imageUrl = null;
  const imageFile = $('#image').files[0];
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
    name: $('#name').value,
    description: $('#description').value,
    category: $('#category').value,
    price: parseFloat($('#price').value),
    is_popular: $('#is_popular').checked,
    calories: parseInt($('#calories').value) || null,
    protein: parseInt($('#protein').value) || null,
    carbohydrates: parseInt($('#carbohydrates').value) || null,
    fats: parseInt($('#fats').value) || null,
    fiber: parseInt($('#fiber').value) || null,
    sugar: parseInt($('#sugar').value) || null,
    sodium: parseInt($('#sodium').value) || null,
    vitamins: $('#vitamins').value || null,
    allergens: $('#allergens').value || null,
    dietary_tags: $('#dietary_tags').value || null,
    updated_at: new Date().toISOString(),
  };
  if (imageUrl) formData.image_url = imageUrl;

  let dbErr;
  if (editingItemId) {
    ({ error: dbErr } = await supabase.from('menu_items').update(formData).eq('id', editingItemId));
  } else {
    formData.available = true;
    ({ error: dbErr } = await supabase.from('menu_items').insert([formData]));
  }

  if (dbErr) { console.error('Database error:', dbErr); alert('Failed to save the item.'); }
  else { itemModal.classList.add('hidden'); await loadMenuItems(); }

  submitButton.disabled = false; submitButton.textContent = 'Save Item';
}

export function bindMenuEvents() {
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
}



// ===== File: main.js =====

// js/main.js
import { initTabs, startAutoRefresh } from './tabs.js';
import { fetchAndRenderOrders, bindOrderStatusEvents } from './orders.js';
import { bindMenuEvents, loadMenuItems } from './menu.js';
import { bindSupplementsEvents, loadSupplements } from './supplements.js';
import { fetchAndRenderTransactionsSplit } from './transactions.js';

document.addEventListener('DOMContentLoaded', () => {
  // Tabs + listeners
  initTabs();
  bindOrderStatusEvents();
  bindMenuEvents();
  bindSupplementsEvents();

  // Initial data loads
  fetchAndRenderOrders();
  fetchAndRenderTransactionsSplit();
  loadMenuItems();

  // Icons + auto refresh
  window.lucide?.createIcons();
  startAutoRefresh();
});


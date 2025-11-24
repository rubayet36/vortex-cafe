// ==========================================
// 1. CONFIGURATION & UTILITIES
// ==========================================

// Initialize Supabase
const SUPABASE_URL = 'https://ovxxnsrqzdlyzdmubwaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92eHhuc3JxemRseXpkbXVid2F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY4MTgsImV4cCI6MjA3OTU1MjgxOH0.uwU9aQGbUO7OEv4HI8Rtq7awANWNubt3yJTSUMZRAJU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPP_BUCKET = 'supplement-images';

// Helper Functions
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmtBDT = (n) => `৳${Number(n || 0).toFixed(2)}`;

const prettyPaymentMethod = (m) => {
  if (!m) return '';
  const val = String(m).toLowerCase();
  if (val === 'bkash') return 'bKash';
  if (val === 'card') return 'Card';
  if (val === 'cash') return 'Cash';
  return 'Other';
};

const notificationSound = $('#notification-sound');
const colNotTaken = $('#orders-col-not-taken');
const colPaymentComplete = $('#orders-col-payment-complete');
const colSuppPending = $('#supp-orders-pending');
const loadingOrders = $('#loading-orders');

// payment modal elements
const paymentModal = document.getElementById('payment-modal');
const paymentForm = document.getElementById('payment-form');
const paymentOrderIdEl = document.getElementById('payment-order-id');
const paymentOrderCustomerEl = document.getElementById('payment-order-customer');
const paymentOrderTotalEl = document.getElementById('payment-order-total');
const paymentMethodSelect = document.getElementById('payment-method');
const paymentReferenceInput = document.getElementById('payment-reference');
const paymentCancelBtn = document.getElementById('payment-cancel-btn');
const paymentCloseBtn = document.getElementById('payment-close-btn');

// keep the uuid as a STRING
// { id: string, customer: string, total: number, type: 'cafe' | 'supplement' }
let currentPaymentOrder = null;

// ==========================================
// ROLE-BASED ACCESS CONTROL
// ==========================================

function getUserRole() {
  return localStorage.getItem('userRole') || 'staff';
}

function setUserRole(role) {
  localStorage.setItem('userRole', role);
}

function isAdmin() {
  return getUserRole() === 'admin';
}

function checkAccess(requiredRole = 'admin') {
  const userRole = getUserRole();
  if (requiredRole === 'admin' && userRole !== 'admin') {
    return false;
  }
  return true;
}

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

// ==========================================
// 2. TABS & NAVIGATION
// ==========================================

function initTabs() {
  const mainTabs = $('.main-tabs');
  const tabContents = $$('.tab-content');

  if (!mainTabs) return;

  mainTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    mainTabs.querySelector('.active')?.classList.remove('active');
    btn.classList.add('active');

    tabContents.forEach((c) => c.classList.remove('active'));
    const toShow = document.getElementById(`${btn.dataset.tab}-section`);
    toShow?.classList.add('active');

    const tab = btn.dataset.tab;
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'orders') fetchAndRenderOrders();
    if (tab === 'transactions') fetchAndRenderTransactions();
    if (tab === 'menu') loadMenuItems();
    if (tab === 'supplements') loadSupplements();
    if (tab === 'supplement-requests') loadSupplementRequests();
  });
}

function startAutoRefresh() {
  setInterval(async () => {
    const activeTab = document.querySelector('.main-tab-btn.active')?.dataset.tab;
    if (activeTab === 'dashboard') await loadDashboard();
    if (activeTab === 'orders') await fetchAndRenderOrders();
    if (activeTab === 'transactions') await fetchAndRenderTransactions();
  }, 10000);
}

function initThemeToggle() {
  const themeToggleBtn = $('#theme-toggle-btn');
  const themeIcon = $('#theme-icon');
  const themeText = $('#theme-text');

  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon?.setAttribute('data-lucide', 'sun');
    if (themeText) themeText.textContent = 'Light Mode';
  }

  themeToggleBtn?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeIcon?.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (themeText) themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    window.lucide?.createIcons();
  });
}

// ==========================================
// 3. ORDERS (CAFE + SUPPLEMENTS PENDING)
// ==========================================

let currentOrderCount = 0;
let currentSuppPendingCount = 0;

async function fetchAndRenderOrders() {
  if (loadingOrders) loadingOrders.classList.remove('hidden');

  // 1. Fetch Cafe Orders
  const { data: orders, error: errCafe } = await supabase
    .from('orders')
    .select(`*, order_items ( * )`)
    .neq('status', 'Delivery Complete')
    .order('created_at', { ascending: true });

  // 2. Fetch Pending Supplement Orders
  const { data: suppOrders, error: errSupp } = await supabase
    .from('supplement_orders')
    .select(`*, supplement_order_items ( * )`)
    .eq('status', 'Pending')
    .order('created_at', { ascending: true });

  if (errCafe) console.error('Error fetching cafe orders:', errCafe);
  if (errSupp) console.error('Error fetching supplement orders:', errSupp);

  // Notification Sound Logic
  const totalNewCount = (orders?.length || 0) + (suppOrders?.length || 0);
  const previousCount = currentOrderCount + currentSuppPendingCount;

  if (totalNewCount > previousCount && previousCount > 0) {
    notificationSound?.play().catch((e) => console.log('Audio play blocked'));
  }

  currentOrderCount = orders?.length || 0;
  currentSuppPendingCount = suppOrders?.length || 0;

  renderCafeKanban(orders || []);
  renderSuppPending(suppOrders || []);

  if (loadingOrders) loadingOrders.classList.add('hidden');
}

// ===============================
// PAYMENT MODAL HELPERS
// ===============================
function openPaymentModal({ id, customer, total, type = 'cafe' }) {
  currentPaymentOrder = {
    id: String(id),
    customer: customer || 'Walk-in',
    total: Number(total) || 0,
    type, // 'cafe' or 'supplement'
  };

  if (paymentOrderIdEl)
    paymentOrderIdEl.textContent = `#${String(id).slice(0, 6).toUpperCase()}`;
  if (paymentOrderCustomerEl)
    paymentOrderCustomerEl.textContent = currentPaymentOrder.customer;
  if (paymentOrderTotalEl)
    paymentOrderTotalEl.textContent = fmtBDT(currentPaymentOrder.total);

  if (paymentMethodSelect) paymentMethodSelect.value = '';
  if (paymentReferenceInput) paymentReferenceInput.value = '';

  paymentModal?.classList.remove('hidden');
  window.lucide?.createIcons();
}

function closePaymentModal() {
  paymentModal?.classList.add('hidden');
  currentPaymentOrder = null;
}

async function handlePaymentSubmit(e) {
  e.preventDefault();
  if (!currentPaymentOrder) return;

  const submitBtn = paymentForm.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;

  const method = paymentMethodSelect?.value;
  const reference = paymentReferenceInput?.value.trim() || null;

  if (!method) {
    alert('Please select a payment method.');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  try {
    // build payment payload
    const payload = {
      method,
      status: 'completed',
      amount: currentPaymentOrder.total,
      transaction_reference: reference,
      source: currentPaymentOrder.type || 'cafe',
    };

    if (currentPaymentOrder.type === 'supplement') {
      payload.supplement_order_id = currentPaymentOrder.id;
    } else {
      payload.order_id = currentPaymentOrder.id;
    }

    // 1) Insert payment
    const { error: paymentError } = await supabase
      .from('payments')
      .insert([payload]);

    if (paymentError) {
      console.error('Payment insert error:', paymentError);
      alert('Could not save payment. Please try again.');
      return;
    }

    // 2) Update order status
    if (currentPaymentOrder.type === 'supplement') {
      // supplements: mark as Completed
      const { error: suppErr } = await supabase
        .from('supplement_orders')
        .update({
          status: 'Completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentPaymentOrder.id);

      if (suppErr) {
        console.error('Supp order status update error:', suppErr);
        alert('Payment saved, but supplement order status could not be updated.');
        return;
      }
    } else {
      // cafe
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'Payment Complete',
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentPaymentOrder.id);

      if (orderError) {
        console.error('Order status update error:', orderError);
        alert('Payment saved, but order status could not be updated.');
        return;
      }
    }

    closePaymentModal();
    await fetchAndRenderOrders();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText || 'Confirm Payment';
    }
  }
}

// --- Cafe Rendering ---
function renderCafeKanban(orders) {
  if (colNotTaken) colNotTaken.innerHTML = '';
  if (colPaymentComplete) colPaymentComplete.innerHTML = '';

  const ordersNotTaken = orders.filter((o) => o.status === 'Not Taken');
  const ordersPaymentComplete = orders.filter(
    (o) => o.status === 'Payment Complete'
  );

  if (colNotTaken) {
    colNotTaken.innerHTML = ordersNotTaken.length
      ? ''
      : '<p class="empty-message">No new orders.</p>';
    ordersNotTaken.forEach((o) =>
      colNotTaken.appendChild(createCafeOrderCard(o))
    );
  }

  if (colPaymentComplete) {
    colPaymentComplete.innerHTML = ordersPaymentComplete.length
      ? ''
      : '<p class="empty-message">No orders awaiting pickup.</p>';
    ordersPaymentComplete.forEach((o) =>
      colPaymentComplete.appendChild(createCafeOrderCard(o))
    );
  }
}

function createCafeOrderCard(order) {
  const orderCard = document.createElement('div');
  const statusClass = (order.status || '').toLowerCase().replace(' ', '-');
  const statusColor = order.status === 'Not Taken' ? 'var(--blue)' : '#ffc107';

  orderCard.className = `order-card status-${statusClass}`;
  orderCard.style.cssText = `--status-color: ${statusColor}`;

  const itemsHtml = (order.order_items || [])
    .map(
      (item) => `
    <div class="order-item">
      <span><span class="quantity">${item.quantity}x</span> ${
        item.item_name
      }</span>
      <span>৳${(item.price_at_order * item.quantity).toFixed(2)}</span>
    </div>
  `
    )
    .join('');

  orderCard.innerHTML = `
    <div class="order-header">
      <div>
        <h3>Order #${String(order.id).slice(0, 6).toUpperCase()}</h3>
        <p class="order-customer">${order.customer_name}</p>
        <p class="order-time">${new Date(
          order.created_at
        ).toLocaleTimeString()}</p>
      </div>
      <p class="total">৳${Number(order.total_amount).toFixed(2)}</p>
    </div>
    <div class="order-items-list">${itemsHtml}</div>
    <div class="order-actions">
      ${
        order.status === 'Not Taken'
          ? `
        <button
          class="btn btn-primary"
          data-id="${order.id}"
          data-next-status="Payment Complete"
          data-order-total="${Number(order.total_amount).toFixed(2)}"
          data-order-customer="${order.customer_name || 'Walk-in'}"
        >
          Mark Payment
        </button>`
          : ''
      }
      ${
        order.status === 'Payment Complete'
          ? `
        <button
          class="btn btn-primary"
          data-id="${order.id}"
          data-next-status="Delivery Complete"
        >
          Mark Delivery Complete
        </button>`
          : ''
      }
    </div>
  `;

  return orderCard;
}

// --- Supplements Pending Rendering ---
function renderSuppPending(rows) {
  if (!colSuppPending) return;
  colSuppPending.innerHTML = rows.length
    ? ''
    : '<p class="empty-message">No supplement orders pending.</p>';
  rows.forEach((o) => colSuppPending.appendChild(createSuppPendingCard(o)));
}

function createSuppPendingCard(order) {
  const card = document.createElement('div');
  card.className = 'order-card status-pending';
  card.style.cssText = `--status-color: var(--teal, #0fb);`;

  const itemsHtml = (order.supplement_order_items || [])
    .map(
      (item) => `
    <div class="order-item">
      <span><span class="quantity">${item.quantity}x</span> ${
        item.item_name
      }</span>
      <span>৳${(item.price_at_order * item.quantity).toFixed(2)}</span>
    </div>
  `
    )
    .join('');

  card.innerHTML = `
    <div class="order-header">
      <div>
        <h3>Supp #${String(order.id).slice(0, 6).toUpperCase()}</h3>
        <p class="order-customer">${order.customer_name || 'Walk-in'}</p>
        <p class="order-time">${new Date(
          order.created_at
        ).toLocaleTimeString()}</p>
      </div>
      <p class="total">৳${Number(order.total_amount).toFixed(2)}</p>
    </div>
    <div class="order-items-list">${itemsHtml}</div>
    <div class="order-actions">
      <button class="btn btn-danger" data-supp-delete="${order.id}">Delete</button>
      <button
        class="btn btn-primary"
        data-supp-pay="${order.id}"
        data-supp-total="${Number(order.total_amount).toFixed(2)}"
        data-supp-customer="${order.customer_name || 'Walk-in'}"
      >
        Mark Payment
      </button>
    </div>
  `;
  return card;
}

// --- Event Listeners (Orders) ---
function bindOrderStatusEvents() {
  const ordersSection = document.getElementById('orders-section');
  if (!ordersSection) return;

  ordersSection.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // 1. CAFE: Payment & Status
    if (btn.dataset.id && btn.dataset.nextStatus) {
      const orderId = btn.dataset.id;
      const nextStatus = btn.dataset.nextStatus;

      // If we're marking payment, open modal instead of direct update
      if (nextStatus === 'Payment Complete') {
        openPaymentModal({
          id: orderId,
          customer: btn.dataset.orderCustomer || 'Walk-in',
          total: parseFloat(btn.dataset.orderTotal || '0') || 0,
          type: 'cafe',
        });
        return;
      }

      // Delivery Complete still updates directly
      if (nextStatus === 'Delivery Complete') {
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Updating…';

        const { error } = await supabase
          .from('orders')
          .update({
            status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        if (error) {
          console.error('Error updating status:', error);
          alert('Could not update order status.');
          btn.disabled = false;
          btn.textContent = original;
        } else {
          await fetchAndRenderOrders();
        }
      }
    }

    // 2. SUPP: Mark Payment (open modal)
    if (btn.dataset.suppPay) {
      const suppId = btn.dataset.suppPay;
      openPaymentModal({
        id: suppId,
        customer: btn.dataset.suppCustomer || 'Walk-in',
        total: parseFloat(btn.dataset.suppTotal || '0') || 0,
        type: 'supplement',
      });
      return;
    }

    // 3. SUPP: Delete
    if (btn.dataset.suppDelete) {
      const orderId = btn.dataset.suppDelete;
      if (!confirm('Delete this supplement order? Items will be restocked.'))
        return;

      const { data: items } = await supabase
        .from('supplement_order_items')
        .select('*')
        .eq('order_id', orderId);

      // Restock items
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

      await supabase
        .from('supplement_order_items')
        .delete()
        .eq('order_id', orderId);
      await supabase.from('supplement_orders').delete().eq('id', orderId);

      alert('Supplement order deleted.');
      await fetchAndRenderOrders();
    }
  });
}

// ==========================================
// 4. CAFE MENU MANAGEMENT
// ==========================================

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
  if (loadingMenu) loadingMenu.classList.remove('hidden');
  if (menuTable) menuTable.classList.add('hidden');

  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching menu items:', error);
    alert('Could not fetch menu items.');
    return;
  }

  if (menuTableBody) {
    menuTableBody.innerHTML = '';
    (data || []).forEach((item) => {
      const row = document.createElement('tr');
      const priceRegular = item.price_regular || item.price || 0;
      const priceLarge = item.price_large || item.price || 0;

      row.innerHTML = `
          <td>
            <div class="item-info">
              <img src="${
                item.image_url || 'https://via.placeholder.com/50'
              }" alt="${item.name}" class="item-image">
              <div class="item-name-desc">
                <div class="item-name">${item.name} ${
        item.is_popular ? '⭐' : ''
      }</div>
              </div>
            </div>
          </td>
          <td><span class="item-category">${item.category}</span></td>
          <td>
            <div class="price-display">
              <span class="price-regular">Reg: ${fmtBDT(priceRegular)}</span>
              <span class="price-large">Lg: ${fmtBDT(priceLarge)}</span>
            </div>
          </td>
          <td>
            <button class="status-toggle ${
              item.available ? 'available' : 'unavailable'
            }" data-id="${item.id}" data-current-status="${
        item.available
      }">${item.available ? 'Available' : 'Unavailable'}</button>
          </td>
          <td>
            <div class="action-buttons">
              <button class="action-btn edit" data-id="${
                item.id
              }"><i data-lucide="edit"></i></button>
              <button class="action-btn delete" data-id="${
                item.id
              }"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        `;
      menuTableBody.appendChild(row);
    });
  }

  window.lucide?.createIcons();
  if (loadingMenu) loadingMenu.classList.add('hidden');
  if (menuTable) menuTable.classList.remove('hidden');
}

async function toggleMenuAvailability(id, current) {
  const { error } = await supabase
    .from('menu_items')
    .update({ available: !current })
    .eq('id', id);
  if (error) alert('Failed to update status.');
  else loadMenuItems();
}

async function openEditModal(id) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    console.error('Error fetching item:', error);
    alert('Could not load item data.');
    return;
  }

  editingItemId = id;
  modalTitle.textContent = 'Edit Menu Item';

  $('#item-id').value = data.id;
  $('#name').value = data.name;
  $('#description').value = data.description;
  $('#category').value = data.category;
  $('#price-regular').value = data.price_regular || data.price || 0;
  $('#price-large').value = data.price_large || data.price || 0;
  $('#is_popular').checked = !!data.is_popular;

  // Nutrition fields
  const setVal = (idSel, v) => ($(idSel).value = v ?? '');
  setVal('#calories', data.calories);
  setVal('#protein', data.protein);
  setVal('#carbohydrates', data.carbohydrates);
  setVal('#fats', data.fats);
  setVal('#fiber', data.fiber);
  setVal('#sugar', data.sugar);
  setVal('#sodium', data.sodium);
  setVal('#vitamins', data.vitamins);
  setVal('#allergens', data.allergens);
  setVal('#dietary_tags', data.dietary_tags);

  $('#current-image').textContent = data.image_url
    ? `Current: ${data.image_url.split('/').pop()}`  
    : 'No image uploaded.';
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

async function handleMenuFormSubmit(e) {
  e.preventDefault();
  const submitButton = e.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Saving…';

  let imageUrl = null;
  const imageFile = $('#image')?.files?.[0];

  if (imageFile) {
    const filePath = `public/${Date.now()}-${imageFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(filePath, imageFile);
    if (uploadError) {
      console.error('Image upload error:', uploadError);
      alert('Failed to upload image.');
      submitButton.disabled = false;
      submitButton.textContent = 'Save Item';
      return;
    }
    const { data: urlData } = supabase.storage
      .from('menu-images')
      .getPublicUrl(uploadData.path);
    imageUrl = urlData.publicUrl;
  }

  const priceRegular = parseFloat($('#price-regular').value);
  const priceLarge = parseFloat($('#price-large').value);

  if (
    isNaN(priceRegular) ||
    isNaN(priceLarge) ||
    priceRegular <= 0 ||
    priceLarge <= 0
  ) {
    alert('Please enter valid prices for both regular and large sizes.');
    submitButton.disabled = false;
    submitButton.textContent = 'Save Item';
    return;
  }

  const formData = {
    name: $('#name').value,
    description: $('#description').value,
    category: $('#category').value,
    price: priceRegular,
    price_regular: priceRegular,
    price_large: priceLarge,
    is_popular: $('#is_popular').checked,
    calories: parseInt($('#calories').value) || null,
  };

  if (imageUrl) formData.image_url = imageUrl;

  let dbErr;
  if (editingItemId) {
    ({ error: dbErr } = await supabase
      .from('menu_items')
      .update(formData)
      .eq('id', editingItemId));
  } else {
    formData.available = true;
    ({ error: dbErr } = await supabase.from('menu_items').insert([formData]));
  }

  if (dbErr) {
    console.error('Database error:', dbErr);
    alert('Failed to save the item.');
  } else {
    itemModal.classList.add('hidden');
    await loadMenuItems();
  }

  submitButton.disabled = false;
  submitButton.textContent = 'Save Item';
}

async function deleteMenuItem(id) {
  if (!confirm('Are you sure you want to delete this menu item?')) return;
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) alert('Could not delete item');
  else loadMenuItems();
}

function bindMenuEvents() {
  addItemBtn?.addEventListener('click', openAddModal);
  closeModalBtn?.addEventListener('click', () =>
    itemModal.classList.add('hidden')
  );
  cancelBtn?.addEventListener('click', () =>
    itemModal.classList.add('hidden')
  );
  itemForm?.addEventListener('submit', handleMenuFormSubmit);

  menuTableBody?.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;
    const id = target.dataset.id;
    if (target.classList.contains('status-toggle'))
      toggleMenuAvailability(id, target.dataset.currentStatus === 'true');
    if (target.classList.contains('edit')) openEditModal(id);
    if (target.classList.contains('delete')) deleteMenuItem(id);
  });
}

// ==========================================
// 5. SUPPLEMENTS INVENTORY MANAGEMENT
// ==========================================

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
  if (loadingSupplements) loadingSupplements.classList.remove('hidden');
  if (supplementsTable) supplementsTable.classList.add('hidden');

  const { data, error } = await supabase
    .from('supplement_products')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching supplements:', error);
    alert('Could not fetch supplements.');
    loadingSupplements?.classList.add('hidden');
    return;
  }

  if (supplementsTableBody) {
    supplementsTableBody.innerHTML = '';
    (data || []).forEach((p) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
          <td>
            <div class="item-info">
              <img src="${
                p.image_url || 'https://via.placeholder.com/50'
              }" class="item-image" alt="${p.name}">
              <div class="item-name-desc">
                <div class="item-name">${p.name} ${
        p.is_featured ? '⭐' : ''
      }</div>
                <div class="item-desc">${p.tags || ''}</div>
              </div>
            </div>
          </td>
          <td>${p.brand || '-'}</td>
          <td>${p.category}</td>
          <td>${fmtBDT(p.price)}</td>
          <td>${
            p.stock > 0
              ? p.stock
              : '<span class="status-badge danger">Out of stock</span>'
          }</td>
          <td>
            <button class="status-toggle ${
              p.available ? 'available' : 'unavailable'
            }" data-supp-id="${p.id}" data-current-status="${
        p.available
      }">${p.available ? 'Available' : 'Unavailable'}</button>
          </td>
          <td>
            <div class="action-buttons">
              <button class="action-btn edit-supp" data-supp-id="${
                p.id
              }"><i data-lucide="edit"></i></button>
              <button class="action-btn delete-supp" data-supp-id="${
                p.id
              }"><i data-lucide="trash-2"></i></button>
            </div>
          </td>
        `;
      supplementsTableBody.appendChild(tr);
    });
  }
  window.lucide?.createIcons();
  if (loadingSupplements) loadingSupplements.classList.add('hidden');
  if (supplementsTable) supplementsTable.classList.remove('hidden');
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
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const gv = (id) => document.getElementById(id)?.value ?? '';
  const required = {
    name: gv('supp-name').trim(),
    category: gv('supp-category'),
    price: Number(gv('supp-price')),
    buying_price: Number(gv('supp-buying')),
    stock: Number(gv('supp-stock')),
  };

  if (
    !required.name ||
    !required.category ||
    isNaN(required.price) ||
    isNaN(required.buying_price) ||
    isNaN(required.stock)
  ) {
    alert('Please fill in Name, Category, Price, Buying Price, and Stock.');
    btn.disabled = false;
    btn.textContent = 'Save Product';
    return;
  }

  let imageUrl = null;
  const imageFile = document.getElementById('supp-image')?.files?.[0];
  if (imageFile) {
    try {
      const { base, ext } = slugifyName(imageFile.name);
      const filePath = `public/${Date.now()}-${base}.${ext}`;
      const { data: uploadData, error: upErr } = await supabase.storage
        .from(SUPP_BUCKET)
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
          contentType:
            imageFile.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from(SUPP_BUCKET)
        .getPublicUrl(uploadData.path);
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
    rating: (() => {
      const v = document.getElementById('supp-rating')?.value;
      return v === '' || v == null ? null : Number(v);
    })(),
    updated_at: new Date().toISOString(),
    available: required.stock > 0,
  };

  if (imageUrl) payload.image_url = imageUrl;
  let error;
  if (currentEditingSuppId) {
    ({ error } = await supabase
      .from('supplement_products')
      .update(payload)
      .eq('id', currentEditingSuppId));
  } else {
    ({ error } = await supabase.from('supplement_products').insert([payload]));
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
    .from('supplement_products')
    .update({ available: !current })
    .eq('id', id);
  if (error) alert('Failed to update status.');
  else loadSupplements();
}

async function deleteSupplement(id) {
  if (!confirm('Delete this product?')) return;
  const linked = await hasOrderHistory(id);
  if (linked) {
    if (
      !confirm(
        'This product has order history.\nYou cannot delete it.\n\nMark it as "Unavailable" instead?'
      )
    )
      return;
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
  suppCloseBtn?.addEventListener('click', () =>
    suppModal.classList.add('hidden')
  );
  suppCancelBtn?.addEventListener('click', () =>
    suppModal.classList.add('hidden')
  );
  suppForm?.addEventListener('submit', handleSupplementSubmit);

  supplementsSection?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('status-toggle')) {
      toggleSupplementAvailability(
        btn.dataset.suppId,
        btn.dataset.currentStatus === 'true'
      );
    }
    if (btn.classList.contains('edit-supp')) {
      openEditSupplementModal(btn.dataset.suppId);
    }
    if (btn.classList.contains('delete-supp')) {
      deleteSupplement(btn.dataset.suppId);
    }
  });
}

// ==========================================
// 6. DASHBOARD OVERVIEW
// ==========================================

async function loadDashboard() {
  const statsContainer = $('#dashboard-stats');
  const recentPreview = $('#recent-orders-preview');

  if (!statsContainer || !recentPreview) return;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart);
  weekStart.setDate(dayStart.getDate() - 7);
  const fromISO = dayStart.toISOString();
  const weekISO = weekStart.toISOString();

  const { data: todayOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'Delivery Complete')
    .gte('created_at', fromISO);
  const { data: todaySupp } = await supabase
    .from('supplement_orders')
    .select('*')
    .eq('status', 'Completed')
    .gte('created_at', fromISO);
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select('*')
    .neq('status', 'Delivery Complete');
  const { data: pendingSupp } = await supabase
    .from('supplement_orders')
    .select('*')
    .eq('status', 'Pending');
  const { data: weekOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'Delivery Complete')
    .gte('created_at', weekISO)
    .lt('created_at', fromISO);
  const { data: weekSupp } = await supabase
    .from('supplement_orders')
    .select('*')
    .eq('status', 'Completed')
    .gte('created_at', weekISO)
    .lt('created_at', fromISO);

  const todayRevenue = [...(todayOrders || []), ...(todaySupp || [])].reduce(
    (s, o) => s + Number(o.total_amount || 0),
    0
  );
  const weekRevenue = [...(weekOrders || []), ...(weekSupp || [])].reduce(
    (s, o) => s + Number(o.total_amount || 0),
    0
  );
  const avgDaily = weekRevenue / 7;
  const revenueChange =
    avgDaily > 0 ? (((todayRevenue - avgDaily) / avgDaily) * 100).toFixed(1) : 0;

  const totalPending =
    (pendingOrders?.length || 0) + (pendingSupp?.length || 0);
  const todayCompleted =
    (todayOrders?.length || 0) + (todaySupp?.length || 0);

  statsContainer.innerHTML = `
    <div class="stat-card green">
      <div class="stat-icon"><i data-lucide="dollar-sign"></i></div>
      <div class="stat-label">Today's Revenue</div>
      <div class="stat-value">${fmtBDT(todayRevenue)}</div>
      <div class="stat-change ${
        revenueChange >= 0 ? 'positive' : 'negative'
      }">
        <i data-lucide="${
          revenueChange >= 0 ? 'trending-up' : 'trending-down'
        }"></i>
        ${Math.abs(revenueChange)}% vs avg
      </div>
    </div>
    <div class="stat-card blue">
      <div class="stat-icon"><i data-lucide="shopping-bag"></i></div>
      <div class="stat-label">Completed Orders</div>
      <div class="stat-value">${todayCompleted}</div>
      <div class="stat-change positive">Today</div>
    </div>
    <div class="stat-card red">
      <div class="stat-icon"><i data-lucide="clock"></i></div>
      <div class="stat-label">Pending Orders</div>
      <div class="stat-value">${totalPending}</div>
      <div class="stat-change">Needs attention</div>
    </div>
  `;

  const recent = [...(pendingOrders || []), ...(pendingSupp || [])].slice(0, 5);
  if (recent.length) {
    recentPreview.innerHTML =
      '<div class="table-container"><div style="padding: 1rem;">' +
      recent
        .map((o) => {
          const isSupp = !o.order_items;
          return `<div class="order-card" style="--status-color: var(--blue); margin-bottom: 1rem;">
          <div class="order-header">
            <div>
              <h3>${isSupp ? 'Supp' : 'Order'} #${String(o.id)
            .slice(0, 6)
            .toUpperCase()}</h3>
              <p class="order-customer">${o.customer_name || 'Walk-in'}</p>
              <p class="order-time">${new Date(
                o.created_at
              ).toLocaleTimeString()}</p>
            </div>
            <p class="total">${fmtBDT(o.total_amount)}</p>
          </div>
        </div>`;
        })
        .join('') +
      '</div></div>';
  } else {
    recentPreview.innerHTML =
      '<p class="empty-message">No pending orders.</p>';
  }

  window.lucide?.createIcons();
}

// ==========================================
// 7. TRANSACTIONS & HISTORY
// ==========================================

const transactionsList = $('#transactions-list');
const transactionsSummary = $('#transactions-summary');
const loadingTransactions = $('#loading-transactions');
const noTransactionsMsg = $('#no-transactions-msg');
const transactionDetailModal = $('#transaction-detail-modal');
const transactionDetailBody = $('#transaction-detail-body');
let allTransactions = [];

async function fetchAndRenderTransactions() {
  if (loadingTransactions) loadingTransactions.classList.remove('hidden');
  if (transactionsList) transactionsList.innerHTML = '';
  if (noTransactionsMsg) noTransactionsMsg.classList.add('hidden');

  const staffView = !isAdmin(); // staff vs admin

  const dateFrom = $('#filter-date-from')?.value;
  const dateTo = $('#filter-date-to')?.value;
  const searchTerm = $('#search-transaction')?.value?.toLowerCase() || '';
  const filterType = $('#filter-type')?.value || 'all';

  let fromISO, toISO;

  if (staffView) {
    // staff → force today only
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    fromISO = today.toISOString();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    toISO = todayEnd.toISOString();
  } else {
    // admin → use filters (or default to today)
    if (dateFrom) {
      fromISO = new Date(dateFrom).toISOString();
    } else {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      fromISO = dayStart.toISOString();
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      toISO = endDate.toISOString();
    }
  }

  // include payments(*) in both queries
  let cafeQuery = supabase
    .from('orders')
    .select('*, order_items(*), payments(*)')
    .eq('status', 'Delivery Complete')
    .gte('created_at', fromISO);

  let suppQuery = supabase
    .from('supplement_orders')
    .select(
      '*, supplement_order_items(*), payments:payments_supplement_order_id_fkey(*)'
    )
    .eq('status', 'Completed')
    .gte('created_at', fromISO);

  if (toISO) {
    cafeQuery = cafeQuery.lte('created_at', toISO);
    suppQuery = suppQuery.lte('created_at', toISO);
  }

  const { data: cafeTx } = await cafeQuery.order('created_at', {
    ascending: false,
  });
  const { data: suppTx } = await suppQuery.order('created_at', {
    ascending: false,
  });

  let cafe = (cafeTx || []).map((t) => {
    const payments = t.payments || [];
    const lastPayment = payments[payments.length - 1] || null;

    return {
      ...t,
      type: 'cafe',
      payment_method: lastPayment?.method || null,
      payment_reference: lastPayment?.transaction_reference || null,
    };
  });

  let supp = (suppTx || []).map((t) => {
    const payments = t.payments || [];
    const lastPayment = payments[payments.length - 1] || null;

    return {
      ...t,
      type: 'supplement',
      payment_method: lastPayment?.method || null,
      payment_reference: lastPayment?.transaction_reference || null,
    };
  });

  if (filterType === 'cafe') supp = [];
  if (filterType === 'supplements') cafe = [];

  if (searchTerm) {
    cafe = cafe.filter(
      (t) =>
        t.customer_name?.toLowerCase().includes(searchTerm) ||
        String(t.id).toLowerCase().includes(searchTerm)
    );
    supp = supp.filter(
      (t) =>
        t.customer_name?.toLowerCase().includes(searchTerm) ||
        String(t.id).toLowerCase().includes(searchTerm)
    );
  }

  allTransactions = [...cafe, ...supp].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  // ----- totals (overall) -----
  const totalRevenue = allTransactions.reduce(
    (s, o) => s + Number(o.total_amount || 0),
    0
  );
  const completedCount = allTransactions.length;
  const avgTransaction =
    completedCount > 0 ? totalRevenue / completedCount : 0;

  // ----- NEW: totals by payment method -----
  const byMethod = {
    cash: 0,
    card: 0,
    bkash: 0,
    other: 0,
  };

  for (const tx of allTransactions) {
    const amt = Number(tx.total_amount || 0);
    const m = (tx.payment_method || '').toLowerCase();

    if (m === 'cash') byMethod.cash += amt;
    else if (m === 'card') byMethod.card += amt;
    else if (m === 'bkash') byMethod.bkash += amt;
    else byMethod.other += amt;
  }

  // summary cards (top)
  if (transactionsSummary) {
    transactionsSummary.innerHTML = `
      <div class="summary-item"><h4>Total Revenue</h4><p>${fmtBDT(
        totalRevenue
      )}</p></div>
      <div class="summary-item"><h4>Total Orders</h4><p>${completedCount}</p></div>
      <div class="summary-item"><h4>Average Order</h4><p>${fmtBDT(
        avgTransaction
      )}</p></div>
    `;
  }

  // ----- NEW: staff-only "Access Restricted" box with payment breakdown -----
  if (staffView && transactionsList) {
    const info = document.createElement('div');
    info.className = 'unauthorized-view';
    info.innerHTML = `
    
      
      <div class="staff-payment-summary">
        <div class="staff-payment-card">
          <span class="label">Cash Revenue</span>
          <span class="value">${fmtBDT(byMethod.cash)}</span>
        </div>
        <div class="staff-payment-card">
          <span class="label">Card Revenue</span>
          <span class="value">${fmtBDT(byMethod.card)}</span>
        </div>
        <div class="staff-payment-card">
          <span class="label">bKash Revenue</span>
          <span class="value">${fmtBDT(byMethod.bkash)}</span>
        </div>
      </div>
    `;
    transactionsList.appendChild(info);
  }

  // ----- transaction lists (cafe / supp) -----
  const wrapper = document.createElement('div');
  wrapper.style.display = 'grid';
  wrapper.style.gridTemplateColumns = '1fr 1fr';
  wrapper.style.gap = '16px';

  const cafeCol = document.createElement('div');
  cafeCol.innerHTML = `<h3 class="tx-title">Cafe Menu Sales</h3>`;
  if (!cafe.length)
    cafeCol.innerHTML += `<p class="empty-message">No cafe transactions.</p>`;
  else
    cafe.forEach((tx) => {
      const el = document.createElement('div');
      el.className = 'transaction-item transaction-card';
      el.dataset.txId = tx.id;
      el.dataset.txType = 'cafe';

      const paymentLine = tx.payment_method
        ? `<p class="payment-tag">
             Paid by ${prettyPaymentMethod(tx.payment_method)}${
            tx.payment_reference ? ' · ' + tx.payment_reference : ''
          }
           </p>`
        : '';

      el.innerHTML = `
        <div class="transaction-details">
          <p><strong>${tx.customer_name}</strong> – Order #${String(tx.id)
        .slice(0, 6)
        .toUpperCase()}</p>
          <p class="order-time">${new Date(tx.created_at).toLocaleString()}</p>
          ${paymentLine}
        </div>
        <p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>
      `;
      cafeCol.appendChild(el);
    });

  const suppCol = document.createElement('div');
  suppCol.innerHTML = `<h3 class="tx-title">Supplements Sales</h3>`;
  if (!supp.length)
    suppCol.innerHTML += `<p class="empty-message">No supplements transactions.</p>`;
  else
    supp.forEach((tx) => {
      const el = document.createElement('div');
      el.className = 'transaction-item transaction-card';
      el.dataset.txId = tx.id;
      el.dataset.txType = 'supplement';

      const paymentLine = tx.payment_method
        ? `<p class="payment-tag">
             Paid by ${prettyPaymentMethod(tx.payment_method)}${
            tx.payment_reference ? ' · ' + tx.payment_reference : ''
          }
           </p>`
        : '';

      el.innerHTML = `
        <div class="transaction-details">
          <p><strong>${tx.customer_name || 'Walk-in'}</strong> – Supp #${String(
        tx.id
      )
        .slice(0, 6)
        .toUpperCase()}</p>
          <p class="order-time">${new Date(tx.created_at).toLocaleString()}</p>
          ${paymentLine}
        </div>
        <p class="transaction-amount">${fmtBDT(tx.total_amount)}</p>
      `;
      suppCol.appendChild(el);
    });

  wrapper.appendChild(cafeCol);
  wrapper.appendChild(suppCol);
  if (transactionsList) transactionsList.appendChild(wrapper);

  if (loadingTransactions) loadingTransactions.classList.add('hidden');
  if (!cafe.length && !supp.length && noTransactionsMsg)
    noTransactionsMsg.classList.remove('hidden');

  window.lucide?.createIcons();
}


function showTransactionDetail(txId, txType) {
  const tx = allTransactions.find(
    (t) => String(t.id) === String(txId) && t.type === txType
  );
  if (!tx) return;

  const items =
    txType === 'cafe'
      ? tx.order_items || []
      : tx.supplement_order_items || [];
  const itemsHtml = items
    .map(
      (item) => `
    <div class="items-breakdown-row">
      <span>${item.quantity}x ${item.item_name}</span>
      <span>${fmtBDT(item.price_at_order * item.quantity)}</span>
    </div>
  `
    )
    .join('');

  if (transactionDetailBody) {
    transactionDetailBody.innerHTML = `
      <div class="detail-section">
        <h4>Order Information</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Order ID</div>
            <div class="detail-value">#${String(tx.id)
              .slice(0, 8)
              .toUpperCase()}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Type</div>
            <div class="detail-value">${
              txType === 'cafe' ? 'Cafe Menu' : 'Supplements'
            }</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Customer</div>
            <div class="detail-value">${
              tx.customer_name || 'Walk-in'
            }</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Date & Time</div>
            <div class="detail-value">${new Date(
              tx.created_at
            ).toLocaleString()}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Payment</div>
            <div class="detail-value">
              ${
                tx.payment_method
                  ? `${prettyPaymentMethod(tx.payment_method)}${
                      tx.payment_reference ? ' • ' + tx.payment_reference : ''
                    }`
                  : 'Not recorded'
              }
            </div>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h4>Items Ordered</h4>
        <div class="items-breakdown">
          ${itemsHtml}
          <div class="items-breakdown-row">
            <span>Total</span>
            <span>${fmtBDT(tx.total_amount)}</span>
          </div>
        </div>
      </div>
    `;
  }

  transactionDetailModal?.classList.remove('hidden');
  window.lucide?.createIcons();
}

function exportTransactionsToCSV() {
  if (!allTransactions.length) {
    alert('No transactions to export.');
    return;
  }

  const headers = [
    'Date',
    'Time',
    'Order ID',
    'Type',
    'Customer',
    'Amount',
    'Payment Method',
    'Payment Reference',
    'Items',
  ];
  const rows = allTransactions.map((tx) => {
    const items =
      tx.type === 'cafe'
        ? (tx.order_items || [])
            .map((i) => `${i.quantity}x ${i.item_name}`)
            .join('; ')
        : (tx.supplement_order_items || [])
            .map((i) => `${i.quantity}x ${i.item_name}`)
            .join('; ');
    const date = new Date(tx.created_at);
    return [
      date.toLocaleDateString(),
      date.toLocaleTimeString(),
      String(tx.id).slice(0, 8).toUpperCase(),
      tx.type === 'cafe' ? 'Cafe' : 'Supplements',
      tx.customer_name || 'Walk-in',
      Number(tx.total_amount).toFixed(2),
      prettyPaymentMethod(tx.payment_method || ''),
      tx.payment_reference || '',
      items,
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_${new Date()
    .toISOString()
    .split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReceipt() {
  window.print();
}

function bindTransactionEvents() {
  $('#apply-filters-btn')?.addEventListener(
    'click',
    fetchAndRenderTransactions
  );
  $('#export-transactions-btn')?.addEventListener(
    'click',
    exportTransactionsToCSV
  );
  $('#close-transaction-detail-btn')?.addEventListener('click', () =>
    transactionDetailModal?.classList.add('hidden')
  );
  $('#close-detail-btn')?.addEventListener('click', () =>
    transactionDetailModal?.classList.add('hidden')
  );
  $('#print-receipt-btn')?.addEventListener('click', printReceipt);

  transactionsList?.addEventListener('click', (e) => {
    const card = e.target.closest('.transaction-card');
    if (card) {
      showTransactionDetail(card.dataset.txId, card.dataset.txType);
    }
  });

  if (!isAdmin()) {
    const fromFilter = $('#filter-date-from');
    const toFilter = $('#filter-date-to');
    if (fromFilter) fromFilter.disabled = true;
    if (toFilter) toFilter.disabled = true;
  }
}

// ==========================================
// 9. SUPPLEMENT REQUESTS MANAGEMENT
// ==========================================

async function loadSupplementRequests() {
  const requestsList = $('#supplement-requests-list');
  const noRequestsMsg = $('#no-requests-msg');

  if (!requestsList) return;

  const { data, error } = await supabase
    .from('supplement_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching supplement requests:', error);
    return;
  }

  requestsList.innerHTML = '';

  if (!data || data.length === 0) {
    noRequestsMsg?.classList.remove('hidden');
    return;
  }

  noRequestsMsg?.classList.add('hidden');

  data.forEach((req) => {
    const card = document.createElement('div');
    card.className = `request-card ${req.status}`;

    card.innerHTML = `
      <div class="request-header">
        <div>
          <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${
            req.supplement_name
          }</h4>
          <p class="order-time">${new Date(
            req.created_at
          ).toLocaleString()}</p>
        </div>
        <span class="request-status ${req.status}">${
      req.status.charAt(0).toUpperCase() + req.status.slice(1)
    }</span>
      </div>

      <div class="request-details">
        <div class="request-detail-item">
          <span class="request-detail-label">Customer</span>
          <span class="request-detail-value">${req.customer_name}</span>
        </div>
        <div class="request-detail-item">
          <span class="request-detail-label">Quantity</span>
          <span class="request-detail-value">${req.quantity}</span>
        </div>
        ${
          req.customer_contact
            ? `
        <div class="request-detail-item">
          <span class="request-detail-label">Contact</span>
          <span class="request-detail-value">${req.customer_contact}</span>
        </div>`
            : ''
        }
      </div>

      ${
        req.special_instructions
          ? `
      <div class="request-instructions">
        <strong>Special Instructions:</strong><br>${req.special_instructions}
      </div>`
          : ''
      }

      ${
        req.status === 'pending'
          ? `
      <div class="order-actions">
        <button class="btn btn-primary" data-request-approve="${req.id}">
          <i data-lucide="check"></i> Approve
        </button>
        <button class="btn btn-danger" data-request-deny="${req.id}">
          <i data-lucide="x"></i> Deny
        </button>
      </div>`
          : ''
      }
    `;

    requestsList.appendChild(card);
  });

  window.lucide?.createIcons();
}

async function handleSupplementRequestSubmit(e) {
  e.preventDefault();

  const submitButton = e.target.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';

  const requestData = {
    supplement_name: $('#req-supplement-name').value.trim(),
    quantity: parseInt($('#req-quantity').value),
    customer_name: $('#req-customer-name').value.trim(),
    customer_contact: $('#req-customer-contact').value.trim() || null,
    special_instructions: $('#req-instructions').value.trim() || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('supplement_requests')
    .insert([requestData]);

  if (error) {
    console.error('Error submitting request:', error);
    alert('Failed to submit request. Please try again.');
  } else {
    e.target.reset();
    await loadSupplementRequests();
    alert('Supplement request submitted successfully!');
  }

  submitButton.disabled = false;
  submitButton.innerHTML = `<i data-lucide="send"></i> Submit Request`;
  window.lucide?.createIcons();
}

async function updateRequestStatus(requestId, newStatus) {
  const { error } = await supabase
    .from('supplement_requests')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) {
    console.error('Error updating request status:', error);
    alert('Failed to update request status.');
  } else {
    await loadSupplementRequests();
  }
}

function bindSupplementRequestEvents() {
  const requestForm = $('#supplement-request-form');
  const requestsList = $('#supplement-requests-list');

  requestForm?.addEventListener('submit', handleSupplementRequestSubmit);

  requestsList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.requestApprove) {
      const requestId = btn.dataset.requestApprove;
      if (confirm('Approve this supplement request?')) {
        await updateRequestStatus(requestId, 'approved');
      }
    }

    if (btn.dataset.requestDeny) {
      const requestId = btn.dataset.requestDeny;
      if (confirm('Deny this supplement request?')) {
        await updateRequestStatus(requestId, 'denied');
      }
    }
  });
}

// ==========================================
// 8. APP INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  if (!getUserRole()) {
    setUserRole('staff');
  }

  initTabs();
  initThemeToggle();
  bindOrderStatusEvents();
  bindMenuEvents();
  bindSupplementsEvents();
  bindTransactionEvents();
  bindSupplementRequestEvents();

  loadDashboard();

  // payment modal events
  paymentForm?.addEventListener('submit', handlePaymentSubmit);
  paymentCancelBtn?.addEventListener('click', closePaymentModal);
  paymentCloseBtn?.addEventListener('click', closePaymentModal);

  const today = new Date().toISOString().split('T')[0];
  const filterDateFrom = $('#filter-date-from');
  const filterDateTo = $('#filter-date-to');
  if (filterDateFrom) filterDateFrom.value = today;
  if (filterDateTo) filterDateTo.value = today;

  window.lucide?.createIcons();
  startAutoRefresh();

  window.toggleUserRole = function () {
    const currentRole = getUserRole();
    const newRole = currentRole === 'admin' ? 'staff' : 'admin';
    setUserRole(newRole);
    alert(
      `User role changed to: ${newRole.toUpperCase()}\nReload the page to see changes.`
    );
    location.reload();
  };

  console.log('Current user role:', getUserRole());
  console.log('To toggle role, run: toggleUserRole()');
});

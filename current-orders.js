// ==========================================
// Vortex – Current New Orders Page
// STAFF VIEW ONLY
// - Shows ONLY orders where status === "Not Taken"
// - Clicking "Confirm & Hide" just removes it from
//   THIS page (no status change in database)
// ==========================================

// ---- Supabase config ----
const SUPABASE_URL = 'https://ovxxnsrqzdlyzdmubwaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92eHhuc3JxemRseXpkbXVid2F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY4MTgsImV4cCI6MjA3OTU1MjgxOH0.uwU9aQGbUO7OEv4HI8Rtq7awANWNubt3yJTSUMZRAJU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Helpers ----
const $ = (sel, root = document) => root.querySelector(sel);
const fmtBDT = (n) => `৳${Number(n || 0).toFixed(2)}`;

const ordersList = $('#orders-list');
const loadingOrders = $('#loading-orders');
const notificationSound = $('#notification-sound');

// Keep track of orders that staff already confirmed/hidden
const hiddenOrderIds = new Set();

// ==========================================
// Fetch + Render current NEW orders
// ==========================================
async function fetchAndRenderCurrentOrders() {
  if (!ordersList) return;

  // NOTE: I commented out the loading spinner toggle here. 
  // With a 3-second refresh, seeing the spinner every 3 seconds is annoying.
  // loadingOrders?.classList.remove('hidden');

  // Fetch only NEW orders (Not Taken)
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'Not Taken')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading current orders:', error);
    // Only clear list if there is a hard error
    ordersList.innerHTML =
      '<p class="empty-message">Could not load current orders.</p>';
    loadingOrders?.classList.add('hidden');
    return;
  }

  // Filter out orders staff has already "confirmed & hidden"
  const visibleOrders = (orders || []).filter(
    (o) => !hiddenOrderIds.has(String(o.id))
  );

  // NOW we clear the list (only after we successfully got new data)
  // This reduces screen flickering
  ordersList.innerHTML = '';

  if (!visibleOrders.length) {
    ordersList.innerHTML = '<p class="empty-message">No new orders.</p>';
    loadingOrders?.classList.add('hidden');
    return;
  }

  visibleOrders.forEach((order) => {
    ordersList.appendChild(createOrderCard(order));
  });

  loadingOrders?.classList.add('hidden');
  
  // Re-initialize icons if using Lucide
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ==========================================
// Create a single order card
// ==========================================
function createOrderCard(order) {
  const card = document.createElement('div');
  card.className = 'order-card';
  card.dataset.orderId = String(order.id);
  card.style.cssText = '--status-color: var(--blue);';

  const itemsHtml = (order.order_items || [])
    .map(
      (item) => `
      <div class="order-item">
        <span>
          <span class="quantity">${item.quantity}x</span>
          ${item.item_name}
        </span>
        <span>${fmtBDT(item.price_at_order * item.quantity)}</span>
      </div>
    `
    )
    .join('');

  card.innerHTML = `
    <div class="order-header">
      <div>
        <h3>Order #${String(order.id).slice(0, 6).toUpperCase()}</h3>
        <p class="order-customer">${order.customer_name || 'Walk-in'}</p>
        <p class="order-time">${new Date(
          order.created_at
        ).toLocaleTimeString()}</p>
      </div>
      <p class="total">${fmtBDT(order.total_amount)}</p>
    </div>

    <div class="order-items-list">
      ${itemsHtml || '<p class="empty-message">No items found.</p>'}
    </div>

    <div class="order-actions">
      <button class="btn btn-primary" data-hide="${order.id}">
        <i data-lucide="check-circle-2"></i>
        Confirm & Hide
      </button>
    </div>
  `;

  return card;
}

// ==========================================
// Hide order LOCALLY (no DB update)
// ==========================================
async function hideOrderLocally(orderId, buttonEl) {
  if (!orderId) return;
  const idStr = String(orderId);

  const card = buttonEl?.closest('.order-card');
  hiddenOrderIds.add(idStr); // remember it's confirmed/seen

  // Optional: small sound for feedback
  try {
    await notificationSound?.play();
  } catch (e) {
    // ignore autoplay issues
  }

  if (card) {
    card.remove();
  }

  // If no cards left, show empty message
  if (!ordersList.querySelector('.order-card')) {
    ordersList.innerHTML =
      '<p class="empty-message">No new orders.</p>';
  }
}

// ==========================================
// Event listeners
// ==========================================
function bindEvents() {
  if (!ordersList) return;

  ordersList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-hide]');
    if (!btn) return;

    const orderId = btn.getAttribute('data-hide');
    hideOrderLocally(orderId, btn);
  });
}

// ==========================================
// Init
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  fetchAndRenderCurrentOrders();

  // UPDATED: Auto-refresh every 3 seconds (3000ms)
  setInterval(fetchAndRenderCurrentOrders, 3000);
});
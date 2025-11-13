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

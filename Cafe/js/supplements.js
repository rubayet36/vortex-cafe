// js/supplements.js
import { supabase } from './supabaseClient.js';
import { $, fmtBDT, SUPP_BUCKET, slugifyName } from './utils.js';

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

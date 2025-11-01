// --- Supabase Client Setup ---
const SUPABASE_URL = 'https://ybrdqxetprlhscfuebyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmRxeGV0cHJsaHNjZnVlYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg2NjksImV4cCI6MjA3NzQ5NDY2OX0.N7pxPNmi1ZowVd9Nik9KABhqTtp3NP-XlEcEiNlJ-8M';


const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM Elements ---
const mainTabs = document.querySelector('.main-tabs');
const tabContents = document.querySelectorAll('.tab-content');
const menuTableBody = document.getElementById('menu-table-body');
const notificationSound = document.getElementById('notification-sound');
const colNotTaken = document.getElementById('orders-col-not-taken');
const colPaymentComplete = document.getElementById('orders-col-payment-complete');
const noOrdersMsg = document.getElementById('no-orders-msg');
const transactionsList = document.getElementById('transactions-list');
const transactionsSummary = document.getElementById('transactions-summary');
const noTransactionsMsg = document.getElementById('no-transactions-msg');
const addItemBtn = document.getElementById('add-item-btn');
const itemModal = document.getElementById('item-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelBtn = document.getElementById('cancel-btn');
const itemForm = document.getElementById('item-form');
const modalTitle = document.getElementById('modal-title');
const loadingMenu = document.getElementById('loading-menu');
const menuTable = document.getElementById('menu-table');
const loadingOrders = document.getElementById('loading-orders');
const loadingTransactions = document.getElementById('loading-transactions');

// --- State ---
let editingItemId = null;
let currentOrderCount = 0; // For notification sound

// --- Tab Switching Logic ---
mainTabs.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    mainTabs.querySelector('.active').classList.remove('active');
    e.target.classList.add('active');
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(`${e.target.dataset.tab}-section`).classList.add('active');
});

// --- Auto-Refresh Logic ---
function startAutoRefresh() {
    setInterval(async () => {
        const activeTab = document.querySelector('.main-tab-btn.active').dataset.tab;
        if (activeTab === 'orders') {
            await fetchAndRenderOrders();
        }
        if (activeTab === 'transactions') {
            await fetchAndRenderTransactions();
        }
    }, 10000); // 10 seconds
}

// --- Orders Management (Kanban) ---
async function fetchAndRenderOrders() {
    loadingOrders.classList.remove('hidden');
    
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`*, order_items ( * )`)
        .neq('status', 'Delivery Complete')
        .order('created_at', { ascending: true });

    if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        return;
    }
    
    if (orders.length > currentOrderCount && currentOrderCount > 0) {
        notificationSound.play();
    }
    currentOrderCount = orders.length;

    colNotTaken.innerHTML = '';
    colPaymentComplete.innerHTML = '';

    const ordersNotTaken = orders.filter(o => o.status === 'Not Taken');
    const ordersPaymentComplete = orders.filter(o => o.status === 'Payment Complete');

    if (ordersNotTaken.length === 0) {
        colNotTaken.innerHTML = '<p class="empty-message">No new orders.</p>';
    } else {
        ordersNotTaken.forEach(order => colNotTaken.appendChild(createOrderCard(order)));
    }
    
    if (ordersPaymentComplete.length === 0) {
        colPaymentComplete.innerHTML = '<p class="empty-message">No orders awaiting pickup.</p>';
    } else {
        ordersPaymentComplete.forEach(order => colPaymentComplete.appendChild(createOrderCard(order)));
    }
    
    loadingOrders.classList.add('hidden');
}

function createOrderCard(order) {
    const orderCard = document.createElement('div');
    const statusClass = order.status.toLowerCase().replace(' ', '-');
    const statusColor = order.status === 'Not Taken' ? 'var(--blue)' : '#ffc107';
    orderCard.className = `order-card status-${statusClass}`;
    orderCard.style.cssText = `--status-color: ${statusColor}`;
    
    const itemsHtml = order.order_items.map(item => `
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
            <p class="total">৳${order.total_amount.toFixed(2)}</p>
        </div>
        <div class="order-items-list">${itemsHtml}</div>
        <div class="order-actions">
            ${order.status === 'Not Taken' ? `<button class="btn btn-primary" data-id="${order.id}" data-next-status="Payment Complete">Mark Payment Complete</button>` : ''}
            ${order.status === 'Payment Complete' ? `<button class="btn btn-primary" data-id="${order.id}" data-next-status="Delivery Complete">Mark Delivery Complete</button>` : ''}
        </div>
    `;
    return orderCard;
}

document.getElementById('orders-section').addEventListener('click', async (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.dataset.id) {
        const button = e.target;
        const orderId = button.dataset.id;
        const nextStatus = button.dataset.nextStatus;
        const originalText = button.textContent;

        button.disabled = true;
        button.textContent = 'Updating...';

        const { error } = await supabase
            .from('orders')
            .update({ status: nextStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (error) {
            console.error("Error updating status:", error);
            alert('Could not update order status.');
            button.disabled = false;
            button.textContent = originalText;
        } else {
            await fetchAndRenderOrders();
            await fetchAndRenderTransactions();
        }
    }
});


// --- Menu Management (Using 'available' and 'is_popular') ---
async function loadMenuItems() {
    loadingMenu.classList.remove('hidden');
    menuTable.classList.add('hidden');
    
    const { data, error } = await supabase.from('menu_items').select('*').order('created_at', { ascending: false });
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
            <td>৳${item.price.toFixed(2)}</td>
            <td>
                <button class="status-toggle ${item.available ? 'available' : 'unavailable'}" data-id="${item.id}" data-current-status="${item.available}">
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

async function toggleAvailability(id, currentStatus) {
    const { error } = await supabase.from('menu_items').update({ available: !currentStatus }).eq('id', id);
    if (error) { alert('Failed to update status.'); }
    else { await loadMenuItems(); }
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
    document.getElementById('is_popular').checked = data.is_popular;
    document.getElementById('calories').value = data.calories || '';
    document.getElementById('protein').value = data.protein || '';
    document.getElementById('carbohydrates').value = data.carbohydrates || '';
    document.getElementById('fats').value = data.fats || '';
    document.getElementById('fiber').value = data.fiber || '';
    document.getElementById('sugar').value = data.sugar || '';
    document.getElementById('sodium').value = data.sodium || '';
    document.getElementById('vitamins').value = data.vitamins || '';
    document.getElementById('allergens').value = data.allergens || '';
    document.getElementById('dietary_tags').value = data.dietary_tags || '';
    document.getElementById('current-image').textContent = data.image_url ? `Current: ${data.image_url.split('/').pop()}` : 'No image uploaded.';
    
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
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    const imageFile = document.getElementById('image').files[0];
    let imageUrl = null;
    if (imageFile) {
        const filePath = `public/${Date.now()}-${imageFile.name}`;
        // This is the corrected line
        const { data: uploadData, error: uploadError } = await supabase.storage.from('menu-images').upload(filePath, imageFile);
        
        if (uploadError) {
            console.error('Image upload error:', uploadError);
            alert('Failed to upload image.');
            submitButton.disabled = false;
            submitButton.textContent = 'Save Item';
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

    if (imageUrl) {
        formData.image_url = imageUrl;
    }

    let error;
    if (editingItemId) {
        const { error: updateError } = await supabase.from('menu_items').update(formData).eq('id', editingItemId);
        error = updateError;
    } else {
        formData.available = true; // Set new items to available by default
        const { error: insertError } = await supabase.from('menu_items').insert([formData]);
        error = insertError;
    }

    if (error) {
        console.error('Database error:', error);
        alert('Failed to save the item.');
    } else {
        itemModal.classList.add('hidden');
        await loadMenuItems();
    }
    submitButton.disabled = false;
    submitButton.textContent = 'Save Item';
}

async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) { console.error('Error deleting item:', error); alert('Failed to delete item.'); } else { await loadMenuItems(); }
}

// --- Transactions Logic (Unchanged) ---
async function fetchAndRenderTransactions() {
    loadingTransactions.classList.remove('hidden');
    transactionsList.innerHTML = '';
    noTransactionsMsg.classList.add('hidden');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'Delivery Complete')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

    if (error) { console.error("Error fetching transactions:", error); return; }

    let totalRevenue = 0;
    if (data.length === 0) {
        noTransactionsMsg.classList.remove('hidden');
    } else {
        data.forEach(tx => {
            totalRevenue += tx.total_amount;
            const txItem = document.createElement('div');
            txItem.className = 'transaction-item';
            txItem.innerHTML = `<div class_ = "transaction-details"><p><strong>${tx.customer_name}</strong> - Order #${tx.id.slice(0, 6).toUpperCase()}</p><p class="order-time">${new Date(tx.created_at).toLocaleString()}</p></div><p class="transaction-amount">৳${tx.total_amount.toFixed(2)}</p>`;
            transactionsList.appendChild(txItem);
        });
    }
    transactionsSummary.innerHTML = `<div class="summary-item"><h4>Total Revenue (Today)</h4><p>৳${totalRevenue.toFixed(2)}</p></div><div class="summary-item"><h4>Completed Orders (Today)</h4><p>${data.length}</p></div>`;
    loadingTransactions.classList.add('hidden');
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    // Menu Tab Listeners
    loadMenuItems();
    addItemBtn.addEventListener('click', openAddModal);
    closeModalBtn.addEventListener('click', () => itemModal.classList.add('hidden'));
    cancelBtn.addEventListener('click', () => itemModal.classList.add('hidden'));
    itemForm.addEventListener('submit', handleFormSubmit);
    menuTableBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.dataset.id;
        if (target.classList.contains('status-toggle')) {
            toggleAvailability(id, target.dataset.currentStatus === 'true');
        }
        if (target.classList.contains('edit')) {
            openEditModal(id);
        }
        if (target.classList.contains('delete')) {
            deleteItem(id);
        }
    });

    // Load data for the default tab
    fetchAndRenderOrders();
    fetchAndRenderTransactions();
    
    // Start the auto-refresh
    startAutoRefresh(); 
    
    lucide.createIcons();
});
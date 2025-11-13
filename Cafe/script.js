// --- Supabase Client Setup ---
// IMPORTANT: Replace with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://ybrdqxetprlhscfuebyy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmRxeGV0cHJsaHNjZnVlYnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTg2NjksImV4cCI6MjA3NzQ5NDY2OX0.N7pxPNmi1ZowVd9Nik9KABhqTtp3NP-XlEcEiNlJ-8M';

const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Global Variables & State ---
let allMenuItems = []; // This will hold the data fetched from Supabase
const categories = ['All', 'Smoothies', 'Protein Bowls', 'Meals', 'Snacks', 'Supplements'];
const dietaryFilters = ['All Dietary Options', 'Vegan', 'Vegetarian', 'Gluten-Free', 'High-Protein', 'Low-Carb'];
let cart = [];
let currentFilter = {
    searchQuery: '',
    category: 'All',
    dietary: 'All Dietary Options'
};

// --- DOM SELECTORS ---
const menuGrid = document.getElementById('menu-grid');
const categoryFiltersContainer = document.getElementById('category-filters');
const dietaryFilterSelect = document.getElementById('dietary-filter');
const searchInput = document.getElementById('search-input');
const cartButton = document.getElementById('cart-button');
const cartModal = document.getElementById('cart-modal');
const closeCartButton = document.getElementById('close-cart-button');
const cartBody = document.getElementById('cart-body');
const cartItemCount = document.getElementById('cart-item-count');
const loadingSpinner = document.getElementById('loading-spinner');
const noItemsMessage = document.getElementById('no-items-message');
const orderTrackingModal = document.getElementById('order-tracking-modal');
const orderTrackingContent = document.getElementById('order-tracking-content');

// --- TEMPLATES ---
const menuItemTemplate = document.getElementById('menu-item-template');
const cartItemTemplate = document.getElementById('cart-item-template');


/**
 * Fetches menu items from Supabase.
 */
async function fetchMenuItems() {
    loadingSpinner.classList.remove('hidden');
    menuGrid.classList.add('hidden');
    noItemsMessage.classList.add('hidden');

    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true) // Only fetch items marked as "Available"
        .order('category', { ascending: true });

    if (error) {
        console.error('Error fetching menu items:', error);
        noItemsMessage.textContent = 'Could not load menu. Please try again later.';
        noItemsMessage.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        return;
    }

    allMenuItems = data;
    renderMenuItems(allMenuItems); // Initial render with all fetched items
    
    loadingSpinner.classList.add('hidden');
    menuGrid.classList.remove('hidden');
}

/**
 * Renders menu items to the grid based on the provided array.
 * @param {Array} items - The array of menu items to display.
 */
function renderMenuItems(items) {
    menuGrid.innerHTML = ''; // Clear existing items

    if (items.length === 0) {
        noItemsMessage.textContent = 'No items found matching your criteria.';
        noItemsMessage.classList.remove('hidden');
    } else {
        noItemsMessage.classList.add('hidden');
    }

    items.forEach(item => {
        const card = menuItemTemplate.content.cloneNode(true).children[0];
        card.dataset.itemId = item.id;

        // Image
        const img = card.querySelector('.card-image');
        const placeholder = card.querySelector('.card-image-placeholder');
        if (item.image_url) {
            img.src = item.image_url;
            img.alt = item.name;
            placeholder.classList.add('hidden');
        } else {
            img.classList.add('hidden');
            placeholder.querySelector('span').textContent = item.name.charAt(0);
        }

        // Tags
        const tagsContainer = card.querySelector('.dietary-tags');
        tagsContainer.innerHTML = '';
        if (item.dietary_tags) {
            item.dietary_tags.split(',').forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.textContent = tag.trim();
                tagsContainer.appendChild(tagEl);
            });
        }

        // Details
        card.querySelector('.card-title').textContent = item.name;
        card.querySelector('.card-price').textContent = `৳${item.price.toFixed(2)}`;
        card.querySelector('.card-description').textContent = item.description;

        // Nutrition Summary
        const nutritionSummary = card.querySelector('.card-nutrition-summary');
        nutritionSummary.innerHTML = `
            <span>${item.calories || 0} cal</span>
            <span>P: ${item.protein || 0}g</span>
            <span>C: ${item.carbohydrates || 0}g</span>
            <span>F: ${item.fats || 0}g</span>`;

        // Nutrition Details (hidden by default)
        const nutritionDetails = card.querySelector('.card-nutrition-details');
        nutritionDetails.innerHTML = `
            <div class="nutrition-item"><span>Calories:</span><span>${item.calories || 'N/A'}</span></div>
            <div class="nutrition-item"><span>Protein:</span><span>${item.protein || 'N/A'}g</span></div>
            <div class="nutrition-item"><span>Carbs:</span><span>${item.carbohydrates || 'N/A'}g</span></div>
            <div class="nutrition-item"><span>Fats:</span><span>${item.fats || 'N/A'}g</span></div>
            <div class="nutrition-item"><span>Fiber:</span><span>${item.fiber || 'N/A'}g</span></div>
            <div class="nutrition-item"><span>Sugar:</span><span>${item.sugar || 'N/A'}g</span></div>
            <div class="nutrition-item full-width"><span>Sodium:</span><span>${item.sodium || 'N/A'}mg</span></div>
            ${item.vitamins ? `<div class="nutrition-item full-width"><span>Vitamins:</span><span>${item.vitamins}</span></div>` : ''}
            ${item.allergens ? `<div class="nutrition-item full-width allergens"><span>Allergens:</span><span>${item.allergens}</span></div>` : ''}
        `;
        menuGrid.appendChild(card);
    });
    lucide.createIcons();
}

/**
 * Filters the currently loaded menu items and re-renders the grid.
 */
function filterAndRender() {
    let filteredItems = [...allMenuItems];

    if (currentFilter.category !== 'All') {
        filteredItems = filteredItems.filter(item => item.category === currentFilter.category);
    }
    
    if (currentFilter.dietary !== 'All Dietary Options') {
        filteredItems = filteredItems.filter(item =>
            item.dietary_tags?.toLowerCase().includes(currentFilter.dietary.toLowerCase())
        );
    }

    if (currentFilter.searchQuery) {
        const query = currentFilter.searchQuery.toLowerCase();
        filteredItems = filteredItems.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        );
    }
    
    renderMenuItems(filteredItems);
}

/**
 * Populates filter buttons and dropdowns.
 */
function populateFilters() {
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.textContent = cat;
        btn.dataset.category = cat;
        if (cat === 'All') btn.classList.add('active');
        categoryFiltersContainer.appendChild(btn);
    });

    dietaryFilters.forEach(filter => {
        const option = document.createElement('option');
        option.value = filter;
        option.textContent = filter;
        dietaryFilterSelect.appendChild(option);
    });
}

// --- CART LOGIC ---
// (All cart functions: addToCart, updateCartQuantity, updateCart, renderCartItems, showCheckoutForm, placeOrder, updateCartIcon remain unchanged)
function addToCart(itemId) {
    const existingItem = cart.find(item => item.id === itemId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        const itemToAdd = allMenuItems.find(item => item.id === itemId);
        cart.push({ ...itemToAdd, quantity: 1 });
    }
    updateCart();
}
function updateCartQuantity(itemId, newQuantity) {
    if (newQuantity <= 0) {
        cart = cart.filter(item => item.id !== itemId);
    } else {
        const cartItem = cart.find(item => item.id === itemId);
        if (cartItem) {
            cartItem.quantity = newQuantity;
        }
    }
    updateCart();
}
function updateCart() {
    renderCartItems();
    updateCartIcon();
}
function renderCartItems() {
    cartBody.innerHTML = '';
    
    if (cart.length === 0) {
        cartBody.innerHTML = `<div class="cart-empty"><i data-lucide="shopping-bag"></i><p>Your cart is empty</p></div>`;
        lucide.createIcons();
        return;
    }
    
    cart.forEach(item => {
        const cartItemEl = cartItemTemplate.content.cloneNode(true).children[0];
        cartItemEl.dataset.itemId = item.id;
        const img = cartItemEl.querySelector('.cart-item-image');
        const placeholder = cartItemEl.querySelector('.cart-item-placeholder');
        if (item.image_url) {
            img.src = item.image_url;
            img.alt = item.name;
            placeholder.classList.add('hidden');
        } else {
            img.classList.add('hidden');
            placeholder.querySelector('span').textContent = item.name.charAt(0);
        }
        cartItemEl.querySelector('.cart-item-title').textContent = item.name;
       cartItemEl.querySelector('.cart-item-price-each').textContent = `৳${item.price.toFixed(2)} each`;
        cartItemEl.querySelector('.quantity-text').textContent = item.quantity;
       cartItemEl.querySelector('.cart-item-subtotal').textContent = `৳${(item.price * item.quantity).toFixed(2)}`;
        cartBody.appendChild(cartItemEl);
    });

    const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    cartBody.innerHTML += `
        <div class="modal-footer" id="cart-footer">
            <div class="cart-total-section">
                <span>Total:</span>
                <span>৳${totalPrice.toFixed(2)}</span>
            </div>
            <button id="proceed-to-checkout" class="checkout-btn">Proceed to Checkout</button>
        </div>`;
    lucide.createIcons();
}
function showCheckoutForm() {
    const cartFooter = document.getElementById('cart-footer');
    const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    cartFooter.innerHTML = `
        <div class="checkout-form">
            <h3>Checkout Information</h3>
            <div class="form-group"><label for="customer-name">Name *</label><input type="text" id="customer-name" placeholder="Enter your name" required></div>
            <div class="form-group"><label for="customer-phone">Phone (optional)</label><input type="tel" id="customer-phone" placeholder="Enter your phone number"></div>
            <div class="form-group"><label for="order-notes">Special Instructions</label><textarea id="order-notes" placeholder="Any special requests?" rows="3"></textarea></div>
            <div class="cart-total-section"><span>Total:</span><span>৳${totalPrice.toFixed(2)}</span></div>
            <div class="form-actions"><button id="back-to-cart" class="checkout-btn back-btn">Back</button><button id="place-order" class="checkout-btn">Place Order</button></div>
        </div>`;
}
// Find and replace the existing placeOrder function in your menu's script.js

async function placeOrder(orderDetails) {
    // 1. Insert into the 'orders' table
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
            customer_name: orderDetails.name,
            customer_phone: orderDetails.phone,
            total_amount: orderDetails.total,
            notes: orderDetails.notes,
            status: 'Not Taken' // Initial status
        }])
        .select()
        .single(); // Use .single() to get the created order back

    if (orderError) {
        console.error('Error creating order:', orderError);
        alert('Could not place your order. Please try again.');
        return;
    }

    // 2. Prepare the items for the 'order_items' table
    const itemsToInsert = orderDetails.items.map(cartItem => ({
        order_id: orderData.id,
        menu_item_id: cartItem.id,
        quantity: cartItem.quantity,
        price_at_order: cartItem.price,
        item_name: cartItem.name
    }));

    // 3. Insert into the 'order_items' table
    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);
    
    if (itemsError) {
        console.error('Error saving order items:', itemsError);
        // In a real app, you might want to delete the order record here
        alert('Could not save order details. Please contact staff.');
        return;
    }
    
    // Success!
    console.log('Order placed successfully:', orderData);
    cart = [];
    updateCart();
    cartModal.classList.add('hidden');
    
    // We can reuse the old order tracking modal for the customer
    showOrderTracking(orderDetails);
}
function updateCartIcon() {
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    if (totalItems > 0) {
        cartItemCount.textContent = totalItems;
        cartItemCount.classList.remove('hidden');
    } else {
        cartItemCount.classList.add('hidden');
    }
}


// --- ORDER TRACKING LOGIC ---
// (This section remains unchanged)
function showOrderTracking(order) {
    orderTrackingModal.classList.remove('hidden');
    renderOrderTracking(order, 'received');
    setTimeout(() => renderOrderTracking(order, 'preparing'), 5000);
    setTimeout(() => renderOrderTracking(order, 'ready'), 12000);
    setTimeout(() => renderOrderTracking(order, 'complete'), 18000);
}
function renderOrderTracking(order, status) {
    const steps = [
        { id: 'received', label: 'Order Received', icon: 'package' },
        { id: 'preparing', label: 'Preparing', icon: 'chef-hat' },
        { id: 'ready', label: 'Ready for Pickup', icon: 'clock' },
        { id: 'complete', label: 'Complete', icon: 'check-circle-2' },
    ];
    const currentStepIndex = steps.findIndex(s => s.id === status);
    let stepsHtml = '';
    steps.forEach((step, index) => {
        const isActive = index <= currentStepIndex;
        stepsHtml += `<div class="status-step"><div class="status-icon ${isActive ? 'active' : 'inactive'}"><i data-lucide="${step.icon}"></i></div><p class="status-label ${isActive ? 'active' : 'inactive'}">${step.label}</p>${isActive ? `<i data-lucide="check-circle-2" class="status-check"></i>` : ''}</div>`;
    });
    orderTrackingContent.innerHTML = `<div class="modal-header"><h2 class="modal-title">Order Tracking</h2><button id="close-tracking-button" class="modal-close-button"><i data-lucide="x"></i></button></div><div class="modal-body"><div class="order-tracking-info"><p>Order ID: <span class="order-id">${order.id.slice(0, 8).toUpperCase()}</span></p><p>Customer: <strong>${order.name}</strong></p><p>Total: <span class="order-total">৳${order.total.toFixed(2)}</span></p></div><div class="status-steps">${stepsHtml}</div>${status === 'complete' ? '<div class="order-complete-message">Thank you for your order!</div>' : ''}</div>`;
    document.getElementById('close-tracking-button').addEventListener('click', () => {
        orderTrackingModal.classList.add('hidden');
    });
    lucide.createIcons();
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    searchInput.addEventListener('input', (e) => {
        currentFilter.searchQuery = e.target.value;
        filterAndRender();
    });
    categoryFiltersContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-btn')) {
            categoryFiltersContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            currentFilter.category = e.target.dataset.category;
            filterAndRender();
        }
    });
    dietaryFilterSelect.addEventListener('change', (e) => {
        currentFilter.dietary = e.target.value;
        filterAndRender();
    });
    menuGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.menu-card');
        if (!card) return;
        if (e.target.closest('.add-to-cart-btn')) {
            addToCart(card.dataset.itemId);
        }
        if (e.target.closest('.info-btn')) {
            card.querySelector('.card-nutrition-details').classList.toggle('hidden');
        }
    });
    cartButton.addEventListener('click', () => {
        renderCartItems();
        cartModal.classList.remove('hidden');
    });
    closeCartButton.addEventListener('click', () => cartModal.classList.add('hidden'));
    cartBody.addEventListener('click', (e) => {
        const cartItemEl = e.target.closest('.cart-item');
        const itemId = cartItemEl?.dataset.itemId;
        const item = cart.find(i => i.id === itemId);

        if (e.target.closest('.plus-btn')) updateCartQuantity(itemId, item.quantity + 1);
        if (e.target.closest('.minus-btn')) updateCartQuantity(itemId, item.quantity - 1);
        if (e.target.closest('.remove-btn')) updateCartQuantity(itemId, 0);
        
        if (e.target.id === 'proceed-to-checkout') showCheckoutForm();
        if (e.target.id === 'back-to-cart') renderCartItems();
        if (e.target.id === 'place-order') {
            const name = document.getElementById('customer-name').value;
            if (!name.trim()) return alert('Please enter your name.');
            placeOrder({
                id: crypto.randomUUID(),
                name: name,
                phone: document.getElementById('customer-phone').value,
                notes: document.getElementById('order-notes').value,
                items: [...cart],
                total: cart.reduce((total, item) => total + (item.price * item.quantity), 0)
            });
        }
    });
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    populateFilters();
    setupEventListeners();
    fetchMenuItems(); // Fetch data from Supabase instead of using mock data
});
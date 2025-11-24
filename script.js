const SUPABASE_URL = 'https://ovxxnsrqzdlyzdmubwaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92eHhuc3JxemRseXpkbXVid2F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY4MTgsImV4cCI6MjA3OTU1MjgxOH0.uwU9aQGbUO7OEv4HI8Rtq7awANWNubt3yJTSUMZRAJU';

const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allMenuItems = [];
const categories = ['All', 'Smoothies', 'Coffee', 'Juice', 'Supplements'];
const dietaryFilters = ['All Dietary Options', 'Vegan', 'Vegetarian', 'Gluten-Free', 'High-Protein', 'Low-Carb'];
let cart = [];
let currentFilter = {
    searchQuery: '',
    category: 'All',
    dietary: 'All Dietary Options'
};

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

const menuItemTemplate = document.getElementById('menu-item-template');
const cartItemTemplate = document.getElementById('cart-item-template');

async function fetchMenuItems() {
    loadingSpinner.classList.remove('hidden');
    menuGrid.classList.add('hidden');
    noItemsMessage.classList.add('hidden');

    const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)
        .order('category', { ascending: true });

    if (error) {
        console.error('Error fetching menu items:', error);
        noItemsMessage.textContent = 'Could not load menu. Please try again later.';
        noItemsMessage.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        return;
    }

    allMenuItems = data;
    renderMenuItems(allMenuItems);

    loadingSpinner.classList.add('hidden');
    menuGrid.classList.remove('hidden');
}

function renderMenuItems(items) {
    menuGrid.innerHTML = '';

    if (items.length === 0) {
        noItemsMessage.textContent = 'No items found matching your criteria.';
        noItemsMessage.classList.remove('hidden');
    } else {
        noItemsMessage.classList.add('hidden');
    }

    items.forEach(item => {
        const card = menuItemTemplate.content.cloneNode(true).children[0];
        card.dataset.itemId = item.id;

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

        const tagsContainer = card.querySelector('.dietary-tags');
        tagsContainer.innerHTML = '';
        if (item.dietary_tags) {
            item.dietary_tags.split(',').forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.textContent = tag.trim();
                tagsContainer.appendChild(tagEl);
            });
        }

        card.querySelector('.card-title').textContent = item.name;
        card.querySelector('.card-description').textContent = item.description;

        const regularPrice = item.price;
        const largePrice = item.price * 1.5;

        const sizeOptions = card.querySelectorAll('.size-option');
        const radioButtons = card.querySelectorAll('input[type="radio"]');

        radioButtons.forEach(radio => {
            radio.name = `size-${item.id}`;
        });

        sizeOptions[0].querySelector('.size-price').textContent = `৳${regularPrice.toFixed(2)}`;
        sizeOptions[1].querySelector('.size-price').textContent = `৳${largePrice.toFixed(2)}`;

        const nutritionSummary = card.querySelector('.card-nutrition-summary');
        nutritionSummary.innerHTML = `
            <span>${item.calories || 0} cal</span>
            <span>P: ${item.protein || 0}g</span>
            <span>C: ${item.carbohydrates || 0}g</span>
            <span>F: ${item.fats || 0}g</span>`;

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

function addToCart(itemId, size) {
    const existingItemIndex = cart.findIndex(item => item.id === itemId && item.size === size);

    if (existingItemIndex !== -1) {
        cart[existingItemIndex].quantity++;
    } else {
        const itemToAdd = allMenuItems.find(item => item.id === itemId);
        const price = size === 'large' ? itemToAdd.price * 1.5 : itemToAdd.price;

        cart.push({
            ...itemToAdd,
            quantity: 1,
            size: size,
            price: price
        });
    }
    updateCart();
}

function updateCartQuantity(itemId, size, newQuantity) {
    if (newQuantity <= 0) {
        cart = cart.filter(item => !(item.id === itemId && item.size === size));
    } else {
        const cartItem = cart.find(item => item.id === itemId && item.size === size);
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
        cartItemEl.dataset.itemSize = item.size;

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
        cartItemEl.querySelector('.cart-item-size').textContent = `Size: ${item.size.charAt(0).toUpperCase() + item.size.slice(1)}`;
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

async function placeOrder(orderDetails) {
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
            customer_name: orderDetails.name,
            customer_phone: orderDetails.phone,
            total_amount: orderDetails.total,
            notes: orderDetails.notes,
            status: 'Not Taken'
        }])
        .select()
        .single();

    if (orderError) {
        console.error('Error creating order:', orderError);
        alert('Could not place your order. Please try again.');
        return;
    }

    const itemsToInsert = orderDetails.items.map(cartItem => ({
        order_id: orderData.id,
        menu_item_id: cartItem.id,
        quantity: cartItem.quantity,
        price_at_order: cartItem.price,
        item_name: `${cartItem.name} (${cartItem.size.charAt(0).toUpperCase() + cartItem.size.slice(1)})`
    }));

    const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

    if (itemsError) {
        console.error('Error saving order items:', itemsError);
        alert('Could not save order details. Please contact staff.');
        return;
    }

    console.log('Order placed successfully:', orderData);
    cart = [];
    updateCart();
    cartModal.classList.add('hidden');

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
            const selectedSize = card.querySelector('input[type="radio"]:checked').value;
            addToCart(card.dataset.itemId, selectedSize);
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
        const itemSize = cartItemEl?.dataset.itemSize;
        const item = cart.find(i => i.id === itemId && i.size === itemSize);

        if (e.target.closest('.plus-btn')) updateCartQuantity(itemId, itemSize, item.quantity + 1);
        if (e.target.closest('.minus-btn')) updateCartQuantity(itemId, itemSize, item.quantity - 1);
        if (e.target.closest('.remove-btn')) updateCartQuantity(itemId, itemSize, 0);

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

document.addEventListener('DOMContentLoaded', () => {
    populateFilters();
    setupEventListeners();
    fetchMenuItems();
});

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

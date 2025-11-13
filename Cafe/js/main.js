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

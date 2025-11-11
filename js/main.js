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
// main.js — login handler for Staff Portal

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form?.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    // Hardcoded login simulation
    if (email === "mahin@mail.com" && password === "pass") {
      window.location.href = "owner-dashboard.html";
    } else if (email === "admin@mail.com" && password === "pass") {
      window.location.href = "dashboard.html";
    } else {
      alert("Invalid credentials. Please try again.");
    }
  });
});

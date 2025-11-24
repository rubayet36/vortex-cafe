// main.js
import { $, icons } from "./utils.js";
import { state, emitRerender } from "./state.js";
import { renderHeader, mountHeader } from "./header.js";
import { renderFooter, mountFooter } from "./footer.js";
import { renderCart, mountCart } from "./cart.js";
import { viewHome, mountHome } from "./home.js";
import { viewCatalog, mountCatalog } from "./catalog.js";
import { viewQuizWrapper, mountQuiz } from "./quiz.js";
import { viewProductDetail, mountProductDetail } from "./productDetail.js";
import { ALL_PRODUCTS } from "./data.js";

// Supabase (ESM)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const SUPABASE_URL = 'https://ovxxnsrqzdlyzdmubwaw.supabase.co';

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92eHhuc3JxemRseXpkbXVid2F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY4MTgsImV4cCI6MjA3OTU1MjgxOH0.uwU9aQGbUO7OEv4HI8Rtq7awANWNubt3yJTSUMZRAJU';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- Render roots ---------- */

function renderHeaderRoot() {
  const mount = $("#header-root");
  if (!mount) return;
  mount.innerHTML = renderHeader();
  mountHeader(mount);
  // ensure lucide icons are wired up
  icons();
}

function renderFooterRoot() {
  const mount = $("#footer-root");
  if (!mount) return;
  mount.innerHTML = renderFooter();
  // pass mount so footer can attach handlers safely
  mountFooter(mount);
}

function renderCartRoot() {
  const mount = $("#cart-root");
  if (!mount) return;

  mount.innerHTML = renderCart();

  // toggle the root's 'open' class so CSS pointer-events work properly
  mount.classList.toggle("open", !!state.isCartOpen);

  // scope all cart events to this mount
  mountCart(mount);
}

/* ---------- App shell ---------- */

function renderApp() {
  renderHeaderRoot();
  renderCartRoot();

  const app = $("#app");
  if (!app) return;

  if (state.currentView === "catalog") {
    app.innerHTML = viewCatalog();
    mountCatalog(app);
  } else if (state.currentView === "product-detail") {
    app.innerHTML = viewProductDetail();
    mountProductDetail(app);
  } else if (state.currentView === "quiz") {
    app.innerHTML = `<div class="pt-24">${viewQuizWrapper()}</div>`;
    mountQuiz(app);
  } else {
    // default to home
    app.innerHTML = viewHome();
    mountHome(app);
  }

  renderFooterRoot();
}

/* ---------- Data load ---------- */

async function loadPortalProducts() {
  // show something immediately using fallback static data
  if (!state.products || state.products.length === 0) {
    state.products = [...ALL_PRODUCTS];
    emitRerender();
  }

  try {
    const { data, error } = await supabase
      .from("supplement_products")
      .select("*")
      .eq("available", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load supplement_products:", error);
      return;
    }

    const mapped = (data || []).map((p) => ({
      id: String(p.id),
      name: p.name,
      brand: p.brand || "—",
      category: (p.category || "other").toLowerCase(),
      price: Number(p.price),
      buyingPrice: Number(p.buying_price || 0),
      originalPrice: p.compare_at_price ? Number(p.compare_at_price) : null,
      rating: p.rating ? Number(p.rating) : 0,
      reviews: 0,
      image:
        p.image_url ||
        "https://via.placeholder.com/600x600?text=Supplement",
      isBestseller: !!p.is_featured,
      isNew: false,
      stock: typeof p.stock === "number" ? p.stock : 0,
      description: p.description || "",
      tags: p.tags || "",
    }));

    // keep ALL_PRODUCTS in sync
    ALL_PRODUCTS.length = 0;
    mapped.forEach((x) => ALL_PRODUCTS.push(x));
    state.products = [...mapped];

    emitRerender();
  } catch (e) {
    console.error("loadPortalProducts error:", e);
  }
}

/* ---------- Checkout flow ---------- */

async function onCheckoutClicked() {
  if (!Array.isArray(state.cart) || state.cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  // Re-check stock locally (defensive)
  for (const it of state.cart) {
    if (it.quantity > Number(it.stock ?? 0)) {
      alert(`Quantity for "${it.name}" exceeds available stock.`);
      return;
    }
  }

  showCheckoutForm();
}

/* ---------- Styled Checkout Form ---------- */

function showCheckoutForm() {
  // avoid stacking multiple overlays if user clicks checkout repeatedly
  if (document.getElementById("checkout-overlay")) return;

  const subtotal = state.cart.reduce(
    (s, it) => s + Number(it.price) * Number(it.quantity),
    0
  );
  const shipping = 0;
  const total = subtotal + shipping;

  const overlay = document.createElement("div");
  overlay.id = "checkout-overlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;

  overlay.innerHTML = `
    <div style="background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 32px; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);">
      <h2 style="color: #fff; font-size: 24px; font-weight: bold; margin-bottom: 24px;">Checkout</h2>
      
      <form id="checkout-form">
        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #d1d5db; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Customer Name *</label>
          <input type="text" id="customer-name" placeholder="Enter your name" required style="width: 100%; padding: 10px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 6px; color: #fff; font-size: 14px; box-sizing: border-box;" />
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; color: #d1d5db; font-size: 14px; font-weight: 500; margin-bottom: 8px;">Phone Number *</label>
          <input type="tel" id="customer-phone" placeholder="Enter your phone" required style="width: 100%; padding: 10px 12px; background: #374151; border: 1px solid #4b5563; border-radius: 6px; color: #fff; font-size: 14px; box-sizing: border-box;" />
        </div>

        <div style="background: #111827; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; color: #9ca3af; font-size: 14px; margin-bottom: 8px;">
            <span>Subtotal:</span>
            <span>৳${subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #9ca3af; font-size: 14px; margin-bottom: 12px;">
            <span>Shipping:</span>
            <span>FREE</span>
          </div>
          <div style="display: flex; justify-content: space-between; color: #fff; font-size: 16px; font-weight: bold; padding-top: 12px; border-top: 1px solid #374151;">
            <span>Total:</span>
            <span>৳${total.toFixed(2)}</span>
          </div>
        </div>

        <div style="display: flex; gap: 12px;">
          <button type="button" id="cancel-checkout" style="flex: 1; padding: 12px 16px; background: #374151; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; transition: all 0.2s;">Cancel</button>
          <button type="submit" style="flex: 1; padding: 12px 16px; background: linear-gradient(to right, #06b6d4, #3b82f6); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; font-size: 14px; transition: all 0.2s;">Place Order</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const form = overlay.querySelector("#checkout-form");
  const cancelBtn = overlay.querySelector("#cancel-checkout");
  const nameInput = overlay.querySelector("#customer-name");
  const phoneInput = overlay.querySelector("#customer-phone");

  cancelBtn.addEventListener("click", () => {
    overlay.remove();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const customer_name = nameInput.value.trim() || "Walk-in";
    const customer_phone = phoneInput.value.trim() || "";

    overlay.remove();
    await processCheckout(customer_name, customer_phone);
  });

  nameInput.focus();
}

/* ---------- Process checkout + DB ---------- */

async function processCheckout(customer_name, customer_phone) {
  const subtotal = state.cart.reduce(
    (s, it) => s + Number(it.price) * Number(it.quantity),
    0
  );
  const shipping = 0;
  const total_amount = subtotal + shipping;

  try {
    // 1) Create supplement order (Pending)
    const { data: orderRow, error: orderErr } = await supabase
      .from("supplement_orders")
      .insert([
        {
          customer_name,
          customer_phone,
          total_amount,
          status: "Pending",
        },
      ])
      .select("*")
      .single();

    if (orderErr || !orderRow) {
      console.error(orderErr);
      alert("Checkout failed (order).");
      return;
    }

    const orderId = orderRow.id;

    // 2) Items + decrement stock
    for (const it of state.cart) {
      const productId = it.id;

      const { error: itemErr } = await supabase
        .from("supplement_order_items")
        .insert([
          {
            order_id: orderId,
            supplement_product_id: productId,
            quantity: it.quantity,
            price_at_order: it.price,
            item_name: it.name,
          },
        ]);

      if (itemErr) {
        console.error(itemErr);
        alert("Checkout failed (item).");
        return;
      }

      // Decrement stock via RPC (if exists) but don't crash if it fails
      try {
        await supabase.rpc("decrement_supplement_stock", {
          p_id: productId,
          p_qty: it.quantity,
        });
      } catch (rpcErr) {
        console.warn("RPC decrement_supplement_stock error:", rpcErr);
      }

      // Update stock column as fallback
      try {
        await supabase
          .from("supplement_products")
          .update({ stock: Number(it.stock ?? 0) - it.quantity })
          .eq("id", productId);
      } catch (updErr) {
        console.warn("Stock update error:", updErr);
      }
    }

    // 3) Clear cart + reload products
    state.cart = [];
    state.isCartOpen = false;
    emitRerender();
    await loadPortalProducts();

    alert("Order placed! Waiting for staff confirmation.");
  } catch (err) {
    console.error("processCheckout error:", err);
    alert("Unexpected error during checkout. Please try again.");
  }
}

/* ---------- Events & boot ---------- */

document.addEventListener("DOMContentLoaded", async () => {
  renderApp();
  await loadPortalProducts();
});

// re-render everywhere when state changes
window.addEventListener("app:rerender", renderApp);

// central checkout listener (fired from cart.js)
document.addEventListener("cart:checkout", onCheckoutClicked);

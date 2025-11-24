// catalog.js
import { state, emitRerender, setView } from "./state.js";
import { $, fmtBDT } from "./utils.js";

/* ---------- View ---------- */
export function viewCatalog() {
  const total = (state.products || []).length;
  return `
    <section class="max-w-6xl mx-auto px-4 pt-24 pb-12">
      <h1 class="text-3xl md:text-4xl font-extrabold mb-6">Product Catalog</h1>

      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <p id="catalog-count" class="text-sm opacity-70">Showing ${total} of ${total} products</p>
        <div class="flex items-center gap-3">
          <button id="catalog-reset-filters" class="text-sm px-3 py-2 bg-gray-800 rounded-md hover:bg-gray-700">Reset Filters</button>
        </div>
      </div>

      <div class="mb-6 border border-gray-800 rounded-lg p-4 bg-gray-900/40">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Sort by Price</label>
            <select id="filter-sort" class="w-full bg-gray-800 text-white px-3 py-2 rounded">
              <option value="default">Default</option>
              <option value="price-low-high">Lowest to Highest</option>
              <option value="price-high-low">Highest to Lowest</option>
            </select>
          </div>

          <div>
            <label class="block text-xs text-gray-400 mb-1">Availability</label>
            <select id="filter-stock" class="w-full bg-gray-800 text-white px-3 py-2 rounded">
              <option value="any">Any</option>
              <option value="in">In stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>

          <div class="md:col-span-2">
            <label class="block text-xs text-gray-400 mb-1">Categories</label>
            <div id="filter-cats" class="flex flex-wrap gap-2">
              <!-- categories will be generated dynamically on mount -->
            </div>
          </div>
        </div>
      </div>

      <div id="catalog-grid" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        ${renderCards(state.products)}
      </div>
    </section>
  `;
}

/* ---------- Mount ---------- */
export function mountCatalog(root) {
  const grid = $("#catalog-grid");
  if (!grid) return;

  const countEl = document.getElementById("catalog-count");
  const sortEl = document.getElementById("filter-sort");
  const stockEl = document.getElementById("filter-stock");
  const catsContainer = document.getElementById("filter-cats");
  const resetBtn = document.getElementById("catalog-reset-filters");

  // Fixed category list for filters
  const CATEGORY_DEFS = [
    { key: "protein",      label: "Protein" },
    { key: "pre-workout",  label: "Pre-Workout" },
    { key: "creatine",     label: "Creatine" },
    { key: "vitamins",     label: "Vitamins" },
    { key: "hydration",    label: "Hydration" },
    { key: "other",        label: "Other" },
  ];

  // Render category pills
  if (catsContainer) {
    catsContainer.innerHTML = CATEGORY_DEFS.map(
      ({ key, label }) => `
        <label class="inline-flex items-center gap-2">
          <input type="checkbox" data-cat="${key}" class="filter-cat" />
          <span class="filter-pill text-sm">${label}</span>
        </label>
      `
    ).join("");
  }

  // Select category checkboxes after rendering them
  const catEls = catsContainer
    ? [...catsContainer.querySelectorAll(".filter-cat")]
    : [];

  function getSelectedCats() {
    return catEls
      .filter((i) => i.checked)
      .map((i) => i.getAttribute("data-cat"));
  }

  function savePersistentFilters() {
    try {
      localStorage.setItem(
        "catalog_filters_persistent",
        JSON.stringify({
          sort: sortEl?.value || "default",
          stock: stockEl?.value || "any",
          cats: getSelectedCats(),
        })
      );
    } catch (e) {}
  }

  function applyFilters() {
    const all = state.products || [];
    const sort = sortEl?.value || "default";
    const stock = stockEl?.value || "any";
    const selectedCats = getSelectedCats();

    let filtered = all.slice();

    // stock filter
    if (stock === "in")
      filtered = filtered.filter(
        (p) => Number(p.stock) && Number(p.stock) > 0
      );
    if (stock === "out")
      filtered = filtered.filter(
        (p) => !Number(p.stock) || Number(p.stock) <= 0
      );

    // categories
    if (selectedCats.length) {
      filtered = filtered.filter((p) => {
        const catKey = String(p.category || "").toLowerCase();
        return selectedCats.includes(catKey);
      });
    }

    // sorting
    if (sort === "price-low-high")
      filtered.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-high-low")
      filtered.sort((a, b) => Number(b.price) - Number(a.price));

    // update grid
    grid.innerHTML = renderCards(filtered);
    animateGrid();
    if (countEl)
      countEl.textContent = `Showing ${filtered.length} of ${all.length} products`;
    savePersistentFilters();
  }

  // initialize filters from possible stored selection
  try {
    // First check for category filter from home page
    const homeFilter = JSON.parse(
      localStorage.getItem("catalog_filters") || "null"
    );
    if (homeFilter && homeFilter.category) {
      // Apply the category filter from home page
      const targetCat = homeFilter.category;
      catEls.forEach(
        (c) => (c.checked = c.getAttribute("data-cat") === targetCat)
      );
      // Clear this one-time filter so it doesn't persist
      localStorage.removeItem("catalog_filters");
    }

    // Then load persistent filters (sort, stock, cats)
    const stored = JSON.parse(
      localStorage.getItem("catalog_filters_persistent") || "null"
    );
    if (stored) {
      if (sortEl && stored.sort) sortEl.value = stored.sort;
      if (stockEl && stored.stock) stockEl.value = stored.stock;
      if (stored.cats?.length) {
        catEls.forEach(
          (c) =>
            (c.checked = stored.cats.includes(c.getAttribute("data-cat")))
        );
      }
    }
  } catch (e) {}

  // initial filter apply
  applyFilters();

  // event listeners
  sortEl?.addEventListener("change", applyFilters);
  stockEl?.addEventListener("change", applyFilters);
  catEls.forEach((c) => c.addEventListener("change", applyFilters));

  resetBtn?.addEventListener("click", () => {
    if (sortEl) sortEl.value = "default";
    if (stockEl) stockEl.value = "any";
    catEls.forEach((c) => (c.checked = false));
    applyFilters();
  });

  // grid click handlers
  grid.addEventListener("click", (e) => {
    // Add to Cart
    const addBtn = e.target.closest(".add-cart");
    if (addBtn) {
      const id = addBtn.dataset.id;
      const prod = state.products.find((p) => String(p.id) === String(id));
      if (prod && Number(prod.stock) > 0) {
        const stock = Number(prod.stock) || 0;
        const existing = state.cart.find(
          (x) => String(x.id) === String(prod.id)
        );
        const inCart = existing ? Number(existing.quantity) || 0 : 0;
        const left = stock - inCart;

        if (left <= 0) {
          alert("No more stock available to add.");
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        const addQty = Math.min(1, left);

        if (existing) {
          existing.quantity += addQty;
        } else {
          state.cart.push({
            id: prod.id,
            name: prod.name,
            price: prod.price,
            stock: prod.stock,
            image: prod.image,
            quantity: addQty,
          });
        }

        emitRerender();
      }

      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Open product detail (card click excluding the button)
    const card = e.target.closest("[data-id]");
    if (card) {
      const pid = card.dataset.id;
      state.currentProductId = String(pid);
      setView("product-detail");
      e.preventDefault();
    }
  });
}

/* ---------- Helpers ---------- */

function stockBadge(p) {
  const stock = Number(p.stock ?? 0);
  if (!stock || stock <= 0)
    return `<span class="badge-stock out">Out of stock</span>`;
  if (stock === 1) return `<span class="badge-stock low">Only 1 left!</span>`;
  if (stock <= 3)
    return `<span class="badge-stock low">${stock} left</span>`;
  return "";
}

function renderCard(p) {
  const out = !Number(p.stock) || Number(p.stock) <= 0;
  return `
    <article class="product-card card-anim ${
      out ? "out-of-stock" : ""
    }" data-id="${p.id}">
      <div class="relative">
        <img src="${p.image}" alt="${p.name}" class="w-full h-56 object-contain rounded-t-lg">
        ${stockBadge(p)}
      </div>

      <div class="p-4">
        <div class="text-xs text-gray-400 mb-1">${p.brand || "—"}</div>

        <a href="#" class="product-title view-detail text-base font-semibold hover:underline" data-id="${
          p.id
        }">
          ${p.name}
        </a>

        <div class="mt-2 text-xs text-gray-400">${p.category}</div>

        <div class="mt-4 flex items-center justify-between">
          <div class="text-lg font-bold">${fmtBDT(p.price)}</div>
          ${
            out
              ? `<button class="btn-cart out" disabled>Out of Stock</button>`
              : `<button class="btn-cart add-cart" data-id="${p.id}">Add to Cart</button>`
          }
        </div>
      </div>
    </article>
  `;
}

function renderCards(items) {
  if (!items?.length) {
    return `<div class="col-span-full text-sm opacity-70">No products available.</div>`;
  }
  return items.map(renderCard).join("");
}

function animateGrid() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  });

  document.querySelectorAll("#catalog-grid .card-anim").forEach((el) => {
    io.observe(el);
  });
}

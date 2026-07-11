const API_BASE = (() => {
  if (window.location.protocol === "file:") return "http://localhost:3000";
  if (window.location.port && window.location.port !== "3000") {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return "";
})();

let state = {
  page: "customer",
  category: "All",
  search: "",
  radius: "all",
  authMode: "login",
  authRole: "customer",
  loading: true,
  error: "",
  authError: "",
  formError: "",
  shops: [],
  products: [],
  cart: [],
  latestOrder: null,
  myOrders: [],
  dashboard: null,
  userLocation: null,
  token: localStorage.getItem("lk_token") || null,
  user: JSON.parse(localStorage.getItem("lk_user") || "null"),
  // vendor panel state
  myShops: [],
  myProducts: [],
  vendorOrders: [],
  vendorTab: "orders",
  deliveryData: null,
  // admin panel state
  adminTab: "users",
  adminUsers: [],
  adminShops: [],
  adminProducts: [],
  adminOrders: []
};

const orderSteps = ["Placed", "Confirmed", "Packed", "Out for Delivery", "Delivered"];
const categories = ["All", "Fresh", "Medicine", "Bakery", "Dairy", "Stationery", "Electronics"];
const app = document.querySelector("#app");
let leafletMap = null;

function isLoggedIn() {
  return Boolean(state.token && state.user);
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`${API_BASE}/api${path}`, { headers, ...options });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = await response.json();
      message = data.message || message;
    } catch (e) {
      message = await response.text();
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

// For real file uploads - do NOT set Content-Type, the browser sets the multipart boundary
async function apiUpload(path, formData) {
  const headers = {};
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`${API_BASE}/api${path}`, { method: "POST", headers, body: formData });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Upload failed");
  }
  return response.json();
}

function requestLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      render();
    },
    () => {
      // user denied or unavailable - fall back to MG Road, Bengaluru so the map still works
      state.userLocation = { lat: 12.9756, lng: 77.6094 };
      render();
    },
    { timeout: 6000 }
  );
}

function distanceKm(a, b) {
  if (!a || !b) return null;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10;
}

function shopsSortedByDistance() {
  return [...state.shops]
    .map((shop) => {
      const coords = shop.location?.coordinates;
      const shopPoint = coords ? { lat: coords[1], lng: coords[0] } : null;
      return { ...shop, distance: distanceKm(state.userLocation, shopPoint) };
    })
    .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
}

async function loadData() {
  try {
    state.loading = true;
    render();

    const [shops, products] = await Promise.all([api("/shops"), api("/products")]);
    state.shops = shops;
    state.products = products;

    if (isLoggedIn()) {
      const [cart, latestOrder, dashboard, myOrders] = await Promise.all([
        api("/cart"),
        api("/orders/latest"),
        api("/dashboard"),
        api("/orders")
      ]);
      state.cart = cart;
      state.latestOrder = latestOrder;
      state.dashboard = dashboard;
      state.myOrders = myOrders;

      if (state.user.role === "vendor" || state.user.role === "admin") {
        const [myShops, myProducts, vendorOrders] = await Promise.all([
          api("/shops/mine"),
          api("/products/mine"),
          api("/orders/vendor")
        ]);
        state.myShops = myShops;
        state.myProducts = myProducts;
        state.vendorOrders = vendorOrders;
      }

      if (state.user.role === "delivery" || state.user.role === "admin") {
        state.deliveryData = await api("/orders/delivery");
      }

      if (state.user.role === "admin") {
        await loadAdminData();
      }
    }

    state.loading = false;
    state.error = "";
  } catch (error) {
    state.loading = false;
    state.error = error.message;
  }
  render();
}

async function loadAdminData() {
  const [users, shops, products, orders] = await Promise.all([
    api("/admin/users"),
    api("/admin/shops"),
    api("/admin/products"),
    api("/admin/orders")
  ]);
  state.adminUsers = users;
  state.adminShops = shops;
  state.adminProducts = products;
  state.adminOrders = orders;
}

function money(value) {
  return "Rs. " + Number(value || 0).toLocaleString("en-IN");
}

function setPage(page) {
  const loginRequiredPages = ["cart", "tracking", "vendor", "delivery", "admin"];
  if (loginRequiredPages.includes(page) && !isLoggedIn()) {
    state.page = "auth";
    state.authMode = "login";
    render();
    return;
  }
  state.page = page;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (page === "customer") requestLocation();
}

function RoleGate(requiredRole, pageBuilder) {
  if (state.user?.role !== requiredRole && state.user?.role !== "admin") {
    return `
      <section class="section">
        <div class="card checkout-box">
          <h2>${requiredRole.charAt(0).toUpperCase() + requiredRole.slice(1)} access only</h2>
          <p class="muted">Your account role is <strong>${state.user?.role}</strong>. Login with a ${requiredRole} account to see this dashboard.</p>
          <button class="primary-button" onclick="logout(); setPage('auth');">Switch Account</button>
        </div>
      </section>
    `;
  }
  return pageBuilder();
}

function setCategory(category) {
  state.category = category;
  render();
}

function setSearch(value) {
  state.search = value;
  render();
  const input = document.querySelector("#search-input");
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function setRadius(value) {
  state.radius = value;
  render();
}

function setAuthMode(mode) {
  state.authMode = mode;
  state.authError = "";
  render();
}

function setAuthRole(role) {
  state.authRole = role;
  render();
}

function setVendorTab(tab) {
  state.vendorTab = tab;
  render();
}

function setAdminTab(tab) {
  state.adminTab = tab;
  render();
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.target;
  try {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.value,
        email: form.email.value,
        password: form.password.value,
        role: state.authRole
      })
    });
    onAuthSuccess(data);
  } catch (error) {
    state.authError = error.message;
    render();
  }
}

async function quickLogin(email, password) {
  try {
    const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    onAuthSuccess(data);
  } catch (error) {
    state.authError = error.message + " (run node seed.js on the backend first to create demo accounts)";
    render();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.target;
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: form.email.value, password: form.password.value })
    });
    onAuthSuccess(data);
  } catch (error) {
    state.authError = error.message;
    render();
  }
}

function onAuthSuccess(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem("lk_token", data.token);
  localStorage.setItem("lk_user", JSON.stringify(data.user));
  state.authError = "";
  state.page = data.user.role === "customer" ? "customer" : data.user.role;
  loadData();
}

function logout() {
  state.token = null;
  state.user = null;
  state.cart = [];
  state.dashboard = null;
  localStorage.removeItem("lk_token");
  localStorage.removeItem("lk_user");
  state.page = "customer";
  render();
}

async function addToCart(productId) {
  if (!isLoggedIn()) return setPage("auth");
  try {
    state.cart = await api("/cart", { method: "POST", body: JSON.stringify({ productId, quantity: 1 }) });
    state.page = "cart";
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function updateQty(productId, quantity) {
  try {
    state.cart = await api(`/cart/${productId}`, { method: "PATCH", body: JSON.stringify({ quantity }) });
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function placeOrder() {
  const address = document.querySelector("#address")?.value || "MG Road, Bengaluru";
  const paymentMethod = document.querySelector("#pay-now")?.value || "UPI";
  const subtotal = state.cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const delivery = subtotal > 300 || subtotal === 0 ? 0 : 35;
  const taxes = Math.round(subtotal * 0.05);
  const total = subtotal + delivery + taxes;

  if (paymentMethod === "Cash on Delivery") {
    return finalizeOrder({ address, paymentMethod });
  }

  try {
    const orderData = await api("/payment/create-order", { method: "POST", body: JSON.stringify({ amount: total }) });

    if (typeof Razorpay === "undefined") {
      state.error = "Razorpay checkout script did not load. Check your internet connection.";
      render();
      return;
    }

    const rzp = new Razorpay({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      order_id: orderData.orderId,
      name: "Local Kart",
      description: "Order payment",
      handler: async function (response) {
        try {
          await api("/payment/verify", {
            method: "POST",
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });
          await finalizeOrder({
            address,
            paymentMethod,
            paymentStatus: "paid",
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id
          });
        } catch (error) {
          state.error = "Payment verified but order placement failed: " + error.message;
          render();
        }
      },
      theme: { color: "#1f7a4d" }
    });

    rzp.open();
  } catch (error) {
    state.error = error.message + " (Add Razorpay test keys in .env to enable online payment, or choose Cash on Delivery.)";
    render();
  }
}

async function finalizeOrder(payload) {
  try {
    const order = await api("/orders", { method: "POST", body: JSON.stringify(payload) });
    state.latestOrder = order;
    state.cart = [];
    state.page = "tracking";
  } catch (error) {
    state.error = error.message;
  }
  render();
}

async function acceptAssignment(orderId) {
  try {
    await api(`/orders/${orderId}/accept`, { method: "POST" });
    await loadData();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function updateOrderStatus(orderId, status) {
  try {
    await api(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, deliveryPartner: state.user?.name })
    });
    await loadData();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

// ---- Vendor actions ----
async function createShop(event) {
  event.preventDefault();
  const form = event.target;
  state.formError = "";
  try {
    let imageUrl = "";
    const file = form.image.files[0];
    if (file) {
      const fd = new FormData();
      fd.append("image", file);
      const uploaded = await apiUpload("/upload", fd);
      imageUrl = uploaded.url;
    }
    await api("/shops", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.value,
        category: form.category.value,
        address: form.address.value,
        image: imageUrl,
        letter: form.name.value[0]?.toUpperCase() || "S"
      })
    });
    await loadData();
    state.vendorTab = "shops";
    render();
  } catch (error) {
    state.formError = error.message;
    render();
  }
}

async function createProduct(event) {
  event.preventDefault();
  const form = event.target;
  state.formError = "";
  try {
    let imageUrl = "";
    const file = form.image.files[0];
    if (file) {
      const fd = new FormData();
      fd.append("image", file);
      const uploaded = await apiUpload("/upload", fd);
      imageUrl = uploaded.url;
    }
    await api("/products", {
      method: "POST",
      body: JSON.stringify({
        name: form.name.value,
        shop: form.shop.value,
        category: form.category.value,
        price: Number(form.price.value),
        stock: Number(form.stock.value),
        image: imageUrl,
        letter: form.name.value[0]?.toUpperCase() || "P"
      })
    });
    await loadData();
    render();
  } catch (error) {
    state.formError = error.message;
    render();
  }
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  try {
    await api(`/products/${id}`, { method: "DELETE" });
    await loadData();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function updateProductStock(id, stock) {
  try {
    await api(`/products/${id}`, { method: "PATCH", body: JSON.stringify({ stock: Number(stock) }) });
    await loadData();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

// ---- Admin actions ----
async function adminChangeRole(userId, role) {
  try {
    await api(`/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    await loadAdminData();
    render();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function adminDeleteUser(userId) {
  if (!confirm("Delete this user permanently?")) return;
  try {
    await api(`/admin/users/${userId}`, { method: "DELETE" });
    await loadAdminData();
    render();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function adminDeleteShop(shopId) {
  if (!confirm("Delete this shop and all its products?")) return;
  try {
    await api(`/admin/shops/${shopId}`, { method: "DELETE" });
    await loadAdminData();
    render();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

async function adminDeleteProduct(productId) {
  if (!confirm("Delete this product?")) return;
  try {
    await api(`/admin/products/${productId}`, { method: "DELETE" });
    await loadAdminData();
    render();
  } catch (error) {
    state.error = error.message;
    render();
  }
}

function filteredProducts() {
  let list = state.category === "All" ? state.products : state.products.filter((p) => p.category === state.category);

  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.shop?.name?.toLowerCase().includes(q));
  }

  if (state.radius !== "all" && state.userLocation) {
    const maxKm = Number(state.radius);
    list = list.filter((p) => {
      const coords = p.shop?.location?.coordinates;
      if (!coords) return true;
      const d = distanceKm(state.userLocation, { lat: coords[1], lng: coords[0] });
      return d === null || d <= maxKm;
    });
  }

  return list;
}

function imageTag(url, letter, gradientClass) {
  if (url) return `<img src="${url}" alt="${letter}" loading="lazy">`;
  return `<span class="${gradientClass || ""}" style="display:grid;place-items:center;width:100%;height:100%;">${letter}</span>`;
}

function Header() {
  const pages = [
    ["customer", "Customer"],
    ["cart", "Cart"],
    ["tracking", "Tracking"],
    ["vendor", "Vendor"],
    ["delivery", "Delivery"],
    ["admin", "Admin"]
  ];

  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">LK</div>
        <div>
          <strong>Local Kart</strong>

        </div>
      </div>
      <nav class="nav" aria-label="Main navigation">
        ${pages.map(([key, label]) => `<button class="${state.page === key ? "active" : ""}" onclick="setPage('${key}')">${label}</button>`).join("")}
      </nav>
      <div class="top-actions">
        ${isLoggedIn()
          ? `<span class="pill">${state.user.name} . ${state.user.role}</span><button class="ghost-button" onclick="logout()">Logout</button>`
          : `<button class="primary-button" onclick="setPage('auth')">Login / Register</button>`}
      </div>
    </header>
  `;
}

function LoadingOrError() {
  if (state.loading) {
    return `<section class="section"><div class="card checkout-box"><h2>Loading Local Kart</h2><p class="muted">Connecting to backend APIs...</p></div></section>`;
  }
  if (state.error) {
    return `
      <section class="section">
        <div class="card checkout-box">
          <h2>Something went wrong</h2>
          <p class="muted">${state.error}</p>
          <p class="muted">Run <strong>node server.js</strong> inside the Local Kart folder, then open http://localhost:3000.</p>
          <button class="primary-button" onclick="state.error=''; loadData();">Retry</button>
        </div>
      </section>
    `;
  }
  return "";
}

function Hero() {
  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Fast local ordering</p>
        <h1>Local Kart</h1>
        <p class="lead">A hyperlocal marketplace where customers discover nearby shops, compare products, place orders, and track delivery from neighborhood businesses.</p>
        <div class="hero-actions">
          <button class="primary-button" onclick="setPage('customer')">Start Shopping</button>
          ${!isLoggedIn() ? `<button class="ghost-button" onclick="setPage('auth')">Login / Register</button>` : ""}
        </div>
      </div>
    </section>
  `;
}

function CustomerPage() {
  const nearby = shopsSortedByDistance();
  return `
    ${Hero()}
    <section class="section">
      <div class="section-head">
        <div>
          <h2>Nearby Shops</h2>
          <p>Location-based discovery with real distance, shown live on the map below.</p>
        </div>
        <button class="ghost-button" onclick="setPage('tracking')">Track Latest Order</button>
      </div>
      <div id="shops-map" class="map-container"></div>
      ${nearby.length === 0 ? `
        <div class="card checkout-box">
          <h3>No shops yet</h3>
          <p class="muted">Run <code>node seed.js</code> in your backend folder to add demo shops, or register a shop from the Vendor dashboard.</p>
        </div>
      ` : `
        <div class="grid">
          ${nearby.map((shop) => `
            <article class="card shop-card">
              <div class="shop-image">${imageTag(shop.image, shop.letter)}</div>
              <div class="card-row">
                <div>
                  <h3>${shop.name}</h3>
                  <p class="muted">${shop.category} . ${shop.address}</p>
                  ${shop.distance != null ? `<p class="muted">${shop.distance} km away</p>` : ""}
                </div>
                <span class="pill">${shop.rating}</span>
              </div>
            </article>
          `).join("")}
        </div>
      `}
    </section>
    <section class="section">
      <div class="section-head">
        <div>
          <h2>Product Catalog</h2>
        </div>
      </div>
      <div class="filters">
        ${categories.map((category) => `<button class="${state.category === category ? "active" : ""}" onclick="setCategory('${category}')">${category}</button>`).join("")}
      </div>
      <div class="layout">
        <aside class="sidebar">
          <label for="search-input">Search products</label>
          <input id="search-input" class="field" placeholder="Milk, medicine, bread" value="${state.search}" oninput="setSearch(this.value)">

          <label for="radius">Delivery radius</label>
          <select id="radius" class="field" onchange="setRadius(this.value)">
            <option value="all" ${state.radius === "all" ? "selected" : ""}>Any distance</option>
            <option value="2" ${state.radius === "2" ? "selected" : ""}>Within 2 km</option>
            <option value="5" ${state.radius === "5" ? "selected" : ""}>Within 5 km</option>
            <option value="10" ${state.radius === "10" ? "selected" : ""}>Within 10 km</option>
          </select>
          ${!state.userLocation ? `<p class="muted">Allow location access to filter by real distance.</p>` : ""}

          <label for="payment">Preferred payment</label>
          <select id="payment" class="field">
            <option>UPI</option>
            <option>Cash on Delivery</option>
            <option>Debit Card</option>
            <option>Credit Card</option>
          </select>
          <button class="primary-button" onclick="setPage('cart')">Go to Cart</button>
        </aside>
        <div class="grid">
          ${filteredProducts().length === 0 ? `
            <div class="card checkout-box">
              <h3>No products match</h3>
              <p class="muted">Try a different category, search term, or radius. Or run <code>node seed.js</code> if the catalog is empty.</p>
            </div>
          ` : filteredProducts().map((product) => `
            <article class="card product-card">
              <div class="product-image">${imageTag(product.image, product.letter)}</div>
              <div>
                <strong>${product.name}</strong>
                <span>${product.shop?.name || ""}</span>
              </div>
              <div class="card-row">
                <strong>${money(product.price)}</strong>
                <span class="pill">${product.stock} left</span>
              </div>
              <button class="primary-button" onclick="addToCart('${product._id}')">Add to Cart</button>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function CartPage() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const delivery = subtotal > 300 || subtotal === 0 ? 0 : 35;
  const taxes = Math.round(subtotal * 0.05);
  const total = subtotal + delivery + taxes;

  return `
    <section class="section">
      <div class="section-head">
        <div><h2>Cart and Checkout</h2></div>
        <button class="ghost-button" onclick="setPage('customer')">Continue Shopping</button>
      </div>
      <div class="order-panel">
        <div class="cart-list">
          ${state.cart.length === 0 ? `<div class="line-item"><strong>Your cart is empty</strong><span class="muted">Add products to place an order.</span></div>` : ""}
          ${state.cart.map((item) => `
            <div class="line-item">
              <div><strong>${item.name}</strong><span class="muted">${money(item.price)} each</span></div>
              <div class="qty">
                <button onclick="updateQty('${item.productId}', ${item.quantity - 1})">-</button>
                <strong>${item.quantity}</strong>
                <button onclick="updateQty('${item.productId}', ${item.quantity + 1})">+</button>
              </div>
            </div>
          `).join("")}
        </div>
        <aside class="card checkout-box">
          <h3>Your Bill</h3>
          <p class="muted">${state.cart.length} item${state.cart.length === 1 ? "" : "s"}</p>
          <div class="total-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
          <div class="total-row"><span>Delivery</span><strong>${delivery === 0 ? "Free" : money(delivery)}</strong></div>
          <div class="total-row"><span>Taxes</span><strong>${money(taxes)}</strong></div>
          <hr>
          <div class="total-row"><span>Total</span><strong>${money(total)}</strong></div>
          <label for="address">Delivery address</label>
          <input id="address" class="field" value="MG Road, Bengaluru">
          <label for="pay-now">Payment method</label>
          <select id="pay-now" class="field">
            <option>UPI</option>
            <option>Cash on Delivery</option>
            <option>Debit Card</option>
          </select>
          <button class="primary-button" onclick="placeOrder()" ${state.cart.length === 0 ? "disabled" : ""}>Place Order</button>
        </aside>
      </div>
    </section>
  `;
}

function TrackingPage() {
  const order = state.latestOrder;
  if (!order) {
    return `<section class="section"><div class="card checkout-box"><h2>No orders yet</h2><p class="muted">Place an order from the cart to see live tracking here.</p></div></section>`;
  }
  const activeIndex = Math.max(0, orderSteps.indexOf(order.status));
  return `
    <section class="section">
      <div class="section-head">
        <div><h2>Real-Time Order Tracking</h2><p>Order <strong>#${order._id.slice(-6)}</strong>, distance ${order.distanceKm ?? "N/A"} km.</p></div>
        <span class="pill">ETA ${order.eta}</span>
      </div>
      <div class="order-panel">
        <div class="timeline">
          ${orderSteps.map((step, index) => `
            <div class="step ${index < activeIndex ? "done" : ""} ${index === activeIndex ? "active" : ""}">
              <strong>${step}</strong>
              <p class="muted">${index === activeIndex ? `Order is currently ${step.toLowerCase()}.` : "Status updated successfully."}</p>
            </div>
          `).join("")}
        </div>
        <aside class="card checkout-box">
          <h3>Delivery Details</h3>
          <p><strong>${order.deliveryPartner}</strong></p>
          <p class="muted">Delivering to ${order.address}.</p>
          <p class="muted">Payment: ${order.paymentMethod} . Status: ${order.paymentStatus}</p>
          <p class="muted">Total: ${money(order.total)}</p>
        </aside>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h2>My Order History</h2></div>
      <div class="table-list">
        ${state.myOrders.map((o) => `
          <div class="line-item">
            <div><strong>#${o._id.slice(-6)}</strong><span class="muted">${money(o.total)} . ${o.paymentMethod}</span></div>
            <span class="status ${o.status === "Delivered" ? "green" : "amber"}">${o.status}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function VendorPage() {
  const vendor = state.dashboard?.vendor || {};
  const tabs = [["orders", "Incoming Orders"], ["products", "My Products"], ["shops", "My Shops"]];
  return `
    <section class="section">
      <div class="section-head">
        <div><h2>Vendor Dashboard</h2></div>
      </div>
      ${DashboardStats([
        [vendor.ordersToday ?? 0, "orders today"],
        [money(vendor.dailyRevenue ?? 0), "daily revenue"],
        [vendor.lowStockProducts?.length ?? 0, "low stock items"]
      ])}

      <div class="admin-tabs">
        ${tabs.map(([key, label]) => `<button class="${state.vendorTab === key ? "active" : ""}" onclick="setVendorTab('${key}')">${label}</button>`).join("")}
      </div>

      ${state.formError ? `<p class="muted" style="color:#c0392b;">${state.formError}</p>` : ""}

      ${state.vendorTab === "orders" ? `
        <div class="card checkout-box">
          <h3>Incoming Orders</h3>
          <div class="table-list">
            ${state.vendorOrders.map((o) => `
              <div class="line-item">
                <div>
                  <strong>Order #${o._id.slice(-6)}</strong>
                  <span class="muted">${o.items.length} items . ${o.paymentMethod} ${o.paymentStatus === "paid" ? "paid" : ""} . ${o.user?.name || ""}</span>
                </div>
                <div class="upload-row">
                  <span class="status ${o.status === "Delivered" ? "green" : "amber"}">${o.status}</span>
                  ${o.status === "Placed" ? `<button class="small-button" onclick="updateOrderStatus('${o._id}', 'Confirmed')">Accept</button>` : ""}
                  ${o.status === "Confirmed" ? `<button class="small-button" onclick="updateOrderStatus('${o._id}', 'Packed')">Pack</button>` : ""}
                  ${o.status === "Packed" ? `<span class="pill">Ready for pickup</span>` : ""}
                </div>
              </div>
            `).join("") || `<p class="muted">No orders yet for your shop's products.</p>`}
          </div>
        </div>
      ` : ""}

      ${state.vendorTab === "products" ? `
        <div class="management-grid">
          <div class="card checkout-box">
            <h3>Add a Product</h3>
            <form onsubmit="createProduct(event)">
              <label>Product name</label>
              <input name="name" class="field" required>
              <label>Shop</label>
              <select name="shop" class="field" required>
                ${state.myShops.map((s) => `<option value="${s._id}">${s.name}</option>`).join("") || `<option disabled selected>Create a shop first</option>`}
              </select>
              <label>Category</label>
              <select name="category" class="field" required>
                ${categories.filter((c) => c !== "All").map((c) => `<option>${c}</option>`).join("")}
              </select>
              <label>Price (Rs.)</label>
              <input name="price" type="number" min="0" class="field" required>
              <label>Stock</label>
              <input name="stock" type="number" min="0" class="field" required>
              <label>Real product photo</label>
              <input name="image" type="file" accept="image/*" class="field">
              <button class="primary-button" type="submit">Add Product</button>
            </form>
          </div>
          <div class="card checkout-box">
            <h3>My Products</h3>
            <div class="table-list">
              ${state.myProducts.map((p) => `
                <div class="line-item">
                  <div class="card-row">
                    <div class="product-image" style="width:48px;height:48px;">${imageTag(p.image, p.letter)}</div>
                    <div>
                      <strong>${p.name}</strong>
                      <span class="muted">${money(p.price)} . ${p.category}</span>
                    </div>
                  </div>
                  <div class="upload-row">
                    <input type="number" value="${p.stock}" class="field" style="width:80px;" onchange="updateProductStock('${p._id}', this.value)">
                    <button class="small-button" onclick="deleteProduct('${p._id}')">Delete</button>
                  </div>
                </div>
              `).join("") || `<p class="muted">No products yet.</p>`}
            </div>
          </div>
        </div>
      ` : `
        <div class="management-grid">
          <div class="card checkout-box">
            <h3>Add a Shop</h3>
            <form onsubmit="createShop(event)">
              <label>Shop name</label>
              <input name="name" class="field" required>
              <label>Category</label>
              <select name="category" class="field" required>
                ${categories.filter((c) => c !== "All").map((c) => `<option>${c}</option>`).join("")}
              </select>
              <label>Address</label>
              <input name="address" class="field" placeholder="e.g. MG Road, Bengaluru" required>
              <p class="muted">Address is geocoded automatically using OpenStreetMap to place it on the real map.</p>
              <label>Real shop photo</label>
              <input name="image" type="file" accept="image/*" class="field">
              <button class="primary-button" type="submit">Add Shop</button>
            </form>
          </div>
          <div class="card checkout-box">
            <h3>My Shops</h3>
            <div class="table-list">
              ${state.myShops.map((s) => `
                <div class="line-item">
                  <div class="card-row">
                    <div class="shop-image" style="width:48px;height:48px;">${imageTag(s.image, s.letter)}</div>
                    <div><strong>${s.name}</strong><span class="muted">${s.address}</span></div>
                  </div>
                  <span class="pill">${s.rating}</span>
                </div>
              `).join("") || `<p class="muted">No shops yet.</p>`}
            </div>
          </div>
        </div>
      `}
    </section>
  `;
}

function DeliveryPage() {
  const active = state.deliveryData?.active;
  const available = state.deliveryData?.available || [];

  return `
    <section class="section">
      <div class="section-head">
        <div><h2>Delivery Partner Dashboard</h2></div>
        <span class="pill">Available</span>
      </div>
      ${DashboardStats([
        [state.dashboard?.delivery?.completedToday ?? 0, "completed today"],
        [active ? 1 : 0, "active delivery"],
        [available.length, "open assignments"]
      ])}
      <div class="management-grid">
        <div class="card checkout-box">
          <h3>Active Delivery</h3>
          ${active ? `
            <p><strong>Order #${active._id.slice(-6)}</strong></p>
            <p class="muted">Drop: ${active.address}</p>
            <p class="muted">Status: ${active.status}</p>
            <div class="upload-row">
              <button class="primary-button" onclick="updateOrderStatus('${active._id}', 'Out for Delivery')">Picked Up</button>
              <button class="ghost-button" onclick="updateOrderStatus('${active._id}', 'Delivered')">Delivered</button>
            </div>
          ` : `<p class="muted">No active delivery right now. Accept an assignment below.</p>`}
        </div>
        <div class="card checkout-box">
          <h3>Available Assignments</h3>
          <div class="table-list">
            ${available.map((order) => `
              <div class="line-item">
                <div><strong>Order #${order._id.slice(-6)}</strong><span class="muted">${order.address} . ${money(order.total)}</span></div>
                <button class="small-button" onclick="acceptAssignment('${order._id}')">Accept</button>
              </div>
            `).join("") || `<p class="muted">No assignments available right now.</p>`}
          </div>
        </div>
      </div>
    </section>
  `;
}

function AdminPage() {
  const admin = state.dashboard?.admin || {};
  const tabs = [["users", "Users"], ["shops", "Shops"], ["products", "Products"], ["orders", "Orders"]];

  return `
    <section class="section">
      <div class="section-head">
        <div><h2>Admin Panel</h2></div>
      </div>
      ${DashboardStats([
        [admin.users ?? 0, "registered users"],
        [admin.orders ?? 0, "total orders"],
        [money(admin.gmv ?? 0), "GMV tracked"]
      ])}

      <div class="admin-tabs">
        ${tabs.map(([key, label]) => `<button class="${state.adminTab === key ? "active" : ""}" onclick="setAdminTab('${key}')">${label}</button>`).join("")}
      </div>

      ${state.adminTab === "users" ? `
        <div class="card checkout-box">
          <h3>All Users (${state.adminUsers.length})</h3>
          <div class="table-list">
            ${state.adminUsers.map((u) => `
              <div class="line-item">
                <div><strong>${u.name}</strong><span class="muted">${u.email}</span></div>
                <div class="upload-row">
                  <select class="field" style="width:auto;" onchange="adminChangeRole('${u._id}', this.value)">
                    ${["customer", "vendor", "delivery", "admin"].map((r) => `<option ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}
                  </select>
                  <button class="small-button" onclick="adminDeleteUser('${u._id}')">Delete</button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${state.adminTab === "shops" ? `
        <div class="card checkout-box">
          <h3>All Shops (${state.adminShops.length})</h3>
          <div class="table-list">
            ${state.adminShops.map((s) => `
              <div class="line-item">
                <div class="card-row">
                  <div class="shop-image" style="width:48px;height:48px;">${imageTag(s.image, s.letter)}</div>
                  <div><strong>${s.name}</strong><span class="muted">${s.category} . ${s.address}</span></div>
                </div>
                <button class="small-button" onclick="adminDeleteShop('${s._id}')">Delete</button>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${state.adminTab === "products" ? `
        <div class="card checkout-box">
          <h3>All Products (${state.adminProducts.length})</h3>
          <div class="table-list">
            ${state.adminProducts.map((p) => `
              <div class="line-item">
                <div class="card-row">
                  <div class="product-image" style="width:48px;height:48px;">${imageTag(p.image, p.letter)}</div>
                  <div><strong>${p.name}</strong><span class="muted">${money(p.price)} . ${p.shop?.name || ""}</span></div>
                </div>
                <button class="small-button" onclick="adminDeleteProduct('${p._id}')">Delete</button>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${state.adminTab === "orders" ? `
        <div class="card checkout-box">
          <h3>All Orders (${state.adminOrders.length})</h3>
          <div class="table-list">
            ${state.adminOrders.map((o) => `
              <div class="line-item">
                <div><strong>#${o._id.slice(-6)}</strong><span class="muted">${o.user?.name || "Unknown"} . ${money(o.total)} . ${o.paymentMethod}</span></div>
                <span class="status ${o.status === "Delivered" ? "green" : "amber"}">${o.status}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </section>
  `;
}

function DashboardStats(items) {
  return `
    <div class="dashboard-grid">
      ${items.map(([value, label]) => `<div class="card dashboard-card"><strong>${value}</strong><span>${label}</span></div>`).join("")}
    </div>
  `;
}

function AuthPage() {
  const isLogin = state.authMode === "login";
  return `
    <section class="section">
      <div class="layout">
        <div>
          <h2>${isLogin ? "Login" : "Create your account"}</h2>
          <div class="upload-row">
            <button class="ghost-button" onclick="quickLogin('vendor@localkart.com','vendor123')">Login as Vendor</button>
            <button class="ghost-button" onclick="quickLogin('admin@localkart.com','admin123')">Login as Admin</button>
            <button class="ghost-button" onclick="setAuthMode('register')">New Customer? Register</button>
          </div>
        </div>
        <div class="card checkout-box">
          <div class="segmented">
            <button class="${isLogin ? "active" : ""}" onclick="setAuthMode('login')">Login</button>
            <button class="${!isLogin ? "active" : ""}" onclick="setAuthMode('register')">Register</button>
          </div>
          ${state.authError ? `<p class="muted" style="color:#c0392b;">${state.authError}</p>` : ""}
          ${isLogin ? `
            <form onsubmit="handleLogin(event)">
              <label for="email">Email</label>
              <input name="email" id="email" class="field" type="email" required>
              <label for="password">Password</label>
              <input name="password" id="password" class="field" type="password" required>
              <button class="primary-button" type="submit">Login</button>
            </form>
          ` : `
            <form onsubmit="handleRegister(event)">
              <label for="name">Name</label>
              <input name="name" id="name" class="field" required>
              <label for="email">Email</label>
              <input name="email" id="email" class="field" type="email" required>
              <label for="password">Password (min 6 characters)</label>
              <input name="password" id="password" class="field" type="password" minlength="6" required>
              <label for="role">Account type</label>
              <select class="field" onchange="setAuthRole(this.value)">
                <option value="customer" ${state.authRole === "customer" ? "selected" : ""}>Customer</option>
                <option value="vendor" ${state.authRole === "vendor" ? "selected" : ""}>Vendor</option>
                <option value="delivery" ${state.authRole === "delivery" ? "selected" : ""}>Delivery Partner</option>
              </select>
              <p class="muted">Admin accounts are created directly in the database (node seed.js), not via public signup, for security.</p>
              <button class="primary-button" type="submit">Create Account</button>
            </form>
          `}
        </div>
      </div>
    </section>
  `;
}

function Footer() {
  return `
    <footer class="footer">
      <div>

      </div>
      <button class="ghost-button" onclick="setPage('customer')">Back to Top</button>
    </footer>
  `;
}

function MainPage() {
  const feedback = LoadingOrError();
  if (feedback) return `<div class="app-shell">${Header()}${feedback}</div>`;

  const pages = {
    customer: CustomerPage,
    cart: CartPage,
    tracking: TrackingPage,
    vendor: () => RoleGate("vendor", VendorPage),
    delivery: () => RoleGate("delivery", DeliveryPage),
    admin: () => RoleGate("admin", AdminPage),
    auth: AuthPage
  };

  return `<div class="app-shell">${Header()}${(pages[state.page] || CustomerPage)()}${Footer()}</div>`;
}

function render() {
  app.innerHTML = MainPage();
  if (state.page === "customer" && !state.loading && !state.error) {
    requestAnimationFrame(mountMap);
  }
}

function mountMap() {
  const container = document.querySelector("#shops-map");
  if (!container || typeof L === "undefined") return;

  const center = state.userLocation || { lat: 12.9756, lng: 77.6094 };

  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }

  leafletMap = L.map(container).setView([center.lat, center.lng], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(leafletMap);

  if (state.userLocation) {
    L.marker([center.lat, center.lng], { title: "You are here" })
      .addTo(leafletMap)
      .bindPopup("You are here")
      .openPopup();
  }

  state.shops.forEach((shop) => {
    const coords = shop.location?.coordinates;
    if (!coords || (coords[0] === 0 && coords[1] === 0)) return;
    L.marker([coords[1], coords[0]])
      .addTo(leafletMap)
      .bindPopup(`<strong>${shop.name}</strong><br>${shop.category}<br>${shop.address}`);
  });
}

render();
loadData();
requestLocation();

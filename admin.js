// ============================================================
// BRONZE Admin Dashboard - admin.js
// ============================================================

const API = '';
const formatIDR = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n || 0);

let allProducts = [];
let allOrders = [];
let editingProductId = null;

// ---- AUTH CHECK ----
const getToken = () => localStorage.getItem('bronze_token');
const getUser = () => {
    const u = localStorage.getItem('bronze_user');
    return u ? JSON.parse(u) : null;
};

const logout = () => {
    localStorage.removeItem('bronze_token');
    localStorage.removeItem('bronze_user');
    window.location.href = 'login.html';
};

const guardAdmin = () => {
    const user = getUser();
    if (!user || user.role !== 'admin') {
        alert('Akses ditolak. Hanya admin yang boleh masuk halaman ini.');
        window.location.href = 'index.html';
        return false;
    }
    const msg = document.getElementById('welcomeMsg');
    if (msg) msg.textContent = `Selamat datang, ${user.name}!`;
    return true;
};

// ---- TOAST ----
const showToast = (msg, type = 'success') => {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3500);
};

// ---- TAB SWITCH ----
const switchTab = (name) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${name}`).classList.add('active');
    event.currentTarget.classList.add('active');
    if (name === 'products') loadProducts();
    if (name === 'orders') loadOrders();
};

// ---- STATUS BADGE ----
const badgeHtml = (status) => {
    const map = { pending: 'warning', success: 'success', dikirim: 'info', dibatalkan: 'danger', selesai: 'purple' };
    return `<span class="badge badge-${status}">${status.toUpperCase()}</span>`;
};

// ---- STATS ----
const loadStats = async () => {
    try {
        const res = await fetch(`${API}/api/admin/stats`, { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        document.getElementById('statUsers').textContent = data.totalUsers ?? 0;
        document.getElementById('statProducts').textContent = data.totalProducts ?? 0;
        document.getElementById('statOrders').textContent = data.totalOrders ?? 0;
        document.getElementById('statRevenue').textContent = formatIDR(data.totalRevenue);
    } catch (e) { console.error(e); }
};

// ---- RECENT ORDERS ----
const loadRecentOrders = async () => {
    try {
        const res = await fetch(`${API}/api/admin/orders`, { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        const tbody = document.getElementById('recentOrders');
        if (!data.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Belum ada pesanan.</td></tr>'; return; }
        tbody.innerHTML = data.slice(0, 10).map(o => `
            <tr>
                <td style="font-family: monospace; font-size:0.8rem; color:var(--text-muted);">${o.midtrans_order_id || o.id}</td>
                <td><div>${o.user_name || '-'}</div><div style="font-size:0.78rem; color:var(--text-muted);">${o.user_email || ''}</div></td>
                <td style="font-weight:600;">${formatIDR(o.total_amount)}</td>
                <td>${formatIDR(o.shipping_cost)}</td>
                <td>${badgeHtml(o.status)}</td>
                <td style="font-size:0.82rem; color:var(--text-muted);">${new Date(o.created_at).toLocaleDateString('id-ID')}</td>
            </tr>`).join('');
    } catch (e) { console.error(e); }
};

// ---- PRODUCTS ----
const loadProducts = async () => {
    try {
        const res = await fetch(`${API}/api/products`);
        allProducts = await res.json();
        renderProductTable(allProducts);
        document.getElementById('productCount').textContent = allProducts.length;
    } catch (e) { showToast('Gagal memuat produk', 'error'); }
};

const renderProductTable = (list) => {
    const tbody = document.getElementById('productsTableBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:2rem;">Tidak ada produk.</td></tr>'; return; }
    tbody.innerHTML = list.map(p => `
        <tr>
            <td>${p.image ? `<img src="${p.image}" class="product-thumb" onerror="this.style.display='none'">` : `<div class="product-thumb-placeholder"><i class="ph ph-image"></i></div>`}</td>
            <td><div style="font-weight:500;">${p.name}</div><div style="font-size:0.78rem; color:var(--text-muted);">${p.description ? p.description.substring(0,60) + '...' : ''}</div></td>
            <td><span class="badge" style="background:rgba(255,255,255,0.07); color:var(--text-muted);">${p.category}</span></td>
            <td style="font-weight:600; color:var(--bronze-light);">${formatIDR(p.price)}</td>
            <td>${p.weight_grams}g</td>
            <td>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-sm btn-edit" onclick="openProductModal(${p.id})"><i class="ph ph-pencil"></i> Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')"><i class="ph ph-trash"></i> Hapus</button>
                </div>
            </td>
        </tr>`).join('');
};

const filterProductTable = () => {
    const q = document.getElementById('productSearch').value.toLowerCase();
    renderProductTable(allProducts.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
};

// Product Modal
const openProductModal = async (id = null) => {
    editingProductId = id;
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('modalTitle').textContent = id ? 'EDIT PRODUK' : 'TAMBAH PRODUK';
    document.getElementById('submitProductBtn').textContent = id ? 'Simpan Perubahan' : 'Simpan Produk';

    if (id) {
        try {
            const res = await fetch(`${API}/api/products/${id}`);
            const p = await res.json();
            document.getElementById('productId').value = p.id;
            document.getElementById('pName').value = p.name;
            document.getElementById('pPrice').value = p.price;
            document.getElementById('pWeight').value = p.weight_grams;
            document.getElementById('pCategory').value = p.category;
            document.getElementById('pImage').value = p.image || '';
            document.getElementById('pHoverImage').value = p.hoverImage || '';
            document.getElementById('pDesc').value = p.description || '';
        } catch (e) { showToast('Gagal memuat data produk', 'error'); return; }
    }
    document.getElementById('productModal').classList.add('active');
};

const closeProductModal = () => {
    document.getElementById('productModal').classList.remove('active');
    editingProductId = null;
};

const submitProduct = async (e) => {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const payload = {
        name: document.getElementById('pName').value,
        price: parseFloat(document.getElementById('pPrice').value),
        weight_grams: parseInt(document.getElementById('pWeight').value),
        category: document.getElementById('pCategory').value,
        image: document.getElementById('pImage').value,
        hoverImage: document.getElementById('pHoverImage').value || document.getElementById('pImage').value,
        description: document.getElementById('pDesc').value,
    };

    try {
        const url = id ? `${API}/api/admin/products/${id}` : `${API}/api/admin/products`;
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Gagal menyimpan', 'error'); return; }
        showToast(id ? 'Produk berhasil diupdate!' : 'Produk berhasil ditambahkan!');
        closeProductModal();
        loadProducts();
        loadStats();
    } catch (e) { showToast('Terjadi kesalahan server', 'error'); }
};

const deleteProduct = async (id, name) => {
    if (!confirm(`Hapus produk "${name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
        const res = await fetch(`${API}/api/admin/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Gagal menghapus', 'error'); return; }
        showToast(`Produk "${name}" berhasil dihapus.`);
        loadProducts();
        loadStats();
    } catch (e) { showToast('Terjadi kesalahan server', 'error'); }
};

// ---- ORDERS ----
const loadOrders = async () => {
    try {
        const res = await fetch(`${API}/api/admin/orders`, { headers: { Authorization: `Bearer ${getToken()}` } });
        allOrders = await res.json();
        renderOrderTable(allOrders);
        document.getElementById('orderCount').textContent = allOrders.length;
    } catch (e) { showToast('Gagal memuat pesanan', 'error'); }
};

const renderOrderTable = (list) => {
    const tbody = document.getElementById('ordersTableBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:2rem;">Belum ada pesanan.</td></tr>'; return; }
    tbody.innerHTML = list.map(o => `
        <tr>
            <td style="font-family:monospace; font-size:0.78rem; color:var(--text-muted);">${o.midtrans_order_id || o.id}</td>
            <td><div style="font-weight:500;">${o.user_name || '-'}</div><div style="font-size:0.78rem; color:var(--text-muted);">${o.user_email || ''}</div></td>
            <td style="font-weight:600;">${formatIDR(o.total_amount)}</td>
            <td>${formatIDR(o.shipping_cost)}</td>
            <td>${badgeHtml(o.status)}</td>
            <td style="font-size:0.82rem; color:var(--text-muted);">${new Date(o.created_at).toLocaleString('id-ID')}</td>
            <td>
                <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)" data-current="${o.status}">
                    ${['pending','success','dikirim','dibatalkan','selesai'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
                </select>
            </td>
        </tr>`).join('');
};

const filterOrderTable = () => {
    const q = document.getElementById('orderSearch').value.toLowerCase();
    renderOrderTable(allOrders.filter(o => (o.user_name || '').toLowerCase().includes(q) || (o.user_email || '').toLowerCase().includes(q) || (o.midtrans_order_id || '').toLowerCase().includes(q)));
};

const updateOrderStatus = async (id, status) => {
    try {
        const res = await fetch(`${API}/api/admin/orders/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ status }) });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Gagal update status', 'error'); return; }
        showToast(`Status diubah menjadi "${status}"`);
        loadOrders();
        loadStats();
    } catch (e) { showToast('Terjadi kesalahan server', 'error'); }
};

// Close modal on overlay click
document.getElementById('productModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('productModal')) closeProductModal();
});

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    if (!guardAdmin()) return;
    loadStats();
    loadRecentOrders();
});

// Global State
let products = [];
let cart = JSON.parse(localStorage.getItem('bronze_cart')) || [];

// DOM Elements
const productGrid = document.getElementById('productGrid');
const cartBtn = document.querySelector('.cart-btn');
const closeCartBtn = document.getElementById('closeCart');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const cartItemsContainer = document.getElementById('cartItems');
const cartCount = document.querySelector('.cart-count');
const menuBtn = document.getElementById('menuBtn');
const navLinks = document.getElementById('navLinks');
const searchInput = document.getElementById('searchInput');

// Format Currency
const formatIDR = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
};

// Check Auth State
const checkAuth = () => {
    const userContainer = document.getElementById('userMenuContainer');
    if(!userContainer) return;

    const userStr = localStorage.getItem('bronze_user');
    if(userStr) {
        const user = JSON.parse(userStr);
        const adminLink = user.role === 'admin' ? `<a href="admin.html" style="color: var(--bronze); text-decoration: none; font-size: 0.85rem; border: 1px solid var(--bronze); padding: 0.3rem 0.7rem; border-radius: 4px;">Admin</a>` : '';
        userContainer.innerHTML = `
            <div style="display: flex; gap: 1rem; align-items: center;">
                ${adminLink}
                <a href="orders.html" style="color: white; text-decoration: none; font-size: 0.9rem;">Hai, ${user.name}</a>
                <button onclick="logout()" style="background: none; border: none; color: var(--bronze); cursor: pointer;"><i class="ph ph-sign-out"></i></button>
            </div>
        `;
    }
};


const logout = () => {
    localStorage.removeItem('bronze_token');
    localStorage.removeItem('bronze_user');
    window.location.reload();
};

// Fetch Products from API
const fetchProducts = async (category = 'All', search = '') => {
    try {
        let url = `/api/products?`;
        if (category !== 'All') url += `category=${category}&`;
        if (search) url += `search=${search}`;
        
        const res = await fetch(url);
        products = await res.json();
        renderProducts(products);
    } catch (error) {
        console.error("Failed to fetch products", error);
        productGrid.innerHTML = '<p style="color:var(--text-secondary); text-align:center; grid-column: 1/-1;">Gagal memuat produk. Pastikan server berjalan.</p>';
    }
};

// Render Products
const renderProducts = (productsToRender) => {
    if(!productGrid) return;
    productGrid.innerHTML = '';
    
    if (productsToRender.length === 0) {
        productGrid.innerHTML = '<p style="color:var(--text-secondary); grid-column: 1/-1; text-align:center;">Produk belum tersedia.</p>';
        return;
    }

    productsToRender.forEach(product => {
        const productEl = document.createElement('div');
        productEl.classList.add('product-card');
        productEl.innerHTML = `
            <div class="product-image-container" onclick="showProductDetail(${product.id})" style="cursor:pointer;">
                <img src="${product.image}" alt="${product.name}" class="product-image primary-img">
                <img src="${product.hoverImage}" alt="${product.name}" class="product-image secondary-img">
            </div>
            <div class="product-info">
                <h3 class="product-title" onclick="showProductDetail(${product.id})" style="cursor:pointer;">${product.name}</h3>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="btn-add" onclick="addToCart(${product.id})" style="flex: 1;">Add to Cart</button>
                    <button class="btn-add" onclick="showProductDetail(${product.id})" style="flex: 1; border-color: var(--bronze); color: var(--bronze);">Detail</button>
                </div>
            </div>
        `;
        productGrid.appendChild(productEl);
    });
};

// Product Detail Modal
const detailModal = document.getElementById('detailModal');
const closeDetailModal = document.getElementById('closeDetailModal');
const detailContent = document.getElementById('detailContent');

const showProductDetail = async (id) => {
    try {
        const res = await fetch(`/api/products/${id}`);
        const product = await res.json();
        
        detailContent.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <img src="${product.image}" style="width:100%; border-radius:8px;">
                </div>
                <div>
                    <h2 style="font-family: 'Bebas Neue'; font-size: 2.5rem; color: var(--bronze); margin-bottom: 0.5rem;">${product.name}</h2>
                    <p style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">${formatIDR(product.price)}</p>
                    <span style="display:inline-block; padding: 0.25rem 0.75rem; background: rgba(255,255,255,0.1); border-radius:4px; font-size:0.8rem; margin-bottom:1rem;">Kategori: ${product.category}</span>
                    <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 2rem;">${product.description}</p>
                    
                    <button class="btn-primary" onclick="addToCart(${product.id})" style="width: 100%;">ADD TO CART</button>
                </div>
            </div>
        `;
        
        detailModal.classList.add('active');
    } catch(e) {
        console.error("Error fetching detail", e);
    }
};

if(closeDetailModal) {
    closeDetailModal.addEventListener('click', () => detailModal.classList.remove('active'));
}

if(detailModal) {
    detailModal.addEventListener('click', (e) => {
        if(e.target === detailModal) detailModal.classList.remove('active');
    });
}


// Cart Functionality
const toggleCart = () => {
    cartSidebar.classList.toggle('active');
    cartOverlay.classList.toggle('active');
};

const addToCart = async (productId) => {
    // If not in products array, fetch it
    let product = products.find(p => p.id === productId);
    if(!product) {
        const res = await fetch(`/api/products/${productId}`);
        product = await res.json();
    }

    const existingItem = cart.find(item => item.id === productId);
    if(existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({...product, quantity: 1});
    }
    
    saveCart();
    updateCartUI();
    if(!cartSidebar.classList.contains('active')) toggleCart();
};

const removeFromCart = (index) => {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
};

const saveCart = () => {
    localStorage.setItem('bronze_cart', JSON.stringify(cart));
};

const updateCartUI = () => {
    cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartItemsContainer.innerHTML = '';
    
    let total = 0;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 2rem;">Your cart is empty.</p>';
    } else {
        cart.forEach((item, index) => {
            total += (item.price * item.quantity);
            const itemEl = document.createElement('div');
            itemEl.classList.add('cart-item');
            itemEl.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="item-details">
                    <div>
                        <h4 class="item-title">${item.name}</h4>
                        <p style="color:var(--bronze); font-weight:600;">${item.quantity}x ${formatIDR(item.price)}</p>
                    </div>
                    <button class="remove-item" onclick="removeFromCart(${index})">Remove</button>
                </div>
            `;
            cartItemsContainer.appendChild(itemEl);
        });
    }
};

// Event Listeners
cartBtn.addEventListener('click', toggleCart);
closeCartBtn.addEventListener('click', toggleCart);
cartOverlay.addEventListener('click', toggleCart);

if(searchInput) {
    let timeoutId;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fetchProducts('All', e.target.value);
        }, 500);
    });
}

// Category Filtering
document.querySelectorAll('.nav-links a[data-category]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-links a').forEach(l => l.style.color = '');
        e.target.style.color = 'var(--bronze)';
        const category = e.target.getAttribute('data-category');
        fetchProducts(category);
    });
});

// Mobile menu
if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const icon = menuBtn.querySelector('i');
        if (navLinks.classList.contains('active')) {
            icon.classList.remove('ph-list');
            icon.classList.add('ph-x');
        } else {
            icon.classList.remove('ph-x');
            icon.classList.add('ph-list');
        }
    });
}

// Scroll Reveal
const initScrollReveal = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.fade-in-section').forEach((el) => {
        observer.observe(el);
    });
};

// Preloader
window.addEventListener('load', () => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.style.opacity = '0';
        preloader.style.visibility = 'hidden';
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500);
    }
});

// Slider Data
const featuredProducts = [
    { name: "BRONZE OG Script Tee", image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=2000&auto=format&fit=crop" },
    { name: "Washed Denim Jacket", image: "https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?q=80&w=2000&auto=format&fit=crop" },
    { name: "Camo Street Vest", image: "https://images.unsplash.com/photo-1620012253291-a1288f6bc20e?q=80&w=2000&auto=format&fit=crop" },
    { name: "Oversized Acid Wash Shirt", image: "https://images.unsplash.com/photo-1618517351616-3898d54c8e74?q=80&w=2000&auto=format&fit=crop" }
];

const renderSlider = () => {
    const wrapper = document.getElementById('sliderWrapper');
    if(!wrapper) return;
    
    featuredProducts.forEach(prod => {
        const item = document.createElement('div');
        item.classList.add('slider-item');
        item.innerHTML = `
            <img src="${prod.image}" alt="${prod.name}">
            <div style="padding: 1rem; text-align: center;">
                <h4 style="font-size: 1rem; font-weight: 500; font-family: var(--font-body);">${prod.name}</h4>
            </div>
        `;
        wrapper.appendChild(item);
    });

    const nextBtn = document.querySelector('.next-btn');
    const prevBtn = document.querySelector('.prev-btn');
    
    if (nextBtn && prevBtn) {
        nextBtn.addEventListener('click', () => wrapper.scrollBy({ left: 320, behavior: 'smooth' }));
        prevBtn.addEventListener('click', () => wrapper.scrollBy({ left: -320, behavior: 'smooth' }));
    }
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    if(productGrid) fetchProducts();
    renderSlider();
    updateCartUI();
    initScrollReveal();
});

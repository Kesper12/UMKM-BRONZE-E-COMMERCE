require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db, initDb } = require('./database');
const midtransClient = require('midtrans-client');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Midtrans config
let snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Database
initDb();

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        if (user.role !== 'admin') return res.status(403).json({ error: 'Access denied. Admins only.' });
        req.user = user;
        next();
    });
};

// --- API ROUTES ---

// Auth - Register
app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ message: 'User registered successfully', userId: this.lastID });
    });
});

// Auth - Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Invalid email or password' });
        
        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid email or password' });

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    });
});

// Products - List & Search
app.get('/api/products', (req, res) => {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    let params = [];

    if (category && category !== 'All') {
        query += ' AND category = ?';
        params.push(category);
    }
    if (search) {
        query += ' AND name LIKE ?';
        params.push(`%${search}%`);
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Products - Detail
app.get('/api/products/:id', (req, res) => {
    db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Product not found' });
        res.json(row);
    });
});

// Shipping - Get Provinces (Mock or Real RajaOngkir if Key provided)
app.get('/api/shipping/provinces', async (req, res) => {
    try {
        if (!process.env.RAJAONGKIR_API_KEY || process.env.RAJAONGKIR_API_KEY.includes('YOUR_')) {
            // Mock Data
            return res.json([
                { province_id: "1", province: "Bali" },
                { province_id: "6", province: "DKI Jakarta" },
                { province_id: "24", province: "Papua" }
            ]);
        }
        const response = await axios.get('https://api.rajaongkir.com/starter/province', {
            headers: { key: process.env.RAJAONGKIR_API_KEY }
        });
        res.json(response.data.rajaongkir.results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch provinces' });
    }
});

// Shipping - Get Cities
app.get('/api/shipping/cities/:provinceId', async (req, res) => {
    try {
        if (!process.env.RAJAONGKIR_API_KEY || process.env.RAJAONGKIR_API_KEY.includes('YOUR_')) {
            // Mock Data
            if (req.params.provinceId === "24") {
                return res.json([{ city_id: "472", city_name: "Mimika", type: "Kabupaten" }]);
            }
            return res.json([{ city_id: "114", city_name: "Denpasar", type: "Kota" }, { city_id: "152", city_name: "Jakarta Pusat", type: "Kota" }]);
        }
        const response = await axios.get(`https://api.rajaongkir.com/starter/city?province=${req.params.provinceId}`, {
            headers: { key: process.env.RAJAONGKIR_API_KEY }
        });
        res.json(response.data.rajaongkir.results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cities' });
    }
});

// Shipping - Calculate Cost
app.post('/api/shipping/cost', async (req, res) => {
    const { destination, weight, courier } = req.body;
    const origin = process.env.ORIGIN_CITY_ID || "472"; // Default Timika

    try {
        if (!process.env.RAJAONGKIR_API_KEY || process.env.RAJAONGKIR_API_KEY.includes('YOUR_')) {
            // Mock calculation
            const cost = parseInt(weight) * 15; // Mock: Rp 15 per gram
            return res.json([{
                code: courier,
                name: "Mock Courier",
                costs: [{ service: "REG", description: "Layanan Reguler", cost: [{ value: cost, etd: "2-3", note: "" }] }]
            }]);
        }
        const response = await axios.post('https://api.rajaongkir.com/starter/cost', {
            origin, destination, weight, courier
        }, { headers: { key: process.env.RAJAONGKIR_API_KEY } });
        res.json(response.data.rajaongkir.results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to calculate cost' });
    }
});

// Checkout (Midtrans Integration)
app.post('/api/checkout', authenticateToken, async (req, res) => {
    const { items, shippingCost, destination } = req.body;
    const userId = req.user.id;

    if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    let itemDetails = [];
    let grossAmount = parseInt(shippingCost);

    // Add shipping as an item
    itemDetails.push({
        id: 'SHIPPING',
        price: parseInt(shippingCost),
        quantity: 1,
        name: 'Shipping Cost'
    });

    for (let item of items) {
        grossAmount += (item.price * item.quantity);
        itemDetails.push({
            id: item.id.toString(),
            price: item.price,
            quantity: item.quantity,
            name: item.name
        });
    }

    const orderId = 'BRONZE-' + Date.now();

    try {
        // Insert order into DB
        db.run('INSERT INTO orders (user_id, total_amount, shipping_cost, midtrans_order_id) VALUES (?, ?, ?, ?)', 
            [userId, grossAmount, shippingCost, orderId], async function(err) {
            if (err) return res.status(500).json({ error: 'Failed to create order' });
            
            const dbOrderId = this.lastID;

            // Insert items
            const stmt = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
            items.forEach(item => stmt.run([dbOrderId, item.id, item.quantity, item.price]));
            stmt.finalize();

            // Create Midtrans Transaction
            let parameter = {
                transaction_details: {
                    order_id: orderId,
                    gross_amount: grossAmount
                },
                item_details: itemDetails,
                customer_details: {
                    first_name: req.user.name,
                    email: req.user.email
                }
            };

            // Only attempt Midtrans API if real keys are provided, otherwise mock it
            if (process.env.MIDTRANS_SERVER_KEY && !process.env.MIDTRANS_SERVER_KEY.includes('YOUR_')) {
                const transaction = await snap.createTransaction(parameter);
                
                // Update order with snap token
                db.run('UPDATE orders SET midtrans_snap_token = ? WHERE id = ?', [transaction.token, dbOrderId]);
                
                res.json({ token: transaction.token, orderId: dbOrderId });
            } else {
                // Mock Token
                const mockToken = 'mock-snap-token-' + Date.now();
                db.run('UPDATE orders SET midtrans_snap_token = ? WHERE id = ?', [mockToken, dbOrderId]);
                res.json({ token: mockToken, orderId: dbOrderId, mock: true });
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Payment gateway error' });
    }
});

// Order History (for logged in user)
app.get('/api/orders', authenticateToken, (req, res) => {
    db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// ==============================
// ADMIN ROUTES
// ==============================

// Admin: Get all users (stat)
app.get('/api/admin/stats', authenticateAdmin, (req, res) => {
    const stats = {};
    db.get('SELECT COUNT(*) as count FROM users WHERE role != ?', ['admin'], (err, row) => {
        stats.totalUsers = row ? row.count : 0;
        db.get('SELECT COUNT(*) as count FROM products', (err2, row2) => {
            stats.totalProducts = row2 ? row2.count : 0;
            db.get('SELECT COUNT(*) as count FROM orders', (err3, row3) => {
                stats.totalOrders = row3 ? row3.count : 0;
                db.get('SELECT SUM(total_amount) as total FROM orders WHERE status = ?', ['success'], (err4, row4) => {
                    stats.totalRevenue = row4 ? (row4.total || 0) : 0;
                    res.json(stats);
                });
            });
        });
    });
});

// Admin: Get all orders
app.get('/api/admin/orders', authenticateAdmin, (req, res) => {
    db.all(`SELECT o.*, u.name as user_name, u.email as user_email 
            FROM orders o 
            LEFT JOIN users u ON o.user_id = u.id 
            ORDER BY o.created_at DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// Admin: Update order status
app.put('/api/admin/orders/:id/status', authenticateAdmin, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'success', 'dikirim', 'dibatalkan', 'selesai'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Status updated', changes: this.changes });
    });
});

// Admin: Add product
app.post('/api/admin/products', authenticateAdmin, (req, res) => {
    const { name, price, category, image, hoverImage, description, weight_grams } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Missing required fields' });

    db.run('INSERT INTO products (name, price, category, image, hoverImage, description, weight_grams) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, price, category, image || '', hoverImage || image || '', description || '', weight_grams || 500],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.status(201).json({ message: 'Product added', id: this.lastID });
        }
    );
});

// Admin: Edit product
app.put('/api/admin/products/:id', authenticateAdmin, (req, res) => {
    const { name, price, category, image, hoverImage, description, weight_grams } = req.body;
    db.run('UPDATE products SET name=?, price=?, category=?, image=?, hoverImage=?, description=?, weight_grams=? WHERE id=?',
        [name, price, category, image, hoverImage || image, description, weight_grams || 500, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Product updated' });
        }
    );
});

// Admin: Delete product
app.delete('/api/admin/products/:id', authenticateAdmin, (req, res) => {
    db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Product deleted' });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

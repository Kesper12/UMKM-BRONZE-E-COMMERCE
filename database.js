const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )`);

        // Products Table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT NOT NULL,
            image TEXT,
            hoverImage TEXT,
            description TEXT,
            weight_grams INTEGER DEFAULT 500
        )`);

        // Orders Table
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total_amount REAL NOT NULL,
            shipping_cost REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            midtrans_snap_token TEXT,
            midtrans_order_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Order Items Table
        db.run(`CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders (id),
            FOREIGN KEY (product_id) REFERENCES products (id)
        )`);

        // Seed Admin User
        const adminEmail = 'admin@bronze.com';
        db.get('SELECT id FROM users WHERE email = ?', [adminEmail], (err, row) => {
            if (!row) {
                const hash = bcrypt.hashSync('admin123', 10);
                db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Admin Bronze', adminEmail, hash, 'admin']);
            }
        });

        // Seed Initial Products
        db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
            if (row && row.count === 0) {
                const initialProducts = [
                    ['Heavy Bones Oversized T-Shirt', 185000, 'Baju', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=2000&auto=format&fit=crop', 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=2000&auto=format&fit=crop', 'Premium heavy cotton t-shirt.', 300],
                    ['Bronze Graffiti Pullover', 350000, 'Baju', 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=2000&auto=format&fit=crop', 'https://images.unsplash.com/photo-1614252339462-2432244299b8?q=80&w=2000&auto=format&fit=crop', 'Cozy pullover with raw graffiti print.', 600],
                    ['Tactical Cargo Pants Dark', 320000, 'Celana', 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=2000&auto=format&fit=crop', 'https://images.unsplash.com/photo-1555689502-c4b22d76c56f?q=80&w=2000&auto=format&fit=crop', 'Durable tactical cargo pants.', 700],
                    ['Classic Logo Crewneck', 295000, 'Baju', 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=2000&auto=format&fit=crop', 'https://images.unsplash.com/photo-1578681994506-b8f46334f773?q=80&w=2000&auto=format&fit=crop', 'Classic logo crewneck sweater.', 500]
                ];

                const stmt = db.prepare('INSERT INTO products (name, price, category, image, hoverImage, description, weight_grams) VALUES (?, ?, ?, ?, ?, ?, ?)');
                initialProducts.forEach(p => stmt.run(p));
                stmt.finalize();
                console.log('Database seeded with initial products.');
            }
        });
    });
};

module.exports = { db, initDb };

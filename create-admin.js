// ============================================================
// Script untuk membuat akun admin baru
// Jalankan: node create-admin.js
// ============================================================

require('dotenv').config();
const bcrypt = require('bcrypt');
const { db, initDb } = require('./database');

// ===== UBAH DATA ADMIN DI BAWAH INI =====
const ADMIN_NAME = 'Admin Bronze';
const ADMIN_EMAIL = 'admin@bronze.com';
const ADMIN_PASSWORD = 'admin123';
// =========================================

initDb();

setTimeout(() => {
    // Cek apakah email sudah ada
    db.get('SELECT id, role FROM users WHERE email = ?', [ADMIN_EMAIL], (err, row) => {
        if (err) {
            console.error('❌ Database error:', err.message);
            process.exit(1);
        }

        if (row) {
            if (row.role === 'admin') {
                console.log(`✅ Akun admin dengan email "${ADMIN_EMAIL}" sudah ada!`);
            } else {
                // Upgrade user biasa jadi admin
                db.run('UPDATE users SET role = ? WHERE email = ?', ['admin', ADMIN_EMAIL], (err2) => {
                    if (err2) console.error('❌ Gagal upgrade:', err2.message);
                    else console.log(`✅ Akun "${ADMIN_EMAIL}" berhasil diupgrade menjadi admin!`);
                    process.exit(0);
                });
            }
            return;
        }

        // Buat akun admin baru
        const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
        db.run(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [ADMIN_NAME, ADMIN_EMAIL, hash, 'admin'],
            function (err2) {
                if (err2) {
                    console.error('❌ Gagal membuat admin:', err2.message);
                } else {
                    console.log('');
                    console.log('✅ Akun admin berhasil dibuat!');
                    console.log('─────────────────────────────');
                    console.log(`📧 Email    : ${ADMIN_EMAIL}`);
                    console.log(`🔑 Password : ${ADMIN_PASSWORD}`);
                    console.log(`👤 Nama     : ${ADMIN_NAME}`);
                    console.log('─────────────────────────────');
                    console.log('💡 Login di: http://localhost:3000/login.html');
                }
                process.exit(0);
            }
        );
    });
}, 500);

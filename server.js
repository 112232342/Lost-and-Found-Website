// express required
const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3001;

// db pre handle
const dbPath = path.join(__dirname, 'data', 'lostandfound.db');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// connect db
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// db table
db.run(`
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        location TEXT,
        description TEXT,
        contact TEXT NOT NULL,
        incidentDate TEXT NOT NULL,
        imageUrl TEXT,
        createdAt TEXT NOT NULL
    )
`, (err) => {
    if (err) {
        console.error('Error creating table:', err);
    } else {
        console.log('Items table ready');
        seedDataIfNeeded();
    }
});

// upload Directory
const uploadDir = path.join(__dirname, 'views', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// multer handling upload process
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // set 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'views')));

// sample data
function seedDataIfNeeded() {
    db.get('SELECT COUNT(*) as count FROM items', (err, row) => {
        if (err) {
            console.error('Error checking data:', err);
            return;
        }
        
        if (row.count === 0) {
            console.log('Seeding sample data...');
            const sampleData = [
                {
                    type: 'lost',
                    title: 'Blue Water Bottle',
                    location: 'Campus - Room 204',
                    description: 'Nalgene bottle with stickers, lost near the water fountain',
                    contact: '123@abc.com',
                    incidentDate: '2024-03-20',
                    imageUrl: null,
                    createdAt: new Date(Date.now() - 86400000).toISOString()
                },
                {
                    type: 'found',
                    title: 'Student ID Card',
                    location: 'Cafe',
                    description: 'ID: XXXX, Name: , found on dining table',
                    contact: '+1234567890',
                    incidentDate: '2024-03-22',
                    imageUrl: null,
                    createdAt: new Date(Date.now() - 43200000).toISOString()
                },
                {
                    type: 'lost',
                    title: 'AirPods Pro',
                    location: 'Library',
                    description: 'White',
                    contact: '123@gmail.com',
                    incidentDate: '2024-03-23',
                    imageUrl: null,
                    createdAt: new Date(Date.now() - 7200000).toISOString()
                }
            ];
            
            const stmt = db.prepare(`
                INSERT INTO items (type, title, location, description, contact, incidentDate, imageUrl, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            sampleData.forEach(item => {
                stmt.run(item.type, item.title, item.location, item.description, 
                         item.contact, item.incidentDate, item.imageUrl, item.createdAt);
            });
            
            stmt.finalize();
            console.log('Sample data inserted');
        }
    });
}

// API routes

// GET all items (with search)
app.get('/api/items', (req, res) => {
    let sql = 'SELECT * FROM items WHERE 1=1';
    const params = [];
    const { search, startDate, endDate } = req.query;

    if (search && search.trim()) {
        sql += ' AND (title LIKE ? OR location LIKE ? OR description LIKE ?)';
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    if (startDate) {
        sql += ' AND incidentDate >= ?';
        params.push(startDate);
    }

    if (endDate) {
        sql += ' AND incidentDate <= ?';
        params.push(endDate);
    }

    sql += ' ORDER BY createdAt DESC';

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error fetching items:', err);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json(rows);
        }
    });
});

// GET single item
app.get('/api/items/:id', (req, res) => {
    const id = parseInt(req.params.id);
    db.get('SELECT * FROM items WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching item:', err);
            res.status(500).json({ error: 'Database error' });
        } else if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: 'not found' });
        }
    });
});

// POST create new item (image upload)
app.post('/api/items', upload.single('image'), (req, res) => {
    const { type, title, location, description, contact, incidentDate } = req.body;
    
    if (!title || !contact || !type) {
        // upload but no verify
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Missing required fields (title, contact, type)' });
    }

    let imageUrl = null;
    if (req.file) {
        // make img URL，get form /upload (image save location)
        imageUrl = `/uploads/${req.file.filename}`;
    }

    const newItem = {
        type: type,
        title: title.trim(),
        location: location || 'Not specified',
        description: description || '',
        contact: contact.trim(),
        incidentDate: incidentDate || new Date().toISOString().split('T')[0],
        imageUrl: imageUrl,
        createdAt: new Date().toISOString()
    };

    db.run(`
        INSERT INTO items (type, title, location, description, contact, incidentDate, imageUrl, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [newItem.type, newItem.title, newItem.location, newItem.description, 
         newItem.contact, newItem.incidentDate, newItem.imageUrl, newItem.createdAt],
    function(err) {
        if (err) {
            console.error('Error inserting item:', err);
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            res.status(500).json({ error: 'Database error' });
        } else {
            newItem.id = this.lastID;
            res.status(201).json(newItem);
        }
    });
});

// DELETE item (also delete image)
app.delete('/api/items/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    db.get('SELECT imageUrl FROM items WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Error fetching item for deletion:', err);
            res.status(500).json({ error: 'Database error' });
        } else if (!row) {
            res.status(404).json({ error: 'Item not found' });
        } else {
            db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
                if (err) {
                    console.error('Error deleting item:', err);
                    res.status(500).json({ error: 'Database error' });
                } else {
                    if (row.imageUrl) {
                        const imagePath = path.join(__dirname, 'views', row.imageUrl);
                        if (fs.existsSync(imagePath)) {
                            fs.unlinkSync(imagePath);
                        }
                    }
                    res.json({ success: true, message: 'Item removed' });
                }
            });
        }
    });
});

// close database
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});

// server listen
app.listen(PORT, () => {
    console.log(`Lost & Found backend server running on http://localhost:${PORT}`);
    console.log(`API endpoints: GET /api/items , POST /api/items , DELETE /api/items/:id`);
    console.log(`Upload directory: ${uploadDir}`);
    console.log(`Database path: ${dbPath}`);
});
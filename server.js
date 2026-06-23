const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Wake up .env
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ======================================================
//    SERVERLESS MONGODB CONNECTION CACHING ENGINE
// ======================================================
let cachedDb = null;

async function connectToDatabase() {
    // 1. If AWS already warmed this container up, REUSE THE EXISTING TCP PIPE!
    if (cachedDb && mongoose.connection.readyState === 1) {
        return cachedDb;
    }

    console.log('=> Initializing Serverless MongoDB Connection...');
    const db = await mongoose.connect(process.env.MONGODB_URI, {
        family: 4,                      // The Silver Bullet: Forces standard IPv4 resolution inside AWS Lambda
        serverSelectionTimeoutMS: 5000, // Fails cleanly in 5s if Atlas is blocked (prevents infinite hangs)
        socketTimeoutMS: 45000          // Automatically snips dead idle sockets after 45s
    });

    cachedDb = db;
    console.log('🟢 Serverless MongoDB Atlas Pipe Warmed & Ready!');
    return cachedDb;
}

// 2. DATABASE GATEWAY GATEKEEPER
// Intercepts API calls to ensure the DB pipe is alive before executing your code.
app.use(async (req, res, next) => {
    // Only wake up MongoDB for /api routes. Static files (CSS/JS) pass through untouched!
    if (req.path.startsWith('/api')) {
        try {
            await connectToDatabase();
        } catch (err) {
            console.error('🔴 Database Gateway Timeout:', err);
            return res.status(500).json({ error: 'Database connection failed to initialize.' });
        }
    }
    next();
});

// ======================================================
//                 BLUEPRINTS (SCHEMAS)
// ======================================================

// 1. HOSTEL OWNER (TENANT) BLUEPRINT
const ownerSchema = new mongoose.Schema({
    hostelName: { type: String, required: true },
    ownerName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });

// Never send the scrambled password back to the frontend browser
ownerSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret.password;
        delete ret._id;
        delete ret.__v;
    }
});

const Owner = mongoose.model('Owner', ownerSchema);

// 2. STUDENT BLUEPRINT (With Owner Leash)
const studentSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    major: { type: String, required: true },
    address: { type: String, required: true },
    room: { type: String, default: 'Unassigned' },
    status: { type: String, default: 'Pending' },
    messPlan: { type: String, default: 'No Mess' },
    duesAmount: { type: Number, default: 0 },
    duesStatus: { type: String, default: 'Pending' }
}, { timestamps: true });

studentSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

const Student = mongoose.model('Student', studentSchema);

// ======================================================
//                 SECURITY MIDDLEWARE
// ======================================================
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 

    if (!token) return res.status(401).json({ error: 'Access Denied: Please log in first.' });

    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key', (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Session expired or invalid security token.' });
        req.ownerId = decoded.id; 
        next(); 
    });
};

// ======================================================
//                 AUTHENTICATION API
// ======================================================

// REGISTER: Sign up a new Hostel Owner
app.post('/api/auth/register', async (req, res) => {
    try {
        const { hostelName, ownerName, email, password } = req.body;
        
        const existing = await Owner.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email address already registered' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newOwner = new Owner({
            hostelName,
            ownerName,
            email,
            password: hashedPassword
        });

        const saved = await newOwner.save();
        const token = jwt.sign({ id: saved._id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '7d' });

        res.status(201).json({ owner: saved, token });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// LOGIN: Authenticate existing Hostel Owner
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const owner = await Owner.findOne({ email });
        if (!owner) return res.status(404).json({ error: 'Account not found' });

        const isMatch = await bcrypt.compare(password, owner.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: owner._id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '7d' });

        res.json({ owner, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================
//            STUDENT API ROUTES (SAAS ISOLATED)
// ======================================================

// GET: Fetch ALL students belonging ONLY to logged-in owner
app.get('/api/students', verifyToken, async (req, res) => {
    try {
        const students = await Student.find({ ownerId: req.ownerId }).sort({ createdAt: -1 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Create a student tied directly to logged-in owner
app.post('/api/students', verifyToken, async (req, res) => {
    try {
        const newStudent = new Student({
            ...req.body,
            ownerId: req.ownerId 
        });
        const saved = await newStudent.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH: Toggle Dues Status
app.patch('/api/students/:id/dues', verifyToken, async (req, res) => {
    try {
        const student = await Student.findOne({ _id: req.params.id, ownerId: req.ownerId });
        if (!student) return res.status(404).json({ error: 'Student record not found' });

        student.duesStatus = student.duesStatus === 'Paid' ? 'Pending' : 'Paid';
        await student.save();
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Checkout / Remove student
app.delete('/api/students/:id', verifyToken, async (req, res) => {
    try {
        const deleted = await Student.findOneAndDelete({ _id: req.params.id, ownerId: req.ownerId });
        if (!deleted) return res.status(404).json({ error: 'Student record not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all single page application routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ======================================================
//                 SERVER ENTRYPOINT
// ======================================================
const PORT = process.env.PORT || 3000;

// Only bind to local port if running in terminal. Skip if Vercel serverless import!
if (require.main === module) {
    app.listen(PORT, () => console.log(`🚀 Local Server live on http://localhost:${PORT}`));
}

module.exports = app;
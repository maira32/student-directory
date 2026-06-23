const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const cors = require('cors');

app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5500',   // if you use Live Server
        'https://https://student-directory-nu.vercel.app/',  // ← replace with your actual URL
    ],
    credentials: true
}));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ======================================================
//    SERVERLESS MONGODB CONNECTION ENGINE
// ======================================================
async function connectToDatabase() {
    if (mongoose.connection.readyState >= 1) return;
    
    await mongoose.connect(process.env.MONGODB_URI, {
        family: 4, 
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
    });
}

// ======================================================
//                 BLUEPRINTS (SCHEMAS)
// ======================================================
const ownerSchema = new mongoose.Schema({
    hostelName: { type: String, required: true },
    ownerName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}, { timestamps: true });

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
    if (!token) return res.status(401).json({ error: 'Access Denied' });

    jwt.verify(token, process.env.JWT_SECRET || 'fallback', (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.ownerId = decoded.id; 
        next(); 
    });
};

// ======================================================
//                 API ROUTES
// ======================================================

app.post('/api/auth/register', async (req, res) => {
    try {
        await connectToDatabase();
        const { hostelName, ownerName, email, password } = req.body;
        const existing = await Owner.findOne({ email });
        if (existing) return res.status(400).json({ error: 'Email already registered' });

        // Change your bcrypt line to this:
        const saltRounds = process.env.NODE_ENV === 'production' ? 8 : 10;
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newOwner = new Owner({ hostelName, ownerName, email, password: hashedPassword });
        const saved = await newOwner.save();
        const token = jwt.sign({ id: saved._id }, process.env.JWT_SECRET || 'fallback', { expiresIn: '7d' });

        res.status(201).json({ owner: saved, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        await connectToDatabase();
        const { email, password } = req.body;
        const owner = await Owner.findOne({ email });
        if (!owner) return res.status(404).json({ error: 'Account not found' });
        const isMatch = await bcrypt.compare(password, owner.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid password' });
        const token = jwt.sign({ id: owner._id }, process.env.JWT_SECRET || 'fallback', { expiresIn: '7d' });
        res.json({ owner, token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students', verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        const students = await Student.find({ ownerId: req.ownerId }).sort({ createdAt: -1 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/students', verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        const newStudent = new Student({ ...req.body, ownerId: req.ownerId });
        const saved = await newStudent.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all for SPA
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Entrypoint
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Live on http://localhost:${PORT}`));
}

module.exports = app;

// TOGGLE DUES
app.patch('/api/students/:id/dues', verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        const student = await Student.findOne({ 
            _id: req.params.id, 
            ownerId: req.ownerId  // security: can't touch other owner's residents
        });
        if (!student) return res.status(404).json({ error: 'Resident not found' });
        
        student.duesStatus = student.duesStatus === 'Paid' ? 'Pending' : 'Paid';
        await student.save();
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE RESIDENT
app.delete('/api/students/:id', verifyToken, async (req, res) => {
    try {
        await connectToDatabase();
        const deleted = await Student.findOneAndDelete({ 
            _id: req.params.id, 
            ownerId: req.ownerId  // security: can't delete other owner's residents
        });
        if (!deleted) return res.status(404).json({ error: 'Resident not found' });
        res.json({ message: 'Resident checked out successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/health', async (req, res) => {
    const dbState = ['disconnected','connected','connecting','disconnecting'];
    res.json({
        status: 'ok',
        mongoUriSet: !!process.env.MONGODB_URI,
        jwtSecretSet: !!process.env.JWT_SECRET,
        dbState: dbState[mongoose.connection.readyState],
        nodeEnv: process.env.NODE_ENV,
        time: new Date().toISOString()
    });
});
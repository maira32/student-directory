const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Wake up the .env file
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. CONNECT TO MONGODB
mongoose.connect(process.env.MONGODB_URI, {
    family: 4, // <-- THE MAGIC TRICK: Forces Node to use standard IPv4
    serverSelectionTimeoutMS: 5000
})

  .then(() => console.log('🟢 MongoDB Atlas Connected Successfully!'))
  .catch(err => console.error('🔴 MongoDB Connection Failed:', err));

// 2. DEFINE THE BLUEPRINT (Mongoose Schema)
const studentSchema = new mongoose.Schema({
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

// Magic trick: MongoDB calls IDs "_id", but your frontend app.js looks for ".id". 
// This automatically duplicates "_id" into "id" whenever we send data to the browser.
studentSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

const Student = mongoose.model('Student', studentSchema);

// ==========================================
//                 API ROUTES
// ==========================================

// GET: Fetch all students
app.get('/api/students', async (req, res) => {
    try {
        const students = await Student.find().sort({ createdAt: -1 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Create a new student
app.post('/api/students', async (req, res) => {
    try {
        const newStudent = new Student(req.body);
        const saved = await newStudent.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PATCH: Toggle Dues (Paid <-> Pending)
app.patch('/api/students/:id/dues', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        student.duesStatus = student.duesStatus === 'Paid' ? 'Pending' : 'Paid';
        await student.save();
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Remove student
app.delete('/api/students/:id', async (req, res) => {
    try {
        await Student.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all to give index.html to the browser
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server live on http://localhost:${PORT}`));
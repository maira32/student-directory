const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataFile = path.join(__dirname, 'data.json');

const readData = () => {
    if (!fs.existsSync(dataFile)) return [];
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
};

const writeData = (data) => {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
};

// GET all students
app.get('/api/students', (req, res) => {
    res.json(readData());
});

// GET dashboard stats (counts everything up for the dashboard cards)
app.get('/api/stats', (req, res) => {
    const students = readData();

    let allocated = 0;
    let pendingArrival = 0;
    let vacating = 0;
    let duesPendingCount = 0;
    let duesPendingTotal = 0;
    let messCount = 0;

    for (const s of students) {
        if (s.status === 'Allocated') allocated++;
        if (s.status === 'Pending') pendingArrival++;
        if (s.status === 'Vacating') vacating++;

        if (s.duesStatus === 'Pending') {
            duesPendingCount++;
            duesPendingTotal += Number(s.duesAmount) || 0;
        }

        if (s.messPlan && s.messPlan !== 'No Mess') messCount++;
    }

    res.json({
        totalResidents: students.length,
        allocated,
        pendingArrival,
        vacating,
        duesPendingCount,
        duesPendingTotal,
        messCount
    });
});

// POST add a new student
app.post('/api/students', (req, res) => {
    // grabbing all the fields from the form
    const { name, email, phone, major, address, room, status, duesAmount, messPlan } = req.body;

    // basic validation, all the main fields are required
    if (!name || !email || !phone || !major || !address || !room || !status || !messPlan) {
        return res.status(400).json({ error: 'All personal and hostel fields are required' });
    }
    if (!email.includes('@') || !email.includes('.')) {
        return res.status(400).json({ error: 'Invalid email address format' });
    }

    // dues amount is optional on the form, default to 0 if nothing was typed
    const parsedDues = duesAmount === undefined || duesAmount === '' ? 0 : Number(duesAmount);
    if (isNaN(parsedDues) || parsedDues < 0) {
        return res.status(400).json({ error: 'Dues amount must be a valid positive number' });
    }

    const students = readData();
    const newStudent = {
        id: students.length > 0 ? students[students.length - 1].id + 1 : 1,
        name, email, phone, major, address, room, status,
        duesAmount: parsedDues,
        duesStatus: 'Pending', // new resident, dues start as pending until they pay
        messPlan
    };

    students.push(newStudent);
    writeData(students);
    res.status(201).json(newStudent);
});

// PATCH toggle a student's dues between Paid / Pending (the "mark as paid" button)
app.patch('/api/students/:id/dues', (req, res) => {
    const students = readData();
    const student = students.find(s => s.id === parseInt(req.params.id));

    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }

    student.duesStatus = student.duesStatus === 'Paid' ? 'Pending' : 'Paid';
    writeData(students);
    res.json(student);
});

app.delete('/api/students/:id', (req, res) => {
    let students = readData();
    students = students.filter(s => s.id !== parseInt(req.params.id));
    writeData(students);
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => console.log('Server active on port 3000'));
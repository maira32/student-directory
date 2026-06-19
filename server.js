const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const dataFile = path.join(__dirname, 'data.json');

const readData = () => {
    if (!fs.existsSync(dataFile)) return [];
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
};

const writeData = (data) => {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
};

app.get('/api/students', (req, res) => {
    res.json(readData());
});

app.post('/api/students', (req, res) => {
    const { name, email, phone, major, address } = req.body;

    if (!name || !email || !phone || !major || !address) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    if (!email.includes('@') || !email.includes('.')) {
        return res.status(400).json({ error: 'Invalid email address format' });
    }
    if (!/^\+?[\d\s-]+$/.test(phone)) {
        return res.status(400).json({ error: 'Phone number contains invalid characters' });
    }

    const students = readData();
    const newStudent = {
        id: students.length > 0 ? students[students.length - 1].id + 1 : 1,
        name, email, phone, major, address
    };

    students.push(newStudent);
    writeData(students);
    res.status(201).json(newStudent);
});

app.delete('/api/students/:id', (req, res) => {
    let students = readData();
    students = students.filter(s => s.id !== parseInt(req.params.id));
    writeData(students);
    res.json({ success: true });
});

app.listen(3000, () => console.log('Server active on port 3000'));
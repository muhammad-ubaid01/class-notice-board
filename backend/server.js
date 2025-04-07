// server.js

const express = require('express');
const cors = require('cors');
const pool = require('./db');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();


app.use(express.json());
app.use(cors());

// Serve static files from "../frontend" relative to server.js
app.use(express.static(path.join(__dirname, '../frontend')));


// Example route (optional)
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});



// Middleware: Verify JWT token
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader)
    return res.status(401).json({ error: 'No token provided' });
  
  const token = authHeader.split(' ')[1];
  if (!token)
    return res.status(401).json({ error: 'No token provided' });
  
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(403).json({ error: 'Failed to authenticate token' });
    req.user = decoded; // contains { id, role }
    next();
  });
}

// Route: User login (using plain text password comparison)
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid username or password" });
    }
    const user = userResult.rows[0];
    // Directly compare plain text passwords
    if (password !== user.password) {
      return res.status(400).json({ error: "Invalid username or password" });
    }
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token, role: user.role, id: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Route: Get all notices (for authenticated users)
// Modified so that if the user is a teacher, they only see notices posted by admin or by themselves.
app.get('/api/notices', verifyToken, async (req, res) => {
  try {
    let query = "";
    let params = [];
    if (req.user.role === 'teacher') {
      // Teacher: only view notices posted by admin or by himself.
      query = `
        SELECT n.*, u.username AS poster_name, u.role AS poster_role 
        FROM notices n
        LEFT JOIN users u ON n.teacher_id = u.id
        WHERE u.role = 'admin' OR n.teacher_id = $1
        ORDER BY n.date DESC;
      `;
      params = [req.user.id];
    } else {
      // Admin or student: view all notices.
      query = `
        SELECT n.*, u.username AS poster_name, u.role AS poster_role 
        FROM notices n
        LEFT JOIN users u ON n.teacher_id = u.id
        ORDER BY n.date DESC;
      `;
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Route: Add notice (allowed for teacher and admin)
app.post('/api/notices', verifyToken, async (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const { title, content } = req.body;
  try {
    await pool.query(
      "INSERT INTO notices (title, content, teacher_id) VALUES ($1, $2, $3)",
      [title, content, req.user.id]
    );
    res.json({ message: "Notice added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Route: Delete notice (teacher can delete only their own; admin can delete any)
app.delete('/api/notices/:id', verifyToken, async (req, res) => {
  const noticeId = req.params.id;
  try {
    const noticeResult = await pool.query("SELECT * FROM notices WHERE id = $1", [noticeId]);
    if (noticeResult.rows.length === 0) {
      return res.status(404).json({ error: "Notice not found" });
    }
    const notice = noticeResult.rows[0];
    if (req.user.role === 'teacher' && notice.teacher_id !== req.user.id) {
      return res.status(403).json({ error: "Teachers can only delete their own notices" });
    }
    await pool.query("DELETE FROM notices WHERE id = $1", [noticeId]);
    res.json({ message: "Notice deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Route: Admin adds new user (teacher or student)
app.post('/api/users', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Only admin can add users" });
  }
  const { username, password, role } = req.body;
  if (!['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  try {
    const userExists = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }
    // Using plain text password; do not hash it (NOT recommended for production)
    await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
      [username, password, role]
    );
    res.json({ message: "User added successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Route: Admin deletes old notices (older than 30 days)
app.delete('/api/notices/old', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Only admin can delete old notices" });
  }
  try {
    const result = await pool.query(`DELETE FROM notices WHERE "date" < (NOW() - INTERVAL '10 days')`);
    if (result.rowCount === 0) {
      res.json({ message: "No old notices exist." });
    } else {
      res.json({ message: `Old notices deleted successfully. ${result.rowCount} notices removed.` });
    }
  } catch (err) {
    console.error("Error deleting old notices:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


// For any other route, serve index.html so client-side routing (if any) works
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});


const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config', '.env') });
const mysql = require('mysql');
const express = require('express');
const app = express();

// Create a connection pool to manage database connections
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Adjust this value based on your needs
  queueLimit: 0,
});

// Test the database connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
  } else {
    console.log('Connected to MySQL database');
    connection.release();
  }
});

// Your routes and controllers here

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});

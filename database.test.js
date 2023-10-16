const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config', '.env') });
const mysql = require('mysql2/promise'); // Use mysql2/promise for async/await

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME,
};

describe('MySQL Database Connection', () => {
  test('Should connect to the MySQL database', async () => {
    try {
      const connection = await mysql.createConnection(dbConfig);

      // The following line will throw an error if the connection fails
      await connection.connect();
      
      console.log('Connected to MySQL');
      
      // Close the connection
      await connection.end();
    } catch (error) {
      console.error('Error connecting to MySQL:', error);
      throw error; // Re-throw the error to make the test fail
    }
  });
});

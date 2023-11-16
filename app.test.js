const request = require('supertest');
const app = require('./server'); // Adjust the path to where your Express app is defined


// Login Tests
describe('POST /login', () => {
    test('It responds with the user data for valid credentials', async () => {
        const response = await request(app)
            .post('/login')
            .send({
                voterID: '862278',
                password: 'test1234'
            });
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('user');
        // Add more expectations based on your application logic
    });

    test('It responds with an error for invalid credentials', async () => {
        const response = await request(app)
            .post('/login')
            .send({
                voterID: 'invalidVoterID',
                password: 'invalidPassword'
            });
        expect(response.statusCode).toBe(401); // or another relevant status code
        // Add more expectations based on your application logic
    });
});

// Registration tests
describe('POST /register', () => {
    test('It responds with the newly created user', async () => {
        const userData = {
            voter_id: "12345",    // Unique identifier for the voter
            first_name: "John",
            middle_name: "Doe",
            last_name: "Smith",
            age: 30,
            address: "123 Main St",
            city: "Anytown",
            state: "iowa",
            zip: "12345",
            email: "john.doe@example.com",
            driving_lic: "D1234567", // Driving license number, if applicable
            passport: null,   // Passport number, if applicable
            role: "VO",             // Role (e.g., Voter, Admin)
            status: "APR",          // Status (e.g., Approved, Pending)
            password: "hashedPassword123", // This should be a hashed password
            d_usr_create: "2023-11-13 12:00:00" // Date of user creation or registration
        };
        
        const response = await request(app)
            .post('/register')
            .send(newUser);
        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('voterId');
        // Add more expectations based on your application logic
    });

    test('It fails to create a user with existing email', async () => {
        const existingUser = {
            // Provide data for a user that already exists in the database
            // ...
        };
        const response = await request(app)
            .post('/register')
            .send(existingUser);
        expect(response.statusCode).toBe(400); // or another relevant status code
        // Add more expectations based on your application logic
    });
});

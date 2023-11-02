const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require('uuid');
const { name } = require("ejs");
const { add } = require("nodemon/lib/rules");
const mysql = require('mysql');
const session = require('express-session');
const flash = require('connect-flash');

require("dotenv").config()
const DB_HOST = process.env.DB_HOST
const DB_USER = process.env.DB_USER
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_DATABASE = process.env.DB_DATABASE
const DB_PORT = process.env.DB_PORT

//DB Connection
const db = mysql.createPool({
   connectionLimit: 100,
   host: DB_HOST,       //This is your localhost IP
   user: DB_USER,         // "newuser" created in Step 1(e)
   password: DB_PASSWORD,  // password for the new user
   database: DB_DATABASE,      // Database name
   port: DB_PORT             // port name, "3306" by default
});

//DB Connection check
db.getConnection( (err, connection)=> {
   if (err) throw (err)
   const port = process.env.PORT
   app.listen(port, () => console.log(`Server Started on port ${port}...`));

});

app.set('view engine', 'ejs');

//app.use(express.json());
app.use(express.urlencoded({extended: false}));

//Logic to display flash messages on Login screen
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

app.use(flash());

//Register new user logic
app.post("/register", async (req, res) => {
    
        const userName = req.body.name;
        const age = req.body.age;
        const address = req.body.address;
        const zip = req.body.zip;
        const drLic = req.body.driving;
        const passport = req.body.passport;
        const email = req.body.email;
        console.log(`password = ${req.body.password}`);
        console.log(`Name = ${req.body.name}`);
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const randomUUID = uuidv4();
        const randomID = parseInt(randomUUID.slice(0, 5), 16);
        console.log ("in /register Post");
        


        db.getConnection( async (err, connection) => {
            if(err) throw (err)
            const sqlInsert = "INSERT INTO users (voter_id, name, Password, age, address, zip, driving_lic, passport, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            const insert_query = mysql.format(sqlInsert,[randomID, userName, hashedPassword, age, address, zip, drLic, passport, email]);
            await connection.query (insert_query, (err, result)=> {
                connection.release()
                if (err) throw (err)
                console.log ("--------> Created new User")
                console.log(result.insertId)
                //res.sendStatus(201)
            })
        })

        res.render('register-success', { voterId: randomID });

})


//Login user logic, auth
app.post("/login", async (req, res) => {
    const voter_id = req.body.voterID;
    const password = req.body.password;
    console.log(`Voter ID = ${voter_id}`)

    db.getConnection( async (err, connection) => {
        if (err) throw (err)
        const sqlSearch = "Select * from users where voter_id = ?"
        const search_query = mysql.format(sqlSearch,[voter_id]);

        await connection.query (search_query, async (err, result) => {
            connection.release()
            console.dir(result, { depth: null });
            
            if (err) throw (err)
            if (result.length == 0) {
                console.log("--------> User does not exist")
                //Logic to show error in case of incorrect voter ID
                req.flash('error', 'No voter ID found');
                res.redirect('/login');
                
            } else {
                const hashedPassword = result[0].Password;
                //get the hashedPassword from result
               if (await bcrypt.compare(password, hashedPassword)) {
               console.log("---------> Login Successful")
               res.send(`${result[0].name} is logged in!`)
               } else {
               console.log("---------> Password Incorrect")
               //Logic to show error in case of incorrect password
               req.flash('error', 'Incorrect password');
               res.redirect('/login');
               } 
            }
        })

    })

})

//routes
app.get("/", (req, res) => {
    res.render("index.ejs");
})


app.get("/login", (req, res) => {
    res.render("login.ejs", { messages: { error: req.flash('error') } });
    //res.render("login.ejs");
})

app.get("/register", (req, res) => {
    res.render("register.ejs");
})
//end


app.listen(4000);
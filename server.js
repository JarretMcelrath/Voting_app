const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require('uuid');
const { name } = require("ejs");
const { add } = require("nodemon/lib/rules");
const mysql = require('mysql');
const session = require('express-session');
const flash = require('connect-flash');
const { format } = require('date-fns');
const nodemailer = require('nodemailer');

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


//Logic to display flash messages on Login screen and save user session
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(flash());




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
               req.session.user = result[0];
               //res.send(`${result[0].name} is logged in!`)
               if (result[0].role === 'AD') {
                    res.redirect('/admin'); // Redirect to admin page
                } else if (result[0].role === 'VO'){
                    if(result[0].status === 'APR'){
                        res.redirect('/userPannel');
                    }else{
                        res.send('Your request is not yet approved.');
                    }
                } else {
                    
                } 
                    
               } else {
               console.log("---------> Password Incorrect")
               //Logic to show error in case of incorrect password
               req.flash('error', 'Incorrect password');
               res.redirect('/login');
               } 
            }
        })

    })

});

//Register new user logic
app.post("/register", async (req, res) => {
    
    const userName = req.body.name;
    const age = req.body.age;
    const address = req.body.address;
    const zip = req.body.zip;
    let drLic = null
    let passport = null
    console.dir(req.body, { depth: null });
    if (req.body.documentType === 'license'){
        drLic = req.body.driving;
    } else{
        passport = req.body.passport
    }
    const email = req.body.email;
    // console.log(`password = ${req.body.password}`);
    // console.log(`Name = ${req.body.name}`);
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const randomUUID = uuidv4();
    const randomID = parseInt(randomUUID.slice(0, 5), 16);
    const currentDateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const role = 'VO';
    const status = 'PEN';
    console.log ("in /register Post");
    


    db.getConnection( async (err, connection) => {
        if(err) throw (err)
        const sqlInsert = "INSERT INTO user (voter_id, name, age, address, zip, driving_lic, passport, email, d_usr_create, role, status, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        const insert_query = mysql.format(sqlInsert,[randomID, userName, age, address, zip, drLic, passport, email, currentDateTime, role, status, hashedPassword]);
        await connection.query (insert_query, (err, result)=> {
            connection.release()
            if (err) throw (err)
            console.log ("--------> Created new User")
            console.log(result.insertId)
            res.render('register-success', { voterId: randomID });
            //res.sendStatus(201)
        })
    })

    

})

app.get("/admin", async (req, res) => {
    // Fetch the user data from your database
    const users = await getTempUsersData();
    console.dir(users, { depth: null });
    console.log(`Result Length = ${users.length}`);

    // Render the adminPannel view and pass the users data to it
    res.render("adminPannel", { users: users });
});

app.get("/userPannel", (req, res) => {
    // Fetch the user data from your database
    const user = req.session.user;
    console.dir(user, { depth: null });
    // Render the adminPannel view and pass the users data to it
    res.render("voterPannel", { user: user });
});


app.post('/approveUser', async (req, res) => {
    const voter_id = req.body.voterId;

    // Update the user's status in the database
    await approveUserInDatabase(voter_id);

    // Get the user's email from the database
    const userEmail_voter_ID = await getUserEmailFromDatabase(voter_id);
    console.dir(userEmail_voter_ID, { depth: null });


    console.log(`Email = ${userEmail_voter_ID[0].email} and voter ID = ${userEmail_voter_ID[0].voter_id}`);
    console.log(`Email = ${process.env.EMAIL_ADDRESS} and password = ${process.env.EMAIL_PASSWORD}`)

   
    let transporter = nodemailer.createTransport({
        host: 'smtp.zoho.com',
        secure: true,
        port: 465,
        auth: {
            user: process.env.EMAIL_ADDRESS,
            pass: process.env.EMAIL_PASSWORD
        },
      });

    const mailOptions = {
        from: 'voupdates@yahoo.com',
        to: userEmail_voter_ID[0].email,
        subject: 'Your account has been approved',
        html: `<h3>Hi ${req.body.userName} </h3><br>
        <p>Your account has been approved<h4><br>Your Voter ID is:${req.body.voterId}, You can now login and Vote..</b></h4></p>`,
        //text: 'Congratulations, your account has been approved!'
    };

    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });

    res.sendStatus(200);
});

app.get("/logout", (req, res) => {
    req.session.destroy(err => {
        if(err) {
            return res.redirect('/userPannel');
        }
        //res.clearCookie('sid');
        res.redirect('/login');
    });
});

app.get("/yourInfo", (req, res) => {
    const userDetails = req.session.user;
    res.render("editUserInfo", { userDetails: userDetails, messages: { success: req.flash('success') } });
});

app.post("/updateUser", async (req, res) => {
    const { name, age, address, zip, driving, passport, email } = req.body;
    const userDetails = req.session.user;

    db.getConnection(async (err, connection) => {
        if (err) throw err;

        const sqlUpdate = "UPDATE users SET name = ?, age = ?, address = ?, zip = ?, driving_lic = ?, passport = ?, email = ? WHERE voter_id = ?";
        const update = mysql.format(sqlUpdate, [name, age, address, zip, driving, passport, email, userDetails.voter_id]);

        await connection.query(update, (err, result) => {
            // connection.release();
            if (err) throw err;

            console.log("User details updated");
            req.flash('success', 'Changes saved');
            
        });

        const sqlSearch = "SELECT * FROM users WHERE voter_id = ?";
        const search_query = mysql.format(sqlSearch, [userDetails.voter_id]);

        await connection.query(search_query, (err, result) => {
            connection.release();
            if (err) throw err;

            // Store the updated user details in the session
            req.session.user = result[0];
            res.redirect("/yourInfo");
        });
    });
});

//routes
app.get("/", (req, res) => {
    res.render("index.ejs");
});


app.get("/login", (req, res) => {
    res.render("login.ejs", { messages: { error: req.flash('error') } });
    //res.render("login.ejs");
});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});
//end


//functions
function getTempUsersData(){
    return new Promise((resolve, reject) => {
        db.getConnection((err, connection) => {
            if (err) reject(err);
            const sqlSearch = "Select * from users where role = ? and status = ?";
            const update = mysql.format(sqlSearch,['VO', 'PEN']);

            connection.query(update, (err, result) => {
                connection.release();
                if (err) reject(err);

                resolve(result);
            });
        });
    });
}

function approveUserInDatabase(voter_id){
    return new Promise( async (resolve, reject) => {
        //const singleTempUser = await getSingleTempUsersData(voter_id);

        db.getConnection(async (err, connection) => {
            if (err) reject(err);
            const sqlMainTableUpdate = "UPDATE users SET status = ? where voter_id = ?";
            const insert = mysql.format(sqlMainTableUpdate,['APR', voter_id]);
            
            // const tempUserDelete = "DELETE FROM temp_user WHERE voter_id = ?";
            // const tempUsrDel = mysql.format(tempUserDelete,[voter_id]);
            
            await connection.query (insert, (err, result)=> {
                // connection.release()
                if (err) reject(err);
                console.log ("USER TABLE UPDATED")
            })

            // await connection.query (tempUsrDel, (err, result)=> {
            //     connection.release()
            //     if (err) reject(err);
            //     console.log ("user deleted in temp table");

            // })
            resolve();
        });
    });
}

function getUserEmailFromDatabase(voterID){
    return new Promise((resolve, reject) => {
        console.log(`inside getUser Voter ID = ${voterID}`);
        db.getConnection(async (err, connection) => {
            if (err) reject(err);
            const sqlQuery = "select email, voter_id from users where voter_id = ?";
            const query = mysql.format(sqlQuery,[voterID]);

            await connection.query (query, (err, result)=> {
                connection.release()
                if (err) reject(err);
                //console.log ("user Approved")
                resolve(result);
            })
        });
    });
}

function getSingleTempUsersData(voter_id){
    return new Promise((resolve, reject) => {
        db.getConnection((err, connection) => {
            if (err) reject(err);
            const sqlSearch = "Select * from temp_user where voter_id = ?";
            const update = mysql.format(sqlSearch,[voter_id]);

            connection.query(update, (err, result) => {
                connection.release();
                if (err) reject(err);
                console.log(`inside singleuser Method Voter id = ${voter_id}`);

                resolve(result);
            });
        });
    });
}

app.listen(4000);
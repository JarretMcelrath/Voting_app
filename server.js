const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { name } = require("ejs");
const { add } = require("nodemon/lib/rules");
const mysql = require("mysql");
const session = require("express-session");
const flash = require("connect-flash");
const { format } = require("date-fns");
const nodemailer = require("nodemailer");
const ExpressError = require("./utils/ExpressError");
const catrchAsync = require("./utils/catrchAsync");
//const crypto = require('crypto');

require("dotenv").config();
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_DATABASE = process.env.DB_DATABASE;
const DB_PORT = process.env.DB_PORT;

//DB Connection
const db = mysql.createPool({
  connectionLimit: 100,
  host: DB_HOST, //This is your localhost IP
  user: DB_USER, // "newuser" created in Step 1(e)
  password: DB_PASSWORD, // password for the new user
  database: DB_DATABASE, // Database name
  port: DB_PORT, // port name, "3306" by default
});

//DB Connection check
db.getConnection((err, connection) => {
  if (err) throw err;
  const port = process.env.PORT;
  app.listen(port, () => console.log(`Server Started on port ${port}...`));
});

app.set("view engine", "ejs");

//app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

//Logic to display flash messages on Login screen and save user session
app.use(
  session({
    secret: "secret",
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(flash());

//Login user logic, auth
app.post("/login", async (req, res) => {
  const voter_id = req.body.voterID;
  const password = req.body.password;
  console.log(`Voter ID = ${voter_id}`);

  db.getConnection(async (err, connection) => {
    if (err) throw err;
    const sqlSearch = "Select * from users where voter_id = ?";
    const search_query = mysql.format(sqlSearch, [voter_id]);

    await connection.query(search_query, async (err, result) => {
      connection.release();
      console.dir(result, { depth: null });

      if (err) throw err;
      if (result.length == 0) {
        console.log("--------> User does not exist");
        //Logic to show error in case of incorrect voter ID
        req.flash("error", "No voter ID found");
        res.redirect("/login");
      } else {
        const hashedPassword = result[0].Password;
        //get the hashedPassword from result
        if (await bcrypt.compare(password, hashedPassword)) {
          console.log("---------> Login Successful");
          req.session.user = result[0];
          //res.send(`${result[0].name} is logged in!`)
          if (result[0].role === "AD") {
            res.redirect("/admin"); // Redirect to admin page
          } else if (result[0].role === "VO") {
            if (result[0].status === "APR") {
              res.redirect("/userPannel");
            } else {
              res.send("Your request is not yet approved.");
            }
          } else {
          }
        } else {
          console.log("---------> Password Incorrect");
          //Logic to show error in case of incorrect password
          req.flash("error", "Incorrect password");
          res.redirect("/login");
        }
      }
    });
  });
});

//Register new user logic
app.post("/register", catrchAsync(async (req, res) => {
  console.log(req.body);

  const firstName = req.body.first_name;
  const middleName = req.body.middle_name || ""; // Default to empty string if not provided
  const lastName = req.body.last_name;
  const age = req.body.age;
  const address = req.body.address;
  const city = req.body.city;
  const state = req.body.state;
  const zip = req.body.zip;
  let drLic = null;
  let passport = null;
  console.dir(req.body, { depth: null });
  if (req.body.documentType === "license") {
    drLic = req.body.driving;
  } else {
    passport = req.body.passport;
  }
  const email = req.body.email;
  console.log(email);
  // console.log(`password = ${req.body.password}`);
  // console.log(`Name = ${req.body.name}`);
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const randomUUID = uuidv4();
  const randomID = parseInt(randomUUID.slice(0, 5), 16);
  const currentDateTime = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  const role = "VO";
  const status = "PEN";
  console.log("in /register Post");

  // check if user is already registered
  const emailCheckQuery = "SELECT * FROM users WHERE email = ?";
  const emailCheckSql = mysql.format(emailCheckQuery, [email]);

  db.getConnection(async (err, connection) => {
    if (err) throw err;

    connection.query(emailCheckSql, async (err, results) => {
      if (err) {
        connection.release();
        throw err;
      }

      if (results.length > 0) {
        console.log("Email already registered.");
        res.json({ success: false, message: "Email already registered." });
        connection.release();
      } else {
        // Email does not exist, proceed with registration
        const sqlInsert =
          "INSERT INTO users (voter_id, first_name, middle_name, last_name, age, address, zip, city, state, driving_lic, passport, email, d_usr_create, role, status, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        const insert_query = mysql.format(sqlInsert, [
          randomID,
          firstName,
          middleName,
          lastName,
          age,
          address,
          zip,
          city,
          state,
          drLic,
          passport,
          email,
          currentDateTime,
          role,
          status,
          hashedPassword,
        ]);
        await connection.query(insert_query, (err, result) => {
          connection.release();
          if (err) throw err;
          console.log("--------> Created new User");
          console.log(result.insertId);
          res.json({ success: true, message: "Registration successful." });
        });
      }
    });
  });
}));

app.get("/admin", catrchAsync(async (req, res) => {
  // Fetch the user data from your database
  // console.log("Inside admin");
  // console.dir(req.session.user, {depth: null});
  const user_Details = req.session.user;

  if(user_Details.role === 'AD'){
  
  const users = await getTempUsersData();
  // console.dir(users, { depth: null });
  // console.log(`Result Length = ${users.length}`);

  // Render the adminPannel view and pass the users data to it
  res.render("adminPannel", { users: users });
  } else{
    throw new ExpressError("unauthorized Access", 401);
  }
}));

app.get("/userPannel", (req, res) => {
  // Fetch the user data from your database
  const user = req.session.user;
  console.dir(user, { depth: null });
  // Render the adminPannel view and pass the users data to it
  res.render("voterPannel", { user: user });
});

app.post("/approveUser", async (req, res) => {
  const voter_id = req.body.voterId;

  // Update the user's status in the database
  await approveOrDenyUserInDatabase(voter_id, "APR");

  // Get the user's email from the database
  const userEmail_voter_ID = await getUserEmailFromDatabase(voter_id);
  console.dir(userEmail_voter_ID, { depth: null });

  sendEmail(userEmail_voter_ID, "approve");

  res.sendStatus(200);
});

app.post("/denyUser", async (req, res) => {
  const voter_id = req.body.voterId;

  // Update the user's status in the database to 'DENIED'
  // You need to implement this function
  await approveOrDenyUserInDatabase(voter_id, "DEN");

  const userEmail_voter_ID = await getUserEmailFromDatabase(voter_id);

  sendEmail(userEmail_voter_ID, "deny");

  res.sendStatus(200);
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/userPannel");
    }
    //res.clearCookie('sid');
    res.redirect("/login");
  });
});

app.get("/yourInfo", (req, res) => {
  const userDetails = req.session.user;
  res.render("editUserInfo", { userDetails: userDetails, messages: { success: req.flash("success") } });
});

app.post("/updateUser", catrchAsync(async (req, res) => {
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
      req.flash("success", "Changes saved");
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
}));

// fogot password posts
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const token = crypto.randomBytes(20).toString("hex");
  const expireTime = Date.now() + 3600000; // 1 hour from now

  // Update the database with the reset token and expiry time
  // You need to add these fields in your users table or create a separate table for tokens
  db.getConnection(async (err, connection) => {
    if (err) throw err;
    const sql = "UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?";
    const updateQuery = mysql.format(sql, [token, expireTime, email]);

    await connection.query(updateQuery, (err, result) => {
      connection.release();
      if (err) throw err;

      // Send reset email
      const resetUrl = `http://localhost:3000/reset-password/${token}`;
      let transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        secure: true,
        port: 465,
        auth: {
          user: process.env.EMAIL_ADDRESS,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      const mailOptions = {
        from: "voupdates@yahoo.com", // Update this with your sending email address
        to: email, // The user's email
        subject: "Password Reset Request",
        html: `<h3>Hi, </h3><br>
                       <p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password. This link will expire in 1 hour.</p>`,
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
          res.json({ success: false, message: "Error sending email" });
        } else {
          console.log("Email sent: " + info.response);
          res.json({ success: true, message: "Password reset email sent" });
        }
      });
    });
  });
});

// Password reset route
app.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  db.getConnection(async (err, connection) => {
    if (err) throw err;
    const sql = "SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?";
    const query = mysql.format(sql, [token, Date.now()]);

    await connection.query(query, async (err, result) => {
      if (err || result.length === 0) {
        connection.release();
        res.json({ success: false, message: "Password reset token is invalid or has expired" });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const updateSql = "UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?";
      const updateQuery = mysql.format(updateSql, [hashedPassword, result[0].email]);

      await connection.query(updateQuery, (err, updateResult) => {
        connection.release();
        if (err) {
          res.json({ success: false, message: "Error resetting password" });
        } else {
          res.json({ success: true, message: "Password has been updated" });
        }
      });
    });
  });
});

// POST route to handle password update
app.post("/update-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body; // Assuming the new password field is named 'password'

  db.getConnection(async (err, connection) => {
    if (err) throw err;

    // Verify the token and its expiration
    const tokenQuery = "SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?";
    const query = mysql.format(tokenQuery, [token, Date.now()]);

    await connection.query(query, async (err, result) => {
      if (err || result.length === 0) {
        connection.release();
        // Token is invalid or expired
        res.status(400).send("Password reset token is invalid or has expired.");
        return;
      }

      // Token is valid, proceed with updating the password
      const hashedPassword = await bcrypt.hash(password, 10);
      const updateSql = "UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?";
      const updateQuery = mysql.format(updateSql, [hashedPassword, result[0].email]);

      await connection.query(updateQuery, (err, updateResult) => {
        connection.release();
        if (err) {
          res.status(500).send("Error updating password.");
        } else {
          res.send("Password has been successfully updated.");
        }
      });
    });
  });
});

//routes
app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs", { messages: { error: req.flash("error") } });
  //res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/forgot-password", (req, res) => {
  res.render("forgot-password.ejs");
});

app.get("/reset-password/:token", (req, res) => {
  const { token } = req.params;
  // Here, you can also optionally verify the token and its expiry before rendering the page

  // Render a view (EJS page) for password reset
  // Ensure you have a view named 'reset-password.ejs' in your views folder
  res.render("reset-password", { token });
});
//end

//functions
function getTempUsersData() {
  return new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) reject(err);
      const sqlSearch = "Select * from users where role = ? and status = ?";
      const update = mysql.format(sqlSearch, ["VO", "PEN"]);

      connection.query(update, (err, result) => {
        connection.release();
        if (err) reject(err);

        resolve(result);
      });
    });
  });
}

function approveOrDenyUserInDatabase(voter_id, status) {
  return new Promise(async (resolve, reject) => {
    //const singleTempUser = await getSingleTempUsersData(voter_id);

    db.getConnection(async (err, connection) => {
      if (err) reject(err);
      const sqlMainTableUpdate = "UPDATE users SET status = ? where voter_id = ?";
      const insert = mysql.format(sqlMainTableUpdate, [status, voter_id]);

      // const tempUserDelete = "DELETE FROM temp_user WHERE voter_id = ?";
      // const tempUsrDel = mysql.format(tempUserDelete,[voter_id]);

      await connection.query(insert, (err, result) => {
        // connection.release()
        if (err) reject(err);
        console.log("USER TABLE UPDATED");
      });
      resolve();
    });
  });
}

function getUserEmailFromDatabase(voterID) {
  return new Promise((resolve, reject) => {
    console.log(`inside getUser Voter ID = ${voterID}`);
    db.getConnection(async (err, connection) => {
      if (err) reject(err);
      const sqlQuery = "select email, voter_id, name from users where voter_id = ?";
      const query = mysql.format(sqlQuery, [voterID]);

      await connection.query(query, (err, result) => {
        connection.release();
        if (err) reject(err);
        //console.log ("user Approved")
        resolve(result);
      });
    });
  });
}

function getSingleTempUsersData(voter_id) {
  return new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) reject(err);
      const sqlSearch = "Select * from temp_user where voter_id = ?";
      const update = mysql.format(sqlSearch, [voter_id]);

      connection.query(update, (err, result) => {
        connection.release();
        if (err) reject(err);
        console.log(`inside singleuser Method Voter id = ${voter_id}`);

        resolve(result);
      });
    });
  });
}

function sendEmail(emailAndVoterID, decision) {
  let transporter = nodemailer.createTransport({
    host: "smtp.zoho.com",
    secure: true,
    port: 465,
    auth: {
      user: process.env.EMAIL_ADDRESS,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  let mailOptions;
  switch (decision) {
    case "approve":
      mailOptions = {
        from: "voupdates@yahoo.com",
        to: emailAndVoterID[0].email,
        subject: "Your account has been approved",
        html: `<h3>Hi ${emailAndVoterID[0].name} </h3><br>
                    <p>Your account has been approved<h4><br>Your Voter ID is: ${emailAndVoterID[0].voter_id}, You can now login and Vote.</b></h4></p>`,
      };
      break;
    case "deny":
      mailOptions = {
        from: "voupdates@yahoo.com",
        to: emailAndVoterID[0].email,
        subject: "Your account has not been approved",
        html: `<h3>Hi ${emailAndVoterID[0].name} </h3><br>
                    <p>Unfortunately, your account has not been approved. Please contact support for more information.</p>`,
      };
      break;
    default:
      console.log("Invalid decision");
      return;
  }

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

app.all("*", (req, res, next) => {
  next(new ExpressError("Page not found", 404));
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err;
  if (!err.message) err.message = "Oh No, Something Went Wrong";
  res.status(statusCode).render("error", { err });
  //res.send("Oh boy, something went wrong");
});

app.listen(4000);

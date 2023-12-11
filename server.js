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
app.post(
  "/register",
  catrchAsync(async (req, res) => {
    console.log(req.body);

    const firstName = req.body.first_name;
    const middleName = req.body.middle_name || ""; // Default to empty string if not provided
    const lastName = req.body.last_name;
    const age = req.body.age;
    const address = req.body.address;
    const city = req.body.city;
    const state = req.body.state;
    const zip = req.body.zip;
    const role = req.body.role;
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
  })
);

app.get(
  "/admin",
  catrchAsync(async (req, res) => {
    const users = await getTempUsersData();

    // Fetch the user data from your database
    // console.log("Inside admin");
    // console.dir(req.session.user, {depth: null});
    if (req.session.user != null) {
      // fetch user data
      const user_Details = req.session.user;
      // verify user is admin
      if (user_Details.role === "AD") {
        // console.dir(users, { depth: null });
        // console.log(`Result Length = ${users.length}`);

        // Render the adminPannel view and pass the users data to it
        res.render("adminPannel", { users: users });
      } else {
        res.render("403-error-page");
      }
    } else {
      res.render("403-error-page");
    }
  })
);

app.delete("/deleteUser/:voterId", (req, res) => {
  const voterId = req.params.voterId;

  db.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting DB connection:", err);
      return res.status(500).send("Server Error");
    }

    const deleteQuery = "DELETE FROM users WHERE voter_id = ?";
    const query = mysql.format(deleteQuery, [voterId]);

    connection.query(query, (err, result) => {
      connection.release();

      if (err) {
        console.error("Error executing delete query:", err);
        return res.status(500).send("Error deleting user");
      }

      console.log("Deleted user with voter ID:", voterId);
      res.status(200).send("User deleted successfully");
    });
  });
});

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

app.get("/editUserInfo/:voterId", async (req, res) => {
  const voterId = req.params.voterId;
  const status = "APR";

  db.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting DB connection:", err);
      return res.status(500).send("Server Error");
    }

    const sqlSearch = "SELECT * FROM users WHERE voter_id = ?";
    const search_query = mysql.format(sqlSearch, [voterId]);

    connection.query(search_query, (err, result) => {
      connection.release();

      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).send("Error fetching user data");
      }

      if (result.length === 0) {
        return res.status(404).send("User not found");
      }

      // Render editUserInfo view with the fetched user data
      res.render("editUserInfo", { userDetails: result[0], messages: {} });
    });
  });
});

app.get("/yourInfo", (req, res) => {
  if (req.session.user != null) {
    const user_details = req.session.user;
    if (user_details.role == "AD" || user_details.voterId == user_details.voterId) {
      const userDetails = req.session.user;
      res.render("editUserInfo", { userDetails: userDetails, messages: { success: req.flash("success") } });
    }
  } else {
    res.redirect("/login");
  }
});

app.post(
  "/updateUser",
  catrchAsync(async (req, res) => {
    const { voter_id, first_name, middle_name, last_name, age, address, zip, driving, passport, email } = req.body;
    let zipUpdate = null;
    const userDetails = req.session.user;
    console.log(
      `Voter ID = ${voter_id}, first name = ${first_name}, middle name = ${middle_name}, last name = ${last_name}, age = ${age}, address = ${address}, zip = ${zip}, driving = ${driving}, passport = ${passport} ,email = ${email}`
    );
    console.log(`Session ZIP = ${req.session.user.zip}`);
    if (req.session.user.zip !== zip) {
      zipUpdate = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    }

    db.getConnection(async (err, connection) => {
      if (err) throw err;

      const sqlUpdate =
        "UPDATE users SET first_name = ?, middle_name = ?, last_name = ?, age = ?, address = ?, zip = ?, driving_lic = ?, passport = ?, email = ?, d_zip_last_updt = ? WHERE voter_id = ?";
      const update = mysql.format(sqlUpdate, [first_name, middle_name, last_name, age, address, zip, driving, passport, email, zipUpdate, voter_id]);

      await connection.query(update, (err, result) => {
        // connection.release();
        if (err) throw err;

        console.log("User details updated");
        console.dir(result);
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
  })
);

// fogot password
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

// Setting up Polls
app.get("/getCandidates", (req, res) => {
  // SQL query to fetch candidates
  const query = "SELECT candidate_first_name, candidate_last_name, candidate_state, candidate_party FROM candidates";

  // Execute the query
  db.query(query, (error, results) => {
    if (error) {
      // Handle the error
      res.status(500).send("Error fetching candidates");
    } else {
      // Send results back to the client
      res.json(results);
    }
  });
});

app.get("/createPoll", (req, res) => {
  if (req.session.user != null) {
    // fetch user data
    const user_Details = req.session.user;
    // verify user is admin
    if (user_Details.role === "AD" || user_Details.role === "MG") {
      // console.dir(users, { depth: null });
      // console.log(`Result Length = ${users.length}`);

      // Render the adminPannel view and pass the users data to it
      res.render("createPoll");
    } else {
      res.render("403-error-page");
    }
  } else {
    res.render("403-error-page");
  }
});

// POST route to handle poll setup submission
app.post("/setuppoll", async (req, res) => {
  const { title, date, start_time, end_time, precincts, candidates } = req.body;
  const randomPollID = uuidv4();
  const pollID = parseInt(randomPollID.slice(0, 5), 16);
  console.log("Candidates string:", req.body.candidates);
  console.log("Precincts string:", req.body.precincts);
  console.log(`Start Time = ${start_time}`);
  console.log(`End Time = ${end_time}`);
  console.log(`Titel = ${title}`);
  console.log(`date  = ${date}`);

  try {
    // Parse the candidates and precincts JSON strings
    // Make sure they are being sent as valid JSON strings from the client-side
    // const parsedCandidates = JSON.parse(candidates);
    // const parsedPrecincts = JSON.parse(precincts);
    const parsedCandidates = candidates !== "NaN" ? JSON.parse(candidates) : [];
    const parsedPrecincts = precincts !== "NaN" ? JSON.parse(precincts) : [];
    // const candidatesObj = parsedCandidates.map((candidate, index) => ({ id: index + 1, name: candidate }));
    // const precinctsObj = parsedPrecincts.map((precinct, index) => ({ id: index + 1, name: precinct }));
    console.dir(parsedCandidates);
    console.dir(parsedPrecincts);

    // Insert data into the database
    db.getConnection(async (err, connection) => {
      const poll_title = title;
      const poll_date = date;

      let startDateandTime = new Date(`${poll_date}T${start_time}:00`);
      let endtDateandTime = new Date(`${poll_date}T${end_time}:00`);

      const sqlInsert_polls = "INSERT INTO polls (poll_id, title, poll_date, start_time, end_time, act_ind) VALUES (?, ?, ?, ?, ?, ?)";
      const poll_values = [pollID, poll_title, poll_date, startDateandTime, endtDateandTime, 'Y'];

      try {
        const results = await new Promise((resolve, reject) => {
          connection.query(sqlInsert_polls, poll_values, (error, results) => {
            if (error) {
              reject(error);
            } else {
              resolve(results);
            }
          });
        });
      } catch (error) {
        console.error("Error saving polls data:", error);
        res.status(500).send("Error saving polls data");
      }

      parsedCandidates.forEach(async (candidate) => {
        const { firstName, lastName, party, office } = candidate;
        const sqlInsert_candidate = "INSERT INTO candidates (poll_id, first_name, last_name, party, office) VALUES (?, ?, ?, ?, ?)";
        const values = [pollID, firstName, lastName, party, office];

        try {
          const results = await new Promise((resolve, reject) => {
            connection.query(sqlInsert_candidate, values, (error, results) => {
              if (error) {
                reject(error);
              } else {
                resolve(results);
              }
            });
          });
          console.log("Candidate data saved successfully:", results);
        } catch (error) {
          console.error("Error saving candidate data:", error);
          res.status(500).send("Error saving candidate data");
        }
      });

      parsedPrecincts.forEach(async (precinct) => {
        const { name, address, zipCode } = precinct;
        const sqlInsert_preinct = "INSERT INTO precincts (poll_id, name, address, zipcode) VALUES (?, ?, ?, ?)";
        const precinct_values = [pollID, name, address, zipCode];
        try {
          const results = await new Promise((resolve, reject) => {
            connection.query(sqlInsert_preinct, precinct_values, (error, results) => {
              if (error) {
                reject(error);
              } else {
                resolve(results);
                connection.release();
              }
            });
          });
          console.log("Candiprecinctdate data saved successfully:", results);
        } catch (error) {
          console.error("Error saving precinct data:", error);
          res.status(500).send("Error saving precinct data");
        }
      });
    });

    res.redirect("/admin");
  } catch (err) {
    console.error("Error parsing JSON data:", err);
    res.status(400).send("Invalid JSON data: " + err.message);
  }
});

app.get('/viewVotes', catrchAsync(async (req, res) => {
  let user_Details = req.session.user;
  let results = [];
  let votCheck = [];
  if(user_Details.status === 'APR' ){
    const sqlSelect_Votes = "select cd.poll_id, pt.name, cd.first_name, cd.last_name, cd.party, cd.office, pt.zipcode, p.start_time, p.end_time, cd.c_id from candidates cd join polls p on cd.poll_id = p.poll_id join precincts pt on pt.poll_id = p.poll_id where p.act_ind = 'Y' and pt.zipcode = ?";
    const select_Votes = mysql.format(sqlSelect_Votes, [user_Details.zip]);


    
    db.getConnection(async (err, connection) => {
      if (err) throw err;
      try {
        results = await new Promise((resolve, reject) => {
          connection.query(select_Votes, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });

        const { format, parseISO } = require('date-fns');
        results.forEach(result => {
          result.start_time = format(result.start_time, "yyyy-MM-dd HH:mm:ss");
          result.end_time = format(result.end_time, "yyyy-MM-dd HH:mm:ss");
        });

        console.log(results);
      
        user_Details.d_zip_last_updt = format(parseISO(user_Details.d_zip_last_updt), "yyyy-MM-dd HH:mm:ss");

        const sqlCheckvote = "select distinct user_id from record where poll_id = ?";
        const checkvoteValue = mysql.format(sqlCheckvote, [results[0].poll_id]);

        votCheck = await new Promise((resolve, reject) => {
          connection.query(checkvoteValue, (err, result) => {
            if (err) reject(err);
            resolve(result);
          });
        });


        if(user_Details.d_zip_last_updt >= results[0].start_time){
          res.send("You cannot vote because you changed your zip during the voting timeperiod.");
          
        } else if(votCheck[0]){
          res.send("You have already voted!!");
        } else {
            res.render("userVote", { results });
        }
      } catch (error) {
        console.error("Error fetching votes:", error);
        res.status(500).send("Error fetching votes");
      } finally {
        connection.release();
      }
    });
  } else {
    res.send("Your request is not yet approved, You cannot vote");
  }
}));

app.post('/voteCount/:c_id', catrchAsync(async (req, res) => {
  const { c_id } = req.params;
  const user_Details = req.session.user;
  let rep = [];
  console.log("Inside record vote");
  console.log(req.params);
  console.log(`Voted for ${c_id}`);


  db.getConnection(async (err, connection) => {
    const sqlSelect_Votes = "select p.poll_id from polls p join precincts pt on p.poll_id = pt.poll_id where pt.zipcode = ?";
    const select_Votes = mysql.format(sqlSelect_Votes, [user_Details.zip]);
    if (err) throw err;
      try {
        rep = await new Promise((resolve, reject) => {
          connection.query(select_Votes, (err, resu) => {
            if (err) reject(err);
            resolve(resu);
          });
        });

      } catch (error) {
        console.error("Error voting:", error);
        res.status(500).send("Error fetching votes");
      }
      console.log(rep);

    const recordQuery = "INSERT into record (poll_id, user_id) VALUES(? ,?)";
    const recordValues = [rep[0].poll_id, user_Details.voter_id];
    try {
      const results = await new Promise((resolve, reject) => {
        connection.query(recordQuery, recordValues, (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
          }
        });
      });
      console.log("record kept:", results);
    } catch (error) {
      console.error("Error recording the vote", error);
      res.status(500).send("Error");
    }

    const voteIncQuery = "UPDATE candidates SET vote_count = COALESCE(vote_count, 0) + 1 WHERE c_id = ?";
    const incValue = [c_id];
    try {
      const results = await new Promise((resolve, reject) => {
        connection.query(voteIncQuery, incValue, (error, results) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
            // connection.release();
          }
        });
      });
      console.log("vote recorded:", results);
      res.send("Your vote has been recorded, you have been logged out, please close this window!");
    } catch (error) {
      console.error("Error recording the vote", error);
      res.status(500).send("Error");
    }
    


  });
}));

//end

//functions
function getTempUsersData() {
  return new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) reject(err);
      const sqlSearch = "select * from users";
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
      const sqlQuery = "select email, voter_id, first_name from users where voter_id = ?";
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
        html: `<h3>Hi ${emailAndVoterID[0].first_name} </h3><br>
                    <p>Your account has been approved<h4><br>Your Voter ID is: ${emailAndVoterID[0].voter_id}, You can now login and Vote.</b></h4></p>`,
      };
      break;
    case "deny":
      mailOptions = {
        from: "voupdates@yahoo.com",
        to: emailAndVoterID[0].email,
        subject: "Your account has not been approved",
        html: `<h3>Hi ${emailAndVoterID[0].first_name} </h3><br>
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

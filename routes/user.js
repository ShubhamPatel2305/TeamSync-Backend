const express = require("express");
const router = express.Router();
const {User} = require("../db/index"); 
const { validateUserSignup, validateUserSignin } = require("../middlewares/UserMiddlewares");
const jwt = require("jsonwebtoken");
require('dotenv').config();

router.post("/signup", validateUserSignup, async (req, res) => {
    try {
        // Destructure the validated data from the request body
        const { name, email, password } = req.body;

        // Hash the password before storing it
        // You can use bcrypt or another library to hash the password
        const bcrypt = require("bcrypt");
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Create a new user instance
        const newUser = new User({
            name,
            email,
            password_hash,
            // Registration OTP will be generated by the schema's default value
        });

        // Save the user to the database
        await newUser.save();

        // Send a success response
        return res.status(201).json({
            message: "User registered successfully.",
            userId: newUser.id, // Return the user's ID or any other relevant information
        });
    } catch (error) {
        console.error("Error creating user:", error);
        return res.status(500).json({
            errors: ["Internal server error."],
        });
    }
});


router.post("/signin", validateUserSignin,(req,res)=>{
    // all checks done create a jwt token using user's email and send it in response 
    const { email, password } = req.body;
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "12h",
    });
    return res.json({
        message: "User signed in successfully.",
        token,
    });
})
module.exports = router;

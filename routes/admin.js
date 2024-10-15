// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const { Admin } = require("../db/index"); // Import the Admin model
const { validateAdminSignIn, tokenValidationAdmin } = require("../middlewares/AdminMiddlewares"); // Import the validation middleware
const { validateProjectApproval, approveProject, getAllProjects, getAllUsers } = require("../middlewares/AdminMiddlewares");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config();

// Define admin sign-in route
router.post("/signin", validateAdminSignIn, async (req, res) => {
    try {
        // Destructure the validated data from the request body
        const { email, password } = req.body;

        // Find the admin by email
        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(401).json({ errors: ["Admin not found."] });
        }

        // Compare the hashed password with the provided password
        const isMatch = await bcrypt.compare(password, admin.password_hash);

        if (!isMatch) {
            return res.status(401).json({ errors: ["Invalid password."] });
        }

        // Create a JWT token using the admin's email
        const token = jwt.sign({ email }, process.env.JWT_SECRET, {
            expiresIn: "12h",
        });

        return res.json({
            message: "Admin signed in successfully.",
            token,
        });
    } catch (error) {
        console.error("Error during admin sign-in:", error);
        return res.status(500).json({
            errors: ["Internal server error."],
        });
    }
});

// Additional routes can be defined here
router.post("/approve-project",tokenValidationAdmin, validateProjectApproval, approveProject);

// Route to get all users (excluding passwords) and their projects
router.get("/all_users",tokenValidationAdmin, getAllUsers);

// Route to get all projects and their details
router.get("/all_projects",tokenValidationAdmin, getAllProjects);


module.exports = router;


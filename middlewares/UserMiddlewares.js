const { z } = require('zod');
const {User} = require("../db/index"); // Ensure this points to your Mongoose User model

// Define a Zod schema for user signup validation
const userSignupSchema = z.object({
    name: z.string().min(1, { message: "Name is required." }),
    email: z.string().email({ message: "Invalid email format." }),
    password: z.string().min(8, { message: "Password must be at least 8 characters long." }),
    // Add any additional fields as necessary
});

// Middleware function for input validation and email uniqueness check
const validateUserSignup = async (req, res, next) => {
    try {
        // Validate the incoming request body against the Zod schema
        const result = userSignupSchema.safeParse(req.body);
        if (!result.success) {
            // Throw an error with the specific validation messages
            throw new Error(result.error.errors.map(err => err.message).join(', '));
        }

        // Check if a user with the same email already exists
        const { email } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                errors: ["A user with this email already exists."],
            });
        }

        // If validation passes and email is unique, call the next middleware
        next();
    } catch (error) {
        // If validation or email check fails, respond with the errors
        return res.status(400).json({
            errors: [error.message], // Ensure to return a single error message for clarity
        });
    }
};

module.exports = {
    validateUserSignup,
};

const { z } = require('zod');

// Define the Zod schema for admin sign-in
const AdminSignInSchema = z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
});

// Middleware function for validating admin sign-in inputs
const validateAdminSignIn = (req, res, next) => {
    try {
        // Validate the request body against the schema
        AdminSignInSchema.parse(req.body);
        next(); // Proceed to the next middleware/route handler if valid
    } catch (error) {
        // If validation fails, return an error response
        return res.status(400).json({ message: error.errors });
    }
};

module.exports = {
    validateAdminSignIn,
};

const { z } = require('zod');

// Define the Zod schema for admin sign-in
const AdminSignInSchema = z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(2, { message: 'Password must be at least 2 characters long' }),
});

// Define the Zod schema for project approval
const ProjectApprovalSchema = z.object({
    project_id: z.string().min(1, { message: 'Project ID is required' }),
    status: z.enum(['approved', 'rejected'], { message: 'Status must be either "approved" or "rejected"' }),
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

// Middleware function for validating project approval inputs
const validateProjectApproval = (req, res, next) => {
    try {
        // Validate the request body against the schema
        ProjectApprovalSchema.parse(req.body);
        next(); // Proceed to the next middleware/route handler if valid
    } catch (error) {
        // If validation fails, return an error response
        return res.status(400).json({ message: error.errors });
    }
};

// Middleware function to handle the project approval logic
const approveProject = async (req, res) => {
    try {
        const { project_id, status } = req.body;
        const { adminId } = req.user; // Extract admin ID from the authenticated user

        // Find the project by ID and update its approval status
        const project = await Project.findById(project_id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Create a new project approval record
        const newApproval = new ProjectApproval({
            project_id: project._id,
            admin_id: adminId,
            status,
        });
        await newApproval.save();

        // Update the project's approval status based on the admin's decision
        project.is_approved = status === 'approved';
        await project.save();

        return res.status(200).json({
            message: `Project has been ${status} successfully.`,
            approval: newApproval,
        });
    } catch (error) {
        console.error('Error during project approval:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    validateAdminSignIn,
    validateProjectApproval,
    approveProject,
};

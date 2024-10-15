const { z } = require('zod');
const { Project, ProjectApproval, User, ProjectUser, Admin } = require('../db/index'); // Import necessary models
const jwt = require('jsonwebtoken');

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

const tokenValidationAdmin=async(req,res, next)=>{
    try {
        const token = req.header('authorization');
        if (!token) {
            return res.status(401).json({ message: 'Token not found' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await Admin.findOne({ email: decoded.email });
        if (!admin) {
            return res.status(401).json({ message: 'Admin not found' });
        }
        req.user = { adminId: admin._id }; // Set the authenticated user in the request object
        next();
    } catch (error) {
        console.error('Error validating token:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
}

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, '-password_hash -registration_otp -reset_otp') // Fetch all users excluding the password field
            .lean(); // Use `lean()` to get plain JavaScript objects instead of Mongoose documents
        
        // Get all projects users are part of
        const projectUsers = await ProjectUser.find().populate('project_id').populate('user_id');

        // Map users with their respective projects
        const userDetails = users.map(user => {
            const projects = projectUsers
                .filter(pu => pu.user_id.toString() === user._id.toString())
                .map(pu => pu.project_id);
            return {
                ...user,
                projects: projects, // Include the user's projects
            };
        });

        return res.status(200).json({
            message: 'All users fetched successfully',
            users: userDetails,
        });
    } catch (error) {
        console.error('Error fetching all users:', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

// Middleware function to get all projects with their details
const getAllProjects = async (req, res) => {
    try {
        const projects = await Project.aggregate([
            {
                $lookup: {
                    from: 'projecttags', // Name of the tags collection
                    localField: 'id', // Project ID
                    foreignField: 'project_id', // Matching project_id in tags
                    as: 'tags' // The name of the field where the tags will be stored
                }
            },
            {
                $project: {
                    id: 1,
                    name: 1,
                    description: 1,
                    created_at: 1,
                    updated_at: 1,
                    deadline: 1,
                    creator_id: 1,
                    is_approved: 1,
                    tags: '$tags.tag_name' // Only return the tag names
                }
            }
        ]);

        return res.status(200).json({
            message: 'All projects fetched successfully',
            projects,
        });
    } catch (error) {
        console.error('Error fetching all projects:', error);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};


module.exports = {
    validateAdminSignIn,
    validateProjectApproval,
    approveProject,
    getAllUsers,
    getAllProjects,
    tokenValidationAdmin
};

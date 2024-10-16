const express = require("express");
const { Project, ProjectTag, ProjectUser, User } = require("../db");
const { validateCreateProject, checkUserExists, adminValidate, checkUserEmailExists, validateTokenProjectOwner, validateUpdateProject, validateAddUsers, checkProjectExists, checkUserAdminExists } = require("../middlewares/ProjectMiddlewares");
const router = express.Router();
const jwt=require("jsonwebtoken");
//require dotenv
require("dotenv").config();

//create a project route
router.post("/create" ,validateCreateProject, async (req,res)=>{
    //get the req body parameters and jwt token in headers decode it get the mail id and use this mail id as creator id to store
    //in the database

    //token
    const token=req.header("authorization");
    if(!token){
        return res.status(401).json({message:"Please enter a token"});
    }
    //verify token than extract email from token
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    const email=decoded.email;
    //get req body and extract name, description, tags and deadline. deadline will be of string form "dd/mm/yyyy" convert it to date and store it
    //in the database
    const {name,description,tags,deadline}=req.body;
    const [day, month, year] = deadline.split("/").map(Number);
    const fullYear = year < 100 ? 2000 + year : year; // Handle two-digit year format
    const parsedDate = new Date(fullYear, month - 1, day); // Convert to JS Date (month is 0-based)
    const project=new Project({
        name:name,
        description:description,
        deadline:parsedDate,
        creator_id:email
    });
    //save the project in the database
    try {
        await project.save();
        const pid=project.id;
        //if tags are present add them to the ProjectTag
        if(tags.length>0){
            tags.forEach(async (tag)=>{
                await ProjectTag.create({project_id:pid,tag_name:tag});
            });
        }
        return res.status(200).json({message:"Project created successfully"});
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }
})

//get my created projects
router.get("/my-created-projects",checkUserEmailExists,async (req,res)=>{
    //get the token from headers and decode it to get the email id
    const token=req.header("authorization");
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    const email=decoded.email;
    //get all the projects created by the user and also get tags of them
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
            $match: {
                creator_id: email // Filter projects by creator_id matching the email variable
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
    return res.status(200).json({projects});
})

//update a project 
router.put("/update",validateTokenProjectOwner, validateUpdateProject, async (req,res)=>{
    //update the details if sent in request 
    
    //get the project id from req body and get the project from database
    const project_id=req.body.project_id;
    const project=await Project.findOne({id:project_id});
    //update the project details if sent in request
    const {name,description,tags,deadline}=req.body;
    if(name){
        project.name=name;
    }
    if(description){
        project.description=description;
    }
    if(deadline){
        const [day, month, year] = deadline.split("/").map(Number);
        const fullYear = year < 100 ? 2000 + year : year; // Handle two-digit year format
        const parsedDate = new Date(fullYear, month - 1, day); // Convert to JS Date (month is 0-based)
        project.deadline=parsedDate;
    }
    //append tags 
    if(tags && tags.length>0){
        tags.forEach(async (tag)=>{
            //if such tag already exists for that project id then send error
            const tagExists=await ProjectTag.findOne({
                project_id:project_id,
                tag_name:tag
            })
            if(tagExists){
                return res.status(400).json({message:`Tag ${tag} already exists for this project`});
            }
            await ProjectTag.create({project_id:project_id,tag_name:tag});
        });
    }

    //make updated_at as date now
    project.updated_at=Date.now();
    //save the project
    try {
        await project.save();
        return res.status(200).json({message:"Project updated successfully"});
    } catch (error) {
        return res.status(500).json({message:"Internal server error"});
    }
})

//router to add users to a project
router.post("/addusers", validateTokenProjectOwner, validateAddUsers, async (req, res) => {
    const project_id = req.body.project_id;
    const user_ids = req.body.user_ids;
    
    const errors = []; // Array to collect errors
  
    try {
      for (const user_id of user_ids) {
        // Check if the user exists
        const userExists = await User.findOne({ id: user_id });
        if (!userExists) {
          errors.push(`User with id ${user_id} does not exist`);
          continue; // Skip to the next iteration
        }
  
        // Check if the user is already added to the project
        const userAlreadyAdded = await ProjectUser.findOne({
          user_id: user_id,
          project_id: project_id
        });
        if (userAlreadyAdded) {
          errors.push(`User with id ${user_id} is already added to the project`);
          continue; // Skip to the next iteration
        }
  
        // Add the user to the project
        await ProjectUser.create({
          user_id: user_id,
          project_id: project_id
        });
      }
  
      // If there are any errors, return them as a response
      if (errors.length > 0) {
        return res.status(400).json({ message: "Some users could not be added", errors });
      }
  
      // If no errors, send success message
      return res.status(200).json({ message: "Users added successfully" });
  
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
//get all users assigned to a project
router.get("/get-all-users/:project_id", checkProjectExists, checkUserAdminExists, async (req, res) => {
    try {
        // Get project id from the URL params
        const project_id = req.params.project_id;

        // Get all users assigned to the project
        const users = await ProjectUser.aggregate([
            {
                $match: {
                    project_id: project_id // Filter users by project_id
                }
            },
            {
                $lookup: {
                    from: 'users', // Name of the users collection
                    localField: 'user_id', // User ID in ProjectUser collection
                    foreignField: 'id', // Matching field in Users collection
                    as: 'user' // The field where the user details will be stored
                }
            },
            {
                $unwind: '$user' // Flatten the array of user details
            },
            {
                $project: {
                    _id: 0, // Exclude _id from the result
                    id: '$user.id', // Get user id
                    name: '$user.name', // Get user name
                    email: '$user.email', // Get user email
                    created_at: '$user.created_at', // Get user created_at field
                    joined_at: '$joined_at' // Get joined_at from ProjectUser
                }
            }
        ]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'No users found for this project' });
        }

        // Send the retrieved users as a response
        return res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});


//get projects i am assigned to 
router.get("/get-my-assigned-projects", checkUserEmailExists, async (req, res) => {
    try {
        // Extract the token from the authorization header
        const token = req.header("authorization");
        if (!token) {
            return res.status(401).json({ message: "Authorization token missing" });
        }

        // Verify the token and extract the user's email
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const email = decoded.email;

        // Find the user by email (ensure checkUserEmailExists middleware passed)
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const user_id = user.id;

        // Fetch all project IDs where the user is assigned in the ProjectUser table
        const assignedProjects = await ProjectUser.find({ user_id: user_id });

        if (assignedProjects.length === 0) {
            return res.status(404).json({ message: "No projects found for this user" });
        }

        // Extract project IDs
        const projectIds = assignedProjects.map(proj => proj.project_id);

        // Fetch project details based on project IDs
        const projects = await Project.find({ id: { $in: projectIds } });

        // Return project details in the response
        return res.status(200).json(projects);
    } catch (error) {
        console.error("Error fetching assigned projects:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});



module.exports = router;

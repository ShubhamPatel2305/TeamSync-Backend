const express = require("express");
const { Project, ProjectTag } = require("../db");
const { validateCreateProject, checkUserExists, adminValidate, checkUserEmailExists } = require("../middlewares/ProjectMiddlewares");
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
    //get all the projects created by the user
    const projects=await Project.find({creator_id:email});
    return res.status(200).json({projects});
})
module.exports = router;

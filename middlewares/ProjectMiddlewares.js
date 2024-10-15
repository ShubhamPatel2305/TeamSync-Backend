const { z } = require('zod');
const {User, Project} = require("../db/index"); 
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const projectCreateSchema = z.object({
    name: z.string().min(4, { message: "Name is required" }),
    description: z.string().min(4, { message: "Description is required" }),
    tags: z.array(z.string().min(1, { message: "Tagname is required" })).optional(),
    deadline: z.preprocess(
      (val) => {
        if (typeof val === "string") {
          const [day, month, year] = val.split("/").map(Number);
          const fullYear = year < 100 ? 2000 + year : year; // Handle two-digit year format
          const parsedDate = new Date(fullYear, month - 1, day); // Convert to JS Date (month is 0-based)
          return isNaN(parsedDate.getTime()) ? null : parsedDate;
        }
        return null;
      },
      z.date().refine((date) => !isNaN(date.getTime()), { message: "Invalid date format, expected dd/mm/yy" })
    )
  });
  

async function validateCreateProject(req,res,next){
    //extract token from header
    const token=req.header("authorization");
    if(!token){
        return res.status(401).json({message:"Please enter a token"});
    }
    //verify token than extract email from token and verify if it exists in User
    try {
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        const user=await User.findOne({email:decoded.email});
        if(!user){
            return res.status(401).json({message:"User not found"});
        }
    } catch (error) {
        return res.status(401).json({message:"Invalid token"});
    }

    //validate the input
    try {
        //safe parse
        const resp=projectCreateSchema.safeParse({
                name:req.body.name,
                description:req.body.description,
                deadline:req.body.deadline,
                tags:req.body.tags
            });
        if(!resp.success){
            return res.status(400).json({message:res.error.errors[0].message});
        }

        //check if a project with same name exists
        const project=await Project.findOne({name:req.body.name})
        if(project){
            console.log("hahah")
            return res.status(400).json({message:"Project with same name already exists"});
        }
        next();
    } catch (error) {
        console.log("hahah")
        return res.status(400).json({message:error});
    }
}

module.exports = {
    validateCreateProject,
};

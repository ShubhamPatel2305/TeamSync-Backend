const { z } = require('zod');
const {User, Project, ProjectUser, Admin} = require("../db/index"); 
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const projectCreateSchema = z.object({
    name: z.string().min(4, { message: "Name is required" }),
    description: z.string().min(4, { message: "Description is required" }),
    tags: z.array(z.string().min(1, { message: "Tagname is required" })).optional(),
    deadline: z.optional(
        z.preprocess(
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
      )
      
  });

  const projectUpdateSchema=z.object({
    project_id:z.string().length(36),
    name: z.string().min(4, { message: "Name is required" }).optional(),
    description: z.string().min(4, { message: "Description is required" }).optional(),
    tags: z.array(z.string().min(1, { message: "Tagname is required" })).optional(),
    deadline: z.preprocess(
        (val) => {
          if (val === undefined || val === null || val === '') {
            return undefined; // Allow the field to be truly optional by returning undefined
          }
          if (typeof val === "string") {
            const [day, month, year] = val.split("/").map(Number);
            const fullYear = year < 100 ? 2000 + year : year; // Handle two-digit year format
            const parsedDate = new Date(fullYear, month - 1, day); // Convert to JS Date (month is 0-based)
            return isNaN(parsedDate.getTime()) ? null : parsedDate;
          }
          return null;
        },
        z.date().optional().refine((date) => !isNaN(date.getTime()), { message: "Invalid date format, expected dd/mm/yy" })
      ).optional(), // Mark the deadline field as optional

  })

    const addUsersSchema=z.object({
        project_id:z.string().length(36),
        user_ids:z.array(z.string().length(36))
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

async function validateUpdateProject(req,res,next){
    //only verify schema 
    const resp=projectUpdateSchema.safeParse(req.body);
    if(!resp.success){
        return res.status(400).json({message:resp.error.errors[0].message});
    }
    next();
}

async function validateAddUsers(req,res,next){
    //extract project_id and user_ids from req body and verify schema using zod 
    const resp=addUsersSchema.safeParse(req.body);
    if(!resp.success){
        return res.status(400).json({message:resp.error.errors[0].message});
    }
    next();
}

async function checkProjectExists(req,res,next){
    //extract project_id from req body and verify schema using zod 
    
    //if request is of type get then do this
    if(req.method=="GET"){
        console.log("in get")
        const schema = z.string().length(36, { message: "project_id must be exactly 36 characters long" });
        const resp=schema.safeParse(req.params.project_id);
        if(!resp.success){
            return res.status(400).json({message:resp.error.errors[0].message});
        }
        //check if project exists
        const project=await Project.findOne({id:req.params.project_id});
        if(!project){
            return res.status(400).json({message:"Project not found"});
        }
        next();
    }else{
        const schema=z.object({
            project_id:z.string().length(36)
        });
        console.log("in post")
        const resp=schema.safeParse(req.body);
        if(!resp.success){
            return res.status(400).json({message:resp.error.errors[0].message});
        }
        //check if project exists
        const project=await Project.findOne({id:req.body.project_id});
        if(!project){
            return res.status(400).json({message:"Project not found"});
        }
        next();
    }
    
}

async function checkUserExists(req,res,next){
    //extract user_id from req body and verify schema using zod 
    const schema=z.object({
        user_id:z.string().length(36)
    });
    const resp=schema.safeParse(req.body);
    if(!resp.success){
        return res.status(400).json({message:resp.error.errors[0].message});
    }
    //check if user exists
    const user=await User.findOne({id:req.body.user_id});
    if(!user){
        return res.status(400).json({message:"User not found"});
    }
    next();
}

async function checkIfCreator(req,res,next){
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
        //verify req body to have project_id where project_id is uuid string 
        //using zod
        const schema=z.object({
            project_id:z.string().length(36)
        });
        const resp=schema.safeParse(req.body); 
        if(!resp.success){
            return res.status(400).json({message:resp.error.errors[0].message});
        }
        //check if project exists
        const projectGet=await Project.findOne({id:req.body.project_id});
        if(!projectGet){
            return res.status(400).json({message:"Project not found"});
        }
        //check if this user is the creator of the given project id that is sent in req body
        const project=await Project.findOne({id:req.body.project_id});
        if(project.creator_id!=decoded.email){
            return res.status(401).json({message:"You are not the owner of this project"});
        }
        next();
    } catch (error) {
        return res.status(401).json({message:"Invalid token"});
    }
}

async function userAlreadyAdded(req,res,next){
    //extract project_id and user_id from req body and verify schema using zod 
    const schema=z.object({
        project_id:z.string().length(36),
        user_id:z.string().length(36)
    });
    const resp=schema.safeParse(req.body);
    if(!resp.success){
        return res.status(400).json({message:resp.error.errors[0].message});
    }
    //check if user is already added to the project
    const projectUser=await ProjectUser.findOne({project_id:req.body.project_id,user_id:req.body.user_id});
    if(projectUser){
        return res.status(400).json({message:"User already added to the project"});
    }
    next();
}

async function validateTokenProjectOwner(req,res,next){
    //extract token from header and check if he is the creator of the project_id he is trying to edit 
    try {
        const token=req.header("authorization");
        if(!token){
            return res.status(401).json({message:"Please enter a token"});
        }
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        const schema=z.object({
            project_id:z.string().length(36)
        });
        const resp=schema.safeParse(req.body); 
        if(!resp.success){
            return res.status(400).json({message:resp.error.errors[0].message});
        }
        //check if project exists
        const projectGet=await Project.findOne({id:req.body.project_id});
        if(!projectGet){
            return res.status(400).json({message:"Project not found"});
        }
        
        if(projectGet.creator_id!=decoded.email){
            return res.status(401).json({message:"You are not the owner of this project"});
        }
        next();
    } catch (error) {
        
    }
}

async function checkUserEmailExists(req,res,next){
    //extract email from jwt token
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
        next();
    } catch (error) {
        return res.status(401).json({message:"Invalid token"});
    }
}

async function checkUserAdminExists(req,res,next){
    //extract email from jwt token
    const token=req.header("authorization");
    if(!token){
        return res.status(401).json({message:"Please enter a token"});
    }
    //verify token than extract email from token and verify if it exists in User
    try {
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        const user=await User.findOne({email:decoded.email});
        const admin= await Admin.findOne({email:decoded.email});
        if(!admin && !user){
            return res.status(401).json({message:"Admin not found"});
        }
        next();
    } catch (error) {
        return res.status(401).json({message:"Invalid token"});
    }
}

module.exports = {
    validateCreateProject,
    checkProjectExists,
    checkUserExists,
    checkIfCreator,
    userAlreadyAdded,
    validateTokenProjectOwner,
    checkUserEmailExists,
    validateUpdateProject,
    validateAddUsers,
    checkUserAdminExists
    
};

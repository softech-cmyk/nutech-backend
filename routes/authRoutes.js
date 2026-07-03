import express from "express";
import User from "../src/models/User.js";
import bcrypt from "bcryptjs";


const router = express.Router();


router.get("/",(req,res)=>{
    res.json({
        message:"Auth API working"
    });
});



// Signup API
router.post("/signup", async(req,res)=>{

    try{

        const {name,email,password} = req.body;


        const existingUser = await User.findOne({email});

        if(existingUser){
            return res.status(400).json({
                message:"User already exists"
            });
        }


        const hashedPassword = await bcrypt.hash(password,10);


        const user = await User.create({
            name,
            email,
            password:hashedPassword
        });


        res.status(201).json({
            message:"User created successfully",
            user
        });


    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

});


export default router;
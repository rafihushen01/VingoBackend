const cloudinary =require("cloudinary").v2
const fs=require("fs")
const dotenv=require("dotenv")
dotenv.config()
const uploadoncloudinary=async(file)=>{
  cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME , 
  api_key: process.env.CLOUD_API, 
  api_secret: process.env.CLOUD_SECRET
});
  try {
    const result=await cloudinary.uploader.upload(file)
    fs.unlinkSync(file)
    return result.secure_url






    
  } catch (error) {
    fs.unlinkSync(file)
    console.log(error)
  }





}
module.exports=uploadoncloudinary
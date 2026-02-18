const { default: mongoose } = require("mongoose")
const dotenv=require("dotenv")
dotenv.config()
const mongourl=process.env.MONGO_URL
const connectdb=async()=>{



    try {
        await mongoose.connect(mongourl)

        console.log(`db connected successfully`)
        
    } catch (error) {
        console.log(`db error :${error}`)
        
    }
}
module.exports=connectdb
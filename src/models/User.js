const { default: mongoose, mongo } = require("mongoose");

const userschema=new mongoose.Schema({
    fullname:{
        type:String,
        required:true
    },
    email:{

        type:String,
        required:true,
        unique:true
    },
    password:{

        type:String,
        
    },
    mobile:{

        type:String,
      
    },
    role:{

        type:String,  
        enum:["owner","user","deliveryboy"],

    },
    resetotp:{

        type:String,
   
    },
    isverifyotp:{

        type:Boolean,
        default:false
    },
    otpexpires:{

        type:Date,

    },

    location:{

        type:{type:String,enum:["Point"],default:"Point"},
        coordinates:{type:[Number],default:[0,0]},

    },
    socketid:{
        type:String
    }



















},{timestamps:true})
userschema.index({location:"2dsphere"})
const user=new mongoose.model("user",userschema)
module.exports=user
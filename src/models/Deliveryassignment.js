const { default: mongoose } = require("mongoose");

const deliveryassignmentschmea=new mongoose.Schema({
   order:{


    type:mongoose.Schema.Types.ObjectId,
    ref:"Order"
   },
   shop:{


    type:mongoose.Schema.Types.ObjectId,
    ref:"Shop"
   },
   shoporderid:{
    
    
    type:mongoose.Schema.Types.ObjectId,
    required:true
   },
   bordcastedTo:[
  {    
    type:mongoose.Schema.Types.ObjectId,
    ref:"user"}

   ],
   assignedTo:{
     type:mongoose.Schema.Types.ObjectId,
    ref:"user",
    default:null
    
   },
   status:{

    type:String,
    enum:["Brodcasted",'assigned','completed'],
    default:'Brodcasted'
   },
   acceptedAt:{

    type:Date,

   }

















},{timestamps:true})
const delivery=new mongoose.model("delivery",deliveryassignmentschmea)
module.exports=delivery
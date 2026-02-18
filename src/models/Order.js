const mongoose = require("mongoose");

const shoporderitemschema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    price: Number,
    quantity: Number,
    name: String,
  },
  { timestamps: true }
);

const shoporderschema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    subtotal: Number,
    shopOrderItems: [shoporderitemschema],
    status: {
      type: String,
      enum: ["pending", "preparing", "out of delivery", "delivered"],
      default: "pending",
    },
    assigment:{
     type: mongoose.Schema.Types.ObjectId, ref: "delivery",
     default:null
    },
    assignedboy:{
          type: mongoose.Schema.Types.ObjectId, 
          ref:'user'

    },
    delotp:{
     type:String,
     default:null
  
    },
     otpexpires:{

      type:Date,
      
     },
     deliveryAt:{

      type:Date
     }



  

  },
  { timestamps: true }
);

const orderschema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    paymentmethod: { type: String, enum: ["Cod", "Online"], required: true },
    deliveryaddress: {
      text: String,
      longitude: Number,
      latitude: Number,
    },
    totalamount: Number,
    deliveryfee: Number,
    shopOrder: [shoporderschema],
        delmobile:{


      type:Number
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderschema);

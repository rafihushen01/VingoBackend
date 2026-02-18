// models/Item.js
const mongoose = require("mongoose");

const itemschema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" }, // Capital S
    category: {
        type: String,
        enum: [
            "Starter","Main-Course","Desserts","Beverage","Snacks","Salads","Sides","Appetizer",
            "Soup","Bread","Rice","Pasta","Seafood","Vegan","Vegetarian","Glutenfree",
            "Breakfast","Pizzas","Burgers","Sandwiches","Wrap","Drink","Fast Food","South Indian",
            "North Indian","Chinese","Continental","Italian","Mexican","Japaness","Bangladeshi",
            "Non-Vegetarian","Chicken","Beef","Mutton","Others","Biyrani","Ramen",'All'
        ],
        required: true
    },
    foodtype: { type: String, enum: ["veg", "non-veg"], required: true },
    price: { type: Number, min: 0, required: true },
    rating:{
    average:[{
        type:Number,
        default:0
    }],
    count:[{
        type:Number,
        default:0
    }]


    }
}, { timestamps: true });

const Item = mongoose.model("Item", itemschema);
module.exports = Item;

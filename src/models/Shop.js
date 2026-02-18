// models/Shop.js
const mongoose = require("mongoose");

const shopschema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, required:false},
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "user" ,}, // Capital U
    city: { type: String, required: true },
    state: { type: String, required: true },
    address: { type: String, required: true },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: "Item" }],
     // Capital I
}, { timestamps: true });

const Shop = mongoose.model("Shop", shopschema);
module.exports = Shop;

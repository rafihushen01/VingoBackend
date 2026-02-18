const Shop = require("../models/Shop");
const Item = require("../models/Items.js");
const uploadOnCloudinary = require("../utils/Cloudinary.js");

// ----------------- Create or Edit Shop -----------------
const createEditShop = async (req, res) => {
  try {
    const { name, address, state, city } = req.body;

    if (!name || !address || !state || !city) {
      return res.status(400).json({
        success: false,
        message: "All fields (name, address, state, city) are required",
      });
    }

    // Handle image upload if exists
    let uploadedImage;
    if (req.file) {
      uploadedImage = await uploadOnCloudinary(req.file.path);
    }

    let existingShop = await Shop.findOne({ owner: req.userId });
    let shopData;

    if (!existingShop) {
      // Create new shop
      shopData = await Shop.create({
        name,
        address,
        state,
        city,
        image: uploadedImage || null,
        owner: req.userId,
      });
    } else {
      // Update existing shop
      shopData = await Shop.findByIdAndUpdate(
        existingShop._id,
        {
          name,
          address,
          state,
          city,
          image: uploadedImage || existingShop.image,
        },
        { new: true, runValidators: true }
      );
    }

    await shopData.populate("owner");

    return res.status(200).json({
      success: true,
      message: existingShop ? "Shop updated successfully" : "Shop created successfully",
      shop: shopData,
    });

  } catch (error) {
    console.error("createEditShop error:", error);
    return res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
    });
  }
};

// ----------------- Get My Shop -----------------
const getMyShop = async (req, res) => {
  try {
    const shopData = await Shop.findOne({ owner: req.userId })
      .populate({
        path: "items",
        model: "Item",
        options: { sort: { updatedAt: -1, createdAt: -1 } }
      })
      .populate("owner");

    if (!shopData) {
      return res.status(404).json({
        success: false,
        message: "No shop found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      shop: shopData,
    });

  } catch (error) {
    console.error("getMyShop error:", error);
    return res.status(500).json({
      success: false,
      message: `Internal server error: ${error.message}`,
    });
  }
};
const getshopbycity=async(req,res)=>{
  try {
    const{currentcity}=req.params
    const shops=await Shop.find({
      city:{$regex :new RegExp(`^${currentcity}$`,"i")}
    }).populate("items")
   if(!shops){

      return res.status(400).json(`Shops is not found`)

   }
   return res.status(200).json({shops,success:true})


    
  } catch (error) {
    return res.status(500).json({message:`GetShopBycity error:${error}`})
    
  }














}
















module.exports = { createEditShop, getMyShop ,getshopbycity};

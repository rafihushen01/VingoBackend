const Shop = require("../models/Shop");
const Item = require("../models/Items.js");
const mongoose = require("mongoose");
const uploadOnCloudinary = require("../utils/Cloudinary");

// ----------------- Add Item -----------------
const addItem = async (req, res) => {
  try {
    const { name, category, foodtype, price } = req.body;

    if (!name || !category || !foodtype || !price) {
      return res.status(400).json({
        success: false,
        message: "All fields (name, category, foodtype, price) are required",
      });
    }

    // Upload image if exists
    let image = req.file ? await uploadOnCloudinary(req.file.path) : null;

    // Find existing shop
    const existingShop = await Shop.findOne({ owner: req.userId });
    if (!existingShop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    // Create new item
    const newItem = await Item.create({
      name,
      category,
      foodtype,
      price,
      image,
      shop: existingShop._id,
    });

    // Push item to shop
    existingShop.items.push(newItem._id);
    await existingShop.save();

    // Populate updated shop items
    const populatedShop = await Shop.findById(existingShop._id)
      .populate({
        path: "items",
        model: "Item",
        options: { sort: { updatedAt: -1, createdAt: -1 } },
      });

    return res.status(201).json({
      success: true,
      message: "Item added successfully",
      item: newItem,
      shop: populatedShop,
    });

  } catch (error) {
    console.error("addItem error:", error);
    return res.status(500).json({
      success: false,
      message: `AddItem error: ${error.message}`,
    });
  }
};

// ----------------- Edit Item -----------------
const editItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid item ID" });
    }

    const { name, category, foodtype, price } = req.body;
    const image = req.file ? await uploadOnCloudinary(req.file.path) : undefined;

    const updatedItem = await Item.findByIdAndUpdate(
      itemId,
      { name, category, foodtype, price, ...(image && { image }) },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    const shopData = await Shop.findById(updatedItem.shop)
      .populate({ path: "items", model: "Item", options: { sort: { updatedAt: -1, createdAt: -1 } } });

    return res.status(200).json({
      success: true,
      message: "Item updated successfully",
      item: updatedItem,
      shop: shopData,
    });

  } catch (error) {
    console.error("editItem error:", error);
    return res.status(500).json({
      success: false,
      message: `EditItem error: ${error.message}`,
    });
  }
};

// ----------------- Delete Item -----------------
const deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ success: false, message: "Invalid item ID" });
    }

    const existingItem = await Item.findById(itemId);
    if (!existingItem) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // Remove reference from shop
    if (existingItem.shop) {
      await Shop.updateOne(
        { _id: existingItem.shop },
        { $pull: { items: itemId } }
      );
    }

    // Delete the item document
    await Item.findByIdAndDelete(itemId);

    // Return updated shop with sorted items
    const updatedShop = await Shop.findById(existingItem.shop)
      .populate({ path: "items", model: "Item", options: { sort: { updatedAt: -1, createdAt: -1 } } });

    return res.status(200).json({
      success: true,
      message: "Item deleted successfully",
      shop: updatedShop,
    });

  } catch (error) {
    console.error("deleteItem error:", error);
    return res.status(500).json({
      success: false,
      message: `DeleteItem error: ${error.message}`,
    });
  }
};
const getitembycity = async (req, res) => {
  try {
    const { currentcity } = req.params;

    if (!currentcity) {
      return res.status(400).json({ success: false, message: "City is required" });
    }

    const shops = await Shop.find({
      city: { $regex: new RegExp(`^${currentcity}$`, "i") }
    });

    if (!shops.length) {
      return res.status(404).json({ success: false, message: "No shops found in this city" });
    }

    const shopIds = shops.map(shop => shop._id);

    const items = await Item.find({ shop: { $in: shopIds } })
      .sort({ createdAt: -1 }); // optional: sort by latest

    return res.status(200).json({ success: true, items });

  } catch (error) {
    console.error("getitembycity error:", error);
    return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
};
const getitembyshop = async (req, res) => {
  try {
    const { shopId } = req.params

    // ✅ Validate shopId
    if (!shopId) {
      return res.status(400).json({
        success: false,
        message: "Shop ID is required ❌",
      })
    }

    // ✅ Fetch and fully populate the shop
    const shop = await Shop.findById(shopId)
      .populate({
        path: "owner",
        model: "user",
        select: "fullname email mobile role",
      })
      .populate({
        path: "items",
        model: "Item",
        populate: [
          {
            path: "category", // ✅ fixed missing path
            select: "name image price foodtype",
          },
          {
            path: "shop", // ✅ should match the field name in your Item model
            select: "name city state image address",
          },
        ],
      })

    // ✅ If shop not found
    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found ⚠️",
      })
    }

    // ✅ Response
    return res.status(200).json({
      success: true,
      message: "✅ Shop and items fetched successfully",
      totalItems: shop.items?.length || 0,
      shop,
    })
  } catch (error) {
    console.error("❌ getitembyshop Error:", error.message)
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching shop details",
      error: error.message,
    })
  }
}
const searchitems = async (req, res) => {
  try {
    const { query, city } = req.query;

    if (!query || !city) {
      return res.status(400).json({
        success: false,
        message: "Query and city are required 🔍"
      });
    }

    // Find shops in the city (case-insensitive)
    const shops = await Shop.find({
      city: { $regex: new RegExp(`^${city}$`, "i") }
    }).populate("items");

    if (!shops || shops.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No shops found in this city 🏙️"
      });
    }

    const shopIds = shops.map(s => s._id);

    // Build dynamic $or conditions
    const orConditions = [
      { name: { $regex: query, $options: "i" } },
      { category: { $regex: query, $options: "i" } },
      { foodtype: { $regex: query, $options: "i" } },
      { rating: { $regex: query, $options: "i" } },
    ];

    // If query is a valid number, search price too
    if (!isNaN(query)) {
      orConditions.push({ price: Number(query) });
    }

    const items = await Item.find({
      shop: { $in: shopIds },
      $or: orConditions
    }).populate("shop", "name image address state city");

    if (!items || items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No items matched your search 🔎"
      });
    }

    return res.status(200).json({
      success: true,
      count: items.length,
      items
    });

  } catch (error) {
    console.error("Searchitems error:", error);
    return res.status(500).json({
      success: false,
      message: `Searchitems error: ${error.message}`
    });
  }
};




module.exports = { addItem, editItem, deleteItem,getitembycity,getitembyshop,searchitems

 };

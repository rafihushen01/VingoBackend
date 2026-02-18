const user = require("../models/User");

const getcurrentuser = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ message: "USER ID IS NOT FOUND" });
    }

    // ✅ correct usage
    const User = await user.findById(userId).select("-password");

    if (!User) {
      return res.status(404).json({ message: "User does not exist" });
    }

    return res.status(200).json({ success: true, User });
  } catch (error) {
    return res.status(500).json({ message: `getcurrent error: ${error.message}` });
  }
};
// সঠিকভাবে মডেল ইম্পোর্ট

const updateuserlocation = async (req, res) => {
  try {
    const { lat, lon } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const updatedUser = await user.findByIdAndUpdate(
      req.userId,
      {
        location: {
          type: "Point",
          coordinates: [lon, lat],
     
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "Location updated successfully",
      success: true,
      location: updatedUser.location,
    });
  } catch (error) {
    return res.status(500).json({
      message: `Updateuserlocationerror: ${error.message}`,
      success: false,
    });
  }
};

module.exports = { getcurrentuser,updateuserlocation };

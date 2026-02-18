const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const secretkey = process.env.SECRET_KEY;

const isAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized access, token missing" });
    }

    const decodedtoken = jwt.verify(token, secretkey);

    if (!decodedtoken) {
      return res
        .status(401)
        .json({ message: "Unauthorized access, token invalid" });
    }

    // ✅ correct field
    req.userId = decodedtoken.id;

    next();
  } catch (error) {
    return res.status(400).json({ message: `isAuth error: ${error.message}` });
  }
};

module.exports = isAuth;

const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const secretkey = process.env.SECRET_KEY;

const gentoken = async (userId) => {
  try {
    // ✅ অবশ্যই object আকারে দিতে হবে
    const token = jwt.sign({ id: userId }, secretkey, { expiresIn: "3d" });
    return token;
  } catch (error) {
    console.log(`token error: ${error}`);
  }
};

module.exports = gentoken;

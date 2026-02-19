const bcrypt = require("bcryptjs");
const gentoken = require("../utils/Token");
const user = require("../models/User");
const sendotp = require("../utils/Mail");

const TOKEN_COOKIE_NAME = "token";
const TOKEN_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

const normalizeSameSite = (value) => {
  const val = String(value || "").toLowerCase();
  if (val === "none" || val === "lax" || val === "strict") return val;
  return null;
};

const getAuthCookieOptions = (req) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const isHttpsRequest = req.secure || forwardedProto === "https";

  let secure;
  if (process.env.COOKIE_SECURE === "true") secure = true;
  else if (process.env.COOKIE_SECURE === "false") secure = false;
  else secure = isHttpsRequest || process.env.NODE_ENV === "production";

  let sameSite =
    normalizeSameSite(process.env.COOKIE_SAME_SITE) || (secure ? "none" : "lax");

  // Browsers reject SameSite=None cookies without Secure.
  if (sameSite === "none" && !secure) {
    sameSite = "lax";
  }

  const options = {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: TOKEN_MAX_AGE,
    path: "/",
  };

  if (process.env.COOKIE_DOMAIN) {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
};

const setAuthCookie = (req, res, token) => {
  res.cookie(TOKEN_COOKIE_NAME, token, getAuthCookieOptions(req));
};

const clearAuthCookie = (req, res) => {
  const { maxAge, ...clearOptions } = getAuthCookieOptions(req);
  void maxAge;
  res.clearCookie(TOKEN_COOKIE_NAME, clearOptions);
};

const toSafeUser = (doc) => ({
  id: doc._id,
  fullname: doc.fullname,
  email: doc.email,
  role: doc.role,
  mobile: doc.mobile,
});

const signup = async (req, res) => {
  try {
    const { fullname, email, password, mobile, role } = req.body;

    if (!fullname || !email || !password || !mobile) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await user.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: `${email} is already registered. Please sign in.` });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    if (!/^[0-9]{10,15}$/.test(mobile)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid mobile number (10+ digits)" });
    }

    const hashpass = await bcrypt.hash(password, 12);

    const newUser = await user.create({
      fullname,
      email,
      password: hashpass,
      mobile,
      role,
    });

    const token = await gentoken(newUser._id);
    setAuthCookie(req, res, token);

    const safeUser = toSafeUser(newUser);

    return res.status(201).json({
      success: true,
      message: "Signup successful",
      token,
      user: safeUser,
      User: safeUser,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and Password are required" });
    }

    const finduser = await user.findOne({ email });
    if (!finduser) {
      return res.status(404).json({ message: "User not found. Please signup first." });
    }

    const verifypass = await bcrypt.compare(password, finduser.password);
    if (!verifypass) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const token = await gentoken(finduser._id);
    setAuthCookie(req, res, token);

    const safeUser = toSafeUser(finduser);

    return res.status(200).json({
      success: true,
      message: "Signin successful",
      token,
      user: safeUser,
      User: safeUser,
    });
  } catch (error) {
    console.error("Signin error:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    clearAuthCookie(req, res);
    return res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Logout failed", error: error.message });
  }
};

const sendmailotp = async (req, res) => {
  try {
    const { email } = req.body;

    const finduser = await user.findOne({ email });
    if (!finduser) {
      return res.status(404).json({ message: "user not found", success: false });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    finduser.resetotp = otp;
    finduser.otpexpires = Date.now() + 5 * 60 * 1000;
    finduser.isverifyotp = false;
    await finduser.save();

    await sendotp(email, otp);

    return res.status(200).json({
      message: "otp sent successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: `sendmailotp error: ${error.message}`,
      success: false,
    });
  }
};

const verifyotp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const finduser = await user.findOne({ email });

    if (!finduser) {
      return res.status(404).json({ message: "user not found", success: false });
    }

    if (!otp) {
      return res.status(400).json({ message: "otp is required", success: false });
    }

    if (String(finduser.resetotp) !== String(otp)) {
      return res.status(400).json({ message: "invalid otp", success: false });
    }

    if (finduser.otpexpires < Date.now()) {
      return res.status(400).json({ message: "otp expired", success: false });
    }

    finduser.isverifyotp = true;
    finduser.resetotp = undefined;
    finduser.otpexpires = undefined;
    await finduser.save();

    return res.status(200).json({
      message: "otp verified successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: `verifyotp error: ${error.message}`,
      success: false,
    });
  }
};

const resetpassword = async (req, res) => {
  try {
    const { email, newpass } = req.body;
    const finduser = await user.findOne({ email });

    if (!finduser) {
      return res.status(404).json({ message: "user not found", success: false });
    }

    if (!finduser.isverifyotp) {
      return res.status(403).json({
        message: "otp verification required before resetting password",
        success: false,
      });
    }

    const hashpass = await bcrypt.hash(newpass, 10);
    finduser.password = hashpass;
    finduser.isverifyotp = false;
    await finduser.save();

    return res.status(200).json({
      message: "password reset successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: `resetpassword error: ${error.message}`,
      success: false,
    });
  }
};

const googleauth = async (req, res) => {
  try {
    const { email, fullname } = req.body;
    let existinguser = await user.findOne({ email });

    if (!existinguser) {
      existinguser = await user.create({
        fullname,
        email,
        role: "user",
      });
    }

    const token = await gentoken(existinguser._id);
    setAuthCookie(req, res, token);

    const safeUser = toSafeUser(existinguser);

    return res.status(200).json({
      success: true,
      message: "Google signup/signin successful",
      token,
      user: safeUser,
      User: safeUser,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `googleauth error: ${error.message}`, success: false });
  }
};

const googleauthlogin = async (req, res) => {
  try {
    const { fullname, email } = req.body;
    const existinguser = await user.findOne({ email });

    if (!existinguser) {
      return res
        .status(400)
        .json({ message: "User does not exist, go to signup first" });
    }

    existinguser.fullname = fullname || existinguser.fullname;
    await existinguser.save();

    const token = await gentoken(existinguser._id);
    setAuthCookie(req, res, token);

    const safeUser = toSafeUser(existinguser);

    return res.status(200).json({
      message: "Login Successful",
      success: true,
      token,
      user: safeUser,
      User: safeUser,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `googleauth error: ${error.message}`, success: false });
  }
};

module.exports = {
  signup,
  signin,
  logout,
  sendmailotp,
  verifyotp,
  resetpassword,
  googleauth,
  googleauthlogin,
};

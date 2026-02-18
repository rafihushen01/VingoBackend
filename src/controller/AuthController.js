
const bcrypt = require("bcryptjs");
const gentoken = require("../utils/Token");
const user = require("../models/User");
const sendotp = require("../utils/Mail");

// ✅ Signup Controller
const signup = async (req, res) => {
  try {
    const { fullname, email, password, mobile, role } = req.body;

    // 🧠 Basic Field Validation
    if (!fullname || !email || !password || !mobile) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 🧠 Check existing user
    const existingUser = await user.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: `${email} is already registered. Please sign in.` });
    }

    // 🔒 Password Validation
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    // 📱 Mobile Validation
    if (!/^[0-9]{10,15}$/.test(mobile)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid mobile number (10+ digits)" });
    }

    // 🔐 Hash Password with strong salt
    const saltRounds = 12;
    const hashpass = await bcrypt.hash(password, saltRounds);

    // 🧾 Create New User
    const newUser = await user.create({
      fullname,
      email,
      password: hashpass,
      mobile,
      role,
    });

    // 🎫 Generate JWT Token
    const token = await gentoken(newUser._id);

    // 🍪 Secure Cookie
    res.cookie("token", token, {
      httpOnly: true, // can't be accessed by JS
      secure: true, // HTTPS only in production
      sameSite: "strict",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    });

    return res.status(201).json({
      success: true,
      message: "Signup successful",
      user: {
        id: newUser._id,
        fullname: newUser.fullname,
        email: newUser.email,
        role: newUser.role,
        mobile: newUser.mobile,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Signin Controller
const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🧠 Validate
    if (!email || !password) {
      return res.status(400).json({ message: "Email and Password are required" });
    }

    // 🔍 Find user
    const finduser = await user.findOne({ email });
    if (!finduser) {
      return res.status(404).json({ message: "User not found. Please signup first." });
    }

    // 🔐 Compare password securely
    const verifypass = await bcrypt.compare(password, finduser.password);
    if (!verifypass) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    // 🎫 Generate Token
    const token = await gentoken(finduser._id);

    // 🍪 Set secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 3 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Signin successful",
      user: {
        id: finduser._id,
        fullname: finduser.fullname,
        email: finduser.email,
        role: finduser.role,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Logout Controller
const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "strict",
      secure:false
    });
    return res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Logout failed", error: error.message });
  }
};
const sendmailotp = async (req, res) => {
  try {
    const { email } = req.body

    const finduser = await user.findOne({ email })
    if (!finduser) {
      return res.status(404).json({ message: "user not found", success: false })
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    finduser.resetotp = otp
    finduser.otpexpires = Date.now() + 5 * 60 * 1000 // 5 min expire
    finduser.isverifyotp = false
    await finduser.save()

    await sendotp(email, otp)

    return res.status(200).json({
      message: "otp sent successfully",
      success: true,
    })
  } catch (error) {
    return res.status(500).json({
      message: `sendmailotp error: ${error.message}`,
      success: false,
    })
  }
}

// --------------------------- verify otp ---------------------------
const verifyotp = async (req, res) => {
  try {
    const { email, otp } = req.body
    const finduser = await user.findOne({ email })

    if (!finduser) {
      return res.status(404).json({ message: "user not found", success: false })
    }

    if (!otp) {
      return res.status(400).json({ message: "otp is required", success: false })
    }

    // compare otp safely
    if (String(finduser.resetotp) !== String(otp)) {
      return res.status(400).json({ message: "invalid otp", success: false })
    }

    // check expiry
    if (finduser.otpexpires < Date.now()) {
      return res.status(400).json({ message: "otp expired", success: false })
    }

    finduser.isverifyotp = true
    finduser.resetotp = undefined
    finduser.otpexpires = undefined
    await finduser.save()

    return res.status(200).json({
      message: "otp verified successfully",
      success: true,
    })
  } catch (error) {
    return res.status(500).json({
      message: `verifyotp error: ${error.message}`,
      success: false,
    })
  }
}


// --------------------------- reset password ---------------------------
const resetpassword = async (req, res) => {
  try {
    const { email, newpass } = req.body
    const finduser = await user.findOne({ email })

    if (!finduser) {
      return res.status(404).json({ message: "user not found", success: false })
    }

    if (!finduser.isverifyotp) {
      return res.status(403).json({
        message: "otp verification required before resetting password",
        success: false,
      })
    }

    const hashpass = await bcrypt.hash(newpass, 10)
    finduser.password = hashpass
    finduser.isverifyotp = false
    await finduser.save()

    return res.status(200).json({
      message: "password reset successfully",
      success: true,
    })
  } catch (error) {
    return res.status(500).json({
      message: `resetpassword error: ${error.message}`,
      success: false,
    })
  }
}
const googleauth = async (req, res) => {
  try {
    const { email, fullname } = req.body; // role & mobile বাদ
    let existinguser = await user.findOne({ email });

    if (!existinguser) {
      const newUser = await user.create({
        fullname,
        email,
        role: "user" // default role
      });

      const token = await gentoken(newUser._id);
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 3*24*60*60*1000,
      });

      return res.status(200).json({ success: true, user: newUser });
    } else {
      // existing user → login
      const token = await gentoken(existinguser._id);
      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 3*24*60*60*1000,
      });
      return res.status(200).json({
        success: true,
        message: "User already exists, logged in successfully",
        user: existinguser,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: `googleauth error: ${error.message}`, success:false });
  }
};

const googleauthlogin = async(req,res) => {
  try {
    const { fullname, email } = req.body;
    const existinguser = await user.findOne({ email });
    if(!existinguser){
      return res.status(400).json({ message: "User does not exist, go to signup first" });
    }

    existinguser.fullname = fullname; // optional update
    const token = await gentoken(existinguser._id);
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 3*24*60*60*1000,
    });
    return res.status(200).json({ message: "Login Successful", success:true });
  } catch (error) {
    return res.status(500).json({ message: `googleauth error: ${error.message}`, success:false });
  }
}

























module.exports = { signup, signin, logout ,sendmailotp,verifyotp,resetpassword,googleauth,googleauthlogin};

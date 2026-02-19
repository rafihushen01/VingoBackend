const expires=require("express")
const { signup, signin, logout, sendmailotp, verifyotp, resetpassword, googleauth, googleauthlogin } = require("../controller/AuthController")
const isAuth = require("../middlewares/IsAuth")
const optionalAuth = isAuth.optionalAuth
const { getcurrentuser, updateuserlocation } = require("../controller/UserController")

const router=expires.Router()
router.post("/signup",signup)
router.post("/googlesignup",googleauth)
router.post("/googlelogin",googleauthlogin)

router.post("/signin",signin)
router.get("/logout",logout)
router.post("/sendotp",sendmailotp)
router.post("/verifyotp",verifyotp)
router.post("/resetpass",resetpassword)
router.get("/getcurrent",optionalAuth,getcurrentuser)
router.post("/updatelocation",isAuth,updateuserlocation)
module.exports=router

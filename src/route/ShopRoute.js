const express=require("express")
const {createEditShop, getMyShop, getshopbycity,  } = require("../controller/ShopController.js")
const isAuth = require("../middlewares/IsAuth")
const upload=require("../middlewares/Multer.js")
const router=express.Router(

)
router.post("/createeditshop",isAuth,upload.single("image"),createEditShop)
router.get("/getmyshop",isAuth,getMyShop)
router.get("/getshopbycity/:currentcity",isAuth,getshopbycity)
module.exports=router
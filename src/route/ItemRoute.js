const express=require("express")
const router=express.Router()
const isAuth = require("../middlewares/IsAuth")
const upload=require("../middlewares/Multer.js")

const { addItem, editItem, deleteItem, getitembycity, getitembyshop,searchitems } = require("../controller/ItemController")
router.post("/additem",isAuth,upload.single("image"),addItem)
router.put("/edititem/:itemId", isAuth, upload.single("image"), editItem)
router.delete("/deleteitem/:itemId", isAuth, deleteItem)
router.get("/getitembycity/:currentcity",isAuth,getitembycity
)

router.get("/getitembyshop/:shopId",isAuth,getitembyshop)
router.get("/searchitems",isAuth,searchitems)
module.exports=router  
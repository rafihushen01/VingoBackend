const Order = require("../models/Order.js");
const Shop = require("../models/Shop.js");
const User = require("../models/User.js");
const Delivery = require("../models/Deliveryassignment.js");
const{sendeliveryotp}=require("../utils/Mail.js")
const placeorder = async (req, res) => {
  try {
    const {
      cartitems,
      paymentmethod,
      deliveryaddress,
      totalamount,
      delmobile,
    } = req.body;

    if (!cartitems || cartitems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    if (
      !deliveryaddress?.text ||
      !deliveryaddress?.latitude ||
      !deliveryaddress?.longitude
    ) {
      return res
        .status(400)
        .json({ message: "Send complete delivery address" });
    }

    // 🛍️ Group items by shop
    const groupsitembyshop = {};
    cartitems.forEach((item) => {
      const shopId = item.shop;
      if (!groupsitembyshop[shopId]) groupsitembyshop[shopId] = [];
      groupsitembyshop[shopId].push(item);
    });

    // 🏪 Create shop-based order summary
    const shopOrder = await Promise.all(
      Object.keys(groupsitembyshop).map(async (shopId) => {
        const shopDoc = await Shop.findById(shopId).populate("owner");
        if (!shopDoc) throw new Error(`Shop not found for ID: ${shopId}`);

        const itemGroup = groupsitembyshop[shopId];
        const subtotal = itemGroup.reduce(
          (sum, i) => sum + Number(i.price) * Number(i.quantity),
          0
        );

        return {
          shop: shopDoc._id,
          owner: shopDoc.owner._id,
          subtotal,
          shopOrderItems: itemGroup.map((i) => ({
            item: i.id,
            price: i.price,
            quantity: i.quantity,
            name: i.name,
          })),
        };
      })
    );

    // 💾 Create order in DB
    const newOrder = await Order.create({
      user: req.userId,
      paymentmethod,
      deliveryaddress,
      totalamount,
      deliveryfee: totalamount > 500 ? 0 : 50,
      shopOrder,
      delmobile,
    });

    return res.status(200).json({ success: true, order: newOrder });
  } catch (error) {
    return res.status(500).json({
      message: `Place order error: ${error.message}`,
      success: false,
    });
  }
};
// 🏆 getuserorders controller – ultimate 100-trillion-dollar edition
const getuserorders = async (req, res) => {
  try {
    // 🔒 step 1: verify identity
    const userid = req.userId;
    if (!userid) {
      return res.status(401).json({
        success: false,
        message: "unauthorized access – user not identified 🚫",
      });
    }

    // ⚙️ step 2: fetch orders with full depth population
    const orders = await Order.find({ user: userid })
      .sort({ createdAt: -1, updatedAt: -1 })
      .populate("shopOrder.shop", "name")
      .populate("shopOrder.owner", "fullname email mobile")
      .populate("shopOrder.shopOrderItems.item", "name price quantity image")
      .lean(); // 🚀 faster json-ready objects

    // ❌ step 3: handle no order case
    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "no orders found for this user ❗",
      });
    }

    // 🎯 step 4: enhance orders with delivery info per shop
    const formattedorders = orders.map((order) => ({
      ...order,
      shopOrder: order.shopOrder.map((shopord) => ({
        ...shopord,
        delmobile: order.delmobile || null,
      })),
    }));

    // 🧮 step 5: generate metadata stats
    const totalorders = formattedorders.length;
    const totalamount = formattedorders.reduce(
      (sum, o) => sum + (o.totalamount || 0),
      0
    );
    const lastorder = formattedorders[0];

    // 🌈 step 6: build cinematic response payload
    return res.status(200).json({
      success: true,
      message: "orders fetched successfully ✅",
      metadata: {
        totalorders,
        totalamount,
        lastorderid: lastorder._id,
        lastorderdate: lastorder.createdAt,
        delmobileincluded: true,
        status: "active",
      },
      timestamp: new Date(),
      orders: formattedorders,
      ui: {
        theme: "glass-neon-hypergradient",
        animation: "fadein-glow",
        responsequality: "100trilliondollar-level",
      },
    });
  } catch (error) {
    console.error("❌ getuserorders error:", error);

    return res.status(500).json({
      success: false,
      message: "internal server error while fetching orders 💥",
      error: error.message,
      hint: "check model population or mongoose schema linkage",
    });
  }
};
;
const getownerorders = async (req, res) => {
  try {
    const userid = req.userId;
    if (!userid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access – owner not identified",
      });
    }

    // 🔍 Nested match: find orders where any shopOrder.owner == userid
    const orders = await Order.find({
      "shopOrder.owner": userid,
    })
      .sort({ createdAt: -1 })
      .populate("user", "fullname email  mobile ")
      .populate("shopOrder.shop", "name")
      .populate(
        "shopOrder.shopOrderItems.item",
        "name price quantity subtotal totalamount image"
      );

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this Owner",
      });
    }

    // 🧮 Optional: filter shopOrders of this specific owner only
    const filteredOrders = orders.map((order) => {
      return {
        ...order._doc,
        shopOrder: order.shopOrder.filter(
          (s) => s.owner.toString() === userid.toString()
        ),
      };
    });

    const totalorders = filteredOrders.length;
    const totalamount = filteredOrders.reduce(
      (acc, o) => acc + (o.totalamount || 0),
      0
    );
    const lastorder = filteredOrders[0];

    return res.status(200).json({
      success: true,
      message: "Owner Orders fetched successfully ✅",
      metadata: {
        totalorders,
        totalamount,
        lastorderid: lastorder?._id,
        lastorderdate: lastorder?.createdAt,
      },
      orders: filteredOrders,
    });
  } catch (error) {
    console.error("❌ Error fetching owner orders:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching owner orders",
      error: error.message,
    });
  }
};
const updateorderstatus = async (req, res) => {
  try {
    const { orderId, shopId } = req.params;
    const { status } = req.body;

    // 🔍 validate
    const validStatuses = [
      "pending",
      "preparing",
      "out of delivery",
      "delivered",
    ];
    if (!status || !validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value" });
    }

    // 🔍 find order
    const order = await Order.findById(orderId);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    // 🔍 find shopOrder
    const shoporder = order.shopOrder.find(
      (o) => o.shop.toString() === shopId.toString()
    );
    if (!shoporder)
      return res
        .status(404)
        .json({ success: false, message: "No shop order found" });

    // 🧭 update status
    shoporder.status = status;

    let boypayload = [];

    // 🚴 Assign delivery boy only when status == "out of delivery"
    if (status === "out of delivery" && !shoporder.assigment) {
      const { longitude, latitude } = order.deliveryaddress;
      if (!longitude || !latitude) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid delivery coordinates" });
      }

      // 🗺️ find nearby delivery boys
      const nearbyboys = await User.find({
        role: "deliveryboy",
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [Number(longitude), Number(latitude)],
            },
            $maxDistance: 50000, // 5km radius
          },
        },
      }).limit(20);

      if (!nearbyboys.length) {
        return res
          .status(400)
          .json({ success: false, message: "No nearby delivery boys found" });
      }

      const nearbyids = nearbyboys.map((b) => b._id);

      // 🚫 filter busy ones
      const busyids = await Delivery.find({
        assignedTo: { $in: nearbyids },
        status: { $nin: ["Brodcasted", "completed"] },
      }).distinct("assignedTo");

      const busyset = new Set(busyids.map((id) => String(id)));
      const freeboys = nearbyboys.filter((b) => !busyset.has(String(b._id)));

      if (!freeboys.length) {
        return res
          .status(400)
          .json({
            success: false,
            message: "All delivery boys are currently busy",
          });
      }

      const candidateIds = freeboys.map((b) => b._id);

      // 🧾 create delivery record
      const deliveryRecord = await Delivery.create({
        order: order._id,
        shop: shoporder.shop,
        shoporderid: shoporder._id,
        bordcastedTo: candidateIds,
        status: "Brodcasted",
      });

      // 🔗 link delivery assignment
      shoporder.assigment = deliveryRecord._id;
      shoporder.assignedboy = deliveryRecord.assignedTo;

      // 🚴‍♂️ payload for frontend broadcast
      boypayload = freeboys.map((b) => ({
        id: b._id,
        fullname: b.fullname,
        mobile: b.mobile,
        longitude: b.location.coordinates?.[0],
        latitude: b.location.coordinates?.[1],
      }));
    }

    // 💾 Save order
    order.markModified("shopOrder");
    await order.save();

    // 🌐 populate full data for response
    const populatedOrder = await Order.findById(orderId)
      .populate("shopOrder.shop", "name image")

      .populate("shopOrder.shopOrderItems.item", "name image price")
      .populate("shopOrder.assignedboy", "fullname mobile email")
      .populate({
        path: "shopOrder.assigment",
        populate: { path: "assignedTo", select: "fullname email mobile" },
      });

    const updatedshoporder = populatedOrder.shopOrder.find(
      (o) => o.shop._id.toString() === shopId.toString()
    );

    return res.status(200).json({
      success: true,
      message: "✅ Order status updated successfully",
      shoporder: updatedshoporder,
      broadcastedboys: boypayload,
      assignment: shoporder.assigment._id,
    });
  } catch (error) {
    console.error("updateorderstatus error:", error);
    return res
      .status(500)
      .json({ success: false, message: `Server error: ${error.message}` });
  }
};
const getdelassignment = async (req, res) => {
  try {
    const deliveryboyid = req.userId;

    // 🟠 Step 1: Validate user
    if (!deliveryboyid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access — Delivery boy ID missing",
      });
    }

    // 🟧 Step 2: Fetch all broadcasted deliveries for this rider
  const assignments = await Delivery.find({
  bordcastedTo: { $in: [deliveryboyid] },
  status: "Brodcasted",
})
  .populate({
    path: "shop",
    select: "name address mobile image",
  })
  .populate({
    path: "order",
    populate: [
      { path: "user", select: "fullname mobile address" },
      { path: "shopOrder.shop", select: "name image" },
      { path: "shopOrder.shopOrderItems.item", select: "name price image" },
      { path: "shopOrder.owner", select: "fullname email mobile" }, // ✅ fixed
    ],
  })
  .populate({
    path: "shoporderid",
    select: "totalprice shopstatus items",
  })
  .sort({ createdAt: -1 });


    // 🟠 Step 3: Handle empty results gracefully
    if (!assignments || assignments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No delivery assignments found for you right now 🚫",
      });
    }

    // 🟧 Step 4: Clean response formatting
  const formattedAssignments = assignments.map((a) => {
  const matchedShopOrder = a.order?.shopOrder?.find((o) =>
    o._id.equals(a.shoporderid)
  );

  return {
    id: a._id,
    status: a.status,
    orderId: a.order?._id,

    shop: {
      name: a.shop?.name,
      address: a.shop?.address,
      mobile: a.shop?.mobile,
      image: a.shop?.image,
    },
    owner: matchedShopOrder?.owner
      ? {
          id: matchedShopOrder.owner._id,
          fullname: matchedShopOrder.owner.fullname,
          email: matchedShopOrder.owner.email,
          mobile: matchedShopOrder.owner.mobile,
        }
      : null, // ✅ added owner extraction
    customer: {
      name: a.order?.user?.fullname,
      mobile: a.order?.user?.mobile,
      address: a.order?.user?.address,
    },
    total: a.order?.totalamount,
    payment: a.order?.paymentmethod,
    createdAt: a.order?.createdAt,
    items: matchedShopOrder?.shopOrderItems || [],
  };
});


    // 🟠 Step 5: Send response
    return res.status(200).json({
      success: true,
      count: formattedAssignments.length,
      message: "Active delivery assignments fetched successfully ✅",
      assignments: formattedAssignments,
    });
  } catch (error) {
    console.error("🚨 Error fetching delivery assignments:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching delivery assignments",
      error: error.message,
    });
  }
};
const acceptdelivery = async (req, res) => {
  try {
    const { assigmentId } = req.params;
    const deliveryboyid = req.userId || req.body.userId;

    // 🟢 Step 1: Validate assignment
    const assigment = await Delivery.findById(assigmentId);
    if (!assigment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // 🟡 Step 2: Ensure assignment is still open
    if (assigment.status !== "Brodcasted") {
      return res
        .status(400)
        .json({ success: false, message: "Assignment has expired" });
    }

    // 🟠 Step 3: Prevent multiple active assignments for same rider
    const activeDelivery = await Delivery.findOne({
      assignedTo: deliveryboyid,
      status: { $nin: ["Brodcasted", "completed"] },
    });
    if (activeDelivery) {
      return res.status(400).json({
        success: false,
        message: "Complete your current delivery before accepting another one",
      });
    }

    // 🔵 Step 4: Assign delivery boy & update assignment
    assigment.assignedTo = deliveryboyid;
    assigment.status = "assigned";
    assigment.acceptedAt = new Date();
    await assigment.save();

    // 🟣 Step 5: Link delivery to corresponding order + shoporder
    const order = await Order.findById(assigment.order);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const shoporder = order.shopOrder.find(
      (o) => o._id.toString() === assigment.shoporderid.toString()
    );
    if (!shoporder) {
      return res
        .status(404)
        .json({ success: false, message: "Shop order not found" });
    }

    // ✅ Assign delivery boy
    shoporder.assignedboy = deliveryboyid;
    shoporder.assigment = assigment._id;
    order.markModified("shopOrder");
    await order.save();

    // 🔴 Step 6: Expire all other broadcasts of same order
    await Delivery.updateMany(
      {
        _id: { $ne: assigmentId },
        order: assigment.order,
        status: "Brodcasted",
      },
      { $set: { status: "expired" } }
    );

    // 🧠 Step 7: Re-fetch updated order with proper populate
    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: "shopOrder.assignedboy",
        select: "fullname email mobile",
      })
      .populate({
        path: "shopOrder.assigment",
        populate: { path: "assignedTo", select: "fullname email mobile" },
      })
      .populate("user", "fullname mobile")
      .lean();

    const updatedshoporder = populatedOrder.shopOrder.find(
      (o) => o._id.toString() === assigment.shoporderid.toString()
    );

    // 🟢 Step 8: Send clean structured response
    return res.status(200).json({
      success: true,
      message: "✅ Delivery assignment accepted successfully",
      assignment: {
        id: assigment._id,
        status: assigment.status,
        order: assigment.order,
        shoporderid: assigment.shoporderid,
        assignedTo: deliveryboyid,
        acceptedAt: assigment.acceptedAt,
      },
      shoporder: {
        id: updatedshoporder._id,
        status: updatedshoporder.status,
        assignedboy: updatedshoporder.assignedboy
          ? {
              id: updatedshoporder.assignedboy._id,
              fullname: updatedshoporder.assignedboy.fullname,
              mobile: updatedshoporder.assignedboy.mobile,
              email: updatedshoporder.assignedboy.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("acceptdelivery error:", error);
    return res.status(500).json({
      success: false,
      message: `accepterror: ${error.message}`,
    });
  }
};

const getcurrentassiorder = async (req, res) => {
  try {
    // 🟢 Step 1: Find active assignment for current delivery boy
    const assignment = await Delivery.findOne({
      assignedTo: req.userId,
      status: "assigned",
    })
      .populate("shop", "name location")
      .populate("assignedTo", "fullname mobile email location")
      .populate({
      path: "order",
      select: "delmobile deliveryaddress shopOrder user", // ✅ include delmobile here
      populate: [
        { path: "user", select: "fullname email mobile location" },
        { path: "shopOrder.shop", select: "name image" },
        {path:'shopOrder.owner',select:"name fullname mobile email"},
        {path:"shopOrder.shopOrderItems.item",select:"name image quantity price"}
      ],
    });
      // .populate("order.user","fullname mobile email location")

      // .populate("order","delmobile")
      // .populate("order.shopOrder.shop","name image address")
    // ❌ Assignment not found
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found ❌",
      });
    }

    // ❌ Order not found
    if (!assignment.order) {
      return res.status(404).json({
        success: false,
        message: "Order not found ❌",
      });
    }

    // 🟡 Step 2: Match the specific shop order under this assignment
    const shoporder = assignment.order.shopOrder?.find(
      (so) => String(so._id) === String(assignment.shoporderid)
    );

    if (!shoporder) {
      return res.status(404).json({
        success: false,
        message: "No matching shop order found ❌",
      });
    }

    // 🟢 Step 3: Extract delmobile safely
    const delmobile = assignment?.order?.delmobile || null;
     const owner=assignment?.shoporder?.owner
     const orderitems=assignment?.shoporder?.shopOrderItems
    // 🟢 Step 4: Extract delivery boy live location
    const deliveryboylocation = (() => {
      const loc = assignment.assignedTo?.location?.coordinates;
      return Array.isArray(loc) && loc.length === 2
        ? { lat: loc[1], lon: loc[0] }
        : { lat: null, lon: null };
    })();

    // 🟢 Step 5: Extract customer delivery address location
    const customerlocation = (() => {
      const addr = assignment.order?.deliveryaddress;
      return addr
        ? { lat: addr.latitude || null, lon: addr.longitude || null }
        : { lat: null, lon: null };
    })();

    // 🟢 Step 6: Return formatted response
    return res.status(200).json({
      success: true,
      message: "Current active assignment fetched successfully ✅",
      data: {
        assignment,
        shoporder,
        deliveryboylocation,
        customerlocation,
        delmobile,
        owner,
        orderitems
      },
    });
  } catch (error) {
    console.error("❌ getcurrentassiorder error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching current assignment ❌",
      error: error.message,
    });
  }
};
// ⚡ getorderbyid controller – super ultimate professional version
const getorderbyid = async (req, res) => {
  try {
    // 🧩 step 1: extract and validate id
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "order id is required to fetch details ⚠️",
      });
    }

    // 🚀 step 2: query and deep populate nested data
    const order = await Order.findById(orderId)
      .populate({
        path: "shopOrder.shop",
        model: "Shop",
        select: "name address city state image",
      })
      .populate({
        path: "shopOrder.assignedboy",
        model: "user",
        select: "fullname mobile location email",
      })
      .populate({
        path: "shopOrder.shopOrderItems.item",
        model: "Item",
        select: "name price image category",
      })
      .populate({
        path: "user",
        select: "fullname email mobile location",
      })
      .lean();

    // ❌ step 3: handle not found
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "order not found ❗",
      });
    }

    // 🎯 step 4: enhance order dynamically
    const enhancedorder = {
      ...order,
      summary: {
        totalshops: order.shopOrder?.length || 0,
        totalitems: order.shopOrder?.reduce(
          (sum, shop) => sum + (shop.shopOrderItems?.length || 0),
          0
        ),
      
      },
      ui: {
        theme: "glass-futuristic",
        animation: "floatin-neon",
        status: "active",
      },
    };

    // ✅ step 5: success response
    return res.status(200).json({
      success: true,
      message: "orderid fetched successfully ✅",
      order: enhancedorder,
    });
  } catch (error) {
    console.error("❌ getorderbyid error:", error);

    return res.status(500).json({
      success: false,
      message: "internal server error while fetching order 💥",
      error: error.message,
      hint: "verify objectid or mongoose population paths",
    });
  }
};

const senddelotp=async(req,res)=>{

   try {
    const{orderId,shopOrderId}=req.body;
       const order=await Order.findById(orderId).populate("user")
       const shopOrder=order.shopOrder.findById(shopOrderId)
      if(!order ||!shopOrder){
      
      return res.status(400).json({message:`Enter valid order/shoporderid `})



      }
    const otp= Math.floor(1000+ Math.random()*900000).toString()
     shopOrder.delotp=otp
     shopOrder.otpexpires=Date.now() +5*60*1000
      await order.save()
     await sendeliveryotp(order.user,otp)
     return res.status(200).json({success:true,
      message:`Otp sent successfully to ${order?.user?.fullname}`
     })


   } catch (error) {
    return res.status(400).json({message:`delotp error ${error}`})
    
   }


}

const verifydelotp=async(req,res)=>{
 try {

   const{orderId,shopOrderId,otp}=req.body
      const order=await Order.findById(orderId).populate("user")
       const shopOrder=order.shopOrder.findById(shopOrderId)
      if(!order ||!shopOrder){
      
      return res.status(400).json({message:`Enter valid order/shoporderid `})



      }
    if(otp!==shopOrder.delotp || shopOrder.otpexpires<Date.now()){

      return res.status(400).json({message:`Invalid Otp `})

    }
    shopOrder.status="delivered"
    shopOrder.deliveryAt=Date.now()
    await order.save()
    await Delivery.deleteOne({

      shopOrder:shopOrder._id,
      order:order._id,
      assignedTo:shopOrder.assignedboy



    })
    return res.status(200).json({success:true,message:`Otp verified successfully ,delivery compeleted `})


  
 } catch (error) {
  return res.status(400).json({message:`delverifyotp error ${error}`})
  
 }









}






module.exports = {
  placeorder,
  getuserorders,
  getownerorders,
  updateorderstatus,
  getdelassignment,
  acceptdelivery,
  getcurrentassiorder,
  getorderbyid,
  senddelotp,
  verifydelotp
};

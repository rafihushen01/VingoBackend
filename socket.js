const sockethandler=async(io)=>{


    io.on("connection",(socket)=>{

        console.log(socket.id)
    })

}
module.exports={sockethandler}
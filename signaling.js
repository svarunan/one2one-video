var express = require('express'),
	app = express(),
	fs = require('fs'),
	port = 8080,
	https = require('https'),
	// refer http://stackoverflow.com/questions/5998694/how-to-create-an-https-server-in-node-js for Https in node
 	privateKey  = fs.readFileSync(__dirname+'/ssl/your.key', 'utf8'),
	certificate = fs.readFileSync(__dirname+'/ssl/your.crt', 'utf8'),
	credentials = {key: privateKey, cert: certificate},
	httpsServer = https.createServer(credentials, app),
	io = require('socket.io')(httpsServer);
	
var onlineClients = {}; // maintain all online clients here
var ioVcall = io.of('/videocall'); // create a separate name space for videocall

io.set('transports', ['websocket']); //'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling'

ioVcall.on('connection',function(socket){
		console.log(socket.id+" : on Video server");
		socket.on('publishPresence',function(data){
			console.log('publishPresence',data);
			ioVcall.emit('newPeer',{'peerId':socket.id,'peerName':data.peerName});
			socket.emit('peerList',onlineClients);
			onlineClients[socket.id] = data.peerName;
		});
		socket.on('disconnect',function() {
		    console.log('disconnect : ',socket.id);
		    ioVcall.emit('peerDisconnect',{'peerId':socket.id});
		    delete onlineClients[socket.id];
		});
		socket.on('terminate', function(data) {
			var toUser = data.peer_id;
			console.log('terminate event from '+socket.id+' ---> '+toUser);
			ioVcall.to(toUser).emit('terminate',{'peer_id':socket.id}); 
		});
		socket.on('incomingCall', function(data) {
		    var toUser = data.toUser;
		   	console.log('incomingCall to '+toUser);
		   	ioVcall.to(toUser).emit('incomingCall',{'fromUser':socket.id});
		});
		socket.on('readyForCall', function(data) {
		    var toUser = data.toUser;
		    console.log('readyForCall to : ',toUser);
		   ioVcall.to(toUser).emit('readyForCall',{'fromUser':socket.id});
		});
		socket.on('inviteICE',function(data) {
			var toUser = data.peer_id;
			var ice = data.ice_candidate;
			ioVcall.to(toUser).emit('inviteICE',{'peer_id':socket.id, 'ice_candidate':ice});
			console.log('Sending ICE to '+toUser+' from '+socket.id);
		});
		socket.on('inviteSDP', function(data) {
		    console.log('------> INVITE SDP To : '+data.peer_id);
		    ioVcall.to(data.peer_id).emit('inviteSDP',{'peer_id':socket.id,'sdp':data.sdp});
		});
	});

process.on('uncaughtException', function (err) {
  console.error(err.stack);
  console.log("Node error");
});

httpsServer.listen(port,"0.0.0.0",function(){ // you can use any port
    console.log('https on '+port);
});

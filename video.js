var cfg = {
	id 					: null,
	localStream			: null,
	RTCP_options 		: [{url: "stun:stun.services.mozilla.com"},{url: "stun:stun.l.google.com:19302"}],
	name				: null
};
var pc;
var socket = null;
var remoteSocket = null;
function init(username){
	socket = io(document.location.origin+":8080/videocall",{transports:['websocket']},{secure: true});
	socket.on('connect',function(){
		cfg.id = socket.nsp+"#"+socket.id;
		$('#mySocketId').html(socket.id);
		cfg.name = username;
		socket.emit('publishPresence',{"peerName":cfg.name});
		console.info(cfg.id,' : connected....');
		_getUserMedia();
	});
	socket.on('newPeer', function(data) {
		console.log('newPeer : ',data);
		if(data.peerId != cfg.id)
	    	$('#contactList').append('<option id='+_getId(data.peerId)+' value="'+_getId(data.peerId)+'">'+data.peerName+'</option>');
	});
	socket.on('peerDisconnect', function(data) {
	    console.log('peerDisconnect ',data);
	    $('#'+_getId(data.peerId)).remove();
	});
	socket.on('terminate', function(data) {
	    console.log('terminate request from : '+data.peer_id);
		pc.hangupfrom = 'remote';
		pc.close();
		removeMediaElements();
	});
	socket.on('peerList',function(data) {
		console.log('peerList : ',data);
	    for(var i in data){
	    	$('#contactList').append('<option id='+_getId(i)+' value="'+_getId(i)+'">'+data[i]+'</option>');	
	    }
	});
	socket.on('incomingCall', function(data) {
	    var fromUser = data.fromUser;
	    console.log('Incoming 100  INVITE');
	    setPC(fromUser, function() {
	    	socket.emit('readyForCall',{"toUser":fromUser});
	        console.log('Outgoing 180 READY ', fromUser);
	    });
	});
	socket.on('readyForCall', function(data) {
		console.log('Incoming 180 READY',data);
	    var fromUser = data.fromUser;
	    _createOffer(fromUser);
	});
	socket.on('inviteICE',function(data) {
		console.log('incoming ICE ',data.ice_candidate);
		var ice = data.ice_candidate;
		var fromUser = data.peer_id;
		pc.addIceCandidate(new RTCIceCandidate(ice)).catch(errorHandler);
	});
	socket.on('inviteSDP', function(data) {
		console.log('Incoming inviteSDP \n',data.sdp.sdp);
	    pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(function() {
	        if(data.sdp.type == 'offer') {
	            pc.createAnswer().then(function(description){
	            	console.log('createAnswer() success');
				    pc.setLocalDescription(description).then(function() {
				        socket.emit('inviteSDP',{'sdp': pc.localDescription, 'peer_id':data.peer_id});
				        console.log('Outgoing inviteSDP ANSWER',pc.localDescription,' : ',data.peer_id);
				    }).catch(errorHandler);	            	
	            }).catch(errorHandler);
	        }
	    }).catch(errorHandler);	
	});
}
function _getId(e){
	return e.replace('/videocall#','');
}
function _setId(e){
	return '/videocall#'+e;
}
function signalInvite(user){
	setPC(user, function(pc) {
		console.log('Sending Invite Signal to '+user);
		socket.emit('incomingCall',{"toUser": user});
		console.log('Outgoing 100 INVITE');
	});
}
/* Media functions */

function setPC(User, cb){
    pc = new RTCPeerConnection({ 'iceServers': cfg.RTCP_options });
    pc.hangupfrom = null;
    remoteSocket = User;
    pc.onicecandidate = function(event){ // ICE genarated
		if (!event || !event.candidate) return;
		console.log('sending ICE to ',User,'\n',event.candidate);
	    socket.emit('inviteICE', {
	        'peer_id': User,
	        'ice_candidate':  event.candidate
	    });
    };
    if(!cfg.localStream){
    	alert('No localStream');
    	return;
    }
    pc.addStream(cfg.localStream);
    pc.onaddstream = function(event) {
        console.log("Got Remote Steam ", event);
        $('#remoteVideo').attr('src',window.URL.createObjectURL(event.stream));
        $('#remoteVideo').attr("autoplay", "autoplay");
        $('#remoteVideo').attr("controls", "");
        $('#remoteVideoDiv').append('<button id=hangup onclick="hangup()">Hangup</button>');      
    };
    pc.oniceconnectionstatechange = function(e){
    	var iceState = this.iceConnectionState;
    	console.log('oniceconnectionstatechange : ',iceState);
    	if(iceState == "disconnected" && pc.hangupfrom == null){ // this comes if disconnect is from remote
    		pc.hangupfrom = 'remote';
    		pc.close();
    		removeMediaElements();
    	}
    	if(iceState == "closed" && pc.hangupfrom == null){ // this comes if disconnect is from local
    		pc.hangupfrom = 'local';
    		removeMediaElements();
    	}
    };
    pc.onremovestream = function(e){
    	console.log('onremovestream \n',e);	
    };
    pc.onsignalingstatechange = function(e){
    	var signalState = pc.signalingState;
    	console.log('onsignalingstatechange pc is :'+ signalState);
    	if(signalState == 'closed'){
    		pc = null;
    	}
    };
    console.log('RTCPeerConnection pc success: \n',pc);
    cb(pc);
}
function _createOffer(toUser){
	console.log('_createOffer started...',toUser);
	pc.createOffer().then(function(description){
		console.log('createOffer() Success');
	    pc.setLocalDescription(description).then(function() {
	        socket.emit('inviteSDP',{'sdp': pc.localDescription, 'peer_id': toUser}); // doubt
	        console.log('Outgoing inviteSDP OFFER \n',pc.localDescription.sdp,' : ',toUser);
	    }).catch(errorHandler);		
	}).catch(errorHandler);
}
function errorHandler(error) {
    console.warn('errorHandler ',error);
}
function _getUserMedia(callback, errorback){
	getUserMedia({"audio":true, "video":true},
	    function(stream) {
	        console.log("getUserMedia success");
	        cfg.localStream = stream;
	   		$('#localVideo').attr('src',window.URL.createObjectURL(stream));
	   		$('#localVideo').attr("autoplay", "autoplay");
            $('#localVideo').attr("muted", "true");
            $('#localVideo').attr("controls", "");
	        if (callback) callback(stream);
	    },
	    function(error) {
	        console.log("Access denied for audio/video");
	        alert("access to the camera/microphone denied");
	        if (errorback) errorback();
	    }
	);
}

/*	UI triggers */

$('#callContact').click(function() {
   var peerBlegId = $('#contactList option:selected').val();
   var peerBlegName = $('#contactList option:selected').text();
   if(peerBlegId){
   	signalInvite(_setId(peerBlegId));
   }
});
$('#click_login').click(function() {
	var name = $('#input_name').val();
	if(!name){
		alert('please enter your name to start');
		return;
	}
	init(name);
    $('#input_name').attr('disabled',true);
    $('#click_login').attr('disabled',true);
});

function uuid(){
	return Math.random().toString(16).substr(2,12);
}

function hangup(){
	pc.hangupfrom = 'local';
	pc.close();
	socket.emit('terminate',{'peer_id':remoteSocket});
	removeMediaElements();
}
function removeMediaElements(){
	var rv= $('#remoteVideo')[0];
	if(rv){
		rv.src='';
		rv.controls=false;
	}
	$('#hangup').remove();
	remoteSocket=null;
}		
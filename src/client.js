const STUN_SERVER = 'stun.1.google.com:19302'; // TODO - what's this
const WS_URL = 'ws://localhost:3013';

class Chat {

	constructor() {
		console.log('Init Chat class');

		this.localVideo = document.getElementById('local-video');
		this.remoteVideo = document.getElementById('remote-video');

		this.signalingServer = null;
		this.peerConnection = null;
		this.roomKey = null;
		this.sendToServer = this.sendToServer.bind(this);

		this.bindUserActions();
		this.initializeSocket();
	}

	sendToServer(data) {
		console.log('Sending to server', data.type);
		this.signalingServer.send(JSON.stringify(data));
	}

	bindUserActions() {
		const createBtn = document.getElementById('create-room');
		const joinBtn = document.getElementById('join-room');

		createBtn.addEventListener('click', () => this.start(true));
	}

	initializeSocket() {

		this.serverConnection = new WebSocket('ws://127.0.0.1:3013');
		this.serverConnection.onmessage = message => this.gotMessageFromServer(message);

		var constraints = {
			video: true,
			audio: true,
		};
		navigator.mediaDevices.getUserMedia(constraints)
			.then((media) => this.getUserMediaSuccess(media))
			.catch(this.rtcError);
	}

	getUserMediaSuccess(stream) {
		console.log("getUserMediaSuccess");
		this.localStream = stream;
		this.localVideo.srcObject = stream;
		this.localVideo.play();
	}

	start(isCaller) {
		var peerRole = isCaller ? "Caller" : "Callee";
		console.log("start("+ peerRole+")");
		this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
		this.peerConnection.onicecandidate = event => this.gotIceCandidate(event);
		this.peerConnection.ontrack = event => this.gotRemoteStream(event);
		this.peerConnection.addStream(this.localStream);

		if(isCaller) {
			console.log("Caller: createOffer");
			this.peerConnection.createOffer()
				.then((description) => this.gotDescription(description))
				.catch(this.rtcError);
		} else {
			this.serverConnection.send(JSON.stringify({'sdp': null}));
		}
	}

	gotDescription(description) {
		console.log('got local description');
		this.peerConnection.setLocalDescription(description, () => {
			console.log('send local sdp to server >>', description);
			this.serverConnection.send(JSON.stringify({'sdp': description}));
		}, this.rtcError);
	}

	gotIceCandidate(event) {
		console.log('got local IceCandidate and send it to server', event.candidate);
		if(event.candidate != null) {
			this.serverConnection.send(JSON.stringify({'ice': event.candidate}));
		}
	}

	gotRemoteStream(event) {
		console.log("got remote stream", event);
		this.remoteVideo.srcObject = event.streams[0];
		this.remoteVideo.play();
	}

	rtcError(error) {
		console.log(error);
	}

	gotMessageFromServer(message) {
		var caller=true;
		if(!this.peerConnection){
			this.start(false);
			caller=false;
		}

		var signal = JSON.parse(message.data);
		if(signal.sdp) {
			console.log('gotMessageFromServer: signal.sdp' );
			if(caller) this.peerConnection.setRemoteDescription(
				new RTCSessionDescription(signal.sdp), function(){},this.rtcError);
			else{
				this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
				.then(() => {
					console.log("Callee: CreateAnswer");
					this.peerConnection.createAnswer()
						.then(desc => this.gotDescription(desc))
						.catch( this.rtcError);
				})
				.catch( this.rtcError);
			}
		} else if(signal.ice) {
			console.log('gotMessageFromServer: signal.ice' + signal.ice.candidate);
			this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
		}
	}
}

new Chat();
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

		this.adapter();
		this.bindUserActions();
		this.initializeSocket();
	}

	adapter() {
		navigator.mediaDevices.getUserMedia = navigator.mediaDevices.getUserMedia || navigator.webkitGetUserMedia;
		window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
		window.RTCIceCandidate = window.RTCIceCandidate || window.webkitRTCIceCandidate;
		window.RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription;
	}

	bindUserActions() {
		const createBtn = document.getElementById('create-room');
		const joinBtn = document.getElementById('join-room');

		createBtn.addEventListener('click', () => this.start(true));
	}

	initializeSocket() {
		this.signalingServer = new WebSocket(WS_URL);
		this.signalingServer.onmessage = message => this.handleNewMessage(message);

		navigator.mediaDevices.getUserMedia({ video: true, audio: true })
			.then((media) => this.getUserMediaSuccess(media))
			.catch(this.rtcError);
	}

	getUserMediaSuccess(stream) {
		console.log('getUserMediaSuccess');
		this.localStream = stream;
		this.localVideo.srcObject = stream;
		this.localVideo.play();
	}

	start(isCaller) {
		var peerRole = isCaller ? 'Caller' : 'Callee';
		console.log('start('+ peerRole+')');
		this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
		this.peerConnection.onicecandidate = event => this.gotIceCandidate(event);
		this.peerConnection.ontrack = event => this.gotRemoteStream(event);
		this.peerConnection.addStream(this.localStream);

		if(isCaller) {
			console.log('Caller: createOffer');
			this.peerConnection.createOffer()
				.then((description) => this.gotDescription(description))
				.catch(this.rtcError);
		}
	}

	gotDescription(description) {
		console.log('got local description');
		this.peerConnection.setLocalDescription(description, () => {
			console.log('send local sdp to server >>', description);
			this.sendToServer({'sdp': description});
		}, this.rtcError);
	}

	gotIceCandidate(event) {
		console.log('got local IceCandidate and send it to server', event.candidate);
		if(event.candidate != null) {
			this.sendToServer({'ice': event.candidate});
		}
	}

	gotRemoteStream(event) {
		console.log('got remote stream', event);
		this.remoteVideo.srcObject = event.streams[0];
		this.remoteVideo.play();
	}

	rtcError(error) {
		console.log(error);
	}

	handleNewMessage(message) {
		console.log('handling new message');

		var caller = true;
		if (!this.peerConnection) {
			this.start(false);
			caller = false;
		}

		var signal = JSON.parse(message.data);
		if (signal.sdp) {
			console.log('handleNewMessage: signal.sdp' );
			if (caller) {
				this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
					.catch(this.rtcError);
			}	else {
				this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
				.then(() => {
					console.log('Callee: CreateAnswer');
					this.peerConnection.createAnswer()
						.then(desc => this.gotDescription(desc))
						.catch( this.rtcError);
				})
				.catch( this.rtcError);
			}
		} else if(signal.ice) {
			console.log('handleNewMessage: signal.ice' + signal.ice.candidate);
			this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
		}
	}
}

new Chat();

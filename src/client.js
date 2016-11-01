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
			.then((media) => this.onMedia(media))
			.catch(this.onError);
	}

	sendToServer(data) {
		console.log('Sending to server', data);
		this.signalingServer.send(JSON.stringify(data));
	}

	onMedia(stream) {
		console.log('onMedia');
		this.localStream = stream;
		this.localVideo.srcObject = stream;
		this.localVideo.play();
	}

	start(isSender) {
		var peerRole = isSender ? 'Sender' : 'Receiver';
		console.log(`starting ${peerRole}`);
		this.peerConnection = new RTCPeerConnection(this.peerConnectionConfig);
		this.peerConnection.onicecandidate = event => this.onIceCandidate(event);
		this.peerConnection.ontrack = event => this.receiveRemoteStream(event);
		this.peerConnection.addStream(this.localStream);

		if(isSender) {
			console.log('Sender: createOffer');
			this.peerConnection.createOffer()
				.then(description => this.onSetDescription(description))
				.catch(this.onError);
		}
	}

	onSetDescription(description) {
		console.log('on set local description', description);
		this.peerConnection.setLocalDescription(description, () => {
			console.log('send local sdp to server >>', description);
			// sending to server the local user configuration
			this.sendToServer({sdp: description});
		}, this.onError);
	}

	onIceCandidate(event) {
		if (event.candidate) {
			console.log('[LOCAL] onIceCandidate. Send to server the candidate', event.candidate);
			this.sendToServer({ice: event.candidate});
		}
	}

	receiveRemoteStream(event) {
		console.log('receive remote stream', event);
		this.remoteVideo.srcObject = event.streams[0];
		this.remoteVideo.play();
	}

	onError(error) {
		console.log(error);
	}

	handleNewMessage(message) {
		console.log('handling new message');

		var sender = true;
		if (!this.peerConnection) {
			// if there's no peer connection it means
			// the current user is the receiver
			console.log('Partner should be connected');
			this.start();
			sender = false;
		}

		var signal = JSON.parse(message.data);
		if (signal.sdp) {
			console.log('handleNewMessage: signal.sdp' );
			if (sender) {
				this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
					.catch(this.onError);
			}	else {
				// if currrent connection isn't the sender I need to send back (createAnswer)
				//
				this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
					.then(() => {
						console.log('Receiver: CreateAnswer');
						this.peerConnection.createAnswer()
							.then(desc => this.onSetDescription(desc))
							.catch(this.onError);
				})
				.catch(this.onError);
			}
		}

		if(signal.ice) {
			console.log(`Adding ICE candidadate ${signal.ice.candidate}`);
			this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
		}
	}
}

new Chat();

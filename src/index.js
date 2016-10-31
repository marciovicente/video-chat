const STUN_SERVER = 'stun.1.google.com:19302'; // what's this
const WS_URL = 'ws://localhost:3013';

class Chat {

	constructor() {
		console.log('Init Chat class');

		// bind user behavior
		const localVideo = document.getElementById('local-video');
		const remoteVideo = document.getElementById('remote-video');
		const createBtn = document.getElementById('create-room');
		const joinBtn = document.getElementById('join-room');

		this.signalingServer = null;
		this.peerConnection = null;
		this.roomKey = null;
		this.stream = null;
		this.remoteStream = null;
		this.remoteSDP = null;
		this.candidates = [];
		this.socketEvent = document.createEvent('Event');
		this.socketEvent.initEvent('socketEvent', true, true);
		this.sendToServer = this.sendToServer.bind(this);
		this.onStream = this.onStream.bind(this);
		this.joinRoom = this.joinRoom.bind(this);

		createBtn.addEventListener('click', () => this.createRoom());
		joinBtn.addEventListener('click', () => this.joinRoom());

		this.initializeSocket();
	}

	sendToServer(data) {
		console.log('Sending to server', data.type);
		this.signalingServer.send(JSON.stringify(data));
	}

	onICECandidate(event) {
		const { candidate } = event;
		console.log('On ICE candidate', candidate);

		if (!candidate) {
			return;
		}

		this.sendToServer({
			type: 'iceCandidate',
			payload: candidate,
			roomKey: this.roomKey
		});
	}

	onStream(media, selector, remote) {
		const videoTag = document.getElementById(selector);
		if (remote) {
			this.remoteStream = media;
		} else  {
			this.stream = media;
		}
		videoTag.srcObject = media;
		videoTag.play();
	}

	createRoom() {
		console.log('Creating room');
		this.sendToServer({
			type: 'room:created',
			payload: null
		});

		navigator.mediaDevices.getUserMedia({
			audio: true,
			video: true
		})
			.then((media) => this.onStream(media, 'local-video'))
			.catch(err => console.warn(err));
	}

	joinRoom() {
		const rid = document.getElementById('room-id').value;
		this.roomKey = rid;
		console.log('Joining room');

		// reuse code below
		navigator.mediaDevices.getUserMedia({
			audio: true,
			video: true
		})
			.then((media) => {
				this.onStream(media, 'local-video')
				this.sendToServer({
					type: 'offer',
					payload: this.roomKey
				});
			})
			.catch(err => console.warn(err));
	}

	bindPeerEvents(remote) {
		console.log('Binding peer events', remote, this.stream, this.remoteStream);
		this.peerConnection = new RTCPeerConnection({
			urls: [`stun:${STUN_SERVER}`]
		});

		this.peerConnection.addStream(remote ? this.remoteStream : this.stream);

		if (remote) {
			console.log(this.remoteSDP.payload);
			this.peerConnection.setRemoteDescription(new RTCSessionDescription({ sdp: this.remoteSDP.payload, type: 'offer' }));
		}

		// bind PC event handlers
		this.peerConnection.ontrack = event => this.onTrack(event);
		// this.peerConnection.onaddstream = event => this.onTrack(event);
		this.peerConnection.onicecandidate = event => this.onICECandidate(event);
		this.peerConnection.createOffer().then(SDP => this.onCreateOffer(SDP));
	}

	onCreateOffer(SDP) {
		const { roomKey } = this;
		console.log(`Sending offer roomKey:${roomKey}`);
		this.peerConnection.setLocalDescription(SDP);
		this.sendToServer({ type: 'offer', payload: roomKey });
	}

	onTrack(event) {
		console.log('on track...');
		this.remoteStream = event.stream;

		const videoTag = document.getElementById('remote-video');
		videoTag.srcObject = this.remoteStream;
		videoTag.play();

		this.socketEvent.eventType = 'onStreamAdded';
		document.dispatchEvent(this.socketEvent);
	}

	initializeSocket() {
		this.signalingServer = new WebSocket(WS_URL);
		this.signalingServer.onopen = () => console.log(new Date() + 'SignalingServer client opened');
		this.signalingServer.onclose = ev => console.log(new Date() + 'SignalingServer client closed');
		this.signalingServer.onmessage = (msg) => this.handleNewMessage(msg);
	}

	setICECandidates(candidate, roomKey) {
		console.log('setICECandidates', candidate, roomKey);
		this.peerConnection = new RTCPeerConnection({
			urls: [`stun:${STUN_SERVER}`]
		});

		// if (candidate && candidate.candidate && candidate.candidate !== null) {
			this.peerConnection.setRemoteDescription(new RTCSessionDescription({ sdp: roomKey }));
			const rtcCandidate = new RTCIceCandidate(candidate);
			console.log(candidate, rtcCandidate.candidate);
			this.peerConnection.addIceCandidate(rtcCandidate).then(d => {
				console.log('candidate added', d);
			})
			.catch(e => console.log('error on add candidate', e));

			this.peerConnection.ontrack = event => this.onTrack(event);
		// }
	}

	handleNewMessage(message) {
		const data = JSON.parse(message.data);
		console.log('Handling new message', data.payload);
		const { payload, roomKey } = data;

		switch (data.type) {
			case 'room:created':
				console.log(`[CLIENT] room:created:${payload}`);
				this.roomKey = payload;
				this.socketEvent.eventType = 'room:created';
				// hide create button or redirect
				break;
			case 'offer':
				console.log('[CLIENT] offer');
				this.remoteSDP = payload;
				console.log('>>>>>>>>>>>', payload);
				this.bindPeerEvents(true);
				break;
			// case 'answer':
			// 	console.log('[CLIENT] answer');
			// 	this.remoteSDP = payload;
			// 	this.closeHandshake();
			// 	break;
			case 'iceCandidate':
				console.log('[CLIENT] iceCandidate');
				if (payload.candidate) {
					this.peerConnection = new RTCPeerConnection({
						urls: [`stun:${STUN_SERVER}`]
					});
				}
				this.setICECandidates(payload, roomKey);
				break;
		}

		if (payload.candidate) {
			this.peerConnection.addIceCandidate(new RTCIceCandidate(payload))
				.catch(err => console.log('Error on set ice candidate', err));
		}
	}
}

new Chat();

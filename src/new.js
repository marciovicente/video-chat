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
		this.peerConnection = new RTCPeerConnection({
			urls: [`stun:${STUN_SERVER}`]
		});
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
		console.log('Sending to server', data);
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
		this.peerConnection.onaddstream({ stream: media });
		this.peerConnection.addStream(media);

		this.peerConnection.createOffer().then(offer => {
			this.peerConnection.setLocalDescription(new RTCSessionDescription(offer))
				.then(offer => {
					console.log('local description setup', offer);
					this.sendToServer(offer);
				})
				.catch(err => console.log(err));
		});
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
				this.onStream(media, 'local-video', true)
				this.sendToServer({
					type: 'offer',
					payload: this.roomKey
				});
			})
			.catch(err => console.warn(err));
	}

	onOffer() {
		this.peerConnection.setRemoteDescription(new RTCSessionDescription(m))
			.then(() => {
				this.peerConnection.createAnswer().then(answer => {
					this.peerConnection.setLocalDescription(new RTCSessionDescription(answer))
						.then(() => {
							this.sendToServer(answer);

							navigator.mediaDevices.getUserMedia({
								audio: true,
								video: true
							})
								.then((media) => this.onStream(media, 'local-video'))
								.catch(err => console.warn(err));
						})
				});
			});
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

	handleNewMessage(message) {
		console.log('Handling new message');
		const data = JSON.parse(message.data);
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
				this.onOffer(data);
				break;
			case 'answer':
				console.log('[CLIENT] answer');
				this.peerConnection.setRemoteDescription(new RTCSessionDescription(data))
					.catch(err => console.log(err));
				break;
		}

		if (data.candidate) {
			this.peerConnection.addIceCandidate(new RTCIceCandidate(data))
				.catch(err => console.log(err));
		}
	}
}

new Chat();

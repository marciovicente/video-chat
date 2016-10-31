
const path = require('path');
const http = require('http');
const fs = require('fs');
const uuid = require('node-uuid');
const WebSocketServer = require('ws').Server;
// const WebSocketServer = require('websocket').server;

const express = require('express');
const app = express();

const port = 3013;
const roomList = {};


app.get('/', function(req, res){
	res.sendFile(`${__dirname}/index.html`);
});

app.use(express.static(`${__dirname}/../dist`));

app.listen('3012', function(req, res){
	console.log('listening on port 3012');
});


const server = http.createServer((req, res) => {
	console.log((new Date()) + ' Received request for ' + request.url);
	response.writeHead(404);
	response.end();
});

// server.listen(3013, function() {
// 	console.log((new Date()) + ' Server is listening on port 3013');
// });

const wss = new WebSocketServer({
	port: 3013,
});

// const wsServer = new WebSocketServer({
// 	httpServer: server,
// 	autoAcceptConnections: false
// });

wss.on('connection', function (ws){
	ws.on('message', function (msg){
		console.log('received: %s', msg);
		wss.clients.forEach(function(other){
			if (other === ws){
				console.log('same client');
				return;
			}else{
				console.log('other client', msg);
				other.send(msg);
			}
		});

	});
});

// wsServer.on('request', (request) => {
// 	console.log('[SERVER] WS request');

// 	const connection = request.accept(null, request.origin);

// 	connection.on('message', message => {
// 		const data = JSON.parse(message.utf8Data);
// 		if (!data && !data.type) {
// 			return;
// 		}
// 		console.log('wsServer', wsServer);
// 		wsServer.clients.forEach(function(other){
// 			if (other === connection){
// 				return;
// 			}else{
// 				return other.send(msg);
// 			}
// 		});

// 		switch (data.type) {
// 			case 'room:created':
// 				console.log('[SERVER] room:created');
// 				createRoom(connection);
// 				break;
// 			case 'offer':
// 				console.log('[SERVER] offer');
// 				onOffer(data, connection);
// 				break;
// 			case 'answer':
// 				console.log('[SERVER] answer');
// 				break;
// 			default:
// 				console.log('[SERVER]', data.type);
// 				if(connection === roomList[data.roomKey].partner) {
// 					console.log('send to creator : '+data.type);
// 					return roomList[data.roomKey].owner.sendUTF(JSON.stringify(data));
// 				}
// 				console.log('send to partner : '+data.type);
// 				return roomList[data.roomKey].partner.sendUTF(JSON.stringify(data));
// 				break;

// 		}
// 	});
// });

const createRoom = (connection) => {
	const roomKey = uuid.v1();
	roomList[roomKey] = {
		owner: connection,
		partner: null
	};

	console.log('Creating', roomKey);

	return connection.sendUTF(JSON.stringify({
		type: 'room:created',
		payload: roomKey
	}));
}

const onOffer = (data, connection) => {
	const roomKey = data.payload;
	console.log('Partner joining: ', roomKey, roomList[roomKey].partner);

	if (roomList[roomKey].partner) {
		console.log('Full room');
		return connection.sendUTF(JSON.stringify({
			type: 'error',
			payload: 'already exists an user in this room'
		}));
	}

	console.log(roomKey, roomList);
	roomList[roomKey].partner = connection;
	return connection.sendUTF(JSON.stringify({
		type: 'offer',
		payload: data
	}));
}

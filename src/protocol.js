﻿var sys = require('util');
var pack = require('jspack').jspack;
var helpers = require('./helpers');

Packet = function (data) {
	this.type = data[0];
	this.data = data;
	this.cursor = 1;
}

Packet.prototype.needs = function (nBytes) {
	if (this.data.length - this.cursor < nBytes) {
		throw Error("oob");
	}
}

var packString = function (str) {
	var buf = new Buffer(str.length * 2);
	for (var i = 0; i < str.length; i++){
		makers['short'](str.charCodeAt(i)).copy(buf, i * 2);
	}
	return helpers.concat(makers['short'](str.length), buf);
}
var unpackString = function (pkt) {
	var len = parsers.short(pkt) * 2;
	pkt.needs(len);
	var buffer = pkt.data.slice(pkt.cursor, pkt.cursor + len);
	var str = "";
	for(var i = 0; i < buffer.length; i+=2){
		str+= String.fromCharCode((buffer[i]<<8) + buffer[i+1]);
	}
	pkt.cursor += len;
	return str;
}
var packIntString = function (str) {
	if (!(str instanceof Buffer)) str = new Buffer(str);
	return helpers.concat(makers['int'](str.length), str);
}
var unpackIntString = function (pkt) {
	var len = parsers.int(pkt);
	pkt.needs(len);
	var str = pkt.data.slice(pkt.cursor, pkt.cursor + len);
	pkt.cursor += len;
	return str;
}

var packBlockArr = function (blks) {
	var buf = makers.short(blks.length);
	var coordArr = new Buffer(0);
	var typeArr = new Buffer(0);
	var metadataArr = new Buffer(0);
	blks.forEach(function (b) {
		var coord = ((b.x & 0xf) << 12) | ((b.z & 0xf) << 8) | (b.y & 0xff);
		coordArr = helpers.concat(coordArr, makers.short(coord));
		typeArr = helpers.concat(typeArr, makers.byte(b.type));
		metadataArr = helpers.concat(metadataArr, makers.byte(b.metadata));
	});

	return helpers.concat(buf, coordArr, typeArr, metadataArr);
}
var unpackBlockArr = function (pkt) {
	var len = parsers.short(pkt);
	var blks = [];
	for (var i = 0; i < len; i++) {
		var coord = parsers.short(pkt);
		var x = (coord & 0xf000) >> 12;
		var z = (coord & 0xf00) >> 8;
		var y = (coord & 0xff);
		blks.push({
			x: x,
			z: z,
			y: y
		});
	}
	for (var i = 0; i < len; i++) {
		blks[i].type = parsers.byte(pkt);
	}
	for (var i = 0; i < len; i++) {
		blks[i].metadata = parsers.byte(pkt);
	}
	return blks;
}

var unpackBool = function (pkt) {
	pkt.needs(1);
	var ret = pkt.data[pkt.cursor] != 0;
	pkt.cursor += 1;
	return ret;
}

var packBool = function (bool) {
	return new Buffer([bool ? 1 : 0]);
}


var packItems = function (items) {
	var buf = makers['short'](items.length);
	for (var i = 0; i < items.length; i++) {
		buf = helpers.concat(buf, makers['short'](items[i].id));
		if (items[i].id != -1) {
			buf = helpers.concat(buf, makers['byte'](items[i].count));
			buf = helpers.concat(buf, makers['short'](items[i].health));
		}
	}
	return buf;
}

var unpackMultiBlocks = function (pkt) {
	var blocks = [];
	var numBlocks = parsers.short(pkt);
	for (var i = 0; i < numBlocks; i++) {
		coord = parsers.short(pkt);
		blocks.push({
			x: (coord >> 12),
			z: ((coord >> 8) & 0xF),
			y: (coord & 0xFF)
		})
	}
	for (var i = 0; i < numBlocks; i++)
	blocks[i].type = parsers.byte(pkt);

	for (var i = 0; i < numBlocks; i++)
	blocks[i].meta = parsers.byte(pkt);

	return blocks;
}

var unpackItems = function (pkt) {
	var items = [];
	var numItems = parsers.short(pkt);
	for (var i = 0; i < numItems; i++) {
		var id = parsers.short(pkt),
			count, health;
		if (id != -1) {
			count = parsers.byte(pkt);
			health = parsers.short(pkt);
		}
		items.push({
			id: id,
			count: count,
			health: health
		});
	}
	return items;
}

var packSlot = function (slot) {
    var buf = new Buffer(0);
	buf = helpers.concat(buf, makers['short'](slot.itemId));
	if (slot.itemId != -1) {
		buf = helpers.concat(buf, makers['byte'](slot.count));
		buf = helpers.concat(buf, makers['short'](slot.damage));
	}
    
    return buf;
}

var unpackSlot = function (pkt) {
    var itemId = parsers.short(pkt), count, damage;
	if (itemId != -1) {
        count = parsers.byte(pkt);
		damage = parsers.short(pkt);
    }
    
    return {
		itemId: itemId,
		count: count,
		damage: damage
		};
}

function byte(name) {
	return ['byte', name];
}

function ubyte(name) {
	return ['ubyte', name];
}

function short(name) {
	return ['short', name];
}

function int(name) {
	return ['int', name];
}

function long(name) {
	return ['long', name];
}

function str(name) {
	return ['str', name];
}

function bool(name) {
	return ['bool', name];
}

function double(name) {
	return ['double', name];
}

function float(name) {
	return ['float', name];
}

function items(name) {
	return ['items', name];
}

function multiblock(name) {
	return ['multiblock', name];
}

function intstr(name) {
	return ['intstr', name];
}

function blockarr(name) {
	return ['blockarr', name];
}

function slot(name) {
	return ['slot', name];
}

var clientPacketStructure = {
	0x00: [int('pingID')],
	0x01: [int('protoVer'), str('username'), long('mapSeed'), int('serverMode'), byte('dimension'), byte('difficulty'), ubyte('height'), ubyte('slots')],
	0x02: [str('username')],
	0x03: [str('message')],
	// 0x05: [int('invType'), items('items')],
	0x05: [int('entityID'), short('slot'), short('itemID'), short('damage')],
	0x07: [int('playerId'), int('targetId'), bool('isLeftClick')],
	0x09: [byte('dimension'), byte('difficulty'), byte('gameMode'), short('worldHeight'), long('mapSeed')],
    0x0a: [bool('onGround')],
	0x0b: [double('x'), double('y'), double('stance'), double('z'), bool('onGround')],
	0x0c: [float('yaw'), float('pitch'), bool('onGround')],
	0x0d: [double('x'), double('y'), double('stance'), double('z'), float('yaw'), float('pitch'), bool('onGround')],
	0x0e: [byte('status'), int('x'), byte('y'), int('z'), byte('face')],
	0x0f: [int('x'), byte('y'), int('z'), byte('direction'), slot('slot')],
	0x10: [short('newSlot')],
	0x12: [int('uid'), byte('animation')],
	0x13: [int('uid'), byte('actionId')],
	0x15: [int('uid'), short('item'), byte('amount'), short('life'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch'), byte('roll')],
	0x65: [byte('windowId')],
	0x66: [byte('windowId'), short('slot'), byte('rightClick'), short('actionNumber'), bool('shift'), slot('slot')],
	0xfe: [],
	0xff: [str('message')],
}

var serverPacketStructure = {
	0x00: [int('pingID')],
	0x01: [int('playerID'), str('serverName'), long('mapSeed'), int('serverMode'), byte('dimension'), byte('difficulty'), ubyte('height'), ubyte('maxPlayers')],
	0x02: [str('serverID')],
	0x03: [str('message')],
	0x04: [long('time')],
	// 0x05: [int('invType'), items('items')],
	0x05: [int('entityID'), short('slot'), short('itemID'), short('damage')],
	0x06: [int('x'), int('y'), int('z')],
	0x0c: [float('yaw'), float('pitch'), bool('onground')],
	0x0d: [double('x'), double('stance'), double('y'), double('z'), float('yaw'), float('pitch'), bool('onGround')],
	//0x0e: [byte('status'), int('x'), byte('y'), int('z'), byte('face')],
	//0x0f: [short('id'), int('x'), byte('y'), int('z'), byte('direction')],
	0x10: [int('uid'), short('item')],
	0x11: [short('itemId'), byte('inBed'), int('x'), byte('y'), int('z')],
	0x12: [int('uid'), byte('animation')],
	0x13: [int('uid'), byte('actionId')],
	0x14: [int('uid'), str('playerName'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch'), short('curItem')],
	0x15: [int('uid'), short('item'), byte('amount'), short('life'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch'), byte('roll')],
	0x16: [int('collectedID'), int('collectorID')],
	0x17: [int('uid'), byte('objType'), int('x'), int('y'), int('z'), int('fireballerId')],
	0x18: [int('uid'), byte('mobType'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch')],
	0x19: [int('uid'), str('title'), int('x'), int('y'), int('z'), int('direction')],
	0x1a: [int('uid'), int('x'), int('y'), int('z'), short('count')],
	0x1d: [int('uid')],
	0x1e: [int('uid')],
	0x1f: [int('uid'), byte('x'), byte('y'), byte('z')],
	0x20: [int('uid'), byte('yaw'), byte('pitch')],
	0x21: [int('uid'), byte('x'), byte('y'), byte('z'), byte('yaw'), byte('pitch')],
	0x22: [int('uid'), int('x'), int('y'), int('z'), byte('yaw'), byte('pitch')],
	0x32: [int('x'), int('z'), bool('mode')],
	// prechunk
	0x33: [int('x'), short('y'), int('z'), byte('sizeX'), byte('sizeY'), byte('sizeZ'), intstr('chunk')],
	// map chunk, gzipped
	0x34: [int('x'), int('z'), multiblock('blocks')],
	// multi block change
	0x35: [int('x'), byte('y'), int('z'), byte('blockType'), byte('blockMetadata')],
	0x65: [byte('windowId')],
	0x67: [byte('windowId'), short('slotId'), short('itemId'), byte('count'), short('damage')],
	0x68: [byte('windowId'), short('count'), intstr('blocks')],
	0x3b: [int('x'), short('y'), int('z'), str('nbt')],
	0xff: [str('message')],
	// disconnect
}

var packetNames = {
	0x00: 'KEEPALIVE',
	0x01: 'LOGIN',
	0x02: 'HANDSHAKE',
	0x03: 'CHAT',
	0x04: 'TIME',
	0x05: 'ENTITY_EQUIPMENT',
	0x06: 'SPAWN_POS',
	0x07: 'USE_ENTITY',
	0x0a: 'FLYING',
	0x0b: 'PLAYER_POSITION',
	0x0c: 'PLAYER_LOOK',
	0x0d: 'PLAYER_MOVE_LOOK',
	0x0e: 'DIG_BLOCK',
	0x0f: 'PLACE_BLOCK',
	0x10: 'CHANGE_HOLDING',
	0x11: 'USE_BED',
	0x12: 'ANIMATION',
	0x13: 'ENTITY_ACTION',
	0x14: 'PLAYER_SPAWN',
	0x15: 'PICKUP_SPAWN',
	0x16: 'COLLECT_ITEM',
	0x17: 'ADD_VEHICLE',
	0x18: 'MOB_SPAWN',
	0x1d: 'DESTROY_ENTITY',
	0x1e: 'CREATE_ENTITY',
	0x1f: 'REL_ENTITY_MOVE',
	0x20: 'ENTITY_LOOK',
	0x21: 'REL_ENTITY_MOVE_LOOK',
	0x22: 'ENTITY_TELEPORT',
	0x32: 'PRE_CHUNK',
	0x33: 'MAP_CHUNK',
	0x34: 'MULTI_BLOCK_CHANGE',
	0x35: 'BLOCK_CHANGE',
	0x3b: 'NBT_ENTITY',
	0x65: 'CLOSE_WINDOW',
	0x66: 'WINDOW_CLICK',
	0x67: 'SET_SLOT',
	0x68: 'WINDOW_ITEMS',
	0xfe: 'SERVER_LIST_PING',
	0xff: 'DISCONNECT',
}

function unpack_fmt(fmt) {
	return function (pkt) {
		var len = pack.CalcLength(fmt);
		pkt.needs(len);
		var value = pack.Unpack(fmt, pkt.data, pkt.cursor);
		pkt.cursor += len;
		return value[0];
	};
}

function pack_fmt(fmt) {
	return function () {
		return new Buffer(pack.Pack(fmt, arguments));
	}
}

var parsers = {
	byte: unpack_fmt('b'),
	ubyte: unpack_fmt('B'),
	short: unpack_fmt('h'),
	int: unpack_fmt('i'),
	long: unpack_fmt('l'),
	str: unpackString,
	bool: unpackBool,
	float: unpack_fmt('f'),
	double: unpack_fmt('d'),
	multiblock: unpackMultiBlocks,
	items: unpackItems,
	intstr: unpackIntString,
	blockarr: unpackBlockArr,
    slot: unpackSlot,
}

var makers = {
	byte: pack_fmt('b'),
	ubyte: pack_fmt('B'),
	short: pack_fmt('h'),
	int: pack_fmt('i'),
	long: pack_fmt('l'),
	str: packString,
	bool: packBool,
	float: pack_fmt('f'),
	double: pack_fmt('d'),
	items: packItems,
	intstr: packIntString,
	blockarr: packBlockArr,
    slot: packSlot,
}

exports.parsePacket = function (buf) {
	return exports.parsePacketWith(buf, clientPacketStructure);
}

exports.parsePacketWith = function (buf, structures) {
	var pkt = new Packet(buf);
	var struct = structures[pkt.type];
	if (!struct) throw Error("unknown packet type while parsing: 0x" + pkt.type.toString(16));
	var pktData = {
		type: pkt.type
	};
	for (var field in struct) {
		var type = struct[field][0];
		var name = struct[field][1];
		pktData[name] = parsers[type](pkt);
	}
	pktData.length = pkt.cursor;
	return pktData;
}

exports.makePacket = function (pktData) {
	return exports.makePacketWith(pktData, serverPacketStructure);
}

exports.makePacketWith = function (pktData, structures) {
	var struct = structures[pktData.type];
	if (!struct) throw Error("unknown packet type while making: 0x" + pkt.type.toString(16));
	var buf = new Buffer([pktData.type]);
	for (var field in struct) {
		var type = struct[field][0];
		var name = struct[field][1];
		buf = helpers.concat(buf, makers[type](pktData[name]));
	}
	return buf;
}

exports.clientPacketStructure = clientPacketStructure;
exports.serverPacketStructure = serverPacketStructure;
exports.packetNames = packetNames;

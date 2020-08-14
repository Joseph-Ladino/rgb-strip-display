/* eslint-disable no-unused-vars */
require("dotenv").config();

const Discord = require("discord.js");
const client = new Discord.Client();
const SerialPort = require("serialport");
const ReadLine = require("@serialport/parser-readline");
const fs = require("fs");
const { off } = require("process");
var myPort = new SerialPort("COM3", { autoOpen: false, baudRate: 2000000 });
var parser = myPort.pipe(new ReadLine());

class Animation {
	constructor(fileName) {
		let json = JSON.parse(fs.readFileSync(`${fileName}.strip`));

		if (json.length < 148) {
			let con = new Array(148 - json.length).fill("#000000");
			for (let i in json.frames) json.frames[i] = json.frames[i].concat(con);
		} else if (json.length > 148) {
			for (let i in json.frames) json.frames[i].splice(148);
		}

		this.length = json.frameCount;
		this.delay = json.frameDelay;
		this._frames = json.frames;
	}

	frames(index) {
		return this._frames[index];
	}
}

class Idle {
	constructor() {
		this["1"] = "#FF0000";
		this["0"] = "#000000";
		this.delay = 33;
		this.length = 1;
		this.limit = 2 ** 18;

		// after 2.42 hours do the funky
		this.Point = class {
			constructor(pos, color, direction, width) {
				this.pos = pos;
				this.color = color;
				this.width = width;
				this.dir = direction;
				this.dead = false;
			}

			get left() {
				return this.pos;
			}

			get right() {
				return this.pos + this.width;
			}

			move() {
				this.pos += this.dir;
			}

			shrink(num) {

				console.log("before", this.width, this.pos);

				this.width -= num;
				this.pos -= this.dir;

				if(this.width < 2) this.dead = true;
			}

			die(arr) {
				arr.splice(arr.indexOf(this), 1);
			}
		};

		this.points = [];
		this.pointCount = 0;
		this.minwidth = 3;
		this.maxwidth = 7;
		this.colors = ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"];
	}

	frames(idx) {
		this.length++;

		let temp = new Array(148).fill("#000000");

		if (idx < this.limit) {
			for (let t = 0; t < 4; t++) temp[72 + t] = this["1"];

			let bin = idx.toString(2).split("").reverse().join("");
			for (let i in bin)
				for (let j = 0; j < 4; j++) {
					temp[i * 4 + j] = this[bin[i]];
					temp[144 - i * 4 + j] = this[bin[i]];
				}
		} else {
			this.delay = 200;

			for (let i = this.points.length - 1; i >= 0; i--) {
				if (this.points[i].dead) this.points[i].die(this.points);
				else this.points[i].move();
			}

			if (this.points.length < 20) {
				let width = Math.floor(Math.random() * (this.maxwidth - this.minwidth)) + this.minwidth;
				width -= width % 2;
				let startpos = Math.floor(Math.random() * (148 - width * 2));
				let color = this.colors[Math.floor(Math.random() * (this.colors.length - 1))];

				let offset = (startpos + width) % 2;

				this.points.push(new this.Point(startpos + width + offset, color, 1, width));
				this.points.push(new this.Point(startpos + offset, color, -1, width));
			}

			for (let a of this.points) {
				for (let j = 0; j < a.width; j++) {
					let k = a.pos + j;
					if (k < 148 && k > 0) temp[k] = a.color;
					else {a.dir *= -1; a.move()}
				}

				for (let b of this.points) {
					// rectangle overlap check for one 1 dimension
					if (a != b && !(a.right <= b.left || b.right <= a.pos)) {
						let aleft = a.left < b.left;
						let lp = aleft ? a : b;
						let rp = aleft ? b : a;
						let overlap = lp.right - rp.left;

						lp.shrink(overlap);
						rp.shrink(overlap);

						if(lp.right != rp.left - 1) rp.pos -= 1;
					}
				}
			}
		}
		// console.log(temp)
		return temp;
	}
}

var me;
var strips = { idle: new Idle(), offline: new Animation("offline"), dnd: new Animation("dnd") };
var active = "";
var animIndex = 0;

function frameToString(frame) {
	return Array.from(frame)
		.map((v) => v.substr(1))
		.join("");
}

function shiftFrameInPlace(frame, clockwise = true) {
	if (clockwise) frame.unshift(frame.pop());
	else frame.push(frame.shift());
}

function writeFrame(frame) {
	myPort.write(frameToString(frame));
}

function nextFrame() {
	animIndex += 1;
	animIndex %= strips[active].length;
}

function updateAnimation() {
	let status = me.presence.status.toLowerCase();
	if (status != active) {
		active = status;
		animIndex = 0;
	}
}

parser.on("data", (ms) => {
	updateAnimation();
	let delay = Math.max(strips[active].delay - parseInt(ms), 1);

	let end = Date.now();
	while (Date.now() < end + delay);

	writeFrame(strips[active].frames(animIndex));
	nextFrame();
});

client.on("ready", async (_) => {
	me = await client.users.fetch(process.env.discord_id);
	updateAnimation();
	myPort.open();
});

client.login(process.env.rgb_sync_token);

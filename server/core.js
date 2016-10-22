if (!window.RTCPeerConnection) {
  window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
}

const COLORS = ["black", "purple", "red", "yellow", "blue", "green", "pink", "orange"];

const CHARACTERS = {
  "Catherine": {
    health: 11,
    faction: "Neutral",
    winCondition: (player, state) => {
      let othersDead = false;
      for (let p of state.players) {
        if (player !== p && p.dead) {
          othersDead = true;
          break;
        }
      }
      return player.dead && !othersDead;
    },
    image: "client/catherine.png",
    winConditionDescription: "Be the first one to die",
    abilityDescription: "(Survival) Heal one point of damage per turn"
  },
  "Bob": {
    health: 11,
    faction: "Neutral",
    winCondition: (player, state) => {
    },
    image: "client/bob.png",
    winConditionDescription: "Collect five items",
    abilityDescription: "(Get Money) Instead of doing damage, you can choose to steal items"
  },
  "Vampire": {
    health: 13,
    faction: "Shadow",
    winCondition: (player, state) => {
      let shadowsWin = false;
      for (let player of state.players){
        if (CHARACTERS[player.name].faction === "Hunter"){
          if (!player.dead){
            shadowsWin = false;
          }
          else {
            shadowsWin = true;
          }
        }
      }
      return shadowsWin;
    },
    image: "client/vampire.png",
    winConditionDescription: "Kill all the hunters",
    abilityDescription: "(Lifesteal) Heal two points of damage after attack succeeds"
  },
  "George": {
    health: 14,
    faction: "Hunter",
    winCondition: (player, state) => {
      let huntersWin = false;
      for (let player of state.players){
        if (CHARACTERS[player.name].faction === "Shadow"){
          if (!player.dead){
            huntersWin = false;
          }
          else {
            huntersWin = true;
          }
        }
      }
      return huntersWin;
    },
    image: "client/george.png",
    winConditionDescription: "Kill all the shadows",
    abilityDescription: "(Demolish) Choose someone to inflict four points of damage to"
  }
};

const WEBRTC_CONFIG = {
  iceServers: [
    // STUN servers
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'stun:stun1.l.google.com:19302'},
    {
      urls: 'turn:numb.viagenie.ca',
      credential: 'muazkh',
      username: 'webrtc@live.com'
    },
  ]
};
const dataChannelOptions = {
  ordered: true
};

class Server {
  constructor() {
    this.resetState();
    this.connections = [];
  }

  resetState() {
    this.state = {
      turn: "",
      players: [],
    };

  }

  genStateCommand(player) {
    return {
      op: "state",
      state: this.state,
      player: player
    };
  }

  pickUnusedCharacter() {
    const potential = Object.keys(CHARACTERS);
    const taken = {};
    for (let p of this.state.players) {
      taken[p.name] = true;
    }
    if (this.state.players.length >= potential) {
      throw "more players than characters";
    }
    let player = null;
    while (!player) {
      const pot = potential[Math.floor(Math.random()*potential.length)];
      if (!taken[pot]) {
        player = pot;
      }
    }
    return player;
  }

  pickUnusedColor() {
    const taken = {};
    for (let p of this.state.players) {
      taken[p.color] = true;
    }
    if (this.state.players.length >= COLORS.length) {
      throw "more players than characters";
    }
    let player = null;
    while (!player) {
      const potentialColor = COLORS[Math.floor(Math.random()*COLORS.length)];
      if (!taken[potentialColor]) {
        player = potentialColor;
      }
    }
    return player;
  }

  updateDead() {
    for (let player of this.state.players) {
      player.dead = (player.damage >= CHARACTERS[player.name].health);
    }
  }

  updateWinners() {
    const winners = [];
    for (let p of this.state.players) {
      const char = CHARACTERS[p.name];
      if (char.winCondition(p, this.state)) {
        winners.push(p);
      }
    }
    this.state.winners = winners.length ? winners : null;
  }

  endTurn() {
    this.updateDead();
    this.updateWinners();

    do {
      const idx = (this.currentPlayerIndex() + 1) % this.state.players.length;
      this.state.turn = this.state.players[idx].name;
    } while (this.currentPlayer().dead);
    this.move(this.currentPlayer());
    this.broadcastState();
  }

  broadcastState() {
    for (let conn of this.connections) {
      conn.sendJSON(this.genStateCommand(conn.player));
    }
  }

  broadcast(obj) {
    for (let conn of this.connections) {
      conn.sendJSON(obj);
    }
  }

  offer(offer, resolve) {
    offer = new RTCSessionDescription(JSON.parse(offer.Offer));
    var peerConnection = new RTCPeerConnection(WEBRTC_CONFIG);

    peerConnection.ondatachannel = (e) => {
      const dataChannel = e.channel;
      this.setupChan(dataChannel);
    };

    peerConnection.onicecandidate = (ev) => {
      if (!ev.candidate) {
        resolve({Answer: JSON.stringify(peerConnection.localDescription)});
      }
    };

    peerConnection.setRemoteDescription(offer, console.log, console.log);
    peerConnection.createAnswer((answer) => {
      peerConnection.setLocalDescription(answer, console.log, console.log);
    }, (error) => console.log(error));
  }

  getPlayer() {
  }

  currentPlayerIndex(name) {
    if (!name) {
      name = this.state.turn;
    }
    for (let i = 0; i<this.state.players.length; i++) {
      if (this.state.players[i].name === name) {
        return i;
      }
    }
    return -1;
  }

  currentPlayer(name) {
    return this.state.players[this.currentPlayerIndex(name)];
  }

  rollDie(sides) {
    return 1 + Math.floor(Math.random()*sides);
  }

  move(player) {
    const oldArea = player.area;
    let area = oldArea;
    while (area == oldArea) {
      const roll = this.rollDie(4) + this.rollDie(6);
      switch (roll) {
        case 2:
        case 3:
          area = "Hermit's Cabin";
          break;
        case 4:
        case 5:
        case 7:
          area = "Underworld Gate";
          break;
        case 6:
          area = "Church";
          break;
        case 8:
          area = "Cemetery";
          break;
        case 9:
          area = "Weird Woods";
          break;
        case 10:
          area = "Erstwhile Altar";
          break;
      }
    }
    player.area = area;
  }

  setupChan(dataChannel) {
    // Establish your peer connection using your signaling channel here
    dataChannel.onerror = (error) => {
      console.log("server: Data Channel Error:", error);
    };

    dataChannel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("server: Got Data Channel Message:", event.data);
      if (data.op === "action") {
        if (data.action === "endTurn") {
          this.endTurn();
        }
      } else if (data.op === "attack") {
        const p = this.currentPlayer(data.player);
        p.damage += Math.abs(this.rollDie(6)-this.rollDie(4));
        const maxDamage = CHARACTERS[p.name].health;
        if (p.damage > maxDamage) {
          p.damage = maxDamage;
        }
        this.broadcastState();
      }
    };

    dataChannel.onopen = () => {
      this.connections.push(dataChannel);
      console.log("server: connection open");
      const char = this.pickUnusedCharacter();
      const playerColor = this.pickUnusedColor();
      const player = {
        name: char,
        damage: 0,
        area: null,
        color: playerColor
      };
      this.move(player);
      dataChannel.player = player;
      this.state.players.push(player);
      if (!this.state.turn) {
        this.state.turn = char;
      }
      this.broadcastState();
    };

    dataChannel.onclose = () => {
      var index = this.connections.indexOf(dataChannel);
      if (index >= 0) {
        this.connections.splice(index, 1);
      }
      console.log("The Data Channel is Closed");
    };

    dataChannel.sendJSON = (json) => {
      dataChannel.send(JSON.stringify(json));
    };
  }
}

function FakeDataChannel(other) {
  if (other) {
    this.remote = other;
    other.remote = this;
    setTimeout(() => {
      this.onopen();
      this.remote.onopen();
    },1);
  }
}
FakeDataChannel.prototype.send = function(data) {
  this.remote.onmessage({data: data});
}

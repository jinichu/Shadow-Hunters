if (!window.RTCPeerConnection) {
  window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
}

const CHARACTERS = {
  "Catherine": {
    health: 10,
    faction: "Neutral",
    winCondition: (player, state) => {
      const cDead = false;
      const othersDead = false;
      for (let player of state.players) {
        if (player.name === "Catherine") {
          if (player.dead) {
            cDead = true;
          }
        } else {
          if (player.dead) {
            othersDead = true;
          }
        }
      }

      return cDead && !othersDead;
    },
  },
  "Bob": {
    health: 11,
    faction: "Neutral",
    winCondition: (player, state) => {
    }
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
    this.state = {
      turn: "Catherine",
      players: [],
    };

    this.connections = [];
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

  updateDead() {
    for (let player of this.state.players) {
      player.dead = player.damage >= CHARACTERS[player.name].health;
    }
  }

  endTurn() {
    this.updateDead();
    do {
      const idx = (this.currentPlayerIndex() + 1) % this.state.players.length;
      this.state.turn = this.state.players[idx].name;
    } while (this.currentPlayer().dead);
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
    offer = JSON.parse(offer.Offer);
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

  currentPlayerIndex() {
    for (let i = 0; i<this.state.players.length; i++) {
      if (this.state.players[i].name === this.state.turn) {
        return i;
      }
    }
    return -1;
  }

  currentPlayer() {
    return this.state.players[this.currentPlayerIndex()];
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
      }
    };

    dataChannel.onopen = () => {
      this.connections.push(dataChannel);
      console.log("server: connection open");
      const char = this.pickUnusedCharacter();
      const player = {
        name: char,
        damage: 0
      };
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

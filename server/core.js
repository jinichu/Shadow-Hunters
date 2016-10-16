if (!window.RTCPeerConnection) {
  window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
}

const CHARACTERS = {
  "Catherine": {
    health: 10,
    faction: "Neutral",
    winCondition: (state) => {
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
}

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
      players: [
      {
        name: "Catherine",
        damage: 4
      },
      {
        name: "Bob",
        damage: 6
      }
      ],
    };

    this.connections = [];
  }

  genStateCommand() {
    return {
      op: "state",
      state: this.state
    };
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

  setupChan(dataChannel) {
    // Establish your peer connection using your signaling channel here
    dataChannel.onerror = (error) => {
      console.log("server: Data Channel Error:", error);
    };

    dataChannel.onmessage = (event) => {
      console.log("server: Got Data Channel Message:", event.data);
    };

    dataChannel.onopen = () => {
      this.connections.push(dataChannel);
      console.log("server: connection open");
      dataChannel.sendJSON(this.genStateCommand());
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

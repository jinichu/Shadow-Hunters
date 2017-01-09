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

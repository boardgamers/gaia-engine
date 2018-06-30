import SpaceMap from './map';
import * as assert from 'assert';
import * as _ from 'lodash';
import Player from './player';
import * as shuffleSeed from "shuffle-seed";
import {
  Faction,
  Command,
  Player as PlayerEnum,
  Building,
  ResearchField,
  Planet,
  Round,
  Booster,
  Resource,
  TechTile,
  TechTilePos,
  AdvTechTile,
  AdvTechTilePos,
  Federation
} from './enums';
import { CubeCoordinates } from 'hexagrid';
import Event from './events';
import techs from './tiles/techs';
import * as researchTracks from './research-tracks'

const ISOLATED_DISTANCE = 3;

import AvailableCommand, {
  generate as generateAvailableCommands
} from './available-command';
import Reward from './reward';

export default class Engine {
  map: SpaceMap;
  players: Player[];
  roundBoosters:  {
    [key in Booster]?: boolean 
  } = { }; 
  techTiles: {
    [key in TechTilePos]?: {tile: TechTile; numTiles: number}
  } = {};
  advTechTiles: {
    [key in AdvTechTilePos]?: {tile: AdvTechTile; numTiles: number}
  } = {};
  terraformingFederation: Federation;
  availableCommands: AvailableCommand[] = [];
  round: number = Round.Init;
  /** Order of players in the turn */
  turnOrder: PlayerEnum[] = [];
  roundSubCommands: AvailableCommand[] = [];
  /**
   * Players who have passed, in order. Will be used to determine next round's
   * order
   */
  passedPlayers: PlayerEnum[] = [];
  /** Current player to make a move */
  currentPlayer: PlayerEnum;
  /** position of the current player in turn order */
  currentPlayerTurnOrderPos: number = 0;

  constructor(moves: string[] = []) {
    this.generateAvailableCommands();
    this.loadMoves(moves);
  }

  loadMoves(moves: string[]) {
    for (const move of moves) {
      this.move(move);
      this.generateAvailableCommands();
    }
  }

  generateAvailableCommands(): AvailableCommand[] {
    return (this.availableCommands = generateAvailableCommands(this));
  }

  availableCommand(player: PlayerEnum, command: Command) {
    return this.availableCommands.find(
      availableCommand => {
        if (availableCommand.name !== command) {
          return false;
        } 
        if (availableCommand.player === undefined) {
          return false;
        }
        return availableCommand.player === player;
      }
    );
  }

  player(player: number): Player {
    return this.players[player];
  }

  move(move: string) {
    const split = move.trim().split(' ');

    if (this.round === Round.Init) {
      const command = split[0] as Command;

      const available = this.availableCommands;
      const commandNames = available.map(cmd => cmd.name);

      assert(
        commandNames.includes(command),
        'Move ' + move + ' not in Available commands: ' + commandNames.join(', ')
      );

      (this[command] as any)(...split.slice(1));
      this.endRound();
    } else {
      const playerS = split[0];

      assert(
        /^p[1-5]$/.test(playerS),
        'Wrong player format, expected p1, p2, ...'
      );
      const player = +playerS[1] - 1;

      assert(  this.currentPlayer === (player as PlayerEnum), "Wrong turn order in move " + move + ", expected "+ this.currentPlayer +' found '+player);

      const command = split[1] as Command;

      const available = this.availableCommands;
      const commandNames = available.map(cmd => cmd.name);

      assert(
        this.availableCommand(player, command),
        'Move ' + move + ' not in Available commands: ' + commandNames.join(', ')
      );

      (this[command] as any)(player as PlayerEnum, ...split.slice(2));

      this.endTurn(command);
    } 
  }

  numberOfPlayersWithFactions(): number {
    return this.players.filter(pl => pl.faction).length;
  }

  static fromData(data: any) {
    const engine = new Engine();
    engine.round = data.round;
    engine.availableCommands = data.availableCommands;
    engine.map = SpaceMap.fromData(data.map);
    for (const player of data.players) {
      engine.players.push(Player.fromData(player));
    }

    return engine;
  }

  endTurn(command : Command) {
    // subactions :  checks if the player has to do another action
    // build can need tech tile
    // tech tile can need to advance research


    // if not subactions Let the next player move based on the command
    this.moveToNextPlayer(command);

    if (this.turnOrder.length === 0) {
      // If all players have passed
      this.endRound();
    }
  }

  endRound() { 
    if ( this.round < 6 ) {
      this.beginRound();

    } else
    {
      //TODO end game
    }
  };

  beginRound() {
    this.round += 1;

    switch (this.round) {
      case Round.SetupBuilding: {
        // Setup round - add Ivits to the end, before third Xenos
        const setupTurnOrder = this.players
          .filter(pl => pl.faction !== Faction.Ivits)
          .map((pl, i) => i as PlayerEnum);
        const reverseSetupTurnOrder = setupTurnOrder.slice().reverse();
        this.turnOrder = setupTurnOrder.concat(reverseSetupTurnOrder);

        const posXenos = this.players.findIndex(
          pl => pl.faction === Faction.Xenos
        );
        if (posXenos !== -1) {
          this.turnOrder.push(posXenos as PlayerEnum);
        }

        const posIvits = this.players.findIndex(
          pl => pl.faction === Faction.Ivits
        );
        if (posIvits !== -1) {
          this.turnOrder.push(posIvits as PlayerEnum);
        }
        break;
      };
      case Round.SetupFaction:
      case Round.Round1: {
        this.turnOrder = this.players.map((pl, i) => i as PlayerEnum);
        this.passedPlayers = [];
        break;
      };
      case Round.SetupRoundBooster:{
        this.turnOrder = this.players.map((pl, i) => i as PlayerEnum).reverse();
        break;
      };
      default: {
        // The players play in the order in which they passed or 
        this.turnOrder = this.passedPlayers;
        this.passedPlayers = [];
      };
    };

    this.currentPlayer = this.turnOrder[0];
    this.currentPlayerTurnOrderPos = 0;
    
    if ( this.round >= 1) {
      this.incomePhase();
      this.gaiaPhase();
    };

  };

  incomePhase(){
    for (const player of this.playersInOrder()) {
      player.receiveIncome();
      //TODO split power actions and request player order
    }
  }

  gaiaPhase(){
    // transform Transdim planets into Gaia if gaiaformed
    for (const hex of this.map.toJSON()) {
      if (hex.data.planet === Planet.Transdim  && hex.data.player !== undefined && hex.data.building === Building.GaiaFormer ) {
        hex.data.planet = Planet.Gaia;
      }
    }
    for (const player of this.playersInOrder()) {
      player.gaiaPhase();
    }
    //TODO manage gaia phase actions for specific factions
  }

  leechingPhase(player: PlayerEnum, location: CubeCoordinates) {
    // exclude setup rounds
    if (this.round <= 0) {
      return;
    }
    // all players excluded leecher
    for (const pl of this.players) {
      if (pl !== this.player(player)) {
        let leech = 0;
        for (const loc of pl.data.occupied) {
          if (this.map.distance(loc, location) < ISOLATED_DISTANCE) {
            leech = Math.max(leech, pl.buildingValue(this.map.grid.get(loc.q, loc.r).data.building, this.map.grid.get(loc.q, loc.r).data.planet))
          }
        }
        leech = Math.min(leech, pl.maxLeech(leech));
        if (leech > 0) {
          this.roundSubCommands.push({
            name: Command.Leech,
            player: this.players.indexOf(pl),
            data: leech
          })
        }
      }
    }
  }

  techTilePhase(player: PlayerEnum) {
    const tiles = [];
    const data = this.players[player].data;

    //  tech tiles that player doesn't already have  
    for (const tilePos of Object.values(TechTilePos)) {
      if (!data.techTiles.includes(tilePos)) {
        tiles.push({
          tile: this.techTiles[tilePos].tile,
          tilePos: tilePos,
          type: "std"
        });
      }
    }

    // adv tech tiles where player has lev 4/5, free federation tokens,
    // and available std tech tiles to cover
    for (const tilePos of Object.values(AdvTechTilePos)) {
      if (this.advTechTiles[tilePos].numTiles > 0  &&
          data.greenFederations > 0 &&
          data.research[tilePos] >=4 && 
          data.techTiles.filter(tech => tech.enabled).length>0 ) {
            tiles.push({
              tile: this.advTechTiles[tilePos].tile,
              tilePos: tilePos,
              type: "adv"
            });
      }
    }

    if (tiles.length>0) {
      this.roundSubCommands.unshift({
        name: Command.ChooseTechTile,
        player: player,
        data: { tiles } 
    })
    }
  }

  coverTechTilePhase(player: PlayerEnum) {
    this.roundSubCommands.unshift({
      name: Command.ChooseCoverTechTile,
      player: player,
      data: {}
    })
  }

  lostPlanetPhase(player: PlayerEnum) {
    this.roundSubCommands.unshift({
      name: Command.PlaceLostPlanet,
      player: player,
      data: {}
    })
  }

  advanceResearchAreaPhase(player: PlayerEnum, tile: string) {
    // if stdTech in a free position or advTech, any researchArea
    let destResearchArea = "";
    for (const tilePos of Object.values(TechTilePos)) {
      if (this.techTiles[tilePos].tile === tile) {
        if (tilePos !== TechTilePos.Free1 &&
          tilePos !== TechTilePos.Free2 &&
          tilePos !== TechTilePos.Free3) {
          destResearchArea = tilePos;
          break;
        }
      }
    }

    this.roundSubCommands.unshift({
      name: Command.UpgradeResearch,
      player: player,
      data: destResearchArea
    });

  }

  possibleResearchAreas(player: PlayerEnum, cost: string, destResearchArea?: ResearchField) {
    const tracks = [];
    const data = this.players[player].data;

    if (data.canPay(Reward.parse(cost))) {
      for (const field of Object.values(ResearchField)) {

        // up in a specific research area
        if (destResearchArea && destResearchArea !== field) {
          continue;
        }

        //already on top
        if (data.research[field] === researchTracks.lastTile(field)) {
          continue;
        }

        // end of the track reached
        const destTile = data.research[field] + 1;

        // To go from 4 to 5, we need to flip a federation and nobody inside
        if (researchTracks.keyNeeded(field, destTile) && data.greenFederations === 0) {
          continue;
        }

        if (this.playersInOrder().some(pl => pl.data.research[field] === researchTracks.lastTile(field))) {
          continue;
        };

        tracks.push({
          field,
          to: destTile,
          cost: cost
        });

      }
    }

    return tracks;
  }

  possibleSpaceLostPlanet(player: PlayerEnum) {
    const data = this.player(player).data;
    const spaces = [];

    for (const hex of this.map.toJSON()) {
      // exclude empty planets and other players' planets
      if (hex.data.planet !== Planet.Empty) {
        continue;
      }
      //TODO: check no satelittes, nor space stations
      const distance = _.min(data.occupied.map(loc => this.map.distance(hex, loc)));
      //TODO posible to extened? check rules const qicNeeded = Math.max(Math.ceil( (distance - data.range) / QIC_RANGE_UPGRADE), 0);
      if (distance > data.range) {
        continue;
      }

      spaces.push({
        building: Building.Mine,
        coordinates: hex.toString(),
      });
    }

    return spaces;
  }

  /** Next player to make a move, after current player makes their move */
  moveToNextPlayer(command: Command): PlayerEnum {
    const subPhaseTurn = this.roundSubCommands.length > 0;
    const playRounds = this.round > 0;
    if (subPhaseTurn) {
      this.currentPlayer = this.roundSubCommands[0].player;
    } else {
      if (playRounds && command !== Command.Pass) {
        const next = (this.currentPlayerTurnOrderPos + 1) % this.turnOrder.length;
        this.currentPlayerTurnOrderPos = next;
        this.currentPlayer = this.turnOrder[next];
        return;
      } else {
        const playerPos = this.currentPlayerTurnOrderPos;
        if (command === Command.Pass) {
          this.passedPlayers.push(this.currentPlayer);
        }
        this.turnOrder.splice(playerPos, 1);
        const newPlayerPos = playerPos + 1 > this.turnOrder.length ? 0 : playerPos;
        this.currentPlayer = this.turnOrder[newPlayerPos];
        this.currentPlayerTurnOrderPos = newPlayerPos;
      }
    }
  }
  

  playersInOrder(): Player[] {
    return this.turnOrder.map(i => this.players[i]);
  }

  /** Commands */
  [Command.Init](players: string, seed: string) {
    const nbPlayers = +players || 2;
    seed = seed || 'defaultSeed';

    this.map = new SpaceMap(nbPlayers, seed);

    // Choose nbPlayers+3 boosters as part of the pool
    const boosters = shuffleSeed.shuffle(Object.values(Booster), this.map.rng()).slice(0, nbPlayers+3);
    for (const booster of boosters) {
      this.roundBoosters[booster] = true;
    }

    // Shuffle tech tiles 
    const techtiles = shuffleSeed.shuffle(Object.values(TechTile), this.map.rng());
    Object.values(TechTilePos).forEach( (pos, i) => {
      this.techTiles[pos] = {tile: techtiles[i], numTiles: 4};
    });
 
    // Choose adv tech tiles as part of the pool
    const advtechtiles = shuffleSeed.shuffle(Object.values(AdvTechTile), this.map.rng()).slice(0, 6);
    Object.values(AdvTechTilePos).forEach( (pos, i) => {
      this.advTechTiles[pos] = {tile: advtechtiles[i], numTiles: 1};
    });

    this.terraformingFederation = shuffleSeed.shuffle(Object.values(Federation), this.map.rng()).slice(0,1);
    
    this.players = [];
    
    for (let i = 0; i < nbPlayers; i++) {
      this.players.push(new Player(i));
    }
  }

  [Command.ChooseFaction](player: PlayerEnum, faction: string) {
    const avail = this.availableCommand(player, Command.ChooseFaction);

    assert(
      avail.data.includes(faction),
      `${faction} is not in the available factions`
    );

    this.players[player].loadFaction(faction as Faction);
  }

  [Command.ChooseRoundBooster](player: PlayerEnum, booster: Booster, fromCommand: Command = Command.ChooseRoundBooster ) {
    const { boosters } = this.availableCommand(player, fromCommand).data;
    
    assert(boosters.includes(booster),
      `${booster} is not in the available boosters`
    );
    
    this.roundBoosters[booster] = false;
    this.players[player].getRoundBooster(booster);
  }

  [Command.Build](player: PlayerEnum, building: Building, location: string) {
    const avail = this.availableCommand(player, Command.Build);
    const { buildings } = avail.data;

    for (const elem of buildings) {
      if (elem.building === building && elem.coordinates === location) {
        const {q, r, s} = CubeCoordinates.parse(location);
        const hex = this.map.grid.get(q, r);

        this.player(player).build(
          elem.upgradedBuilding,
          building,
          hex.data.planet,
          Reward.parse(elem.cost),
          {q, r, s}
        );

        hex.data.building = building;
        hex.data.player = player;


        this.leechingPhase(player, {q, r, s} );

        if ( building === Building.ResearchLab || buildings === Building.Academy1 || building === Building.Academy2) {
          this.techTilePhase(player);
        }
       
        return;
      }
    }

    throw new Error(`Impossible to execute build command at ${location}`);
  }

  [Command.UpgradeResearch](player: PlayerEnum, field: ResearchField) {
    const { tracks } = this.availableCommand(player, Command.UpgradeResearch).data;
    const track = tracks.find(tr => tr.field === field);

    assert(track, `Impossible to upgrade knowledge for ${field}`);

    const data = this.player(player).data;

    data.payCosts(Reward.parse(track.cost));
    data.gainReward(new Reward(`${Command.UpgradeResearch}-${field}`));

    if (data.research[field] === researchTracks.lastTile(field)) {
      if (field === ResearchField.Terraforming) {
        //gets federation token
        //TODO
      } else if (field === ResearchField.Navigation) {
        //gets LostPlanet
        this.lostPlanetPhase(player);
      }
    }
  }

  [Command.Pass](player: PlayerEnum, booster: Booster) {
    this.roundBoosters[this.players[player].data.roundBooster] = true;
    this.players[player].pass();
    (this[Command.ChooseRoundBooster] as any)(player, booster, Command.Pass);
  }

  [Command.Leech](player: PlayerEnum, leech: number) {
    const leechCommand  = this.availableCommand(player, Command.Leech).data;
  
    assert( leechCommand == leech , `Impossible to charge ${leech} power`);

    const powerLeeched = this.players[player].data.chargePower(leech);
    this.player(player).data.payCost( new Reward(Math.max(powerLeeched - 1, 0), Resource.VictoryPoint));
  }

  [Command.DeclineLeech](player: PlayerEnum) {
  }

  [Command.ChooseTechTile](player: PlayerEnum, tile: string) {
    const { tiles } = this.availableCommand(player, Command.ChooseTechTile).data;
    const tileAvailable = tiles.find(ta => ta.tile == tile);

    assert(tileAvailable !== undefined, `Impossible to get ${tile} tile`);

    this.player(player).loadEvents(Event.parse(techs[tile]));
    this.player(player).data.techTiles.push(
      {
        tile: tileAvailable.tile,
        enabled: true
      }
    )
    this.techTiles[tileAvailable.tilePos].numTiles -= 1;
    if (tileAvailable.type === "adv") {
      this.coverTechTilePhase(player)
    };
    // add advance research area subCommand
    this.advanceResearchAreaPhase(player, tile)
  }

  [Command.ChooseCoverTechTile](player: PlayerEnum, tile: string) {
    const { tiles } = this.availableCommand(player, Command.ChooseCoverTechTile).data;
    const tileAvailable = tiles.find(ta => ta.tile == tile);

    assert(tileAvailable !== undefined, `Impossible to cover ${tile} tile`);
    //remove tile
    const tileIndex = this.player(player).data.techTiles.findIndex(tl => tl.tile = tileAvailable.tile)
    this.player(player).data.techTiles.splice(tileIndex, 1);
    //remove bonus
    this.player(player).removeEvents(Event.parse(techs[tile]));
  }

  [Command.PlaceLostPlanet](player: PlayerEnum, location: string) {
    const avail = this.availableCommand(player, Command.Build);
    const { spaces } = avail.data;

    if (spaces.indexOf(location) === -1) {
      throw new Error(`Impossible to execute build command at ${location}`);
    }

    const { q, r, s } = CubeCoordinates.parse(location);
    const hex = this.map.grid.get(q, r);
    hex.data.planet = Planet.Lost;
    hex.data.building = Building.Mine;
    hex.data.player = player;

    this.players[player].data.occupied = _.uniqWith([].concat(this.players[player].data.occupied, location), _.isEqual)

    this.players[player].receiveBuildingTriggerIncome(Building.Mine, Planet.Lost)
    this.leechingPhase(player, { q, r, s });

    return;
  }
}

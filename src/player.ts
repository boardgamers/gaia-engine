import { Faction, Operator, ResearchField, Planet, Building, Resource, Booster, Condition } from './enums';
import PlayerData from './player-data';
import Event from './events';
import { factionBoard, FactionBoard } from './faction-boards';
import * as _ from 'lodash';
import factions from './factions';
import Reward from './reward';
import { CubeCoordinates, Hex } from 'hexagrid';
import researchTracks from './research-tracks';
import { terraformingStepsRequired } from './planets';
import boosts from './tiles/boosters';
import { Player as PlayerEnum } from './enums';
import { stdBuildingValue } from './buildings';
import SpaceMap from './map';
import { GaiaHexData } from '..';

const TERRAFORMING_COST = 3;
const FEDERATION_COST = 7;

export default class Player {
  faction: Faction = null;
  board: FactionBoard = null;
  data: PlayerData = new PlayerData();
  events: { [key in Operator]: Event[] } = {
    [Operator.Once]: [],
    [Operator.Income]: [],
    [Operator.Trigger]: [],
    [Operator.Activate]: [],
    [Operator.Pass]: [],
    [Operator.Special]: []
  };

  constructor(public player: PlayerEnum) {
    this.data.on('advance-research', track => this.onResearchAdvanced(track));
  }

  toJSON() {
    return {
      faction: this.faction,
      data: this.data,
      income: Reward.toString(Reward.merge([].concat(...this.events[Operator.Income].map(event => event.rewards))), true)
    };
  }

  static fromData(data: any) {
    const player = new Player(data.player);

    if (data.faction) {
      player.loadFaction(data.faction);
    }

    if (data.data) {
      _.merge(player.data, data.data);
    }

    return player;
  }

  get planet(): Planet {
    return factions.planet(this.faction);
  }

  canBuild(targetPlanet: Planet, building: Building, {isolated, addedCost}: {isolated?: boolean, addedCost?: Reward[]}) : Reward[] {
    if (this.data[building] >= (building === Building.GaiaFormer ? this.data.gaiaformers : this.board.maxBuildings(building))) {
      // Too many buildings of the same kind
      return undefined;
    }

    if (!addedCost) {
      addedCost = [];
    }

    if (!this.data.canPay(addedCost)) {
      return undefined;
    }
    
    //gaiaforming discount
    if (building === Building.GaiaFormer){
      const gaiaformingDiscount =  this.data.gaiaformers > 1  ? this.data.gaiaformers : 0;
      addedCost.push(new Reward(-gaiaformingDiscount, Resource.GainToken));
    } else if (building === Building.Mine){
      //habiltability costs
     if ( targetPlanet === Planet.Gaia) {
        addedCost.push(new Reward("1q"));
      } else { // Get the number of terraforming steps to pay discounting terraforming track
        const steps = terraformingStepsRequired(factions[this.faction].planet, targetPlanet); 
        addedCost.push(new Reward((TERRAFORMING_COST - this.data.terraformSteps)*steps, Resource.Ore));
      }
    };

    const cost = Reward.merge([].concat(this.board.cost(targetPlanet, building, isolated), addedCost));
    return this.data.canPay(cost) ? cost : undefined;
  }

  loadFaction(faction: Faction) {
    this.faction = faction;
    this.board = factionBoard(faction);

    this.loadEvents(this.board.income);

    this.data.power.bowl1 = this.board.power.bowl1;
    this.data.power.bowl2 = this.board.power.bowl2;
  }

  loadEvents(events: Event[]) {
    for (const event of events) {
      this.loadEvent(event);
    }
  }

  loadEvent(event: Event) {
    this.events[event.operator].push(event);

    if (event.operator === Operator.Once) {
      this.data.gainRewards(event.rewards);
    }
  }

  removeEvents(events: Event[]) {
    for (const event of events) {
      this.removeEvent(event);
    }  
  }

  removeEvent(event: Event) {
    let findEvent = this.events[event.operator].findIndex(
      ev => ev.toJSON === event.toJSON
    );
    this.events[event.operator].slice(findEvent, 1);
  }
  
  onResearchAdvanced(field: ResearchField) {
    const events = Event.parse(researchTracks[field][this.data.research[field]]);
    this.loadEvents(events);
    
    this.receiveAdvanceResearchTriggerIncome();
  }

  build(upgradedBuilding, building: Building, planet: Planet, cost: Reward[], location: CubeCoordinates) {
    this.data.payCosts(cost);
    //excluding Gaiaformers as occupied 
    if ( building !== Building.GaiaFormer ) {
      this.data.occupied = _.uniqWith([].concat(this.data.occupied, location), _.isEqual)
    }

    // Add income of the building to the list of events
    this.loadEvent(this.board[building].income[this.data[building]]);
    this.data[building] += 1;

    // remove upgraded building and the associated event
    if(upgradedBuilding) {
      this.data[upgradedBuilding] -= 1;
      this.removeEvent(this.board[upgradedBuilding].income[this.data[upgradedBuilding]]);
    }

    // get triggered income for new building
    this.receiveBuildingTriggerIncome(building, planet);
  }

  pass(){
    this.receivePassIncome();
    // remove the old booster  
    this.removeEvents( Event.parse( boosts[this.data.roundBooster]));
    this.data.roundBooster =  undefined;
  }

  getRoundBooster(roundBooster: Booster){  
    // add the booster to the the player
    this.data.roundBooster =  roundBooster;
    this.loadEvents( Event.parse( boosts[roundBooster]));
  }

  receiveIncome() {
    for (const event of this.events[Operator.Income]) {
      this.data.gainRewards(event.rewards);
    }
  }

  receivePassIncome() {
    // this is for pass tile income (e.g. rounboosters, adv tiles)
    for (const event of this.events[Operator.Pass]) {
      this.data.gainRewards(event.rewards);
    }
  }

  receiveBuildingTriggerIncome(building: Building, planet: Planet) {
    // this is for roundboosters, techtiles and adv tile
    for (const event of this.events[Operator.Trigger]) {
      if (Condition.matchesBuilding(event.condition, building, planet)) {
        this.data.gainRewards(event.rewards)
      };
    }
  }

  receiveAdvanceResearchTriggerIncome() {
    for (const event of this.events[Operator.Trigger]) {
      if (event.condition === Condition.AdvanceResearch) {
        this.data.gainRewards(event.rewards)
      };
    }
  }

  gaiaPhase() {
    /* Move gaia power tokens to regular power bowls */
    // Terrans move directly to power bowl 2
    if (this.faction === Faction.Terrans) {
      this.data.power.bowl2 += this.data.power.gaia;
    } else {
      this.data.power.bowl1 += this.data.power.gaia;
    }
    this.data.power.gaia = 0;
  }

  buildingValue(building: Building, planet: Planet){
    const baseValue =  stdBuildingValue(building);

    // Space stations or gaia-formers do not get any bonus
    if (baseValue === 0) {
      return 0;
    }
    
    const addedBescods = this.faction === Faction.Bescods && this.data[Building.PlanetaryInstitute] === 1  && planet === Planet.Titanium ? 1 : 0;
    //TODO value if TECH3
    return baseValue + addedBescods;
  }

  maxLeech(possibleLeech: number){ 
    // considers real chargeable power and victory points
    return Math.min(possibleLeech, this.data.power.bowl1 * 2 + this.data.power.bowl2, this.data.victoryPoints + 1);
  }

  availableFederations(map: SpaceMap): Hex<GaiaHexData>[][] {
    const excluded = map.excludedHexesForBuildingFederation(this.player);

    const hexes = this.data.occupied.map(coord => map.grid.get(coord.q, coord.r)).filter(hex => !excluded.has(hex));
    const values = hexes.map(node => this.buildingValue(node.data.building, node.data.planet));

    const combinations = this.possibleCombinationsForFederations(_.zipWith(hexes, values, (val1, val2) => ({hex: val1, value: val2})));
    const maxSatellites = this.data.discardablePowerTokens();
    
    // We now have several combinations of buildings that can form federations
    // We need to see if they can be connected
    let federations: Array<{occupied: Set<Hex<GaiaHexData>>, satellites: number, planets: number}> = [];

    for (const combination of combinations) {
      federations.push(...getFederations(combination));
    }

    /** Federation with the least satellites */
    const minFed1 = _.minBy(federations, fed => fed.planets + fed.satellites * 1000);
    /** Federation with the least planets */
    const minFed2 = _.minBy(federations, fed => fed.planets * 1000 + fed.satellites);

    /** Remove federations which have at least one planet & one satellite more than another */
    federations = federations.filter(fed => {
      if (fed.planets > minFed1.planets && fed.satellites > minFed1.satellites) {
        return false;
      }
      if (fed.planets > minFed2.planets && fed.satellites > minFed2.satellites) {
        return false;
      }
      return true;
    });

    /** Remove federations which are included in another (i.e. have an extra satellite but same number of planets) */
    const toRemove = [];
    for (let i = 0; i < federations.length; i++) {
      for (let j = 1; j < federations.length; j++) {
        const [fed1, fed2] = _.sortBy([federations[i], federations[j]], fed => fed.occupied.size);
        const included = [...fed1.occupied.values()].every(val => fed2.occupied.has(val));

        if (included) {
          toRemove.push(fed1);
        }
      }
    }
    federations = federations.filter(fed => !toRemove.includes(fed));

    var getFederations = (buildings: Hex<GaiaHexData>[]) => {
      let solutions: HexGroup[] = [];
      const hexesWithBuildings = new Set(hexes);

      const [firstBuilding, ...otherBuildings] = buildings;

      class HexGroup {
        constructor(other?: HexGroup) {
          if (other) {
            this.toReach = new Set(other.toReach);
            this.satellites = other.satellites;
            this.occupied = new Set(other.occupied);
            this.planets = other.planets;
          }
        }

        toString() {
          return [...this.occupied].map(x => x.toString()).join(",");
        }

        add(hex: Hex<GaiaHexData>) {
          if (this.occupied.has(hex)) {
            return;
          }

          this.occupied.add(hex);
          this.toReach.delete(hex);

          if (hex.data.planet !== Planet.Empty) {
            this.planets += 1;
          }

          for (const hexWithBuilding of hexesWithBuildings) {
            if (CubeCoordinates.distance(hex, hexWithBuilding) === 1) {
              this.add(hexWithBuilding);
            }
          }
        }

        toReach: Set<Hex<GaiaHexData>> = new Set();
        occupied: Set<Hex<GaiaHexData>> = new Set();
        satellites: number = 0;
        // Strict interpretation of the rules says planets  might be buildings instead (including space stations)
        planets: number = 0;
      }
      
      const startingHexGroup = new HexGroup();

      for (const building of otherBuildings) {
        startingHexGroup.toReach.add(building);
      }
      startingHexGroup.add(firstBuilding);

      // If the starting buildings are already connected
      if (startingHexGroup.toReach.size === 0) {
        return [startingHexGroup];
      }

      type HexGroupMap = Map<string, HexGroup>;
      let minSatellites = maxSatellites;
      const hexGroups: HexGroupMap = new Map([[startingHexGroup.toString(), startingHexGroup]]);

      let toExplore: HexGroupMap = new Map(hexGroups.entries());
      let nextToExplore: HexGroupMap = new Map();

      while (toExplore.size > 0) {
        for (const [_, hexGroup] of toExplore) {
          if (hexGroup.satellites >= minSatellites) {
            // We are going to add one satellite anyway, which will 
            // put us over the limit
            continue;
          }
          const exploredNeighbours: Set<Hex<GaiaHexData>> = new Set();
          for (const hex of hexGroup.occupied) {
            for (const neighbour of map.grid.neighbours(hex.q, hex.r)) {
              if (excluded.has(neighbour) || exploredNeighbours.has(neighbour)) {
                continue;
              }
              exploredNeighbours.add(neighbour);
              const newHexGroup = new HexGroup(hexGroup); 
              newHexGroup.add(neighbour);
              newHexGroup.satellites += 1;

              const key = newHexGroup.toString();
              if (hexGroups.has(key)) {
                continue;
              }
              hexGroups.set(key, newHexGroup);

              if (newHexGroup.toReach.size === 0) {
                if (minSatellites === hexGroup.satellites) {
                  solutions.push(newHexGroup);
                } else if (minSatellites < hexGroup.satellites) {
                  minSatellites = hexGroup.satellites;
                  solutions = [newHexGroup];
                }
              } else {
                nextToExplore.set(key, newHexGroup);
              }
            }
          }
        }

        toExplore = nextToExplore;
        nextToExplore = new Map();
      }

      return solutions;
    }

    return federations.map(fed => [...fed.occupied.values()]);
  }

  possibleCombinationsForFederations(nodes: Array<{hex: Hex<GaiaHexData>, value: number}>, toReach = FEDERATION_COST): Hex<GaiaHexData>[][] {
    const ret: Hex<GaiaHexData>[][] = [];

    for (let i = 0; i < nodes.length; i ++) {
      if (nodes[i].value === 0) {
        continue;
      }

      if (nodes[i].value >= toReach) {
        ret.push([nodes[i].hex]);
        continue;
      }

      for (const possibility of this.possibleCombinationsForFederations(nodes.slice(i+1), toReach - nodes[i].value)) {
        possibility.push(nodes[i].hex);
        ret.push(possibility);
      }
    }

    return ret;
  }
}
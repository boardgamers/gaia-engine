import axios from 'axios';
import Engine from './index';
import crypto from "crypto";
import { EngineOptions } from './src/engine';
import { Round } from './src/enums';

export async function init (nbPlayers: number, expansions: string[], options: EngineOptions & {balancedGeneration: boolean}, seed?: string): Promise<Engine> {
  if (!seed) {
    seed = crypto.randomBytes(8).toString('base64');
  }

  if (expansions.includes("spaceships")) {
    options.spaceShips = true;
  }

  if (options.balancedGeneration) {
    delete options.balancedGeneration;

    const resp = await axios.post('http://gaia-project.hol.es', {seed, player: this.options.setup.nbPlayers}).then(r => r.data);

    options.map = {sectors: resp.map};

    // We use different standards for sides A & B of sectors than the online generator
    if (nbPlayers === 2) {
      options.map.sectors.forEach(val => val.sector = val.sector.replace(/A/, 'B'));
    } else {
      options.map.sectors.forEach(val => val.sector = val.sector.replace(/B/, 'A'));
    }
  }

  return new Engine([`init ${nbPlayers} ${seed}`], options);
}

export function setPlayerMetaData(engine: Engine, player: number, metaData: {name: string}) {
  engine.players[player].name = metaData.name;

  return engine;
}

export function move(engine: Engine, move: string, player: number) {
  if (!(engine instanceof Engine)) {
    engine = Engine.fromData(engine);
  }

  const round = engine.round;
  engine.move(move);

  if (engine.newTurn && engine.round !== round) {
    (engine as any).messages = [...((engine as any).messages || []), `Round ${round}`];
  }

  // todo: automove

  return engine;
}

export function ended (engine: Engine) {
  return engine.ended;
}

export function cancelled (engine: Engine) {
  return engine.ended && engine.round < Round.LastRound;
}

export function scores (engine: Engine) {
  return engine.players.map(pl => pl.data.victoryPoints);
}

export function dropPlayer (engine: Engine, player: number) {
  engine.players[player].dropped = true;

  // TODO: automove

  return engine;
}

export function currentPlayer (engine: Engine) {
  return engine.playerToMove;
}

export function toSave (engine: Engine) {
  if (!engine.newTurn) {
    return undefined;
  }
  return engine;
}

export function messages (engine: Engine) {
  const messages = (engine as any).messages || [];
  delete (engine as any).messages;

  return {
    messages,
    engine
  };
}

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.core.config import (
    TICK_INTERVAL_SECONDS,
    PLAYER_START_ID,
    PLAYER_START_X,
    PLAYER_START_Y,
    HITBOXES_ENABLED,
    TALK_RANGE_TILES,
)
from app.core.villagers import VILLAGERS
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.world.town import load_town
from app.world.simulation import Simulation
from app.world.movement import apply_move
from app.persistence.store import Store
from app.api.websocket import ConnectionManager
from app.api.messages import parse_move_command

logger = logging.getLogger(__name__)


def _state_payload(agents, player) -> dict:
    return {
        "agents": [
            {"id": agent.id, "x": agent.x, "y": agent.y} for agent in agents
        ],
        "player": player.to_dict(),
    }


def _initial_payload(agents, player, town_entities, grid, talk_range_tiles) -> dict:
    return {
        "agents": [agent.to_dict() for agent in agents],
        "player": player.to_dict(),
        "town": [entity.to_dict() for entity in town_entities],
        "grid_width": grid.width,
        "grid_height": grid.height,
        "talk_range_tiles": talk_range_tiles,
    }


def create_app() -> FastAPI:
    town = load_town()
    blockers = [entity for entity in town.entities if entity.blocks]
    store = Store(
        Grid(town.width, town.height),
        [
            Agent(
                agent_id=v.id,
                x=v.x,
                y=v.y,
                name=v.name,
                role=v.role,
                line=v.line,
                backstory=v.backstory,
            )
            for v in VILLAGERS
        ],
        Player(player_id=PLAYER_START_ID, x=PLAYER_START_X, y=PLAYER_START_Y),
        blockers,
    )
    simulation = Simulation(store, hitboxes_enabled=HITBOXES_ENABLED)
    manager = ConnectionManager()

    async def tick_loop():
        while True:
            await asyncio.sleep(TICK_INTERVAL_SECONDS)
            try:
                agents = simulation.tick()
                await manager.broadcast(_state_payload(agents, store.get_player()))
            except Exception:
                logger.exception("tick_loop failed on this tick")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task = asyncio.create_task(tick_loop())
        yield
        task.cancel()

    app = FastAPI(lifespan=lifespan)

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await manager.connect(websocket)
        try:
            await websocket.send_text(
                json.dumps(
                    _initial_payload(
                        store.get_agents(),
                        store.get_player(),
                        town.entities,
                        store.get_grid(),
                        TALK_RANGE_TILES,
                    )
                )
            )
            while True:
                raw = await websocket.receive_text()
                direction = parse_move_command(raw)
                if direction is not None:
                    grid = store.get_grid()
                    player = store.get_player()
                    new_x, new_y = apply_move(
                        grid,
                        player.x,
                        player.y,
                        direction,
                        buildings=store.get_buildings(),
                        hitboxes_enabled=HITBOXES_ENABLED,
                    )
                    store.set_player_position(new_x, new_y)
                    await manager.broadcast(
                        _state_payload(store.get_agents(), store.get_player())
                    )
        except WebSocketDisconnect:
            pass
        except Exception:
            logger.exception("websocket_endpoint failed")
        finally:
            manager.disconnect(websocket)

    return app


app = create_app()

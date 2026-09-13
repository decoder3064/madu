import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from app.core.config import (
    GRID_WIDTH,
    GRID_HEIGHT,
    AGENT_START_ID,
    AGENT_START_X,
    AGENT_START_Y,
    AGENT_2_START_ID,
    AGENT_2_START_X,
    AGENT_2_START_Y,
    AGENT_3_START_ID,
    AGENT_3_START_X,
    AGENT_3_START_Y,
    TICK_INTERVAL_SECONDS,
    PLAYER_START_ID,
    PLAYER_START_X,
    PLAYER_START_Y,
    BUILDING_SIZE,
    BUILDING_1_ID,
    BUILDING_1_X,
    BUILDING_1_Y,
    BUILDING_2_ID,
    BUILDING_2_X,
    BUILDING_2_Y,
    HITBOXES_ENABLED,
    AGENT_1_NAME,
    AGENT_1_ROLE,
    AGENT_1_LINE,
    AGENT_2_NAME,
    AGENT_2_ROLE,
    AGENT_2_LINE,
    AGENT_3_NAME,
    AGENT_3_ROLE,
    AGENT_3_LINE,
    TALK_RANGE_TILES,
)
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.world.building import Building
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


def _initial_payload(agents, player, buildings, grid, talk_range_tiles) -> dict:
    return {
        "agents": [agent.to_dict() for agent in agents],
        "player": player.to_dict(),
        "buildings": [building.to_dict() for building in buildings],
        "grid_width": grid.width,
        "grid_height": grid.height,
        "talk_range_tiles": talk_range_tiles,
    }


def create_app() -> FastAPI:
    store = Store(
        Grid(GRID_WIDTH, GRID_HEIGHT),
        [
            Agent(
                agent_id=AGENT_START_ID,
                x=AGENT_START_X,
                y=AGENT_START_Y,
                name=AGENT_1_NAME,
                role=AGENT_1_ROLE,
                line=AGENT_1_LINE,
            ),
            Agent(
                agent_id=AGENT_2_START_ID,
                x=AGENT_2_START_X,
                y=AGENT_2_START_Y,
                name=AGENT_2_NAME,
                role=AGENT_2_ROLE,
                line=AGENT_2_LINE,
            ),
            Agent(
                agent_id=AGENT_3_START_ID,
                x=AGENT_3_START_X,
                y=AGENT_3_START_Y,
                name=AGENT_3_NAME,
                role=AGENT_3_ROLE,
                line=AGENT_3_LINE,
            ),
        ],
        Player(player_id=PLAYER_START_ID, x=PLAYER_START_X, y=PLAYER_START_Y),
        [
            Building(
                building_id=BUILDING_1_ID, x=BUILDING_1_X, y=BUILDING_1_Y, size=BUILDING_SIZE
            ),
            Building(
                building_id=BUILDING_2_ID, x=BUILDING_2_X, y=BUILDING_2_Y, size=BUILDING_SIZE
            ),
        ],
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
                        store.get_buildings(),
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

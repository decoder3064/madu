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
    PLAYER_START_ID,
    PLAYER_START_X,
    PLAYER_START_Y,
    TICK_INTERVAL_SECONDS,
)
from app.world.grid import Grid
from app.world.agent import Agent
from app.world.player import Player
from app.world.simulation import Simulation
from app.persistence.store import Store
from app.api.websocket import ConnectionManager

logger = logging.getLogger(__name__)

store = Store(
    Grid(GRID_WIDTH, GRID_HEIGHT),
    [Agent(agent_id=AGENT_START_ID, x=AGENT_START_X, y=AGENT_START_Y)],
    Player(player_id=PLAYER_START_ID, x=PLAYER_START_X, y=PLAYER_START_Y),
)
simulation = Simulation(store)
manager = ConnectionManager()


def _agents_payload(agents) -> dict:
    return {"agents": [agent.to_dict() for agent in agents]}


async def tick_loop():
    while True:
        await asyncio.sleep(TICK_INTERVAL_SECONDS)
        try:
            agents = simulation.tick()
            await manager.broadcast(_agents_payload(agents))
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
    await websocket.send_text(json.dumps(_agents_payload(store.get_agents())))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

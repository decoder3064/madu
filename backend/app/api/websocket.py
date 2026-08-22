import json


class ConnectionManager:
    def __init__(self):
        self._connections = []

    async def connect(self, websocket) -> None:
        await websocket.accept()
        self._connections.append(websocket)

    def disconnect(self, websocket) -> None:
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def broadcast(self, message: dict) -> None:
        data = json.dumps(message)
        for connection in list(self._connections):
            try:
                await connection.send_text(data)
            except Exception:
                self.disconnect(connection)

import { useGameConnection } from './hooks/useGameConnection'
import { useKeyboardMovement } from './hooks/useKeyboardMovement'
import { AgentScene } from './scene/AgentScene'

function App() {
  const { agents, player, sendMove } = useGameConnection('ws://localhost:8420/ws')
  useKeyboardMovement(sendMove)
  return <AgentScene agents={agents} player={player} />
}

export default App

import { useAgentPositions } from './hooks/useAgentPositions'
import { AgentScene } from './scene/AgentScene'

function App() {
  const agents = useAgentPositions('ws://localhost:8420/ws')
  return <AgentScene agents={agents} />
}

export default App

import { Home } from './screens/Home'
import { PersonChooser } from './screens/PersonChooser'
import { Toast } from './components/Toast'
import { useMe } from './store/useMe'

export default function App() {
  const me = useMe()

  return (
    <>
      {me ? <Home me={me} /> : <PersonChooser />}
      <Toast />
    </>
  )
}

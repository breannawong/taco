import { Home } from './screens/Home'
import { ListScreen } from './screens/ListScreen'
import { PersonChooser } from './screens/PersonChooser'
import { Toast } from './components/Toast'
import { SheetProvider } from './sheets/SheetProvider'
import { useMe } from './store/useMe'
import { useView } from './store/useNav'

export default function App() {
  const me = useMe()
  const view = useView()

  let screen = null
  if (!me) {
    screen = <PersonChooser />
  } else if (view.name === 'list') {
    screen = <ListScreen listId={view.id} me={me} />
  } else {
    screen = <Home me={me} />
  }

  return (
    <SheetProvider>
      {screen}
      <Toast />
    </SheetProvider>
  )
}

import { TacoLogo } from '../components/TacoLogo'
import { Avatar } from '../components/Avatar'
import { PEOPLE } from '../store'
import { setMe } from '../store/session'

export function PersonChooser() {
  return (
    <div className="chooser">
      <TacoLogo />
      <h1>Taco</h1>
      <p>Who's packing on this phone?</p>
      <div className="who-pick">
        {PEOPLE.map((person) => (
          <button type="button" key={person.id} onClick={() => setMe(person.id)}>
            <Avatar person={person} size="lg" />
            {person.name}
          </button>
        ))}
      </div>
      <p className="note">You can switch anytime from the circle in the corner.</p>
    </div>
  )
}

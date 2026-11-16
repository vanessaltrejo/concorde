import App from '../App'
import { Landing } from './Landing'
import { ProjectsHome } from './ProjectsHome'
import { usePath } from './nav'

// Picks the screen from the address: launcher, projects home, or the tool.
export function Root() {
  const path = usePath()
  if (path === '/') return <Landing />
  if (path === '/home') return <ProjectsHome />
  return <App />
}

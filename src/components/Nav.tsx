import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/gallery', label: 'Gallery' },
  { to: '/add', label: 'Add' },
  { to: '/you', label: 'You' },
]

export default function Nav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-night/95 backdrop-blur">
      <ul className="mx-auto flex w-full max-w-2xl pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                [
                  'block py-4 text-center font-display text-sm font-medium transition-colors',
                  isActive ? 'text-signal' : 'text-muted',
                ].join(' ')
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

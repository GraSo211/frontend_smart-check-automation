import type { UserDTO } from "@/actions/users"

export function filterUsersBySearch(users: UserDTO[], searchTerm: string) {
  const query = searchTerm.trim().toLowerCase()
  if (!query) return users
  return users.filter((user) => user.nombre.toLowerCase().includes(query) || user.email.toLowerCase().includes(query))
}

export function applyUserPatch(users: UserDTO[], id: string, patch: Partial<UserDTO>) {
  return users.map((user) => (user.id === id ? { ...user, ...patch } : user))
}

export function createUserOperationTracker() {
  const pending = new Set<string>()

  return {
    begin(id: string) {
      if (pending.has(id)) return false
      pending.add(id)
      return true
    },
    end(id: string) {
      pending.delete(id)
    },
    has(id: string) {
      return pending.has(id)
    },
    snapshot() {
      return new Set(pending)
    },
  }
}

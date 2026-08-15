/**
 * React hook for local account management.
 * Provides the registry of accounts, the active one, and mutations.
 */
import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getLocalAccounts, getActiveAccountId, setActiveAccountId, createLocalAccount, removeLocalAccount, renameLocalAccount, type LocalAccount } from '@/lib/services/auth-service'

const QUERY_KEY = ['local-accounts']

export function useAuthAccounts() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getLocalAccounts(),
    refetchOnWindowFocus: true,
  })

  const createMut = useMutation({
    mutationFn: createLocalAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => Promise.resolve(removeLocalAccount(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => Promise.resolve(renameLocalAccount(id, name)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  const switchAccount = useCallback((id: string) => {
    setActiveAccountId(id)
    queryClient.invalidateQueries()
    // Full reload so all stores/tanstack caches rebuild for the new user.
    window.location.reload()
  }, [queryClient])

  const createAccount = useCallback(() => {
    if (name.trim().length < 2) return
    createMut.mutate(name.trim(), {
      onSuccess: () => setName(''),
    })
  }, [name, createMut])

  const activeId = getActiveAccountId()
  const accounts = query.data ?? []
  const activeAccount: LocalAccount | undefined = accounts.find((a) => a.id === activeId)

  return {
    accounts,
    activeAccount,
    activeId,
    isLoading: query.isLoading,
    name,
    setName,
    createAccount,
    isCreating: createMut.isPending,
    switchAccount,
    removeAccount: removeMut.mutate,
    renameAccount: renameMut.mutate,
    isRemoving: removeMut.isPending,
    isRenaming: renameMut.isPending,
  }
}

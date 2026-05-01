import type { HandleClientError } from '@sveltejs/kit'

export const handleError: HandleClientError = async ({ error, event, status, message }) => {
  if (error instanceof Error) {
    return error
  }
  return {
    status,
    message
  }
}

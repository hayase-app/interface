import { toStore } from 'svelte/store'

import { page as currentPage } from '$app/state'

export const page = toStore(() => ({
  url: currentPage.url,
  route: currentPage.route,
  status: currentPage.status,
  error: currentPage.error,
  data: currentPage.data,
  params: currentPage.params,
  state: currentPage.state,
  form: currentPage.form,
  shallow: currentPage.shallow
}))

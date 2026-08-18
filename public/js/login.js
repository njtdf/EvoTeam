const { createApp, ref } = Vue

createApp({
  setup() {
    const role = ref('grad')
    const userId = ref('')
    const password = ref('')
    const loading = ref(false)
    const error = ref('')

    async function doLogin() {
      if (!userId.value || !password.value) {
        error.value = 'Please enter ID and password'
        return
      }
      loading.value = true
      error.value = ''
      try {
        const data = await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({
            student_id: userId.value,
            password: password.value,
          }),
        })
        if (data.ok) {
          window.location.href = data.redirect
        }
      } catch (e) {
        error.value = e.message
      } finally {
        loading.value = false
      }
    }

    return { role, userId, password, loading, error, doLogin }
  },
}).mount('#app')

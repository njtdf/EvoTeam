const { createApp, ref, computed } = Vue

createApp({
  setup() {
    const selectedRole = ref(null)
    const userId = ref('')
    const password = ref('')
    const loading = ref(false)
    const error = ref('')

    function selectRole(role) {
      selectedRole.value = role
      error.value = ''
    }

    async function doLogin() {
      if (!userId.value || !password.value) {
        error.value = '请输入 ID 和密码'
        return
      }
      loading.value = true
      error.value = ''
      try {
        const data = await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({ student_id: userId.value, password: password.value }),
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

    return { selectedRole, selectRole, userId, password, loading, error, doLogin }
  },
}).mount('#app')

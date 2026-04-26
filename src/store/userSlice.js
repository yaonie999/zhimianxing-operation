import { createSlice } from '@reduxjs/toolkit'

const userSlice = createSlice({
  name: 'user',
  initialState: {
    isLoggedIn: false,
    user: null,
    token: null,
  },
  reducers: {
    loginSuccess(state, action) {
      state.isLoggedIn = true
      state.user = action.payload?.user || action.payload?.data?.user || null
      state.token = action.payload?.token || action.payload?.data?.token || null
    },
    logout(state) {
      state.isLoggedIn = false
      state.user = null
      state.token = null
    },
  },
})

export const { loginSuccess, logout } = userSlice.actions
export default userSlice.reducer

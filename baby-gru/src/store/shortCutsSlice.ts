import { createSlice } from '@reduxjs/toolkit'

export const shortcutSettings = createSlice({
  name: 'shortcutSettings',
  initialState: {
    shortcutOnHoveredAtom: null,
    showShortcutToast: null,
    shortCuts: null,
  },
  reducers: {
    setShortcutOnHoveredAtom: (state, action: {payload: boolean, type: string}) => {
      return {...state, shortcutOnHoveredAtom: action.payload}
    },
    setShowShortcutToast: (state, action: {payload: boolean, type: string}) => {
        return {...state, showShortcutToast: action.payload}
    },
    setShortCuts: (state, action: {payload: string, type: string}) => {
        return {...state, shortCuts: action.payload}
    }    
}})

export const { setShowShortcutToast, setShortcutOnHoveredAtom, setShortCuts } = shortcutSettings.actions

export default shortcutSettings.reducer
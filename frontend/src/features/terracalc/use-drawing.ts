import { useCallback, useReducer } from 'react'
import type { LatLng } from './types'

/**
 * État du dessin du terrain, avec historique pour "Annuler".
 * - draw : chaque clic sur la carte ajoute un point
 * - edit : on déplace, insère ou supprime des points existants
 *
 * Pendant qu'on fait glisser un point, on met à jour la position SANS remplir l'historique
 * (sinon un seul glissement créerait des dizaines d'étapes à annuler).
 */
export type DrawMode = 'draw' | 'edit'

interface State {
  points: LatLng[]
  past: LatLng[][]
  mode: DrawMode
  selected: number | null
}

type Action =
  | { type: 'add'; point: LatLng }
  | { type: 'moveStart' }
  | { type: 'move'; index: number; point: LatLng }
  | { type: 'insert'; index: number; point: LatLng }
  | { type: 'remove'; index: number }
  | { type: 'clear' }
  | { type: 'undo' }
  | { type: 'load'; points: LatLng[] }
  | { type: 'mode'; mode: DrawMode }
  | { type: 'select'; index: number | null }

const HISTORY_LIMIT = 100

function reducer(s: State, a: Action): State {
  const push = (points: LatLng[], extra: Partial<State> = {}): State => ({
    ...s,
    past: [...s.past, s.points].slice(-HISTORY_LIMIT),
    points,
    ...extra,
  })
  switch (a.type) {
    case 'add':
      return push([...s.points, a.point], { selected: null })
    case 'moveStart':
      return { ...s, past: [...s.past, s.points].slice(-HISTORY_LIMIT) }
    case 'move':
      return { ...s, points: s.points.map((p, i) => (i === a.index ? a.point : p)) }
    case 'insert':
      return push([...s.points.slice(0, a.index), a.point, ...s.points.slice(a.index)], { selected: a.index })
    case 'remove':
      return push(
        s.points.filter((_, i) => i !== a.index),
        // Moins de 3 points : on repasse en mode dessin pour compléter
        { selected: null, mode: s.points.length - 1 < 3 ? 'draw' : s.mode },
      )
    case 'clear':
      return s.points.length ? push([], { selected: null, mode: 'draw' }) : s
    case 'undo': {
      if (!s.past.length) return s
      const previous = s.past[s.past.length - 1]
      return { ...s, points: previous, past: s.past.slice(0, -1), selected: null, mode: previous.length < 3 ? 'draw' : s.mode }
    }
    case 'load':
      return { points: a.points, past: [], mode: a.points.length >= 3 ? 'edit' : 'draw', selected: null }
    case 'mode':
      return { ...s, mode: a.mode, selected: null }
    case 'select':
      return { ...s, selected: a.index }
  }
}

export function useDrawing(initial: LatLng[] = []) {
  const [state, dispatch] = useReducer(reducer, {
    points: initial,
    past: [],
    mode: initial.length >= 3 ? 'edit' : 'draw',
    selected: null,
  })

  return {
    ...state,
    canUndo: state.past.length > 0,
    add: useCallback((point: LatLng) => dispatch({ type: 'add', point }), []),
    moveStart: useCallback(() => dispatch({ type: 'moveStart' }), []),
    move: useCallback((index: number, point: LatLng) => dispatch({ type: 'move', index, point }), []),
    insert: useCallback((index: number, point: LatLng) => dispatch({ type: 'insert', index, point }), []),
    remove: useCallback((index: number) => dispatch({ type: 'remove', index }), []),
    clear: useCallback(() => dispatch({ type: 'clear' }), []),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    load: useCallback((points: LatLng[]) => dispatch({ type: 'load', points }), []),
    setMode: useCallback((mode: DrawMode) => dispatch({ type: 'mode', mode }), []),
    select: useCallback((index: number | null) => dispatch({ type: 'select', index }), []),
  }
}

export type Drawing = ReturnType<typeof useDrawing>

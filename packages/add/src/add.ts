import { remove } from './remove'
export function add(c: number, d: number) {
  return c + d + remove(c, d)
}
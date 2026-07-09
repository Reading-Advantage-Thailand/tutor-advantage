import type { DirectionalInput } from '@/lib/games/enchantedLibrary'
import type { InputVector } from '@/hooks/useDirectionalInput'

export function mapInputVectorToDirectional(input: InputVector): DirectionalInput {
  return {
    left: input.dx < 0,
    right: input.dx > 0,
    up: input.dy < 0,
    down: input.dy > 0,
    cast: Boolean(input.cast),
  }
}

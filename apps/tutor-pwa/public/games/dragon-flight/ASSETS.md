# Dragon Flight Assets

## Asset Files

### Character Assets (3x3 sprite sheets)

**player-3x3-sheet-facing-down.png**
- Player dragon facing downward (flying animation)
- 9 animation frames arranged in 3x3 grid
- Used during active gameplay

**player-3x3-sheet-facing-camera.png**
- Player dragon facing directly at camera
- Used in intro screen as preview sprite

**dragon-army-3x3-sheet-facing-up.png**
- Army of small dragons that accompany the player
- Each frame represents a different dragon in the army
- Maximum of 12 dragons displayed in 4x3 grid formation

**boss-3x3-sheet-facing-up.png**
- Skeleton King boss enemy
- Frames 0-2: idle animation
- Frame 2: defeated state

**gates-3x3-sheet-facing-up.png**
- Magic gates with vocabulary translations
- Row 0: normal gate animation
- Row 1: correct selection state (green tint)
- Row 2: incorrect selection state (red tint)

### Background Assets (tiling parallax layers)

**parallax-top-tiling.png**
- Distant sky and clouds
- Slowest scroll speed: 40 pixels per second
- Rendered with 70% opacity
- Seamlessly loops for continuous flight effect

**parallax-middle-tiling.png**
- Mid-ground landscape elements
- Medium scroll speed: 28 pixels per second
- Rendered with 85% opacity

**parallax-bottom-tiling.png**
- Close ground and foreground elements
- Fastest scroll speed: 18 pixels per second
- Full opacity (100%)

### UI Assets

**loading-screen-background.png**
- Background for game start/loading screen
- Darkened with overlay during gameplay

## Asset Usage Details

### Player Dragon (`player-3x3-sheet-facing-down.png`)
- **Position**: Bottom center of canvas (`playerY: height * 0.78`)
- **Animation**: Cycles through 9 frames (3x3 grid) at 120ms per frame
- **Scale**: Ranges from 0.12 to 0.3 based on stage width
- **Movement**: Smoothly interpolates horizontally to selected gates (LERP factor: 0.22)
- **Purpose**: Main playable character controlled by player

### Dragon Army (`dragon-army-3x3-sheet-facing-up.png`)
- **Position**: Behind the main player dragon
- **Layout**: Displayed in 4x3 grid formation (max 12 dragons)
- **Animation**: Each dragon shows frame based on its position index
- **Scale**: 0.06 to 0.18 (smaller than main dragon)
- **Behavior**: 
  - Starts with 1 dragon
  - +1 dragon for each correct answer
  - -1 dragon for each incorrect answer (minimum 1)
- **Purpose**: Visual representation of player's dragon flight strength

### Boss (`boss-3x3-sheet-facing-up.png`)
- **Phase**: Appears only during boss phase when timer expires
- **Entry**: Starts above screen, scrolls down to player level
- **Animation**: 
  - Frames 0-2: Idle animation
  - Frame 2: Defeated state
- **Scale**: 0.25 to 0.65 (largest character asset)
- **Position**: Center horizontally (`bossX: width / 2`)
- **Combat**: Battle plays out during boss phase - dragons fight against boss power

### Gates (`gates-3x3-sheet-facing-up.png`)
- **Quantity**: Two gates displayed simultaneously (left and right)
- **Movement**: Travel from top of screen (y = -height) to bottom (y = +height) over 7.2 seconds
- **Animation**: Cycles through 3 frames at 160ms per frame
- **Scale**: 0.5 × gate frame width
- **Position**: 
  - Left gate: 28% of stage width
  - Right gate: 72% of stage width
  - Vertical position: 55% of stage height
- **States**:
  - Row 0: Normal floating animation
  - Row 1: Correct selection (green highlight overlay)
  - Row 2: Incorrect selection (red highlight overlay)
- **Interaction**: Clickable/tappable during gameplay to select translation

### Parallax Backgrounds
- **Layer Structure**: Three independent layers rendering in separate Konva canvas layers
- **Looping Technique**: Each layer rendered twice (A/B) for seamless infinite scrolling
- **Top Layer** (`parallax-top-tiling.png`):
  - Scroll speed: 40 pixels per second
  - Opacity: 70%
  - Creates depth perception
- **Middle Layer** (`parallax-middle-tiling.png`):
  - Scroll speed: 28 pixels per second
  - Opacity: 85%
  - Mid-ground scenery
- **Bottom Layer** (`parallax-bottom-tiling.png`):
  - Scroll speed: 18 pixels per second
  - Opacity: 100%
  - Foreground elements
- **Scaling**: Width scales to fill stage height while maintaining aspect ratio

### Loading Background (`loading-screen-background.png`)
- **Purpose**: Static background shown during asset loading phase
- **Overlay**: Darkened with semi-transparent slate overlay (55% opacity) during gameplay
- **Usage**: Ensures visual consistency during load transitions

### Player Camera (`player-3x3-sheet-facing-camera.png`)
- **Usage**: Displayed in intro screen as a preview sprite
- **Display**: Shown in a rounded border box before game starts
- **Purpose**: Provides visual introduction to the player character

## Technical Notes

### Sprite Grid System
All character assets use a 3x3 sprite grid system. The `buildSpriteGrid` function handles:
- Uneven frame distribution (remainder pixels distributed across first columns/rows)
- Frame cropping with `getSpriteCrop` for animation frames
- Responsive scaling based on stage dimensions

### Loading Sequence
1. All assets loaded via `loadImage` promises
2. `buildAssets` function parallel-loads all assets for optimal performance
3. Loading screen shown until all assets are ready
4. Game cannot start until all assets are successfully loaded

### Performance Considerations
- Parallax layers use Konva Animation for smooth 60fps rendering
- Sprite animations use independent intervals per asset type
- Gate travel speed calculated dynamically based on stage size
- Asset caching in React `useMemo` to prevent recalculations

## Asset Dimensions

All assets are PNG format with transparency support. Actual dimensions vary by original sprite sheet size, with scaling applied dynamically at runtime based on:
- Stage width (responsive design)
- Viewport height
- Character type (player, army, boss, gates)

For exact pixel dimensions, check individual image files.

# :icon[images/eye_sensor.png]{size=36} Eye Sensor

The Eye Sensor gives out a redstone signal when a player looks at it. The closer you look to the center of the face, the stronger the signal.

## How it works

| Where you look | Signal strength |
| :---: | :---: |
| Center of a face | 15 |
| Edge of a face | 1 |
| Not at the block | 0 |

- Works on every face of the block.
- Players can be up to **512 blocks** away. Blocks in between block the view, entities do not.
- If several players look at it, the strongest signal counts.
- Players in Spectator mode are ignored.
- It powers redstone components and solid blocks on all sides.

## Crafting

::: crafting
A B A
B C B
A D A
A: images/end_stone.png "End Stone"
B: images/echo_shard.png "Echo Shard"
C: images/ender_eye.png "Eye of Ender"
D: images/redstone.png "Redstone Dust"
=> images/eye_sensor.png "Eye Sensor"
:::

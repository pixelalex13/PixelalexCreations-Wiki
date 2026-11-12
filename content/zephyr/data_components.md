Zephyr adds a data component and a loot function for the [Vitalis Bottle](illusioner#vitalis-bottle). They are mainly useful for commands, data packs and mod developers.

## Data component

| Component | Type | Range | Description |
|---|---|:---:|---|
| `zephyr:vitalis_bottle_amplifier` | Integer | `0` to `4` | The level of the Vitalis Bottle. `0` is level I, `4` is level V |

Example: a Vitalis Bottle with level V.

```
/give @s zephyr:vitalis_bottle[zephyr:vitalis_bottle_amplifier=4]
```

## Loot function

`zephyr:set_vitalis_bottle_amplifier` sets the level of a Vitalis Bottle in a loot table. `amplifier` takes a number or a number provider.

```json
{
  "type": "zephyr:set_vitalis_bottle_amplifier",
  "amplifier": {
    "type": "minecraft:uniform",
    "min": 0,
    "max": 4
  }
}
```

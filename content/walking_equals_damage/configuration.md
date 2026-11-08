The config file is created the first time the game or server starts.

**File:** `config/walking_equals_damage.json`

```json
{
  "damagePerBlock": 1.0
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `damagePerBlock` | Number | `1.0` | Damage per block moved, in health points |

One health point is half a heart. Examples:

| Value | Damage per block |
|---|---|
| `0.5` | Quarter heart |
| `1.0` | Half a heart (default) |
| `2.0` | One heart |
| `20.0` | Ten hearts (a full health bar) |

::: info
The config is only loaded on startup. Restart the game or server after changing it.
:::

::: warning
If the file contains invalid JSON, the mod silently falls back to the default value. Check your syntax if your changes have no effect.
:::

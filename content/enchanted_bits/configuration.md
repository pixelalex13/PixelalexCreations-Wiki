The config file is created the first time the game or server starts.

**File:** `config/enchanted_bits.json`

```json
{
  "shiftingBookCooldown": 3.0
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `shiftingBookCooldown` | Number | `3.0` | Cooldown of the [Shifting Book](shifting_book) in seconds |

Decimal values work too, for example `1.5` for one and a half seconds.

::: info
The config is only loaded on startup. Restart the game or server after changing it.
:::

::: warning
If the file contains invalid JSON, the game can crash when a Shifting Book is used. Check your syntax after editing.
:::

The config file is created the first time the game starts.

**File:** `config/pixels_f3.json`

```json
{"hudColor":"#FFFFFFFF"}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `hudColor` | Text | `"#FFFFFFFF"` | Text color of the overlay as a hex value |

## Color format

The color can be written as `#RRGGBB` or `#AARRGGBB`. Examples:

| Value | Color |
|---|---|
| `#FFFFFF` | [#FFFFFF]White[/] (default) |
| `#FFFF55` | [#FFFF55]Yellow[/] |
| `#55FFFF` | [#55FFFF]Aqua[/] |
| `#FF5555` | [#FF5555]Red[/] |

::: info Transparency
The alpha part (`AA`) is currently ignored. The text is always fully visible.
:::

::: info
The config is only loaded on startup. Restart the game after changing it.
:::

::: danger
An invalid color value (for example `#FFF` or a typo) crashes the game on startup. Use exactly 6 or 8 hex digits.
:::

::: warning
If the file contains invalid JSON, it is reset to the default values.
:::

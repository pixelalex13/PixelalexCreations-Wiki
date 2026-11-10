# :icon[images/invisible_name_tag.png]{size=36} Invisible Name Tag

Wear the Invisible Name Tag on your head to hide your name tag. You also disappear from the locator bar.

## Crafting

::: crafting shapeless
A B .
. . .
. . .
A: images/name_tag.png "Name Tag"
B: potion #f6f6f6 "Potion of Invisibility" | splash_potion #f6f6f6 "Splash Potion of Invisibility" | lingering_potion #f6f6f6 "Lingering Potion of Invisibility"
=> images/invisible_name_tag.png "Invisible Name Tag"
:::

Any potion of invisibility works: normal, splash or lingering, and both the normal and the long version.

::: info
The recipe does not show up in the recipe book, because it uses a potion.
:::

## Name Tag Visibility attribute

The mod also adds an attribute that controls whether a player's name tag is shown.

| Attribute | Default | Range |
|---|---|---|
| `embellishments:name_tag_visibility` | `1.0` | `0.0` to `1.0` |

At `0.0`, the name tag of that player is hidden. You can change it with a command:

```
/attribute @s embellishments:name_tag_visibility base set 0
```

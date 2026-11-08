Enchanted Bits adds one block tag. You can change it with a data pack.

## Enchanting Table Passthrough

**Tag:** `enchanted_bits:enchanting_table_passthrough`

Controls which blocks can be placed between an Enchanting Table and its bookshelves, see [Enchanting Table](enchanting_table). The vanilla tag for this still works as well.

By default, the tag includes all blocks that are not a full cube, for example air, slabs, stairs, walls, fences, doors, trapdoors, carpets, torches, lanterns, candles, flowers, crops, signs, banners, beds, heads, glass panes, bars, chains, chests and shelves.

### Adding blocks with a data pack

Create this file in your data pack:

`data/enchanted_bits/tags/block/enchanting_table_passthrough.json`

```json
{
  "replace": false,
  "values": [
    "minecraft:glass"
  ]
}
```

With `"replace": false`, your blocks are added to the existing list. With `"replace": true`, only your blocks are allowed.

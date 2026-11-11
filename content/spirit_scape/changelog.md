## Beta v1.1
::: changelog
## Additions

**Spirit Crystal**
- The Spirit Crystal can now be applied to armor as an armor trim material

## Changes

**Graveyard Structure**
- Graveyards are now slightly rarer
:::

## Beta v1.0
::: changelog
## Additions

**Muddy Items**
- There are 13 different kinds of muddy items:
  Bundled Minerals, Sword, Pickaxe, Axe, Shovel, Hoe, Spear, Helmet, Chestplate, Leggings, Boots, Horse Armor, and Nautilus Armor
- They can be found in a variety of locations, including:
  Desert Pyramids, Desert Wells, Ocean Ruins, Trail Ruins, Strongholds, Igloos, Shipwrecks, Buried Treasures, Ancient Cities, Mineshafts, Jungle Pyramids, Trial Chambers, and via Fishing and Sniffer Digging
- Muddy Items can be cleaned in a Cleaning Station to receive a random tier of the corresponding tool (e.g., cleaning a Muddy Axe could yield a Stone Axe or a Netherite Axe)

**Soap Bars**
- There are 3 different tiers of Soap Bars: Crude, Refined, and Purified
- Soap Bars are used to clean Muddy Items in the Cleaning Station
- The tier determines the cleaning time and outcome — the better the soap, the higher the chance of receiving a rarer item
- Soap Bars can be obtained by trading with the Gravedigger Villager or by crafting them:
  - **Crude:** Clay Ball + Porkchop + Water Bucket
  - **Refined:** Crude Soap Bar + Diamond + Honey Bottle
  - **Purified:** Refined Soap Bar + Spirit Crystal + Ghast Tear

**Cleaning Station**
- The Cleaning Station is a new workstation used to clean Muddy Items
- It can be crafted using Iron Ingots, Planks, a Glass Pane, and a Cauldron
- It can also be found naturally in the new Graveyard structure
- The Cleaning Station has its own GUI, built similarly to the Furnace or Brewing Stand
- It must be filled with a Water Bucket (18 uses before refueling) or a Water Bottle (6 uses before refueling) before it can operate
- The cleaning process works similarly to smelting in a Furnace, but uses Soap instead of fuel and only accepts Muddy Items as input
- The tier of soap used determines the cleaning time and outcome — the better the soap, the higher the chance of a rarer result
- The Cleaning Station supports Hopper interaction similarly to a Furnace: Muddy Items are inserted from the top, Water and Soap from the sides, and the result (along with the empty Bucket or Bottle) is extracted from the bottom
- It also supports Comparator output
- The Station has 2 notable block states:
  - **Cleaning:** Emits particles and sound while active
  - **Filled:** Displays a filled water texture when water is present
- Cleaning results are fully data-driven via loot tables, making them easy to customize

**Urn**
- The Urn is a new decorative block, similar to the Decorated Pot but significantly smaller
- Unlike the Decorated Pot, the Urn cannot be decorated and holds up to 8 items — including non-stackable items
- The main difference from the Decorated Pot is the ability to store 8 distinct items, including non-stackables
- All other behavior is nearly identical, including Comparator output, Hopper functionality, and the breaking mechanic (e.g., hitting it with a Bow and Arrow shatters it)
- Urns can be found naturally in the Graveyard structure or crafted using 3 Bricks

**Gravedigger Villager Profession**
- The Gravedigger is a new Villager profession that spawns naturally in the Graveyard structure
- The Gravedigger uses the Cleaning Station as their workstation
- Their trades range from Rotten Flesh and Bones to Soap Bars and Spirit Plasma

**Graveyard Structure**
- A new structure that can be found in several biome-specific variants: Forest, Taiga, Snowy Taiga, Savanna, Desert, and Badlands
- The structure features graves, a crypt containing Urns, and a Gravedigger Villager with a Cleaning Station
- Loot can be found in the graves, Urns, and among the Gravedigger's belongings
- The Graveyard is a rare structure and not easy to come across
[gray]*Parts of the graveyard structures were built by PixelToni153.*[/]

**Translation**
- Added a german translation

## Changes

**Spirit Crystal Horse and Nautilus Armor**
- These items can no longer be crafted using the Spirit Manifest, as they can now be obtained through Muddy Items

**Dimensional Rift Event**
- The event is now 10 times rarer, following the reduced need for the Spirit Manifest
:::

## Alpha v1.1
::: changelog
## Additions

**Commands**

**spawnevent**
- Added a new "spawnevent" command, used to spawn events in the world
- To execute the command, the player must be a Grandmaster (Operator Level 2) or higher
- The Dimensional Rift event can now be spawned using this command

## Changes

**Dimensional Rift Event**
- The "Spirit Manifest Spawn Event" has been renamed to "Dimensional Rift"
- The rift now opens within a 24-block radius around the player instead of 30
- The sounds of the rift have been made quieter
:::

## Alpha v1.0
::: changelog
## Additions

**Spirit Crystal**
- The Spirit Crystal is a new material used for crafting equipment and other items
- Spirit Crystals can be found as Stone Ore and Deepslate Ore between the heights of 16 to -62, with a similar rarity to Netherite
- The ore can only be broken with a Diamond Pickaxe or higher
- There is also a Spirit Crystal Block that is similar to the Netherite Block, except it can be blown up by End Crystals or Charged Creepers

**Spirit Plasma**
- Is a new crafting material dropped by vexes
[gray]*This is exclusive to Alpha and will be changed in the Beta.*[/]

**Soul**
- Is a new crafting material dropped by soul sand, similar to gravel and flint
[gray]*This is a temporary solution and will be changed if there is a better solution for it.*[/]

**Soul Plasma Rod**
- Is a new crafting material similar to sticks
- It is crafted using a Soul, Spirit Plasma, Breeze Rod, and Echo Shard

**Spirit Manifest**
- Is a magical item used for getting items in Alpha and Beta development if there isn't a real way to obtain them
- It has a small lore text in the tooltip
- It can appear in a world event randomly every tick with a chance of 1 in 100,000
- The world event is a rift opening up with loud sounds playing to indicate it has spawned around a player within a range of 30 blocks
[gray]*This is an item exclusive to Alpha and Beta and will probably become unobtainable during release.*[/]

**Spirit Crystal Weapons & Tools**
- The Spirit Crystal Weapons & Tools set features: Sword, Spear, Shovel, Pickaxe, Axe, and Hoe
- These sets are like Copper to Stone Tools; they are faster than their Netherite counterparts, but do not deal more damage, have more durability, or higher attack speed
- They are crafted using Soul Plasma Rods and Spirit Crystals

**Spirit Crystal Armor**
- The Spirit Crystal Armor set features: Helmet, Chestplate, Leggings, Boots, Horse Armor, and Nautilus Armor
- These sets are similar to Netherite but do not have knockback resistance; as a trade-off, they have one more armor than Netherite
- The player armor set is crafted as usual with Spirit Crystals
- The Horse and Nautilus Armor are smithed in the Smithing Table with their diamond counterparts, Spirit Crystals, and the Spirit Manifest

**Spirit Scape Item Group**
- All items were added to this item group as well as to other fitting item groups

**Tags**

**Needs Spirit Crystal Tool Tag**
- Added a needs_spirit_crystal_tool tag to use later in development

**Needs Netherite Tool Tag**
- Added a needs_netherite_tool tag to use later in development
[gray]*This was added because vanilla Minecraft only has a needs_diamond_tool tag and below.*[/]

## Changes

- Huge texture overhaul over the textures from the legacy mod
- Renamed a few items from the legacy mod
:::

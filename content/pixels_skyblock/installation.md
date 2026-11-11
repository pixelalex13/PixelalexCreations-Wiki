## Singleplayer

1. Download the normal or the Hardcore version from [Pixelalex Creations](https://www.pixelalexcreations.net/worlds/#pixels_skyblock).
2. Unzip the downloaded file. Inside is a folder called `Pixels Skyblock [2.0]`.
3. Open your Minecraft folder and go into the `saves` folder.
4. Move the `Pixels Skyblock [2.0]` folder into `saves`.
5. Start Minecraft and open the world under **Singleplayer**.

::: warning
Move the folder, not the ZIP file. Minecraft does not show worlds that are still zipped.
:::

::: info Included packs
The world comes with its data packs and a small resource pack already installed. You do not need to download anything else. Do not disable them, or the custom advancements will not work.
:::

::: info LAN
If you open the world to LAN, only you get the included resource pack. Other players can install it themselves, see [Resource pack](#resource-pack) below.
:::

## Server

1. Stop your server.
2. Download the normal or the Hardcore version and unzip it.
3. Delete or rename the existing `world` folder of your server.
4. Move the `Pixels Skyblock [2.0]` folder into your server folder and rename it to `world`.
5. Open `server.properties` and set the following values:

| Setting | Value | Notes |
|---|---|---|
| `difficulty` | `normal` | Same as in singleplayer |
| `hardcore` | `true` or `false` | `true` for the Hardcore version, `false` for the normal version |

6. Start the server.

::: warning Hardcore on servers
For Hardcore mode, use the Hardcore download **and** set `hardcore=true`. Setting only one of them is not enough.
:::

### Resource pack

The resource pack that changes the look of the advancement screen is not sent to players automatically. You have two options:

- **For all players:** move `world/resourcepacks/resources.zip` out of the world folder, upload it somewhere with a direct download link and set that link as `resource-pack` in `server.properties`.
- **For single players:** each player copies `resources.zip` into their own `resourcepacks` folder and enables it.

::: warning
If `resources.zip` is still inside the world folder, the server ignores the `resource-pack` setting. Make sure to move it out first.
:::

Without the resource pack, the advancements still work. They just use the vanilla look.

## Settings

The world is set to **Survival** mode on **Normal** difficulty, with cheats turned off. In the Hardcore version, Hardcore mode is on.

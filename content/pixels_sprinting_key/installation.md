Pixels Sprinting Key is installed the classic way: its files go directly into the Minecraft `.jar`. Use a separate instance for this, so your normal game stays untouched.

## Requirements

- A launcher with separate instances, for example [Prism Launcher](https://prismlauncher.org)
- A vanilla instance with Minecraft **1.0.0**
- The mod ZIP from the [download page](https://www.pixelalexcreations.net/mods/#pixels_sprinting_key)

::: danger The official Minecraft Launcher does not work
When you start 1.0.0, the official launcher replaces the changed `.jar` with the original one, so the mod is removed again right away. Use a launcher like Prism instead.
:::

::: warning
The mod changes the game file itself. Do not install it into an instance you want to keep vanilla.
:::

## Installing

::: tabs
@tab Prism (recommended)
1. Create a new instance with Minecraft **1.0.0**.
2. Right-click the instance and choose **Edit**.
3. Open **Version** and click **Add to Minecraft.jar** on the right.
4. Select the mod ZIP.
5. Start the instance.
@tab Manual
1. Create a new instance with Minecraft **1.0.0** and start it once, so the game files are downloaded.
2. Find the client `.jar` of the instance.
3. Open the `.jar` with an archive tool like 7-Zip or WinRAR.
4. Delete the `META-INF` folder.
5. Copy all files from the mod ZIP into the top level of the `.jar`, not into a subfolder.
6. Close the archive tool and start the instance.
:::

::: tip Why delete META-INF?
The original `.jar` is signed, and the signature is stored in `META-INF`. Once the `.jar` is changed, Java's signature check fails and the game will not start.
:::

## Changing the key

The sprint key defaults to **Ctrl**. You can change it under **Options › Controls**.

## Uninstalling

- **Prism:** remove the mod in **Edit › Version** again.
- **Manual:** delete the instance or let the launcher download the version again.

## Troubleshooting

::: details The game crashes or shows a black screen on start
The `META-INF` folder is still in the `.jar`. Delete it and start again.
:::

::: details The sprint key does nothing
The mod files ended up in a subfolder inside the `.jar`. Move them to the top level.
:::
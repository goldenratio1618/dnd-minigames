# dnd-minigames
Minigames for a DnD campaign

## Quick start

1. Install dependencies:

```
npm install
```

2. Start the server (binds to 0.0.0.0 so devices on your WiFi can connect):

```
npm start
```

3. Open the game:

- DM view: `http://<your-ip>:3000/dm.html`
- Player view: `http://<your-ip>:3000/`

Tip: if you are in WSL, use your Windows host IP (from `ipconfig`) or your WSL IP (`hostname -I`).

## Network safety

The server only accepts connections from private/local IP ranges (10.x, 172.16-31.x, 192.168.x, loopback, and link-local). Even if you accidentally expose the port, it rejects non-local traffic.

For extra safety:

- Do not set up router port forwarding.
- Keep your firewall rules limited to your local network.

## Arcane Cells (FreeCell variant)

- 8 tableau columns, 4 foundations, and 4 free cells.
- Colors replace suits: white (hearts), green (diamonds), blue (clubs), black (spades).
- Values are numbered 1 through 13.
- Tableau builds down in alternating color groups (white/green vs blue/black).
- Foundations build up by color starting at 1.
- Click a card (or valid run) and then click a destination to move it.

### Free cell names and locks

- Free cells represent characters. Click the name area to claim it.
- Cells lock while someone is typing so multiple people cannot edit the same name.
- Cards can only be moved into a free cell that has a name.

### Traps

- The DM chooses the number of trapped cards when starting a new game (default 10).
- Traps only trigger when a trapped card is moved into a named free cell.
- When a trap triggers, players see an explosion and are frozen until the DM confirms the alert.
- Each card shows a hint number (bottom-right) indicating adjacent traps, including itself.
- The DM sees trapped cards and their trap numbers in the top-right corner of each card.

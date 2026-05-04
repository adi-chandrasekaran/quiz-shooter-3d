# Quiz Shooter 3D

A multiplayer 3D quiz-shooter prototype.

## What it does

- Host creates a room.
- Host enters a multiple-choice question deck.
- Players join without accounts using a room code.
- Players choose one of three maps:
  - Village
  - Prison
  - Laser Tag Arena
- Each question spawns answer-monsters.
- Players shoot the monster with the correct answer.
- Correct answer = points based on speed.
- Wrong answer = no score.
- Getting caught by a monster = negative score and respawn.
- Leaderboard updates live over Socket.IO.
- Each player progresses independently, so nobody waits for a timer.

## Tech Stack

- Client: React + TypeScript + Vite + React Three Fiber + Drei
- Server: Node + Express + Socket.IO + TypeScript
- No database yet. Room/game state is in-memory for the prototype.

## How to run in Cursor

```bash
cd quiz-shooter-3d
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

Server runs at:

```text
http://localhost:4000
```

## Suggested next upgrades

1. Add real 3D assets from Blender / Mixamo / Sketchfab.
2. Add authentication for hosts.
3. Save decks in a database.
4. Add real map geometry and collision.
5. Add weapons, reloads, ammo, sounds, animations, and post-processing.
6. Add anti-cheat by moving more scoring logic server-side.
7. Add teacher dashboard / class analytics.

## Multi-device testing on the same Wi-Fi

If players are joining from phones or other laptops, `localhost` will not work for them because it points to their own device.

1. Find your laptop IP address.
2. Create this file:

```bash
client/.env
```

3. Add:

```bash
VITE_SERVER_URL=http://YOUR-LAPTOP-IP:4000
```

4. Restart:

```bash
npm run dev
```

5. Players open:

```text
http://YOUR-LAPTOP-IP:5173
```


## New game flow added

This version includes:

- Host-controlled start only.
- Countdown on all player screens after the host starts.
- Host overview dashboard after starting:
  - player grid
  - clickable individual progress
  - live leaderboard
  - end game
  - restart same game
- Player waiting room after finishing all questions.
- Animated final podium when everyone finishes.
- End game returns everyone to the home screen.
- Restart game resets scores/progress and starts the countdown again.

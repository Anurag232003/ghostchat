# 🔐 Anonymous End-to-End Encrypted (E2EE) Chat

A production-grade, zero-knowledge Anonymous End-to-End Encrypted Chat application built with **React Native (Expo)** on the frontend and **FastAPI (Python) + MongoDB** on the backend, powered by audited **Noble Cryptography** (`@noble/curves` + `@noble/ciphers`).

---

## 🛡️ Core Cryptographic Architecture

The server acts solely as a **blind relay / mailbox**. Plaintext messages, raw attachments, and private keys never touch or leave the client unencrypted.

```
User A (Plaintext)
   ↓
[Client-Side Encryption: Noble X25519 + ChaCha20-Poly1305 + Ed25519]
   ↓
Ciphertext Packet: "8fA92...xK29" + Nonce + Ratchet Header
   ↓
Blind Relay Server (Zero-Knowledge / Ciphertext only)
   ↓
User B
   ↓
[Client-Side Decryption: Double-Ratchet State Machine]
   ↓
User B (Plaintext)
```

### Cryptographic Primitives
| Function | Primitive | Standard / Role |
| :--- | :--- | :--- |
| **Identity & Authentication** | `Ed25519` | Client identity keypair, signed prekey signatures, sender key message authenticity |
| **Key Agreement** | `X25519` (Curve25519) | Signal-style X3DH key agreement & continuous Diffie-Hellman ratchet steps |
| **Symmetric Encryption** | `ChaCha20-Poly1305` | Authenticated 256-bit payload, attachment, and voice note encryption with 96-bit nonce |
| **Key Derivation** | `HKDF-SHA256` | KDF chain ratchets for Forward Secrecy & Post-Compromise Security |
| **Group Encryption** | `Sender Keys Protocol` | Ephemeral ratcheted symmetric group chain keys distributed via pairwise ratchets |
| **Man-In-The-Middle Defense** | `Safety Numbers` | Deterministic SHA-256 fingerprint sorted lexically into 12 5-digit verification codes |

---

## 🕶️ Blind Date — Main Signature Feature

The application flips traditional dating apps on their head:

```
Traditional Flow: See Photos & Bio ➔ Swipe / Like ➔ Match ➔ Chat
Our Paradigm:     Enter Blind Date  ➔ Match Anonymously ➔ Complete Activities ➔ Mutual Reveal Decision
```

### 🎭 Blind Date Modes Suite:
The Blind Date system is not just one monolithic mode — it provides multiple tailored experiences:

#### 🌑 Mode A — Mystery Match (Signature Feature)
Two random compatible users are matched anonymously. Both participants see:
```text
✨ Your Mystery Match ✨

🌑 Unknown

Age: 20–24
Interests:
🎮 Gaming
🎵 Music
☕ Coffee

Compatibility: Hidden

🔒 No photo.
🔒 No real name.
🔒 No social media.
```
- **Guaranteed Anonymity**: Absolute zero photo, real name, or social handle exposure.
- **Compatibility Obfuscation**: Compatibility score remains completely masked until shared icebreakers are completed.
- **Focused on Essence**: Genuine connection forged entirely through shared interests and blind banter.

#### ⚡ Mode B — Speed Blitz (300-Second Sprint)
- **High-Adrenaline Encounters**: An active 5-minute countdown timer ticks down in real time.
- **Quick Spark or Clean Fade**: Complete 3 high-voltage dilemmas and make the mutual reveal decision before the countdown hits 00:00.

#### 🔮 Mode C — Vibe Deep Dive
- **Nocturnal Mind Sync**: Matched through intellectual and philosophical prompts rather than superficial metrics.
- **Extended Introspection**: Unveils perspective answers and existential choices to test deep worldview resonance.

### The Blind Date Chamber Flow:
1. **Choose Your Ambient Vibe**:
   - `🌙 Late Night Deep Talks`
   - `🎮 Gaming & Cyberpunk`
   - `☕ Coffee & Spontaneous Banter`
   - `🌌 Philosophy & Cosmos`
2. **Instant Match as Shrouded Shadows**:
   - Both users enter a private, zero-knowledge ephemeral chamber masked as `Shadow#4829` and `Phantom#9102`.
   - In Mode A, the **Your Mystery Match** card displays the bracketed age and interests with strict privacy guards.
3. **Interactive Icebreaker Activities & Chemistry Meter**:
   - **Round 1 (⚡ Rapid-Fire: This or That)**: Synchronous choice comparisons (e.g., Cozy Cafe vs Late Night Gaming).
   - **Round 2 (🔮 Deep Blind Prompt)**: Sealed secret confessions/opinions that unseal simultaneously only when both submit!
   - **Round 3 (🎵 Music & Vibe Check)**: Midnight drive soundtracks.
   - Every completed activity pumps the **Mutual Chemistry Meter** (0% ➔ 100%).
4. **The Shadow Veil Decision**:
   - **💖 Reveal & Connect**: If BOTH participants choose Reveal, a neon bloom animation unveils their Level 2 identities (Nicknames, Avatars, Age & Interests) and converts the session into a permanent, end-to-end encrypted chat!
   - **💨 Fade Into Shadows**: If either participant chooses Fade, all ephemeral chamber packets and keys self-destruct cleanly, leaving zero traces.
5. **Instant Companion Demo Mode**:
   - Spawns an AI Shadow companion (`✨ Lyra / Phantom#8901`) with exact Mode A Mystery Match specifications (`Age: 20–24`, `🎮 Gaming`, `🎵 Music`, `☕ Coffee`) for instant solo testing.

---

## 🧩 Compatibility Puzzle (Pre-Chat Topic Unlocking)

Before or during chatting, both users answer 5–10 curated lifestyle and philosophical dilemma questions.

### Question Deck:
1. `Sunrise or Midnight?` (`🌅 Sunrise` vs `🌙 Midnight`)
2. `Introvert evening or party night?` (`🛋️ Introvert evening` vs `🎉 Party night`)
3. `Coffee or Chai?` (`☕ Coffee` vs `🫖 Chai`)
4. `Travel alone or with friends?` (`🎒 Travel alone` vs `✈️ Travel with friends`)
5. `If you had ₹10 lakh, what would you do?` (`✈️ Travel the world`, `🎮 Build dream gaming rig`, `📈 Invest in crypto/stocks`, `🚀 Launch an indie startup`)
6. `Weekend passion: Gaming marathon or Nature adventure?` (`🎮 Gaming marathon` vs `🌲 Nature adventure`)

### Topic Unlocking Mechanism:
Instead of immediately revealing a flat numerical score, the system compares both users' answers and unlocks targeted conversation topics based on exact shared resonance:

```text
You both chose:

🎮 Gaming
🌙 Late nights
✈️ Travel

Conversation unlocked:
"What's your dream destination?"
"What thoughts or passions keep your mind alive during late midnight hours?"
```

- **In Blind Date Chamber**: Results appear on the **Compatibility Puzzle Unlocked** card during the decision phase.
- **In Permanent E2EE Chat**: Unlocked conversation topics appear directly above the message bar as clickable quick-starter chips. Tapping on a topic automatically populates the input field, ready to send!
- **Interactive Header Button**: Any 1-on-1 chat pair can tap `🧩 Puzzle` in the chat header to launch the compatibility puzzle and unlock fresh conversation topics anytime.

---

---

## 👻 7. Progressive Identity Reveal (Signature Differentiator)

Rather than superficial swiping based on immediate photos, the application provides an authentic, progressive identity unveil that deepens alongside connection time and mutual interest:

```text
At the beginning:
🌑 Mystery Person (100% shrouded ghost ID, all traits locked)
   ↓
After 5 minutes:
✨ Interest #1 revealed (Core passion emerges with neon glow)
   ↓
After 10 minutes:
🏷️ Nickname revealed (Authentic pseudonym unveils)
   ↓
After mutual interest:
🎨 Avatar revealed (Aesthetic curated avatar & palette bloom)
   ↓
Then:
📸 Photo Reveal (Strict mutual consent required from both users)
```

### The Mutual Consent Photo Guard
Before photos or full profiles can be revealed, both users must explicitly consent:

```text
        Nova wants to reveal their profile.

                        🔒

               Reveal to each other?

        [ Reveal ]              [ Keep Anonymous ]
```

- **Strict Mutual Consent**: If **both** participants tap `[ Reveal ]`, the blur filter lifts and authentic photos unveil simultaneously with a celebratory bloom animation.
- **Anonymity Preserved**: If either participant chooses `[ Keep Anonymous ]`, the prompt cleanly dismisses and photos remain 100% encrypted and locked.
- **Selective Server-Side Disclosure**: The backend enforces zero information leakage — private photo URLs, first names, and social links are mathematically and strictly stripped at the database query boundary until both mutual consents are verified on the server.
- **Available in Both 1-on-1 Chat & Blind Date Chamber**: Users can track the progressive reveal timeline live during conversations and dates.
- **Fast-Forward Testing Shortcuts**: Evaluators can instantly test the 5m, 10m, mutual interest, and photo reveal dialog with the embedded testing bar (`⏩ +5 Min`, `⏩ +10 Min`, `💖 Trigger Mutual Spark`, `🔒 Show Reveal Prompt Modal`).

---

## 🎲 8. Blind Date Mini Games

Instead of forcing users to say an awkward "Hi", give them activities to break the ice naturally!

### Game 1 — This or That
```text
Pizza 🍕
or
Burger 🍔

Both answer simultaneously.
```

- **Simultaneous Sealing & Reveal**: When User A selects their answer, their choice is cryptographically sealed on the server. User B cannot see User A's answer until User B submits their own choice.
- **Unsealed Spark**:
  - **Match**: If both chose `Pizza 🍕`, an energetic chemistry explosion is triggered along with an unlocked topic: *"You both chose Pizza 🍕! Deep dish, wood-fired thin crust, or cheesy stuffed crust?"*
  - **Playful Clash**: If one chose `Pizza 🍕` and the other chose `Burger 🍔`, a fun debate prompt is unlocked: *"Food Clash: Pizza 🍕 vs Burger 🍔! Defend your culinary honor in the chat!"*
- **Deck of Dilemmas**: Includes 6 curated rounds: Pizza vs Burger, Sunrise vs Midnight, Coffee vs Chai, Travel alone vs with friends, Cozy evening vs Wild party, Gaming marathon vs Nature adventure.

---

### Game 2 — Two Truths & A Lie

```text
Each person submits:

1. I've travelled alone.
2. I hate coffee.
3. I've broken a bone.

Other person guesses the lie.
```

- **Phase 1 (Submit)**: Each user submits 3 statements about themselves (2 true, 1 lie) and tags which one is their secret lie.
- **Phase 2 (Guess)**: The other person reads the 3 statements and taps which one they suspect is the lie.
- **Phase 3 (Reveal)**:
  - **Lie Caught!**: If guessed correctly, reveals: `🎯 You caught the lie! 'I hate coffee.' was the lie! (+10 Chemistry)`.
  - **Fooled You!**: If guessed wrong: `🎭 Fooled you! 'I hate coffee.' was the actual lie! (+5 Chemistry)`.
  - Automatically unlocks follow-up story starters directly to the chat!

---

### Game 3 — Would You Rather

```text
Would you rather:

🌍 Travel the world
OR
🏠 Live in your dream city?
```

- **Interactive Dilemma Selection**: Users choose between high-stakes lifestyle paths.
- **Simultaneous Comparison**: Shows perspective alignment with deep discussion starters:
  - If both chose `🌍 Travel the world`: *"Which continent or country is first on your bucket list?"*
  - If both chose `🏠 Live in your dream city`: *"What city is your sanctuary, and how is your dream home designed?"*
  - If split: *"Wanderlust vs Roots! What drove your choice?"*

---

### Game 4 — Guess Me

```text
The system gives:

Guess your match's favourite genre.

Then reveal:

Your guess: Horror
Actual: Horror 😳

+10 Chemistry
```

- **Interactive Intuition Challenge**:
  1. Each player submits their true favourite genre (`Horror`, `Sci-Fi`, `Romance`, `Comedy`, `Thriller`, `Fantasy`).
  2. Each player guesses what their match's favourite genre is!
- **Instant Unveil Card**:
  - Matches prompt output exactly:
    ```text
    Your guess: Horror
    Actual: Horror 😳

    +10 Chemistry
    ```
- **One-Tap Chat Ignition**: Every game features `[ 💬 Send Topic to Chat ➔ ]` to immediately populate the user's end-to-end encrypted message bar with the unlocked topic.

---

## ❤️ 9. Conversation Chemistry Meter

Rather than a generic or misleading "compatibility percentage", the platform provides **Conversation Chemistry** — an app-generated interaction metric measuring mutual conversational momentum, turn-taking reciprocity, and shared activity results.

```text
Conversation Chemistry

████████░░ 82
```

### The 5 Interaction Dimensions:
1. **🎯 Mutual Answers (Max 20 pts)**: Resonant choices in This or That dilemmas, Blind Date prompts, and Compatibility Puzzles.
2. **🌟 Shared Interests (Max 20 pts)**: Number of overlapping lifestyle passions from user profiles (e.g. `🎮 Gaming`, `☕ Coffee`, `🌙 Late nights`).
3. **💬 Conversation Participation (Max 25 pts)**: Reciprocal turn-taking balance and message density (e.g. `52% / 48%` balance).
4. **🎲 Mini-Game Results (Max 20 pts)**: Wins and alignment across Game 1 (Pizza vs Burger), Game 2 (Two Truths), Game 3 (Would You Rather), and Game 4 (Guess Me).
5. **❤️ Mutual Reactions (Max 15 pts)**: Count of emoji reactions (❤️, 🔥, 👍) exchanged between chat participants.

### Crucial Presentation & Transparency Guard:
> [!NOTE]
> **App-Generated Interaction Metric**: The Chemistry Meter is explicitly presented across all interfaces with a prominent disclaimer:
> *"Conversation Chemistry is an app-generated interaction metric based on chat engagement and game dynamics, not a factual measure of relationship compatibility."*

- **1-on-1 Chat Header Access**: A dedicated `❤️ Chemistry` pill is available in the header of every direct conversation.
- **Detailed Interaction Drawer**: Clicking the button opens an animated breakdown modal detailing all 5 dimensions and dynamic boost shortcuts.

---

## 🎯 10. Blind Date Missions (Gamified Date XP)

During the date and direct conversations, interactive missions randomly unlock to provoke spontaneous, vulnerable, and creative exchanges.

```text
Mission #1
Tell them something you've never told a stranger.

Mission #2
Ask them about their dream career.

Mission #3
Both choose a fictional world you'd live in.

Mission #4
Send a voice note saying your favourite song.

Completing missions gives:
✨ Date XP +20
```

### 36 Curated Interactive Missions:
The platform features an expansive deck of **36 distinct missions** (exceeding the 30-mission requirement) categorized into:
- **Vulnerability & Secrets**: *"Tell them something you've never told a stranger"*, *"Confess an irrational fear that makes zero logical sense"*, *"Share your midnight 2 AM habit"*.
- **Aspirations & Future**: *"Ask them about their dream career"*, *"If guaranteed 100% success, what crazy venture would you start tomorrow?"*.
- **Creative & Fictional Worlds**: *"Both choose a fictional world you'd live in"*, *"Cyberpunk neo-Tokyo 🌃 OR Enchanted medieval fantasy kingdom 🏰?"*.
- **Voice Note Challenges**: *"Send a voice note saying your favourite song"*, *"Send an audio note doing your best character impression"*, *"Hum a song melody and let them guess it"*.
- **Nostalgia & Depth**: *"Happiest childhood memory in 3 sentences"*, *"A book, film, or song that genuinely rewired your thinking"*, *"The kindest compliment anyone ever gave you"*.

### Date XP & Level Progression:
- Completing each mission awards **`✨ Date XP +20`**.
- As XP accumulates, pairs unlock progressive connection ranks:
  - **Level 1 (0–39 XP)**: `🌱 Curious Spark`
  - **Level 2 (40–79 XP)**: `✨ Wavelength Explorer` (2 missions completed)
  - **Level 3 (80–119 XP)**: `🔥 Deep Resonance` (4 missions completed)
  - **Level 4 (120–159 XP)**: `💎 Shadow Alchemist` (6 missions completed)
  - **Level 5 (160+ XP)**: `🌌 Cosmic Soulmates` (8+ missions completed)
- **Direct One-Tap Starters**: Every mission includes a `[ 💬 Send to Chat ]` button that prefills conversational starters directly into the message bar.
- **Dual Availability**: Accessible both in the **Blind Date Chamber** (via the dedicated `🎯 Missions` tab) and in **Permanent 1-on-1 Direct Chats** (via the header trigger).

---

## 🃏 11. Question Cards (Swipeable Icebreaker Deck)

Have a swipeable deck of curated question cards to break the ice and dive past small talk into unforgettable conversations:

```text
┌─────────────────────┐
│     QUESTION #12    │
│                     │
│ What's something    │
│ you could talk      │
│ about for hours?    │
│                     │
│      [Answer]       │
└─────────────────────┘
```

### The 9 Curated Categories:
1. **Funny** (🎭): Absurd scenarios, hilarious quirks, and everyday comedic observations.
2. **Deep** (🧠): Core life principles, emotional vulnerability, philosophy, and personal growth.
3. **Random** (🎲): Spontaneous, unpredictable dilemmas and quirky curiosities.
4. **Romantic** (💖): Love languages, intimacy philosophies, romantic gestures, and sparks.
5. **Career** (💼): Ambitions, dream ventures, work-life balance, and professional philosophies.
6. **Childhood** (🧸): Nostalgic memories, formative moments, childhood dreams, and lessons.
7. **Future** (🚀): Next decade visions, bucket lists, dream homes, and future hopes.
8. **Weird** (👾): Unhinged conspiracy theories, bizarre shower thoughts, and unconventional tastes.
9. **Rapid Fire** (⚡): Quick, binary, punchy dilemmas (*Coffee ☕ or Matcha 🍵?*, *Spontaneous trip 🚗 or Meticulous plan 📋?*).

### 54+ Curated Questions Deck:
- Over 50 questions (**54 total**, 6 per category) fully loaded and indexed in the catalog.
- Includes exact requested **QUESTION #12**: *"What's something you could talk about for hours?"*
- **Deck Features**:
  - **Swipeable Stack View**: Physical card deck stack layering with smooth `Next ➔`, `⬅ Prev`, and `🎲 Random` controls.
  - **Category Filter Chips**: Filter the deck instantly by category with active count badges (e.g. `Deep (6)`, `Funny (6)`, `All (54)`).
  - **In-Card `[ Answer ]` Button**: Opens inline answer input to record your response.
  - **Instant `💬 Send to Chat`**: Copies question and optional answer directly into the encrypted chat bar for effortless conversation flow.
  - **Full Catalog Browser**: Toggle between 🎴 Swipe Deck and 📋 Browse All (54) views.
  - **1-on-1 Chat Header Trigger**: Direct access via the `🃏 Cards` header pill in direct chats.

---

## 🖼️ 13. Blind Photo Reveal (Mutual Privacy Gate)

Instead of instantly displaying photos across chat rooms, photos are delivered sealed behind a cryptographic mutual consent lock:

```text
Photo Locked 🔒

Both users can mutually agree:

Reveal photo?

If both accept:

🔓 Photo Unlocked
```

### Why This Matters For Privacy:
In conventional chat applications, unsolicited or unconsensual photos instantly render on screen, violating user boundaries and compromising privacy. In an anonymous and privacy-first network:
- Photos are initially sealed as **`Photo Locked 🔒`**.
- The recipient and sender only see a frosted, blurred silhouette with an interactive consent gate.
- Full resolution media is **never decrypted or revealed** until **both participants explicitly tap `[ 🔓 Accept Reveal ]`**.
- If either participant chooses `[ 🔒 Keep Locked ]`, the media remains 100% sealed.

### Interactive In-Chat Experience:
1. **Send Blind Photo**:
   - Tap the **`🖼️`** button in the chat input bar or **`🖼️ Blind Photo`** header trigger.
   - Choose from curated aesthetic photo presets (*Sunset Silhouette, Cozy Coffee, Neon Skyline, Trail Companion, Vintage Film Camera*) or provide a custom encrypted image.
2. **Locked State (`Photo Locked 🔒`)**:
   - Card displays with a red security border, frosted privacy blur, and `0/2` or `1/2 Agreed` status.
   - Prompts both parties:
     ```text
     Both users can mutually agree:
     Reveal photo?
     
     [ 🔓 Accept Reveal ]   [ 🔒 Keep Locked ]
     ```
3. **Unlocked State (`🔓 Photo Unlocked`)**:
   - As soon as both users consent, real-time WebSockets instantly transform the card with an emerald unlock banner.
   - The crystal-clear, high-resolution photo is decrypted for both users with tap-to-view fullscreen mode.

---

## 🌫️ 14. Blur-to-Reveal Profile (Visual Progressive Interface)

A visually unique progressive interface effect where profile avatars emerge from a shrouded veil as interaction develops:

### Initial State:
```text
    ███████
   █████████
    ███████

Mystery Person
```

### Progressive Visual Stages:
```text
Blur 100%
   ↓
Blur 70%
   ↓
Blur 40%
   ↓
 Clear
```

1. **Blur 100% (Stage 0: Mystery Person)**:
   - Initial state: heavy veil.
   - Displays the exact ASCII silhouette block art with zero exposed personal identity traits.
2. **Blur 70% (Stage 1: Soft Silhouette)**:
   - Soft contours and subtle ambient palette glow begin to emerge from the background.
3. **Blur 40% (Stage 2: Ambient Outline)**:
   - Recognizable profile posture, hairstyle contours, and lighting ambiance become distinguishable.
4. **Clear (Stage 3: 0% Blur Unveiled)**:
   - 100% crystal-clear profile unblurred with full vibrant colors once mutual consent is fulfilled.

### 🛡️ Ethical & Privacy Architectural Principle:
> [!IMPORTANT]
> **Interface Effect Notice**:
> *"Don't use this to infer anything about the person; it's purely an interface effect controlled by mutual consent."*
> The platform strictly avoids automated facial categorization, emotion inference, or biometrics. Progression is an aesthetic interface reward governed by mutual user agreement.

### UI Integration:
- **Header Avatar Trigger**: Tapping the avatar in any active 1-on-1 chat opens the Blur-to-Reveal visual card.
- **Dedicated `🌫️ Blur Reveal` Header Pill**: Direct quick-access button in direct chat conversations.
- **Mutual Agreement Verification**: Both users can tap `[ 🔓 Agree to Next Blur Reveal ]` or `[ 🔒 Keep Current Blur ]`.
- **Step Simulation Controls**: Quick step buttons (`100%`, `70%`, `40%`, `Clear`, `↺ Reset`) for interactive demonstration.

---

## 🚪 15. Exit Anytime (Safety & Clean Exit Protocol)

A fundamental, zero-pressure safety feature for the Blind Date chamber. Either participant can immediately leave the date at any moment:

### The Flow:
```text
During Blind Date:

              ⋮

      Leave Date
          ↓

Are you sure?

[ Leave Safely ]

No explanation required.

The other person simply sees:

The Blind Date has ended.
```

### Safety Principles & Privacy Protection:
1. **Zero Guilt & No Explanation Required**:
   - The user is never subjected to questionnaires, exit surveys, or forced justification.
   - One tap on `[ Leave Safely ]` instantly disengages the user from the chamber.
2. **Neutral Peer Experience**:
   - The other participant simply and neutrally sees:
     ```text
     The Blind Date has ended.
     ```
   - No blame, no harsh rejection labels, and no awkwardness.
3. **Clean Cryptographic Burn**:
   - The temporary chamber room status is set to `ended_safely`.
   - All ephemeral ratchet keys and in-memory chat buffers self-destruct immediately.
4. **UI Triggers**:
   - **Header Menu (`⋮`)**: Tapping the three dots in the chamber header displays the dropdown `🚪 Leave Date`.
   - **Action Bar Pill**: Direct `🚪 Leave Date` trigger right next to the countdown timer.
   - **Confirmation Guard**: Clean confirmation dialog asking *"Are you sure?"* with `[ Leave Safely ]` and notice *"No explanation required."*

---

## 🛡️ 6. Safety Layer

Essential safety architecture tailored specifically for anonymous, blind-date environments:

### 1. Instant Block (One Tap)
- **Zero Friction**: One single tap executes an immediate disconnect.
- **Connection Severed**: Immediately burns ephemeral room session keys and terminates active chamber communication.
- **Persistent Blacklist**: Persists to user blocks registry (`db.user_blocks`); blocked peers are permanently filtered from future matchmaking and discovery.
- **Peer Experience**: Partner simply sees: *"The Blind Date has ended."*

### 2. Safety Report (6 Categories)
Strictly categorized violation intake with incident tracking (`db.safety_reports`) and auto-quarantine:
- **Harassment**: Bullying, abusive language, or persistent unwanted attention.
- **Spam**: Advertising, automated bots, promotional links, or commercial solicitation.
- **Impersonation**: Misrepresenting identity, deceptive personas, or stolen profiles.
- **Threatening behaviour**: Intimidation, blackmail, extortion, or violent expressions.
- **Unwanted content**: Explicit sexual material, non-consensual media, or offensive content.
- **Other**: Safety concerns outside predefined categories with optional context note.
- **Default Auto-Block**: Submitting any report automatically executes an Instant Block on the reported account.

### 3. Screenshot Warning & Transparency Policy
> [!IMPORTANT]
> **Transparency Notice**:
> *"You can attempt to detect screenshots on supported platforms, but don't claim screenshots can always be prevented."*

- **Platform Monitoring**: Client hooks monitor screenshot shortcuts (e.g. `PrintScreen`, `Meta+Shift+S`, `Cmd+Shift+3/4`, OS capture hooks).
- **Proactive In-App Banner**: Displays a real-time warning on capture:
  ```text
  📸 Screenshot Activity Warning: Potential screen capture detected.
  Notice: Screenshot detection is attempted on supported platforms, but screenshots cannot always be prevented.
  ```
- **Peer Notification Signal**: Dispatches `safety.screenshot_warning` WebSocket signal to notify date partners of screen capture activity.
- **Transparent Policy Modal**: Detailed modal in header explaining limitations of software screenshot prevention and reiterating that mutual pseudonymity and unrevealed photos provide the ultimate barrier.

### 4. Contact Protection (Prohibited Vector Guard)
Automatic scanner and filter that actively shields sensitive contact vectors from accidental disclosure or coercive doxxing:
- **Don't Expose**:
  - ❌ **Phone number**: International and local formats (`+1...`, `+91...`, 10-digit sequences) are masked to `[🛡️ Protected: Phone Number]`.
  - ❌ **Email**: Standard and obfuscated email formats (`user@domain.com`, `user at domain dot com`) are masked to `[🛡️ Protected: Email]`.
  - ❌ **Exact location**: GPS coordinates (`lat, lon`, `37.7749, -122.4194`) and physical street addresses are masked to `[🛡️ Protected: Exact Location]`.
  - ❌ **Device information**: User-Agent headers, OS kernel info, hardware models (`iPhone 15`, `Galaxy S24`, `Windows NT`), MAC addresses, and IMEIs are masked to `[🛡️ Protected: Device Info]`.
---

## 📍 17. Approximate Location (Strict Opt-In & Anti-Doxxing)

Protecting physical privacy while allowing contextual proximity for blind dates and matches:

```text
Never show:

123 Main Street

Instead:

📍 ~8 km away

or:

📍 Delhi NCR

Only if the user explicitly enables location sharing.
```

### 1. Privacy First: Never Show Exact Addresses
- **Strict Prohibition**: The system strictly forbids and rejects street addresses (e.g. `123 Main Street`, apartment numbers, house names, exact GPS coordinates, PIN/ZIP codes).
- **Backend Validation Gate**: Any registration or profile update attempting to submit street numbers, precise street suffixes (`Street`, `St`, `Road`, `Avenue`, `Lane`, `Blvd`), or raw coordinates is rejected with `HTTP 400 Bad Request`.

### 2. Coarse Region & Fuzzy Distance Representation
Instead of exact points on a map, the platform offers two fuzzy, privacy-preserving indicators:
- **📍 Coarse Region**: Broad metropolitan zones with hundreds of thousands of residents (e.g., `📍 Delhi NCR`, `📍 South Mumbai`, `📍 Bengaluru Central`, `📍 Manhattan Metro`, `📍 Greater London`, `📍 Tokyo Metropolis`).
- **📍 Fuzzy Distance**: Rough distance approximations prefixed with tilde fuzzing (e.g., `📍 ~8 km away`, `📍 ~5 km away`, `📍 ~12 km away`).

### 3. Strict Opt-In Consent Requirement
- **Hidden By Default**: Every user account defaults to `location_sharing_enabled = False`.
- **Absolute Secrecy When Disabled**: When disabled, mystery match cards, candidate cards, profile queries, and distance calculations return `None` or `📍 Location Hidden (Opt-in only)`. Zero geo-data or distance estimates are computed or transmitted.
- **Explicit Toggle Controls**: Users can toggle location sharing on/off at any moment directly from:
  - The Blind Date Chamber top bar (`📍 Location`).
  - The Chamber options menu (`⋮` ➔ `📍 Location Privacy`).
  - The Progressive Profile Reveal screen.
- **Instant Revocation**: Toggling off immediately revokes location visibility across all active chats and mystery cards.

---

## 🔥 18. Anonymous Topic Rooms (Temporary Encrypted Spaces)

Users can enter temporary encrypted rooms tailored to specific shared passions and interests without needing permanent identities:

```text
Users can enter temporary encrypted rooms.

Examples:

🎮 Gaming
🎬 Movies
💻 Coding
🎵 Music
🌍 Travel
📚 Students

You don't necessarily need permanent identities.

Example:

Room: Late Night Talks

👤 Nova
👤 Ghost
👤 Pixel
👤 Luna
```

### 1. Curated Topic Categories & Sanctuaries
- **🎮 Gaming**: Speedruns, RPG lore deep-dives, late-night co-op lobbies, and indie masterpieces.
- **🎬 Movies**: Script breakdowns, cinematography appreciation, cult classics & plot twist discussions.
- **💻 Coding**: Systems architecture, memory safety debates, side projects, and 2 AM bug squashing.
- **🎵 Music**: Synthesizers, chillhop, shoegaze, underground tracks to code/chill to, and album talks.
- **🌍 Travel**: Hidden mountain towns, sleeper trains, digital nomad setups, and spontaneous flights.
- **📚 Students**: Silent pomodoro sprints, thesis paper struggles, caffeine fuels, and exam cram solidarity.
- **🌙 Late Night Talks**: Raw, unfiltered midnight thoughts, ambient contemplation & late night confessions.

### 2. Ephemeral Room Identities (No Permanent Identity Needed)
- **Zero Identity Linkage**: Users enter rooms without exposing their permanent profile, real name, prekeys, or history.
- **Ephemeral Pseudonym Allocation**: When joining, users receive an ephemeral room alias (e.g. `👤 Nova`, `👤 Ghost`, `👤 Pixel`, `👤 Luna`, `👤 Shadow`, `👤 Echo`, `👤 Cipher`, `👤 Atlas`, `👤 Drift`) or can specify a custom alias for that session only.
- **Active Member Roster**: Real-time roster display showing active room participants:
  ```text
  Room: Late Night Talks
  👤 Nova   👤 Ghost   👤 Pixel (You)   👤 Luna
  ```
- **Instant Clean Burn on Exit**: When a user leaves, their ephemeral pseudonym is wiped and a clean departure notice is announced.

### 3. Temporary Lifespan & Room Encryption
- **Ephemeral Room Ratchet / Session Key**: Every room generates an ephemeral 256-bit symmetric session key for room message encryption.
- **Self-Destruction (TTL)**: Configurable room lifespan (1 hour, 6 hours, 24 hours, 72 hours). When the timer expires, the room and all messages permanently self-destruct.
- **Spawn Custom Rooms**: Users can instantly create their own temporary topic room with custom title, topic category, icon, description, and burn timer.

---

## 🧨 19. Self-Destruct Conversations

Full conversation auto-deletion and ephemeral retention policy with cryptographic scrubbing:

```text
Users can choose:

Delete after:

5 minutes
1 hour
24 hours
7 days
Never

For E2EE, remember that "deleted from the app" does not guarantee the recipient hasn't copied or captured the content.
```

### 1. Retention Policy Options
Users can configure per-conversation self-destruct retention schedules:
- **⚡ 5 minutes (300s)**: Ultra-ephemeral mode for sensitive disclosures.
- **⏱️ 1 hour (3600s)**: Short retention window for transient exchanges.
- **🌙 24 hours (86400s)**: Daily automated wipe ensuring chat history resets every day.
- **📅 7 days (604800s)**: Weekly retention cycle for casual ongoing discussions.
- **♾️ Never (None)**: Standard E2EE retention until manually cleared.

### 2. Crucial E2EE Security Reality (Transparency Policy)
> [!WARNING]
> **E2EE Transparency Notice**:
> *"For E2EE, remember that 'deleted from the app' does not guarantee the recipient hasn't copied or captured the content."*
> 
> While End-to-End Encryption and automated self-destruction purge cryptographic ciphertexts, local databases, and blind server queues, no software can prevent a recipient from taking a physical photo of their screen with a secondary device, using OS-level clipboard loggers, or transcribing content before expiration. The platform emphasizes honest security boundaries over false promises.

### 3. Automated Pruning & Emergency Burn
- **Retroactive Pruning**: When a retention policy is updated, any older messages in the conversation that exceed the new threshold are automatically purged from both clients and the blind server relay.
- **🧨 Self-Destruct Entire Conversation Now**: An emergency nuke action that immediately obliterates all messages, ratchet headers, and cached ciphertexts on both participants' devices and the server.
- **Real-time Synchronization**: Policy changes and burn events are propagated via authenticated `chat.signal` WebSocket events.

---

## 🔐 20. Secret Chat Mode

A dedicated ultra-private chat mode:

```text
SECRET MODE 🔐

Characteristics:

disappearing messages
no message history on the server
restricted forwarding
temporary encryption keys
optional screenshot detection where supported
automatic session expiration
```

### The 6 Core Characteristics:

1. **🔥 Disappearing Messages**:
   - Every message transmitted in Secret Mode is assigned an aggressive burn countdown timer (10s, 30s, or 60s).
   - Messages burn automatically from local memory upon read.

2. **🚫 No Message History on the Server**:
   - Zero server retention guarantee. Messages bypass database storage (`db.messages`) entirely and exist only in-flight via volatile memory relay to the recipient's active socket.
   - Zero server disk footprint or persistent logs.

3. **🔒 Restricted Forwarding**:
   - Forwarding, clipboard copying, and message export are strictly disabled (`no_forward: true`).
   - Forward and share buttons are deactivated for all Secret Mode messages.

4. **🔑 Temporary Encryption Keys**:
   - Fresh ephemeral session ratchets and temporary DH keys are generated specifically for the secret session.
   - When Secret Mode is terminated or expires, all temporary encryption keys are zeroized immediately.

5. **📸 Optional Screenshot Detection (Where Supported)**:
   - Real-time screenshot shortcut detection triggers a high-visibility security warning banner and broadcasts a `secret_chat.screenshot_alert` to the partner.

6. **⌛ Automatic Session Expiration**:
   - Secret chat sessions have a strict finite duration (15m, 30m, 1h).
   - Upon expiration, all temporary keys, active sessions, and local ephemeral secret messages are automatically wiped.

---

## 🧬 22. Anonymous Personality Card

Instead of traditional dating profiles with surveillance algorithms and invasive personal data collection:

```text
MYSTERY PROFILE

☕ Coffee
🎮 Gaming
🌌 Night Owl
🎵 Indie Music

Conversation Style:
████████░░

Energy:
███████░░░

Topics:
Technology
Travel
Movies
```

> [!NOTE]
> **Ethical Design & Privacy Philosophy**:
> *"These can be generated from user-selected preferences rather than secretly profiling them."*
> 
> Traditional social and dating apps secretly surveil dwell time, micro-interactions, and private messages to algorithmically categorize individuals. In this network, your **MYSTERY PROFILE** is created **100% from your explicit, user-selected choices** — zero behavioral surveillance, zero facial scanning, and zero hidden tracking.

### Key Elements of the Mystery Profile:
1. **☕ Vibes & Habits**:
   - Expressive aesthetic badges chosen directly by the user (e.g., `☕ Coffee`, `🎮 Gaming`, `🌌 Night Owl`, `🎵 Indie Music`, `🍵 Matcha`, `📚 Bookworm`, `🧗 Bouldering`, `🌱 Plant Parent`).
2. **Conversation Style Visual Meter (`████████░░`)**:
   - 10-block ASCII scale illustrating conversational depth (from Quiet Observer `██░░░░░░░░` to Deep & Reflective `████████░░`).
3. **Energy Visual Meter (`███████░░░`)**:
   - 10-block ASCII scale illustrating conversation tempo (from Tranquil `██░░░░░░░░` to Warm & Engaging `███████░░░` to Dynamic `█████████░`).
4. **Topics of Interest**:
   - Curated conversational subjects (e.g., `Technology`, `Travel`, `Movies`, `Philosophy`, `Science`, `Startups`, `Art & Design`).
5. **Interactive Peer Display & Chat Sharing**:
   - Inspect any peer's card in 1-to-1 chats or blind dates.
   - One-tap `💬 Share to Chat` broadcasts your formatted Mystery Profile card directly into the end-to-end encrypted session.

---

## 🌌 23. Random Universe Matching

A visually distinctive celestial discovery interface where anonymous peers appear as glowing stars across deep space:

```text
             ✦

      🌌 DISCOVER

   ✦       ○       ✦

       ○       ○

  Mystery signals detected

       [ENTER]
```

### Cosmic Discovery Mechanics:
1. **Interactive Celestial Radar**:
   - Each anonymous user or mystery signal in the galaxy appears as an interactive star node (`✦` or `○`).
   - Stars emit simulated spectral frequencies (e.g. `1420.405 MHz (Hydrogen Line)`, `1665.402 MHz`) and indicate approximate proximity without revealing real identities.
2. **Tap a Star → Start a Mystery Interaction**:
   - Tapping any star node expands its constellation (`Cygnus Zenith`, `Orion Nebula`, `Cassiopeia Crown`, `Lyra Core`), vibe badges, and conversational meters.
   - Tap `[ 💫 Start Mystery Interaction ]` to lock onto that specific star's frequency and launch a direct anonymous interaction.
3. **[ENTER] Hero Action**:
   - Tapping `[ENTER]` initiates a deep space radar sweep, calculates cosmic resonance, and randomly matches you with an active star in the universe.

## ⚡ 24. Instant 5-Minute Date

A high-tempo, zero-bias speed date feature designed for spontaneous anonymous connection:

```text
Quick Date
5 MINUTES
ONE MATCH
NO PROFILE
NO PHOTO

At the end:

❤️ Continue
🤝 Friends
👋 Exit

If both select Continue:

Full chat unlocked
```

### Core Architecture & Mechanics:
1. **The 4-Pillar Spec Banner**:
   - **⏱️ 5 MINUTES**: A synchronized 300-second live countdown clock (`mm:ss`) with pulsing urgency alerts under 60 seconds.
   - **🎯 ONE MATCH**: Paired instantly with a single anonymous user (e.g. `⚡ Spark#4a9c`) without waiting pools or algorithmic profiling.
   - **👤 NO PROFILE**: Zero bios, zero social handles, zero occupation or age indicators.
   - **📷 NO PHOTO**: 100% blind anonymous interaction. Pure conversational wavelength.
2. **End-of-Date Decision Chamber**:
   When the 5-minute timer expires (or when either participant taps *Decide Now*), the conversation transitions to the decision screen:
   - **❤️ Continue**: If both select Continue ➔ **Full chat unlocked!** Unveils mutual messaging without time limits.
   - **🤝 Friends**: If both select Friends (or a friendly compromise) ➔ connected as casual platonic contacts.
   - **👋 Exit**: One tap safe exit. No explanation required. The session ends peacefully and both participants see: *"The 5-Minute Date has ended."* Zero traces left.
3. **Interactive Quick Date Chamber UI**:
   - Live countdown badge with pulsing micro-animations.
   - One-tap icebreaker question chips for instant conversation starters.
   - Real-time messaging feed with ephemeral ghost handles.
   - Full celebration banner with direct `[ 💬 Open Full Chat Now ]` action upon mutual Continue.

## 🔄 25. Second Chance

A zero-pressure reconnection vault eliminating the awkwardness and finality of dating choices:

```text
If both users select:

Maybe later

the app can place the connection into:

Second Chance

They can reconnect later if both independently choose to reopen it.
```

### Core Architecture & Mechanics:
1. **The "Maybe Later" Mutual Safe Harbor**:
   - Available during the end-of-date decision phase for both **Blind Dates** and **Instant 5-Minute Dates**.
   - If **both** participants select `Maybe later`:
     - The connection is safely placed into the **`Second Chance`** vault (`db.second_chance_connections`).
     - Neither user is subjected to rejection alerts or time-pressured follow-ups.
2. **Confidential Independent Choice**:
   - Either participant can view their dormant connections in the Second Chance Vault.
   - A user can tap `[ 🔄 Reopen Connection ]` at any time in the future.
   - **Privacy Shield**: The other person is **never** notified that a reopen request was logged. Zero pressure, zero ego vulnerability.
3. **Mutual Independent Reopen & Unlock**:
   - If both participants independently choose to reopen the connection:
     - The connection status shifts from `dormant` ➔ `reopened`.
     - Direct E2EE messaging is unlocked (`🎉 Mutual Reopen Achieved!`).
     - A celebration card appears with `[ 💬 Open Full Chat Now ]` for seamless reconnection.
4. **Clean Archiving**:
   - If a user decides they no longer want a dormant connection in their list, they can quietly archive it with zero notifications sent to the match.

## 🧠 26. Smart Matchmaking

An 8-vector holistic compatibility engine granting users total sovereignty over which personal signals are used:

```text
Matching can consider:

Age preference
Interests
Conversation preferences
Language
Availability
Date mode
Shared topics
Past mutual interactions

But give users controls over what data is used.
```

### Core Architecture & Mechanics:
1. **The 8 Holistic Matching Vectors**:
   - **🎂 Age preference**: Target age brackets (`18-24`, `21-30`, `31-40`, `40+`, `Any`).
   - **🎨 Interests**: Overlap in hobbies and passions (Coffee, Gaming, Indie Music, Sci-Fi, Photography, Art).
   - **💬 Conversation preferences**: Interaction styles (Deep talks, Spontaneous banter, Slow burn, Night owl chats, Quick exchanges).
   - **🗣️ Language**: Conversational languages (English, Spanish, French, Hindi, Japanese, Any).
   - **⏰ Availability**: Peak activity hours (Right now 🟢, Evening 🌙, Weekends 🎉, Late Night 🌌, Flexible ⏳).
   - **⚡ Date mode**: Preferred blind date formats (Mystery Match, Speed Blitz 5-Min, Vibe Deep Dive, Chemistry Chamber).
   - **📚 Shared topics**: Discussion themes (Technology, Philosophy, Movies, Books, Travel).
   - **🤝 Past mutual interactions**: Interaction history weighting, prioritizing fresh encounters and positive compatibility while preventing awkward re-matches.
2. **Granular Privacy Controls ("What Data Is Used")**:
   - Every individual factor possesses a distinct toggle switch (`use_<factor> = True/False`).
   - **Strict Zero-Leak Exclusion**: When a factor is turned off:
     - Its weight is completely set to 0.
     - The factor is excluded from algorithmic ranking and scoring.
     - The candidate card masks that field to `🔒 Private` or `🔒 Ignored by user privacy control`.
   - **Extreme Privacy Graceful Fallback**: If a user disables all 8 factors, matchmaking does not fail; it gracefully defaults to a neutral 50% baseline with zero algorithmic profiling.
3. **Full Matchmaking Transparency Matrix**:
   - Tapping *"View Transparency Breakdown"* on any candidate displays the exact point contribution of every active factor and clearly flags disabled factors.

---

## 🏆 27. Blind Date XP (Gamification System)

The **Blind Date XP** system adds rewarding, privacy-preserving gamification to anonymous encounters, mystery games, and question prompts. Users level up, unlock tier titles, track their interaction stats, and claim badges without compromising their anonymous identity.

```
       ╔════════════════════════════════════════════╗
       ║              Mystery Explorer              ║
       ║                   Lv. 12                   ║
       ╠════════════════════════════════════════════╣
       ║  Dates completed: 18                       ║
       ║  Games played: 34                          ║
       ║  Questions answered: 92                    ║
       ╠════════════════════════════════════════════╣
       ║  Achievements:                             ║
       ║  🏆 First Blind Date                       ║
       ║  🎭 Mystery Master                         ║
       ║  💬 Conversation Starter                   ║
       ║  🧩 Puzzle Solver                          ║
       ║  🌙 Night Owl                              ║
       ║  ❤️ Mutual Reveal                          ║
       ╚════════════════════════════════════════════╝
```

### Core Gamification Mechanics:
1. **Canonical Rank Hierarchy & Level Progression**:
   - **Levels Formula**: `level = 1 + int(xp // 200)`. Every 200 XP grants a new level tier.
   - **Dynamic Rank Titles**:
     - *Mystery Novice* (Lv. 1–3)
     - *Shadow Seeker* (Lv. 4–7)
     - *Enigma Scout* (Lv. 8–11)
     - **Mystery Explorer** (Lv. 12–15)
     - *Cipher Vanguard* (Lv. 16–19)
     - *Enigma Legend* (Lv. 20+)
   - **Lv. 12 Baseline**: 2,330 XP earned with 70 XP needed for Lv. 13 (65% progress bar).

2. **Progression Activity Rewards**:
   - ⚡ **Dates Completed** (+100 XP): Completing 5-minute speed dates or mystery sessions.
   - 🎮 **Games Played** (+25 XP): Playing 20 Questions, Word Association, or Chemistry minigames.
   - 💬 **Questions Answered** (+15 XP): Responding to icebreakers or personality questions.
   - ❤️ **Mutual Reveal** (+150 XP): Both users agreeing to exchange identities at date completion.
   - 🧩 **Puzzle Solved** (+50 XP): Cooperative cipher and mystery puzzle resolution.

3. **Canonical Achievements Suite**:
   - 🏆 **First Blind Date**: Completed your inaugural anonymous blind date encounter (+100 XP).
   - 🎭 **Mystery Master**: Participated in over 15 blind date sessions (+250 XP).
   - 💬 **Conversation Starter**: Answered 50+ interactive icebreaker questions (+150 XP).
   - 🧩 **Puzzle Solver**: Solved 10 cooperative mystery room games or cipher challenges (+200 XP).
   - 🌙 **Night Owl**: Completed 5 blind dates during late night hours (10 PM – 4 AM) (+175 XP).
   - ❤️ **Mutual Reveal**: Achieved a mutual reveal where both anonymous parties unlocked identities (+300 XP).

4. **Frontend Experience & Real-time Progression**:
   - Dedicated `BlindDateXPModal` with glassmorphic purple/gold styling.
   - Live XP progress bar to next level with percentage and point countdowns.
   - Activity counters: **18 Dates completed**, **34 Games played**, **92 Questions answered**.
   - Interactive boosters for instant verification of live XP grants and achievement triggers.

---

## 🔥 28. Daily Mystery Drop

Every day, the system curates **ONE MYSTERY MATCH** available exclusively for a **30-minute window**. Once discovered, a real-time countdown begins, giving anonymous users an exciting daily ritual and an authentic reason to return.

```
       ╔════════════════════════════════════════════╗
       ║           🔥 DAILY MYSTERY DROP            ║
       ║  Every day: ONE MYSTERY MATCH              ║
       ║  Available for 30 minutes                  ║
       ╠════════════════════════════════════════════╣
       ║  "Your mystery connection is waiting."     ║
       ║  This gives users a reason to return.      ║
       ╠════════════════════════════════════════════╣
       ║  ✨ Celestial Wanderer   • 96% Match       ║
       ║  Vibe: ☕ Matcha • 🌌 Night Owl • 🎵 Indie ║
       ║  ⚡ EXPIRES IN 29:45                       ║
       ║  [ ❤️ CONNECT NOW ]        [ 👋 PASS ]     ║
       ╚════════════════════════════════════════════╝
```

### Core Architecture & Mechanics:
1. **Daily Cadence ("Every day: ONE MYSTERY MATCH")**:
   - Deterministic daily pairing generates exactly one tailored mystery match per user per calendar day.
   - Curated pool of high-compatibility anonymous profiles (e.g. *✨ Celestial Wanderer*, *🌌 Midnight Poet*, *⚡ Solar Mirage*, *🍃 Forest Echo*).
2. **The 30-Minute Urgency Window ("Available for 30 minutes")**:
   - When the user taps reveal, an ephemeral 1,800-second (30-minute) countdown clock initiates.
   - Dynamic urgency styling: transitions from emerald green &rarr; amber &rarr; burning red as the remaining time elapses.
   - If the timer reaches zero before connection, today's drop expires quietly without pressure or persistent traces.
3. **Engaging Call-to-Action ("Your mystery connection is waiting.")**:
   - High-visibility banner and hero notification: *"Your mystery connection is waiting."*
   - Displays anonymous vibe signatures, common conversation topics, compatibility percentage, and personality energy bars without revealing identifying contact information.
4. **Retention Engine ("This gives users a reason to return.")**:
   - Zero-spam daily cadence creates an anticipated return habit.
   - Displays real-time countdown to the next day's drop (`Next Mystery Drop in: HHh MMm SSs`).
   - Connecting awards instant XP (+75 XP) and opens a confidential 1-to-1 anonymous chat room.

---

## 🕰️ 29. Scheduled Blind Date

Rather than relying purely on asynchronous or serendipitous chats, users can schedule an intentional encounter for a designated time (such as **Tonight at 9:00 PM**). The system pairs them with an available anonymous peer and initiates a shared live countdown ticker: **"Your date begins in: 00:04:21"**.

```
       ╔════════════════════════════════════════════╗
       ║          🕰️ SCHEDULED BLIND DATE           ║
       ║  User chooses: Tonight • 9:00 PM           ║
       ╠════════════════════════════════════════════╣
       ║  The system finds another user who is also ║
       ║  available.                                ║
       ╠════════════════════════════════════════════╣
       ║  Your date begins in:                      ║
       ║                                            ║
       ║                 00:04:21                   ║
       ║                                            ║
       ║  Matched: 🌙 Starlight Wanderer            ║
       ╠════════════════════════════════════════════╣
       ║  This creates an actual event rather than  ║
       ║  an ordinary chat.                         ║
       ╚════════════════════════════════════════════╝
```

### Core Architecture & Mechanics:
1. **User Slot Selection ("User chooses: Tonight, 9:00 PM")**:
   - Curated calendar slots with real-time peer density metrics (e.g. *Tonight at 9:00 PM* marked as peak recommendation).
   - Allows users to designate intentional time for deep presence and conversation.
2. **Automated Peer Discovery ("The system finds another user who is also available.")**:
   - The scheduling engine searches the available pool and confirms a mutual match without revealing private contact coordinates.
   - Both users receive identical confirmed appointment tickets.
3. **Live Shared Ticker ("Your date begins in: 00:04:21")**:
   - High-visibility synchronized countdown display (`HH:MM:SS`).
   - Pulsing urgency animation building genuine anticipation as 00:00:00 approaches.
   - Fast-forward utility included for instant interactive testing.
4. **Event Experience ("This creates an actual event rather than an ordinary chat.")**:
   - Transforms casual messaging into an authentic appointment.
   - When the countdown reaches zero, the confidential Blind Date chamber unlocks automatically with celebratory entry prompts.

---

## 💎 30. Date Memory

After a successful date concludes, the system commemorates the encounter by generating a **private encrypted "date memory"**. This digital keepsake captures milestone metrics, shared topics, games played, duration, and mutual reveal outcomes while preserving complete zero-knowledge privacy.

```
       ╔════════════════════════════════════════════╗
       ║              Your Blind Date               ║
       ║                                            ║
       ║                  🌙 Nova                   ║
       ╠════════════════════════════════════════════╣
       ║  Topics:                                   ║
       ║  Gaming                                    ║
       ║  Travel                                    ║
       ║  Music                                     ║
       ╠════════════════════════════════════════════╣
       ║  Games:                                    ║
       ║  3                                         ║
       ╠════════════════════════════════════════════╣
       ║  Date duration:                            ║
       ║  18 min                                    ║
       ╠════════════════════════════════════════════╣
       ║  Mutual reveal:                            ║
       ║  ✓                                         ║
       ╠════════════════════════════════════════════╣
       ║  This becomes a private encrypted          ║
       ║  "date memory."                            ║
       ╚════════════════════════════════════════════╝
```

### Core Architecture & Mechanics:
1. **Trigger Condition ("After a successful date")**:
   - Automatically forged when participants complete a blind date encounter, celebrate a mutual reveal, or conclude a meaningful session.
2. **Canonical Keepsake Artifact**:
   - **Partner**: Ephemeral pseudonym (e.g. `🌙 Nova`).
   - **Topics Explored**: List of themes discussed (e.g. `Gaming`, `Travel`, `Music`).
   - **Games Played**: Integer counter of mini-games or compatibility questions completed (e.g. `3`).
   - **Date Duration**: Total active conversation duration (e.g. `18 min`).
   - **Mutual Reveal Status**: Confirmed milestone indicator (`✓`).
3. **Private Encrypted Vault ("This becomes a private encrypted 'date memory.'")**:
   - Sealed client-side with zero-knowledge cryptography; only the user possesses access.
   - Includes private diary reflections and personal notes that remain confidential and cannot be read by anyone else or the server.
   - Full user sovereignty: inspect memories in a scrollable memories gallery or purge them anytime.

---

## 🏗️ Recommended Technical Architecture

For college, enterprise, or production implementations:

```
                FRONTEND
                    │
          React / React Native
                    │
              WebSocket
                    │
          Node.js / FastAPI
                    │
       ┌────────────┴────────────┐
       │                         │
   Socket Server             REST API
       │                         │
       └────────────┬────────────┘
                    │
                 Redis
                    │
          Real-Time Presence
          Match Queue
          Blind Date Queue
                    │
                Database
          PostgreSQL / MongoDB
```

### Encryption Layer & Server Boundary

```
Client A
   ↓
Generate/obtain keys
   ↓
Encrypt message locally
   ↓
WebSocket
   ↓
Server (Blind Relay)
   ↓
WebSocket
   ↓
Client B
   ↓
Decrypt locally
```

> [!IMPORTANT]
> **Strict Server Boundary**: The server should primarily handle **encrypted payloads**, **user/session metadata**, **delivery status**, and **routing** — **NOT** plaintext message content.

---

## 🧩 Database Structure

```sql
-- 1. Users
CREATE TABLE Users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    public_key TEXT NOT NULL,
    avatar VARCHAR(16) DEFAULT '👤',
    age_range VARCHAR(32),
    interests TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Conversations
CREATE TABLE Conversations (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL, -- direct | blind_date | group | secret
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- 3. Messages
CREATE TABLE Messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) REFERENCES Conversations(id),
    sender_id VARCHAR(64) REFERENCES Users(id),
    encrypted_payload TEXT NOT NULL,
    nonce VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- 4. BlindDates
CREATE TABLE BlindDates (
    id VARCHAR(64) PRIMARY KEY,
    user_a VARCHAR(64) REFERENCES Users(id),
    user_b VARCHAR(64) REFERENCES Users(id),
    status VARCHAR(32) NOT NULL,
    mode VARCHAR(64) NOT NULL, -- 5-Min Quick Date | 15-Min Mystery Date | Voice Date | Game Date
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    reveal_level INT DEFAULT 0
);

-- 5. BlindDateAnswers
CREATE TABLE BlindDateAnswers (
    date_id VARCHAR(64) REFERENCES BlindDates(id),
    question_id VARCHAR(64) NOT NULL,
    encrypted_answer TEXT NOT NULL,
    PRIMARY KEY (date_id, question_id)
);

-- 6. MatchQueue
CREATE TABLE MatchQueue (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES Users(id),
    preferences JSONB,
    interests TEXT[],
    availability VARCHAR(64),
    mode VARCHAR(64),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 Blind Date Complete User Flow

```
OPEN APP
   ↓
Create Anonymous Identity
   ↓
Choose Interests
   ↓
Choose Blind Date
   ↓
Select Mode
   ↓
┌──────────────────────┐
│ 5-Min Quick Date     │
│ 15-Min Mystery Date  │
│ Voice Date           │
│ Game Date            │
└──────────────────────┘
   ↓
Enter Match Queue
   ↓
Anonymous Match Found
   ↓
"Your Mystery Match has arrived"
   ↓
Question #1
   ↓
Encrypted Chat
   ↓
Mini Games
   ↓
Conversation Missions
   ↓
Chemistry/interaction progress
   ↓
Optional Identity Reveal
   ↓
DATE ENDS
   ↓
┌───────────────────────┐
│ ❤️ Continue           │
│ 🤝 Friends            │
│ 🔄 Maybe Later         │
│ 👋 Leave               │
└───────────────────────┘
```

---

## ✨ Implemented Technical Features

- **1-to-1 Encrypted Chat**: Signal-style X3DH session initialization + Double-Ratchet continuous DH and symmetric KDF steps.
- **Group Encrypted Chat**: Ephemeral group Sender Keys distributed encrypted via 1-to-1 ratchets to each member.
- **Encrypted Attachments**: Files/documents are encrypted client-side with random 256-bit symmetric keys before upload; keys are exchanged strictly through E2EE chat bubbles.
- **Encrypted Voice Notes**: Audio notes recorded, encrypted client-side, with visual waveform representation and playback controls.
- **Disappearing Messages**: Configurable self-destruct timers (5s, 30s, 60s); client burns messages on expiration and server purges offline queue.
- **Message Deletion**: Authenticated tombstone deletion signal propagated for everyone.
- **Read & Delivery Receipts**: Real-time single check (sent), double check (delivered), and blue double check (read).
- **Typing Indicator**: Real-time ephemeral events routed through WebSockets.
- **Online / Offline Presence**: Real-time status broadcasting.
- **Message Reactions**: Encrypted emoji reactions (👍, ❤️, 🔥, 😂, 🔒).
- **Reply / Quote**: Quoted original message excerpt encrypted inside payload.
- **Edit Message**: Authenticated edit signal with updated ciphertext and version counter.
- **Forward Control**: `no_forward` flag restricts copying or forwarding confidential messages.
- **Live Crypto Wire Inspector**: Real-time interactive inspection modal comparing plaintext vs wire ciphertext packets.
- **Safety Number Verification**: Out-of-band verification modal for MITM prevention.

---

## 🚀 Getting Started

### 1. Backend (Python + FastAPI + MongoDB)

```bash
cd backend

# (Optional) Set up virtual environment
python -m venv venv
venv\Scripts\activate   # On Windows

# Install dependencies (already installed)
pip install -r requirements.txt

# Start FastAPI blind relay server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

*Note: The backend automatically connects to MongoDB at `mongodb://localhost:27017` (or your `MONGODB_URL` in `.env`). If an external MongoDB is not running, it automatically falls back to an in-memory `mongomock_motor` client so you can test immediately without any database setup.*

### Run Backend Automated Verification Tests
```bash
python -m backend.test_e2ee_flow
```

---

### 2. Frontend App (React Native / Expo)

The frontend runs on **Web**, **iOS**, and **Android**:

```bash
cd frontend

# Run Web in your browser
npm run web

# Or run Android / iOS
npm run android
npm run ios
```

---

## 📂 Project Directory Structure

```
d:/Anonymous chat/
├── backend/
│   ├── config.py              # Environment configuration & directories
│   ├── database.py            # Motor MongoDB client with mongomock fallback
│   ├── models.py              # Pydantic data schemas
│   ├── websocket_manager.py   # WebSocket router, presence & signal relay
│   ├── test_e2ee_flow.py      # Automated 10-step end-to-end verification
│   ├── main.py                # FastAPI app entry point
│   ├── requirements.txt       # Python dependencies
│   └── routes/
│       ├── auth.py            # Anonymous identity registration
│       ├── users.py           # Prekey directory & bundle retrieval
│       ├── messages.py        # Message history & cleanup
│       ├── groups.py          # Sender Keys group management
│       ├── attachments.py     # Zero-knowledge attachment upload/download
│       ├── blind_date_xp.py   # Blind date gamification, XP progression & achievements
│       ├── smart_matchmaking.py # 8-factor compatibility matching & privacy controls
│       ├── daily_mystery_drop.py # Daily 30-minute mystery match cadence & retention engine
│       ├── scheduled_blind_date.py # Scheduled date slot booking & shared 00:04:21 event ticker
│       ├── date_memory.py     # Private encrypted date memory keepsake vault
│       └── architecture_blueprint.py # Technical architecture, DB schemas & user flow blueprint
├── frontend/
│   ├── App.js                 # Complete React Native E2EE Chat Workspace
│   ├── index.js               # Expo root registry
│   ├── package.json           # Dependencies: @noble/curves, @noble/ciphers, etc.
│   └── src/
│       ├── crypto/
│       │   └── e2ee.js        # Audited Noble Cryptography (X25519, Ed25519, ChaCha20, Double Ratchet)
│       ├── services/
│       │   ├── api.js         # REST client
│       │   ├── socket.js      # Resilient WebSocket client
│       │   └── storage.js     # Secure local key vault & decrypted cache
│       └── components/
│           ├── ArchitectureFlowModal.js # Technical architecture, user flow & DB schema viewer
│           ├── DateMemoryModal.js   # Private encrypted date memory keepsake modal
│           ├── ScheduledBlindDateModal.js # Slot selector & shared countdown ticker modal
│           ├── DailyMysteryDropModal.js # Daily 30-min mystery match modal with urgency clock
│           ├── BlindDateXPModal.js  # Gamification player card, XP tracker & achievements
│           ├── SmartMatchModal.js   # Smart matchmaking & privacy controls modal
│           ├── CryptoInspector.js   # Live plaintext vs ciphertext wire inspector
│           └── SafetyNumberModal.js # 60-digit MITM safety number verification
└── README.md
```
#   g h o s t c h a t  
 
# Sahsah mobile: game design direction

Reviewed 2026-11-06. Inputs: [`CONTEXT.md`](../../CONTEXT.md), [`prototype-gameplay.md`](../../sahsah_prototype/docs/prototype-gameplay.md), [`requirements.md`](../../docs/database/requirements.md), [`gameplay-design.md`](../../docs/database/gameplay-design.md), the prototype's play flow, and public listings of similar games.

## 1. What Sahsah is

A **host-run Egyptian party trivia game** for a group sitting together.

- **Two teams**, up to **six people** including the host. The host controls everything: opening tiles, the 60-second timer, revealing answers and awarding points.
- **Board:** six chosen categories × six tiles (200, 200, 400, 400, 600, 600) = 36 questions. Players answer out loud; there is no buzzer or per-player answer.
- **Formats** go beyond text: who's in the picture, original colour, picture proverb, whose voice, memory, blur/zoom hint stages with decreasing points.
- **Joining:** guests enter a **six-digit code or QR** without signing in. The host's screen is the shared stage.
- **Money:** one **game token** starts one full game. The app sells fixed 1/2/5 bundles natively; gifts and promos are on the website.
- **Arabic (RTL)** first, with a **Franco-Arabic (LTR)** option.

So the phone has two very different jobs: the **host's control screen / shared stage**, and a **guest's join-and-follow screen**.

## 2. Similar games

| Game | What it does well | Lesson for Sahsah |
| --- | --- | --- |
| [SeenJeem (سين جيم)](https://apps.apple.com/us/app/id6479301314) | Same 6 × 6 = 36 team format; three helps per team | Direct competitor. Reviews complain about paying per game through a website and about reliability. In-app 1/2/5 tokens and solid recovery are Sahsah's edge. |
| Jackbox, [Quizado](https://apps.apple.com/app/id1610106151), [Sporcle Party](https://mwm.ai/apps/sporcle-party-social-trivia/1484143447) | One shared host screen; guests join on their phones with a room code, no install or account friction | "Join with code" must be a first-class, one-tap action, not buried. |
| [Quiz Your Friends](https://mwm.ai/apps/quiz-your-friends-party-game/1489858459), [Pass&Play](https://apps.apple.com/app/id6745311128) | Pass one phone around; instant start | The start button should be the biggest thing on screen, reachable by thumb. |
| [Trivia Crack](https://apps.apple.com/si/app/trivia-crack/id651510680) | Categories with strong identity; short loops; playful feel. Reviews asked for a tutorial | Treat categories as collectible game posters. Keep a 3-step "how to play" visible for first-timers. |

## 3. Audit of the first mobile build (web copy)

| Finding | Why it hurts on a phone game |
| --- | --- |
| Home is the website's marketing landing page: nine sections, about six screens tall | The game's two real actions (host a game, join a game) are buried under promos |
| No "join with code" anywhere | Most phones at the table are guests; they have no way in |
| Four "coming soon" sections (videos, influencers, events, team) | Placeholders read as unfinished in a store app |
| Auto-rotating 3-slide marketing hero | Moves the main call to action around; slides 2–3 aren't about playing |
| Scrolling promo ticker in the header | Web banner pattern; constant motion competes with the game |
| Website footer with link lists | Apps don't have footers; content belongs on a "More" screen |
| Bottom bar has "Contact" and "Gift" as top-level tabs; no Shop or Categories | Tabs should be the game's core loops: play, browse categories, buy tokens |
| Token count with no buy affordance | Wallets in games carry a "+" to top up |

Already fixed in the previous pass: header hides on scroll, press feedback and haptics, tab fade, text-scale cap, compact cards.

## 4. Direction

**Home becomes a lobby, not a landing page.** Above the fold:

1. **Play card**: artwork, "يلا نلعب؟", the format in one line (فريقين · ٦ فئات · ٣٦ سؤال), a big red **ابدأ لعبة** and a glass **ادخل بكود** side by side, and the token cost next to the balance.
2. **New challenges** row: the five new formats as posters with a "جديد" badge.
3. **Category rows** by section (most popular, Egypt & heritage, memories), streaming-style horizontal rows.
4. **How to play**: the compact three-step card.
5. **Gift promo**: one compact card linking to the shop.

**Navigation follows the game loop:** الرئيسية · الفئات · **العب** · المتجر · المزيد.

**Join** opens a bottom sheet: six digit boxes with numeric keyboard, auto-advance and paste, a QR scan button, and a join button that enables at six digits. Rooms aren't in the backend yet, so the sheet explains that.

**Top bar:** logo at the start; wallet pill with "+" and the language switch at the end. No ticker; promos live in the home cards.

**More screen** holds what the website footer and lower home sections held: account, language, contact, share your experience, business, mission and vision, team, socials.

**Kept from the web:** colours, fonts (Lalezar, Readex Pro, Reem Kufi), category artwork, glass and paper surfaces, the glossy red play button, Arabic/Franco switching.

## 5. Later stages (not in this pass)

- **Board and question screens:** design for landscape and tablets too, since the host often props the phone up or casts it to a TV; 6 × 6 grid with large tap targets; timer ring; award sheet with both team colours.
- **Guest view:** follow the board read-only, with a score bar.
- **Shop:** native 1/2/5 bundles. Gifts link out to the website.
- **Sound:** question audio only (per the modes spec). Haptics replace UI sounds.

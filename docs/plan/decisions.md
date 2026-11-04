# Decisions (append-only)

Add new decisions at the bottom with the next number. Never edit another item's file to change a decision; record it here.

| # | Decision |
|---|---|
| D1 | Surface: Chrome extension on Claude.ai, Gemini, ChatGPT first; other surfaces later. |
| D2 | Open source on GitHub, also published to the Chrome Web Store. |
| D3 | BYOK for v1: users store their own TypeSafe and Anthropic keys locally. No backend. Hosted proxy is a later option. |
| D4 | Jev = TypeSafe judgment model. Typed questions (Score / Noul / Choice), independent and parallel, one narrow question per judgment, combined in our code. |
| D5 | "Good prompt" = has the structure best suited to its mode. Research and validation are dev-time only; nothing is trained at runtime. |
| D6 | A small downstream validation set (~30-50 prompts per mode, original vs. enhanced, run on Claude/GPT/Gemini) checks the structure definitions are right. Dev-time only. |
| D7 | Only parts scoring below a threshold are rewritten. Strong parts stay verbatim. |
| D8 | Trigger: clicking a mode option starts enhancement immediately on whatever is in the chat bar. |
| D9 | Result streams into the chat bar live; original restorable (undo). |
| D10 | Cut for v1: privacy/legal, cost/latency strategy, testing/CI as separate items. Architecture keeps a short "what data goes where" note and a latency/cost budget. Testing is folded into the eval harness. |
| D11 | Pace: fast. Ask the user only when genuinely unsure. |

---
name: Vue and chess.js reactivity
description: Avoiding recursive updates when a mutable chess.js engine is used inside Vue.
---

Store the chess.js `Chess` instance in `shallowRef`, not a deep `ref`. chess.js temporarily makes and undoes moves while generating legal moves and evaluating check/game-over state; deep Vue proxies can interpret those internal changes as UI updates and trigger recursive renders. Refresh derived UI through an explicit position revision or replace the instance.

**Why:** Starting a game caused Vue's `Maximum recursive updates exceeded` because a reactive render invoked chess.js rule checks that mutate and restore internal board state.

**How to apply:** In Vue chess interfaces using chess.js, keep the engine instance non-proxied and explicitly invalidate UI-derived state after committed moves.

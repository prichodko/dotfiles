---
title: Don't Chain Effects via State
impact: MEDIUM
impactDescription: eliminates cascading re-renders
tags: rerender, useEffect, chains, derived-state, batching
---

## Don't Chain Effects via State

Never chain effects that trigger each other through intermediate state updates. Each link causes an extra render pass.

**Incorrect (3 unnecessary re-renders in worst case):**

```tsx
function Game() {
  const [card, setCard] = useState(null)
  const [goldCardCount, setGoldCardCount] = useState(0)
  const [round, setRound] = useState(1)
  const [isGameOver, setIsGameOver] = useState(false)

  useEffect(() => {
    if (card?.gold) setGoldCardCount(c => c + 1)
  }, [card])

  useEffect(() => {
    if (goldCardCount > 3) {
      setRound(r => r + 1)
      setGoldCardCount(0)
    }
  }, [goldCardCount])

  useEffect(() => {
    if (round > 5) setIsGameOver(true)
  }, [round])
}
```

**Correct (derive inline + batch in handler):**

```tsx
function Game() {
  const [card, setCard] = useState(null)
  const [goldCardCount, setGoldCardCount] = useState(0)
  const [round, setRound] = useState(1)

  const isGameOver = round > 5

  function handlePlaceCard(nextCard) {
    if (isGameOver) throw Error('Game already ended.')

    setCard(nextCard)
    if (nextCard.gold) {
      if (goldCardCount < 3) {
        setGoldCardCount(goldCardCount + 1)
      } else {
        setGoldCardCount(0)
        setRound(round + 1)
      }
    }
  }
}
```

React batches all `setState` calls within an event handler into a single render. Move the logic into the handler that caused the change, and derive what you can during render.

Reference: [https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations](https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations)

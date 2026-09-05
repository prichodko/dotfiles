# Interface design

Compare alternatives when a selected refactor has a material tradeoff. Start from the actual callers, required behavior, ordering, failure modes, and dependencies. Use project vocabulary and [LANGUAGE.md](LANGUAGE.md) for useful distinctions.

Develop alternatives that test different priorities, such as a smaller caller contract, extension needs, or the most common operation. Choose the number of alternatives from the decision. Do not invent extra designs or agents to meet a quota.

When delegation is permitted and useful, give each agent a bounded design question and relevant source evidence. Use the available collaboration tools and concurrency limits. Otherwise compare alternatives locally.

For each alternative, show the interface, a representative caller, the complexity it hides, and important tradeoffs. Use [DEEPENING.md](DEEPENING.md) when dependency replacement or test coverage affects the choice.

Recommend the option best supported by the requirements. Ask for a user decision only when an unresolved priority changes that recommendation. A design comparison does not authorize implementation or documentation changes.

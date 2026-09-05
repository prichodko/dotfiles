# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Assumes the vocabulary in [LANGUAGE.md](LANGUAGE.md) — **module**, **interface**, **seam**, **adapter**.

## Dependency categories

When assessing a candidate for deepening, inspect its dependencies. These categories suggest test strategies. Choose from the project's behavior and existing contracts; they do not require new ports, adapters, or test infrastructure.

### 1. In-process

Pure computation, in-memory state, no I/O. Combine related behavior only when this reduces a demonstrated coordination cost. Test the resulting interface directly. An adapter is usually unnecessary.

### 2. Local-substitutable

Dependencies may have local test stand-ins, such as an in-memory filesystem. Use a stand-in when it represents the behavior under test. Use the real dependency or integration checks when its differences matter. Keep test setup internal unless callers need the same contract.

### 3. Remote but owned (Ports & Adapters)

For your own services across a network boundary, consider a port when it separates business behavior from transport details. Preserve existing useful clients and contracts. Test transport behavior through the relevant integration, and use a substitute for isolated logic tests when useful.

### 4. True external (Mock)

For third-party services you do not control, isolate the dependency where it improves ownership and failure handling. Use mocks, local substitutes, or integration checks according to the behavior being tested. Do not add a wrapper only to make mocking possible.

## Seam discipline

- Introduce a port when it isolates a real dependency or protects a useful contract. Do not create extra adapters to justify an abstraction.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them.

## Preserve useful test coverage

- Remove an old test only when replacement coverage proves its useful behavior and failure modes. Preserve distinct coverage.
- Write new tests at the deepened module's interface. The **interface is the test surface**.
- Tests assert on observable outcomes through the interface, not internal state.
- Tests should survive internal refactors — they describe behaviour, not implementation. If a test has to change when the implementation changes, it's testing past the interface.

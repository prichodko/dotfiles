# Architecture concepts

Use the project's domain names and familiar terms such as component, service, API, and boundary. Use the concepts below when they make a distinction clearer.

**Module:** A unit with an interface and an implementation. It can be a function, component, package, or service.

**Interface:** Everything a caller must know, including types, valid states, ordering, configuration, and failure behavior.

**Implementation:** The behavior hidden behind the interface.

**Depth:** How much useful behavior an interface hides from its callers. File length and the number of methods do not establish depth.

**Seam:** A place where an implementation can be replaced without changing its callers.

**Adapter:** An implementation that connects an interface to a concrete dependency.

**Locality:** How closely related behavior, changes, and knowledge are kept together.

An abstraction earns its place when it hides meaningful complexity or protects a useful contract. Multiple implementations can justify an abstraction, but they are not a required count. A stable external boundary can be useful with one implementation.

Use the deletion question as evidence: if the abstraction disappeared, would its complexity spread across callers or disappear? Confirm the answer from actual call sites. Test observable behavior through the relevant interface while preserving useful coverage of distinct failure modes.

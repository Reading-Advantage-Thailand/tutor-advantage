export class RequiresConnectionError extends Error {
  constructor(message = "Requires a connection") {
    super(message)
  }
}

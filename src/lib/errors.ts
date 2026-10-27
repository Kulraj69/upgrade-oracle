export class InputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "InputError";
  }
}
export class UpstreamError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

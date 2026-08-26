/** An error carrying the HTTP status the API should return. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export const badRequest = (message: string): ApiError => new ApiError(400, message);
export const forbidden = (message: string): ApiError => new ApiError(403, message);
export const notFound = (message: string): ApiError => new ApiError(404, message);
export const conflict = (message: string): ApiError => new ApiError(409, message);
export const tooLarge = (message: string): ApiError => new ApiError(413, message);
export const serviceUnavailable = (message: string): ApiError => new ApiError(503, message);

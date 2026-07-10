export class NotFoundError extends Error {
  constructor(entity: string, id: number | string) {
    super(`${entity} ${id} not found`);
  }
}

export class ConflictError extends Error {}

/** Thrown when an OTA push completes but the device never reports the new firmware version. */
export class OtaVerificationError extends Error {}

/** Thrown when required server configuration (env vars) is missing for the requested operation. */
export class ConfigurationError extends Error {}

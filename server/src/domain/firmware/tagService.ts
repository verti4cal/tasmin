import { listTasmotaTags } from "../../infra/firmware/tags.js";

/** Thin wrapper around the tag listing so routes go through domain/ like everything else. */
export class TagService {
  list(): Promise<string[]> {
    return listTasmotaTags();
  }
}
